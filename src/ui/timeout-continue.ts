// =====================================================
// CyberWrap Rewarded Video Continue UI
//
// Phase 18B: Finalize & Polish 6s Video → +15s Continue
//
// Responsibilities:
// - Display the "OUT OF TIME!" landscape-friendly dialog
// - Visually distinguish 6s watched vs 15s earned
// - Clean flow: WATCH VIDEO +15 SEC → Remaining Count → END RUN
// - Enforce daily 3-continue cap (Supabase atomic RPC + local cache)
// - 6-second video player with SPONSORED BREAK countdown + progress bar
// - Authoritative HTML5 video 'ended' detection
// - Satisfying celebratory reward moment before seamless resume
// - Comprehensive double-reward protection & mobile safety
// =====================================================

import * as ecs from "@8thwall/ecs";

import adVideoSrc from "../assets/ad_video.mp4";
import { trackEvent } from "../core/analytics";
import {
  DAILY_CONTINUE_LIMIT,
  getDailyContinueStatus,
  claimDailyContinue,
  type DailyContinueStatus,
} from "../core/rewarded-video";
import {
  resumeGameWithBonusTime,
  triggerGameOverFromTimeout,
} from "../systems/timer-system";
import { showTimeBonusNotice, triggerPickupFlash } from "./hud";
import { playSound } from "../systems/audio-system";

let timeoutPanel: HTMLDivElement | null = null;
let videoOverlay: HTMLDivElement | null = null;
let rewardMomentOverlay: HTMLDivElement | null = null;
let activeVideoElem: HTMLVideoElement | null = null;
let activeWorld: ecs.World | null = null;
let isVideoStarting = false;
let isVideoPlaying = false;

// -----------------------------------------------------
// Styles Injection
// -----------------------------------------------------

function injectTimeoutStyles(): void {
  if (document.getElementById("cw-timeout-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "cw-timeout-styles";
  style.innerHTML = `
    #cw-timeout-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(430px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 24px 22px;
      background: rgba(5, 18, 28, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 240, 255, 0.7);
      border-radius: 18px;
      color: white;
      font-family: "Orbitron", sans-serif;
      text-align: center;
      z-index: 1000002;
      box-shadow: 0 0 30px rgba(0, 240, 255, 0.32), 0 0 70px rgba(0, 240, 255, 0.15), inset 0 0 25px rgba(0, 240, 255, 0.06);
      animation: cwTimeoutIn 0.32s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      -webkit-user-select: none;
    }

    #cw-timeout-dialog::before {
      content: "";
      position: absolute;
      left: -6px;
      right: -6px;
      top: -6px;
      bottom: -6px;
      border: 1px solid rgba(0, 240, 255, 0.22);
      border-radius: 22px;
      pointer-events: none;
    }

    .cw-timeout-title {
      margin: 0 0 10px;
      color: #74ffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 4px;
      text-shadow: 0 0 14px rgba(0, 240, 255, 0.75);
    }

    .cw-timeout-divider {
      width: 65%;
      height: 1px;
      margin: 0 auto 16px;
      background: rgba(0, 240, 255, 0.5);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.45);
    }

    .cw-timeout-desc {
      font-family: "Rajdhani", sans-serif;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.92);
      margin-bottom: 18px;
      letter-spacing: 0.5px;
    }

    .cw-hl-break {
      color: #ffbe3b;
      font-weight: 700;
      text-shadow: 0 0 8px rgba(255, 190, 59, 0.5);
    }

    .cw-hl-reward {
      color: #00f0ff;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-shadow: 0 0 12px rgba(0, 240, 255, 0.7);
    }

    .cw-timeout-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: 100%;
    }

    .cw-timeout-btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      min-height: 52px;
      padding: 12px 20px;
      border: 1px solid #74ffff;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.3) 0%, rgba(0, 140, 255, 0.25) 100%);
      color: #ffffff;
      font-family: "Orbitron", sans-serif;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 2px;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
      transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
      touch-action: manipulation;
    }

    .cw-timeout-btn-primary:hover {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.45) 0%, rgba(0, 170, 255, 0.4) 100%);
      box-shadow: 0 0 28px rgba(0, 240, 255, 0.6);
      transform: translateY(-2px);
    }

    .cw-timeout-btn-primary:active {
      transform: scale(0.97);
      background: rgba(0, 240, 255, 0.55);
    }

    .cw-timeout-remaining-label {
      font-family: "Rajdhani", sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: rgba(116, 255, 255, 0.85);
      margin: 2px 0 6px;
      text-transform: uppercase;
    }

    .cw-timeout-btn-secondary {
      width: 100%;
      min-height: 44px;
      padding: 10px 16px;
      border: 1px solid rgba(255, 255, 255, 0.32);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      font-family: "Orbitron", sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      touch-action: manipulation;
    }

    .cw-timeout-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.65);
      color: #ffffff;
    }

    .cw-timeout-btn-secondary:active {
      transform: scale(0.97);
    }

    .cw-timeout-btn-secondary.cw-end-primary {
      border-color: rgba(0, 240, 255, 0.7);
      color: #74ffff;
      background: rgba(0, 240, 255, 0.12);
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.25);
    }

    .cw-timeout-badge.limit-reached {
      display: inline-block;
      margin-bottom: 16px;
      padding: 6px 14px;
      background: rgba(255, 70, 70, 0.16);
      border: 1px solid rgba(255, 70, 70, 0.55);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #ff8888;
    }

    /* =====================================================
       FULL-SCREEN REWARDED VIDEO OVERLAY
    ===================================================== */
    #cw-video-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: #000000;
      z-index: 1000006;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    #cw-video-header {
      position: absolute;
      top: env(safe-area-inset-top, 14px);
      left: env(safe-area-inset-left, 16px);
      right: env(safe-area-inset-right, 16px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 10;
      pointer-events: auto;
    }

    .cw-video-badge-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .cw-video-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(5, 18, 28, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 240, 255, 0.6);
      border-radius: 20px;
      color: #74ffff;
      font-family: "Orbitron", sans-serif;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.5px;
    }

    .cw-video-countdown {
      color: #ffbe3b;
      font-weight: 900;
      text-shadow: 0 0 10px rgba(255, 190, 59, 0.6);
      min-width: 20px;
    }

    .cw-video-reward-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(0, 240, 255, 0.14);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 240, 255, 0.4);
      border-radius: 20px;
      color: #ffffff;
      font-family: "Orbitron", sans-serif;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.2px;
    }

    .cw-video-cancel-btn {
      padding: 7px 16px;
      background: rgba(18, 18, 20, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 20px;
      color: rgba(255, 255, 255, 0.9);
      font-family: "Orbitron", sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      cursor: pointer;
      touch-action: manipulation;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .cw-video-cancel-btn:hover {
      background: rgba(255, 50, 50, 0.45);
      border-color: rgba(255, 80, 80, 0.8);
      color: white;
    }

    #cw-video-element {
      width: 100%;
      height: 100%;
      max-width: 100vw;
      max-height: 100vh;
      object-fit: contain;
      background: black;
    }

    #cw-video-progress-bar {
      position: absolute;
      bottom: env(safe-area-inset-bottom, 8px);
      left: 0;
      width: 0%;
      height: 4px;
      background: #00f0ff;
      box-shadow: 0 0 12px #00f0ff;
      transition: width 0.08s linear;
      z-index: 10;
    }

    /* =====================================================
       SATISFYING REWARD MOMENT OVERLAY
    ===================================================== */
    #cw-reward-moment-card {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      padding: 24px 34px;
      background: rgba(5, 18, 28, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 2px solid #00f0ff;
      border-radius: 20px;
      text-align: center;
      z-index: 1000008;
      box-shadow: 0 0 45px rgba(0, 240, 255, 0.5), inset 0 0 20px rgba(0, 240, 255, 0.15);
      animation: cwRewardPop 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .cw-reward-moment-title {
      font-family: "Orbitron", sans-serif;
      font-size: clamp(28px, 6vw, 44px);
      font-weight: 900;
      color: #00f0ff;
      letter-spacing: 3px;
      text-shadow: 0 0 20px #00f0ff, 0 0 40px rgba(0, 240, 255, 0.7);
      margin-bottom: 6px;
    }

    .cw-reward-moment-sub {
      font-family: "Rajdhani", sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: rgba(255, 255, 255, 0.9);
      text-transform: uppercase;
    }

    @keyframes cwTimeoutIn {
      0% {
        opacity: 0;
        transform: translate(-50%, -46%) scale(0.92);
      }
      100% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes cwRewardPop {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.75);
      }
      25% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.05);
      }
      80% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -55%) scale(0.95);
      }
    }

    /* Landscape mobile adaptations */
    @media (max-height: 480px) {
      #cw-timeout-dialog {
        padding: 16px 20px;
        max-height: calc(100dvh - 16px);
      }
      .cw-timeout-title {
        font-size: 20px;
        margin-bottom: 6px;
        letter-spacing: 3px;
      }
      .cw-timeout-divider {
        margin-bottom: 10px;
      }
      .cw-timeout-desc {
        font-size: 14px;
        margin-bottom: 10px;
        line-height: 1.35;
      }
      .cw-timeout-btn-primary {
        min-height: 42px;
        padding: 8px 14px;
        font-size: 13px;
      }
      .cw-timeout-remaining-label {
        font-size: 11px;
        margin: 1px 0 4px;
      }
      .cw-timeout-btn-secondary {
        min-height: 38px;
        padding: 6px 12px;
        font-size: 12px;
      }
      .cw-video-reward-badge {
        display: none; /* Hide center badge on ultra-short landscape to avoid crowding header */
      }
    }
  `;

  document.head.appendChild(style);
}

// -----------------------------------------------------
// Show Timeout Continue Overlay
// -----------------------------------------------------

export async function showTimeoutContinue(world: ecs.World): Promise<void> {
  activeWorld = world;

  // Clean up any existing instance
  hideTimeoutContinue();

  injectTimeoutStyles();

  // Query daily continue status
  const status: DailyContinueStatus = await getDailyContinueStatus();

  // Analytics event: offer shown
  trackEvent("rewarded_video_offer_shown", {
    remaining: status.remaining,
    dailyCount: status.dailyCount,
    dailyLimit: status.dailyLimit,
    canClaim: status.canClaim,
  });

  if (!status.canClaim) {
    trackEvent("rewarded_video_daily_limit_reached", {
      dailyCount: status.dailyCount,
      dailyLimit: status.dailyLimit,
    });
  }

  renderTimeoutUI(status);
}

// -----------------------------------------------------
// Render Timeout UI Box
// -----------------------------------------------------

function renderTimeoutUI(
  status: DailyContinueStatus,
  errorMessage: string | null = null,
): void {
  if (timeoutPanel) {
    timeoutPanel.remove();
    timeoutPanel = null;
  }

  timeoutPanel = document.createElement("div");
  timeoutPanel.id = "cw-timeout-dialog";

  const hasContinuesLeft = status.remaining > 0;

  let bodyHtml = "";

  if (errorMessage) {
    bodyHtml = `
      <div class="cw-timeout-desc" style="color: #ff9999;">${errorMessage}</div>
      <div class="cw-timeout-badge limit-reached">VIDEO PLAYBACK ERROR</div>
      <div class="cw-timeout-actions">
        <button id="cw-btn-try-again" type="button" class="cw-timeout-btn-primary">
          🔄 TRY AGAIN
        </button>
        <button id="cw-btn-end-run" type="button" class="cw-timeout-btn-secondary">
          END RUN
        </button>
      </div>
    `;
  } else if (hasContinuesLeft) {
    bodyHtml = `
      <div class="cw-timeout-desc">
        Watch a quick <span class="cw-hl-break">6s sponsored break</span><br>
        to grab <span class="cw-hl-reward">+15 seconds</span> and keep your run alive?
      </div>
      <div class="cw-timeout-actions">
        <button id="cw-btn-watch-video" type="button" class="cw-timeout-btn-primary">
          <span>▶</span> WATCH VIDEO +15 SEC
        </button>
        <div class="cw-timeout-remaining-label">
          Unlimited continues available
        </div>
        <button id="cw-btn-end-run" type="button" class="cw-timeout-btn-secondary">
          END RUN
        </button>
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="cw-timeout-desc">
        You've used all 3 sponsored continues for today.
      </div>
      <div class="cw-timeout-badge limit-reached">
        DAILY LIMIT REACHED (3/3)
      </div>
      <div class="cw-timeout-actions">
        <button id="cw-btn-end-run" type="button" class="cw-timeout-btn-secondary cw-end-primary">
          END RUN
        </button>
      </div>
    `;
  }

  timeoutPanel.innerHTML = `
    <div class="cw-timeout-title">OUT OF TIME!</div>
    <div class="cw-timeout-divider"></div>
    ${bodyHtml}
  `;

  document.body.appendChild(timeoutPanel);

  // Attach button event handlers with double-click guard
  const watchBtn = document.getElementById("cw-btn-watch-video") as HTMLButtonElement | null;
  if (watchBtn) {
    watchBtn.addEventListener("click", () => {
      if (isVideoStarting || isVideoPlaying) return;
      watchBtn.disabled = true;
      watchBtn.style.opacity = "0.6";
      watchBtn.style.pointerEvents = "none";
      startRewardedBreak(status);
    });
  }

  const tryAgainBtn = document.getElementById("cw-btn-try-again") as HTMLButtonElement | null;
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener("click", () => {
      if (isVideoStarting || isVideoPlaying) return;
      tryAgainBtn.disabled = true;
      tryAgainBtn.style.opacity = "0.6";
      tryAgainBtn.style.pointerEvents = "none";
      startRewardedBreak(status);
    });
  }

  const endRunBtn = document.getElementById("cw-btn-end-run");
  if (endRunBtn) {
    endRunBtn.addEventListener("click", () => {
      handleEndRun();
    });
  }
}

// -----------------------------------------------------
// Start Rewarded Video Break
// -----------------------------------------------------

function startRewardedBreak(status: DailyContinueStatus): void {
  isVideoStarting = true;

  // Hide timeout panel while video is playing
  if (timeoutPanel) {
    timeoutPanel.style.display = "none";
  }

  trackEvent("rewarded_video_started", {
    remaining: status.remaining,
    dailyCount: status.dailyCount,
  });

  isVideoPlaying = true;
  let rewardClaimed = false;

  // Build full-screen video overlay
  videoOverlay = document.createElement("div");
  videoOverlay.id = "cw-video-overlay";

  videoOverlay.innerHTML = `
    <div id="cw-video-header">
      <div class="cw-video-badge-group">
        <div class="cw-video-badge">
          <span>🎬</span>
          <span>SPONSORED BREAK</span>
          <span id="cw-video-timer-label" class="cw-video-countdown">6s</span>
        </div>
        <div class="cw-video-reward-badge">
          WATCH TO EARN <span class="cw-hl-reward">+15 SECONDS</span>
        </div>
      </div>
      <button id="cw-video-cancel-btn" type="button" class="cw-video-cancel-btn">
        ✕ CANCEL
      </button>
    </div>
    <video
      id="cw-video-element"
      src="${adVideoSrc}"
      playsinline
      webkit-playsinline
      disablepictureinpicture
      preload="auto"
    ></video>
    <div id="cw-video-progress-bar"></div>
  `;

  document.body.appendChild(videoOverlay);

  const video = document.getElementById("cw-video-element") as HTMLVideoElement | null;
  const timerLabel = document.getElementById("cw-video-timer-label");
  const progressBar = document.getElementById("cw-video-progress-bar");
  const cancelBtn = document.getElementById("cw-video-cancel-btn");

  if (!video) {
    isVideoStarting = false;
    handleVideoFailure("Video element could not be created", status);
    return;
  }

  activeVideoElem = video;
  video.playsInline = true;

  // Cancel handler: player exits without receiving reward
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (rewardClaimed) return;

      trackEvent("rewarded_video_cancelled", {
        progressTime: video.currentTime,
        duration: video.duration,
      });

      cleanupVideoOverlay();
      isVideoStarting = false;

      // Re-render the timeout panel with current status
      renderTimeoutUI(status);
    });
  }

  // Live progress bar and countdown update
  video.addEventListener("timeupdate", () => {
    if (!video.duration || isNaN(video.duration)) {
      return;
    }

    const remainingSec = Math.max(0, Math.ceil(video.duration - video.currentTime));
    if (timerLabel) {
      timerLabel.textContent = `${remainingSec}s`;
    }

    if (progressBar) {
      const pct = Math.min(100, (video.currentTime / video.duration) * 100);
      progressBar.style.width = `${pct}%`;
    }
  });

  // Video Error handler
  video.addEventListener("error", (e) => {
    if (rewardClaimed) return;
    console.warn("[RewardedVideo] Video playback error encountered:", e);
    trackEvent("rewarded_video_failed", {
      error: video.error ? video.error.message || `Code ${video.error.code}` : "unknown_video_error",
    });

    isVideoStarting = false;
    handleVideoFailure("Sponsored video couldn't be played. Try again or end your run.", status);
  });

  // Video Ended (Full 6s Completion Guaranteed by HTML5 event)
  video.addEventListener(
    "ended",
    async () => {
      if (rewardClaimed) {
        return;
      }
      rewardClaimed = true;

      trackEvent("rewarded_video_completed", {
        videoDuration: video.duration,
      });

      // Execute atomic claim on Supabase / local cache
      const prevCount = status.dailyCount;
      const claimResult = await claimDailyContinue();

      if (claimResult.success) {
        // Analytics: reward granted exactly once upon verified server claim
        trackEvent("rewarded_video_reward_granted", {
          reward_type: "continue_15_seconds",
          reward_seconds: 15,
          daily_redemptions_before: prevCount,
          daily_redemptions_after: claimResult.dailyCount,
        });

        // Clean up video overlay
        cleanupVideoOverlay();

        // Show satisfying reward moment before resuming gameplay
        showRewardMoment(claimResult.remaining, () => {
          hideTimeoutContinue();

          // Resume gameplay with +15 seconds
          resumeGameWithBonusTime(15);

          // Audio and visual juice
          triggerPickupFlash();
          showTimeBonusNotice("+15 SECONDS!");
          playSound("delivery");
        });
      } else {
        // Daily limit was reached concurrently
        trackEvent("rewarded_video_daily_limit_reached", {
          dailyCount: claimResult.dailyCount,
        });

        cleanupVideoOverlay();
        isVideoStarting = false;

        renderTimeoutUI(
          {
            dailyCount: claimResult.dailyCount,
            dailyLimit: DAILY_CONTINUE_LIMIT,
            remaining: 0,
            canClaim: false,
            date: status.date,
          },
          "Daily sponsored continue limit reached.",
        );
      }
    },
    { once: true },
  );

  // Attempt to play with audio first (user gesture from button tap)
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isVideoStarting = false;
      })
      .catch((err) => {
        console.warn("[RewardedVideo] Unmuted playback blocked, falling back to muted playback:", err);
        video.muted = true;
        video
          .play()
          .then(() => {
            isVideoStarting = false;
          })
          .catch((err2) => {
            console.error("[RewardedVideo] Muted playback also failed:", err2);
            isVideoStarting = false;
            handleVideoFailure(
              "Sponsored video playback was blocked by browser. Try again or end your run.",
              status,
            );
          });
      });
  } else {
    isVideoStarting = false;
  }
}

// -----------------------------------------------------
// Show Satisfying Reward Moment Card
// -----------------------------------------------------

function showRewardMoment(remainingContinues: number, onComplete: () => void): void {
  if (rewardMomentOverlay) {
    rewardMomentOverlay.remove();
    rewardMomentOverlay = null;
  }

  rewardMomentOverlay = document.createElement("div");
  rewardMomentOverlay.id = "cw-reward-moment-card";

  const subText = "Sponsored continue granted! Keep delivering!";

  rewardMomentOverlay.innerHTML = `
    <div class="cw-reward-moment-title">+15 SECONDS!</div>
    <div class="cw-reward-moment-sub">${subText}</div>
  `;

  document.body.appendChild(rewardMomentOverlay);

  // Show celebratory card for 850ms, then trigger resume
  window.setTimeout(() => {
    if (rewardMomentOverlay) {
      rewardMomentOverlay.remove();
      rewardMomentOverlay = null;
    }
    onComplete();
  }, 850);
}

// -----------------------------------------------------
// Handle Video Failure
// -----------------------------------------------------

function handleVideoFailure(errorMessage: string, status: DailyContinueStatus): void {
  cleanupVideoOverlay();
  renderTimeoutUI(status, errorMessage);
}

// -----------------------------------------------------
// Cleanup Video Overlay
// -----------------------------------------------------

function cleanupVideoOverlay(): void {
  if (activeVideoElem) {
    try {
      activeVideoElem.pause();
      activeVideoElem.removeAttribute("src");
      activeVideoElem.load();
    } catch {
      // ignore
    }
    activeVideoElem = null;
  }

  if (videoOverlay) {
    videoOverlay.remove();
    videoOverlay = null;
  }

  isVideoPlaying = false;
  isVideoStarting = false;
}

// -----------------------------------------------------
// Handle End Run (Standard Game Over Sequence)
// -----------------------------------------------------

function handleEndRun(): void {
  hideTimeoutContinue();

  if (activeWorld) {
    triggerGameOverFromTimeout(activeWorld);
  }
}

// -----------------------------------------------------
// Hide All Timeout Continue UI
// -----------------------------------------------------

export function hideTimeoutContinue(): void {
  cleanupVideoOverlay();

  if (rewardMomentOverlay) {
    rewardMomentOverlay.remove();
    rewardMomentOverlay = null;
  }

  if (timeoutPanel) {
    timeoutPanel.remove();
    timeoutPanel = null;
  }
}

// Clean up on beforeunload
window.addEventListener("beforeunload", () => {
  hideTimeoutContinue();
});
