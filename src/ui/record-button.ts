import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { trackEvent } from "../core/analytics";
import { getMusicRecordingStream } from "../systems/audio-system";

// ==================================================
// CYBERWRAP SOCIAL RECORDER
//
// FINAL BEHAVIOR
//
// RECORD pressed
//      ↓
// 3-second information notice
//      ↓
// Record NEXT 10 seconds of gameplay
//      ↓
// Pause recorder
//      ↓
// Game continues normally
//      ↓
// GAMEOVER
//      ↓
// Capture final score
//      ↓
// Resume same recorder
//      ↓
// Record 2-second score card
//      ↓
// Stop recorder
//      ↓
// Share / download
//
// If fewer than 10 seconds remain:
//
// RECORD
//      ↓
// Record remaining gameplay
//      ↓
// GAMEOVER
//      ↓
// 2-second score card
//      ↓
// Share / download
//
// The game NEVER pauses.
// ==================================================

// ==================================================
// CONFIGURATION
// ==================================================

const GAMEPLAY_RECORD_SECONDS = 10;

const SCORE_CARD_SECONDS = 2;

const RECORDING_FPS = 30;

const CHUNK_INTERVAL = 500;

const NOTICE_DURATION = 3000;

const VIDEO_FILENAME_BASE = "dailybread-cyberwrap-run";

// ==================================================
// RECORDER STATE
// ==================================================

let recorder: MediaRecorder | null = null;

let recordingStream: MediaStream | null = null;

let recordingCanvas: HTMLCanvasElement | null = null;

let recordingContext: CanvasRenderingContext2D | null = null;

let sourceCanvas: HTMLCanvasElement | null = null;

let recordingChunks: Blob[] = [];

let renderFrame: number | null = null;

let gameplayTimer: number | null = null;

let gameOverMonitorTimer: number | null = null;

let scoreCardTimer: number | null = null;

let recordingActive = false;

let gameplayRecordingFinished = false;

let waitingForGameOver = false;

let scoreCardRecording = false;

let recordingStartedAt = 0;

let gameplayDuration = 0;

// ==================================================
// NOTIFICATION
// ==================================================

let noticeElement: HTMLDivElement | null = null;

let noticeTimer: number | null = null;

// ==================================================
// RECORDING HUD
// ==================================================

let recordingHUD: HTMLDivElement | null = null;

let recordingTimeElement: HTMLSpanElement | null = null;

// ==================================================
// RECORD REQUEST
// ==================================================

function handleRecordRequest(): void {
  if (recordingActive) {
    return;
  }

  if (gameData.state !== GameState.DRIVING) {
    return;
  }

  // ------------------------------------------------
  // HARD RECORDING CUTOFF
  //
  // Do not allow recording during the final 8 seconds.
  // ------------------------------------------------

  if (gameData.timeLeft < 8) {
    return;
  }

  // ------------------------------------------------
  // Show information notice first.
  // Recording begins after the 3-second notice.
  // ------------------------------------------------

  showRecordingNotice();

  window.setTimeout(() => {
    // Game may have changed during the notice.
    if (gameData.state !== GameState.DRIVING) {
      return;
    }

    // Re-check the cutoff.
    if (gameData.timeLeft < 8) {
      return;
    }

    beginRecording();
  }, NOTICE_DURATION);
}

// ==================================================
// LISTENER
// ==================================================

function setupRecordingListener(): void {
  window.removeEventListener("cyberwrap-record", handleRecordRequest);

  window.addEventListener("cyberwrap-record", handleRecordRequest);
}

// ==================================================
// NOTICE STYLES
// ==================================================

function createRecordingNotice(): void {
  if (noticeElement) {
    return;
  }

  const styleId = "cyberwrap-recording-notice-styles";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");

    style.id = styleId;

    style.textContent = `
      #cyberwrap-recording-notice {

        position: fixed;

        left: 50%;

        bottom:
          max(
            105px,
            calc(105px + env(safe-area-inset-bottom))
          );

        transform:
          translateX(-50%)
          translateY(12px);

        width:
          min(330px, calc(100vw - 36px));

        box-sizing:
          border-box;

        padding:
          13px 18px;

        border:
          1px solid
          rgba(0,255,255,.45);

        border-radius:
          14px;

        background:
          rgba(5,18,28,.92);

        backdrop-filter:
          blur(12px);

        -webkit-backdrop-filter:
          blur(12px);

        color:
          #74ffff;

        font-family:
          Arial,
          sans-serif;

        font-size:
          12px;

        font-weight:
          800;

        letter-spacing:
          1.4px;

        text-align:
          center;

        line-height:
          1.4;

        z-index:
          2100000;

        pointer-events:
          none;

        opacity:
          0;

        transition:
          opacity .25s ease,
          transform .25s ease;

        box-shadow:
          0 0 18px
          rgba(0,255,255,.16);
      }

      #cyberwrap-recording-notice.cw-recording-notice-visible {

        opacity:
          1;

        transform:
          translateX(-50%)
          translateY(0);
      }

      .cw-recording-notice-small {

        display:
          block;

        margin-top:
          5px;

        color:
          rgba(255,255,255,.65);

        font-size:
          9px;

        letter-spacing:
          1px;

        font-weight:
          600;
      }

      @media (max-width:600px) {

        #cyberwrap-recording-notice {

          bottom:
            max(
              100px,
              calc(100px + env(safe-area-inset-bottom))
            );

          font-size:
            11px;

          padding:
            12px 15px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  noticeElement = document.createElement("div");

  noticeElement.id = "cyberwrap-recording-notice";

  noticeElement.innerHTML = `
    ONLY 10 SECONDS WILL BE RECORDED

    <span class="cw-recording-notice-small">
      Your final score will be added after the game
    </span>
  `;

  document.body.appendChild(noticeElement);
}

// ==================================================
// SHOW NOTICE
// ==================================================

function showRecordingNotice(): void {
  createRecordingNotice();

  if (!noticeElement) {
    return;
  }

  if (noticeTimer !== null) {
    clearTimeout(noticeTimer);

    noticeTimer = null;
  }

  noticeElement.classList.remove("cw-recording-notice-visible");

  requestAnimationFrame(() => {
    noticeElement?.classList.add("cw-recording-notice-visible");
  });

  noticeTimer = window.setTimeout(() => {
    noticeElement?.classList.remove("cw-recording-notice-visible");

    noticeTimer = null;
  }, NOTICE_DURATION);
}

// ==================================================
// HUD
// ==================================================

function createRecordingHUD(): void {
  if (recordingHUD) {
    return;
  }

  const styleId = "cyberwrap-recording-hud-styles";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");

    style.id = styleId;

    style.textContent = `
      #cyberwrap-recording-hud {

        position: fixed;

        top:
          max(
            14px,
            env(safe-area-inset-top)
          );

        left: 50%;

        transform:
          translateX(-50%)
          translateY(-10px);

        display:
          flex;

        align-items:
          center;

        gap:
          9px;

        padding:
          8px 14px;

        border:
          1px solid
          rgba(255,70,70,.45);

        border-radius:
          999px;

        background:
          rgba(8,8,12,.88);

        box-shadow:
          0 0 18px
          rgba(255,50,50,.18);

        backdrop-filter:
          blur(10px);

        -webkit-backdrop-filter:
          blur(10px);

        color:
          white;

        font-family:
          Arial,
          sans-serif;

        font-size:
          12px;

        font-weight:
          800;

        letter-spacing:
          1px;

        z-index:
          2000000;

        pointer-events:
          none;

        opacity:
          0;

        transition:
          opacity .2s ease,
          transform .2s ease;
      }

      #cyberwrap-recording-hud.cw-recording-visible {

        opacity:
          1;

        transform:
          translateX(-50%)
          translateY(0);
      }

      #cyberwrap-recording-dot {

        width:
          9px;

        height:
          9px;

        border-radius:
          50%;

        background:
          #ff3b3b;

        box-shadow:
          0 0 8px
          rgba(255,60,60,.9);

        animation:
          cyberwrap-recording-pulse
          1s ease-in-out infinite;
      }

      #cyberwrap-recording-time {

        min-width:
          22px;

        text-align:
          center;

        color:
          #ff7070;
      }

      @keyframes cyberwrap-recording-pulse {

        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }

        50% {
          opacity: .35;
          transform: scale(.72);
        }
      }
    `;

    document.head.appendChild(style);
  }

  recordingHUD = document.createElement("div");

  recordingHUD.id = "cyberwrap-recording-hud";

  recordingHUD.innerHTML = `
    <span id="cyberwrap-recording-dot"></span>

    <span>
      REC
    </span>

    <span id="cyberwrap-recording-time">
      10
    </span>
  `;

  document.body.appendChild(recordingHUD);

  recordingTimeElement = recordingHUD.querySelector(
    "#cyberwrap-recording-time",
  ) as HTMLSpanElement | null;
}

// ==================================================
// SHOW HUD
// ==================================================

function showRecordingHUD(seconds: number): void {
  createRecordingHUD();

  if (!recordingHUD) {
    return;
  }

  if (recordingTimeElement) {
    recordingTimeElement.textContent = Math.max(
      0,
      Math.ceil(seconds),
    ).toString();
  }

  requestAnimationFrame(() => {
    recordingHUD?.classList.add("cw-recording-visible");
  });
}

// ==================================================
// UPDATE HUD
// ==================================================

function updateRecordingHUD(seconds: number): void {
  if (!recordingTimeElement) {
    return;
  }

  recordingTimeElement.textContent = Math.max(0, Math.ceil(seconds)).toString();
}

// ==================================================
// HIDE HUD
// ==================================================

function hideRecordingHUD(): void {
  recordingHUD?.classList.remove("cw-recording-visible");
}

// ==================================================
// FIND SOURCE CANVAS
// ==================================================

function findSourceCanvas(): HTMLCanvasElement | null {
  const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;

  if (!canvas) {
    return null;
  }

  if (canvas.width <= 0 || canvas.height <= 0) {
    return null;
  }

  return canvas;
}

// ==================================================
// MIME TYPE
// ==================================================

function getSupportedMimeType(): string | null {
  const types = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function getRecordingFilename(mimeType: string): string {
  return `${VIDEO_FILENAME_BASE}.${mimeType.startsWith("video/mp4") ? "mp4" : "webm"}`;
}

// ==================================================
// CREATE RECORDING CANVAS
// ==================================================

function createRecordingCanvas(): boolean {
  sourceCanvas = findSourceCanvas();

  if (!sourceCanvas) {
    console.warn("[CyberWrap Recorder] Source canvas unavailable.");

    return false;
  }

  recordingCanvas = document.createElement("canvas");

  recordingCanvas.width = sourceCanvas.width;

  recordingCanvas.height = sourceCanvas.height;

  recordingCanvas.style.display = "none";

  document.body.appendChild(recordingCanvas);

  recordingContext = recordingCanvas.getContext("2d");

  if (!recordingContext) {
    cleanupRecording();

    return false;
  }

  return true;
}

// ==================================================
// DRAW GAMEPLAY FRAME
// ==================================================

function drawGameplayFrame(): void {
  if (!recordingCanvas || !recordingContext || !sourceCanvas || !recorder) {
    return;
  }

  if (recorder.state !== "recording") {
    return;
  }

  const width = recordingCanvas.width;

  const height = recordingCanvas.height;

  recordingContext.clearRect(0, 0, width, height);

  recordingContext.drawImage(sourceCanvas, 0, 0, width, height);

  drawWatermark(recordingContext, width, height);

  renderFrame = requestAnimationFrame(drawGameplayFrame);
}

// ==================================================
// DRAW WATERMARK
// ==================================================

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const mainText = "DailyBread Shawarma — CyberWrap";

  const secondaryText = "powered by GT Graphix & XR";

  const fontSize = Math.max(15, Math.round(width * 0.022));

  const secondaryFontSize = Math.max(10, Math.round(fontSize * 0.58));

  const padding = Math.max(12, Math.round(width * 0.022));

  ctx.textAlign = "right";

  ctx.textBaseline = "bottom";

  ctx.font = `700 ${fontSize}px Arial, sans-serif`;

  const mainWidth = ctx.measureText(mainText).width;

  ctx.font = `600 ${secondaryFontSize}px Arial, sans-serif`;

  const secondaryWidth = ctx.measureText(secondaryText).width;

  const contentWidth = Math.max(mainWidth, secondaryWidth);

  const boxPaddingX = fontSize * 0.65;

  const boxPaddingY = fontSize * 0.5;

  const lineGap = fontSize * 0.18;

  const boxWidth = contentWidth + boxPaddingX * 2;

  const boxHeight = fontSize + secondaryFontSize + lineGap + boxPaddingY * 2;

  const x = width - padding;

  const y = height - padding;

  ctx.fillStyle = "rgba(0,0,0,.62)";

  ctx.beginPath();

  ctx.roundRect(
    x - boxWidth,
    y - boxHeight,
    boxWidth,
    boxHeight,
    fontSize * 0.35,
  );

  ctx.fill();

  ctx.font = `700 ${fontSize}px Arial, sans-serif`;

  ctx.fillStyle = "rgba(255,255,255,.95)";

  ctx.fillText(
    mainText,
    x - boxPaddingX,
    y - boxPaddingY - secondaryFontSize - lineGap,
  );

  ctx.font = `600 ${secondaryFontSize}px Arial, sans-serif`;

  ctx.fillStyle = "rgba(116,255,255,.92)";

  ctx.fillText(secondaryText, x - boxPaddingX, y - boxPaddingY);
}

// ==================================================
// DRAW SCORE CARD
// ==================================================

function drawScoreCard(): void {
  if (!recordingCanvas || !recordingContext) {
    return;
  }

  const width = recordingCanvas.width;

  const height = recordingCanvas.height;

  const ctx = recordingContext;

  ctx.clearRect(0, 0, width, height);

  // -----------------------------------------------
  // Background
  // -----------------------------------------------

  ctx.fillStyle = "rgba(5,18,28,1)";

  ctx.fillRect(0, 0, width, height);

  // -----------------------------------------------
  // Cyan glow
  // -----------------------------------------------

  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7,
  );

  gradient.addColorStop(0, "rgba(0,255,255,.18)");

  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;

  ctx.fillRect(0, 0, width, height);

  // -----------------------------------------------
  // TIME UP
  // -----------------------------------------------

  ctx.textAlign = "center";

  ctx.textBaseline = "middle";

  ctx.font = `800 ${Math.max(
    30,
    Math.round(width * 0.065),
  )}px Arial, sans-serif`;

  ctx.fillStyle = "#74ffff";

  ctx.shadowColor = "rgba(0,255,255,.8)";

  ctx.shadowBlur = 22;

  ctx.fillText("TIME UP!", width / 2, height * 0.25);

  // -----------------------------------------------
  // FINAL SCORE
  // -----------------------------------------------

  ctx.shadowBlur = 35;

  ctx.font = `900 ${Math.max(
    65,
    Math.round(width * 0.14),
  )}px Arial, sans-serif`;

  ctx.fillStyle = "#ffffff";

  ctx.fillText(gameData.score.toString(), width / 2, height * 0.5);

  // -----------------------------------------------
  // LABEL
  // -----------------------------------------------

  ctx.shadowBlur = 12;

  ctx.font = `700 ${Math.max(
    16,
    Math.round(width * 0.032),
  )}px Arial, sans-serif`;

  ctx.fillStyle = "#74ffff";

  ctx.fillText("FINAL SCORE", width / 2, height * 0.66);

  // -----------------------------------------------
  // BRAND
  // -----------------------------------------------

  ctx.shadowBlur = 0;

  ctx.font = `700 ${Math.max(
    14,
    Math.round(width * 0.026),
  )}px Arial, sans-serif`;

  ctx.fillStyle = "rgba(255,255,255,.95)";

  ctx.fillText("DailyBread Shawarma — CyberWrap", width / 2, height * 0.82);

  ctx.font = `600 ${Math.max(
    10,
    Math.round(width * 0.018),
  )}px Arial, sans-serif`;

  ctx.fillStyle = "rgba(116,255,255,.9)";

  ctx.fillText("powered by GT Graphix & XR", width / 2, height * 0.88);
}

// ==================================================
// BEGIN RECORDING
// ==================================================

function beginRecording(): void {
  if (recordingActive) {
    return;
  }

  trackEvent("recording_requested");

  if (!createRecordingCanvas()) {
    return;
  }

  const mimeType = getSupportedMimeType();

  if (!mimeType) {
    console.warn("[CyberWrap Recorder] No supported video format.");

    cleanupRecording();

    return;
  }

  // -----------------------------------------------
  // Canvas stream
  // -----------------------------------------------

  let videoStream: MediaStream;

  try {
    videoStream = recordingCanvas!.captureStream(RECORDING_FPS);
  } catch (error) {
    console.warn("[CyberWrap Recorder] captureStream failed.", error);

    cleanupRecording();

    return;
  }

  // -----------------------------------------------
  // Background music
  // -----------------------------------------------

  const musicStream = getMusicRecordingStream();

  if (musicStream) {
    musicStream.getAudioTracks().forEach((track) => {
      videoStream.addTrack(track);
    });
  }

  recordingStream = videoStream;

  recordingChunks = [];

  // -----------------------------------------------
  // Create MediaRecorder
  // -----------------------------------------------

  try {
    recorder = new MediaRecorder(recordingStream, {
      mimeType,

      videoBitsPerSecond: 2_500_000,

      audioBitsPerSecond: 96_000,
    });
  } catch (error) {
    console.warn("[CyberWrap Recorder] MediaRecorder creation failed.", error);

    cleanupRecording();

    return;
  }

  // -----------------------------------------------
  // Data
  // -----------------------------------------------

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordingChunks.push(event.data);
    }
  };

  // -----------------------------------------------
  // Error
  // -----------------------------------------------

  recorder.onerror = (event) => {
    console.warn("[CyberWrap Recorder] Recording error.", event);
  };

  // -----------------------------------------------
  // Stop
  // -----------------------------------------------

  recorder.onstop = () => {
    void finalizeRecording(mimeType);
  };

  // -----------------------------------------------
  // Start
  // -----------------------------------------------

  try {
    recorder.start(CHUNK_INTERVAL);
  } catch (error) {
    console.warn("[CyberWrap Recorder] Failed to start.", error);

    cleanupRecording();

    return;
  }

  recordingActive = true;

  gameplayRecordingFinished = false;

  waitingForGameOver = false;

  scoreCardRecording = false;

  recordingStartedAt = performance.now();

  gameplayDuration = 0;

  showRecordingHUD(GAMEPLAY_RECORD_SECONDS);

  drawGameplayFrame();

  // -----------------------------------------------
  // Check how much game time remains.
  // -----------------------------------------------

  const timeRemaining = Math.max(0, gameData.timeLeft);

  const gameplaySeconds = Math.min(GAMEPLAY_RECORD_SECONDS, timeRemaining);

  gameplayDuration = gameplaySeconds;

  gameplayTimer = window.setTimeout(
    finishGameplayCapture,
    gameplaySeconds * 1000,
  );

  console.log(
    `[CyberWrap Recorder] Recording started for ${gameplaySeconds}s.`,
  );
}

// ==================================================
// FINISH GAMEPLAY CAPTURE
// ==================================================

function finishGameplayCapture(): void {
  if (!recordingActive || gameplayRecordingFinished || !recorder) {
    return;
  }

  gameplayRecordingFinished = true;

  if (gameplayTimer !== null) {
    clearTimeout(gameplayTimer);

    gameplayTimer = null;
  }

  // -----------------------------------------------
  // Stop gameplay frame rendering.
  // -----------------------------------------------

  if (renderFrame !== null) {
    cancelAnimationFrame(renderFrame);

    renderFrame = null;
  }

  // -----------------------------------------------
  // If game already ended,
  // immediately create score card.
  // -----------------------------------------------

  if (gameData.state === GameState.GAMEOVER || gameData.timeLeft <= 0) {
    beginScoreCardRecording();

    return;
  }

  // -----------------------------------------------
  // Pause SAME MediaRecorder.
  //
  // The recording remains alive.
  // The game continues normally.
  // -----------------------------------------------

  try {
    if (recorder.state === "recording") {
      recorder.pause();
    }
  } catch (error) {
    console.warn("[CyberWrap Recorder] Unable to pause recorder.", error);
  }

  waitingForGameOver = true;

  hideRecordingHUD();

  console.log(
    "[CyberWrap Recorder] Gameplay captured. Waiting for final score.",
  );

  monitorGameOver();
}

// ==================================================
// MONITOR GAME OVER
// ==================================================

function monitorGameOver(): void {
  if (!recordingActive || !waitingForGameOver) {
    return;
  }

  if (gameData.state === GameState.GAMEOVER || gameData.timeLeft <= 0) {
    waitingForGameOver = false;

    beginScoreCardRecording();

    return;
  }

  gameOverMonitorTimer = window.setTimeout(monitorGameOver, 100);
}

// ==================================================
// BEGIN SCORE CARD
// ==================================================

function beginScoreCardRecording(): void {
  if (!recordingActive || scoreCardRecording || !recorder) {
    return;
  }

  scoreCardRecording = true;

  if (gameOverMonitorTimer !== null) {
    clearTimeout(gameOverMonitorTimer);

    gameOverMonitorTimer = null;
  }

  // -----------------------------------------------
  // Capture FINAL score now.
  // -----------------------------------------------

  drawScoreCard();

  showRecordingHUD(SCORE_CARD_SECONDS);

  // -----------------------------------------------
  // Resume same MediaRecorder.
  // -----------------------------------------------

  try {
    if (recorder.state === "paused") {
      recorder.resume();
    }
  } catch (error) {
    console.warn("[CyberWrap Recorder] Unable to resume recorder.", error);

    cleanupRecording();

    return;
  }

  // -----------------------------------------------
  // Keep score card on canvas for 2 seconds.
  // -----------------------------------------------

  let remaining = SCORE_CARD_SECONDS;

  updateRecordingHUD(remaining);

  scoreCardTimer = window.setInterval(() => {
    remaining--;

    updateRecordingHUD(remaining);

    if (remaining <= 0) {
      if (scoreCardTimer !== null) {
        clearInterval(scoreCardTimer);

        scoreCardTimer = null;
      }

      stopFinalRecorder();
    }
  }, 1000);
}

// ==================================================
// STOP FINAL RECORDER
// ==================================================

function stopFinalRecorder(): void {
  if (!recorder) {
    return;
  }

  hideRecordingHUD();

  try {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  } catch (error) {
    console.warn("[CyberWrap Recorder] Failed to stop recorder.", error);
  }
}

// ==================================================
// FINALIZE VIDEO
// ==================================================

async function finalizeRecording(mimeType: string): Promise<void> {
  const blob = new Blob(recordingChunks, {
    type: mimeType,
  });

  if (blob.size <= 0) {
    console.warn("[CyberWrap Recorder] Empty recording.");

    cleanupRecording();

    return;
  }

  console.log(
    `[CyberWrap Recorder] Final video: ${(blob.size / 1024 / 1024).toFixed(
      2,
    )} MB`,
  );

  const filename = getRecordingFilename(mimeType);

  const file = new File([blob], filename, {
    type: mimeType,
  });

  // -----------------------------------------------
  // Share
  // -----------------------------------------------

  if (
    navigator.canShare &&
    navigator.canShare({
      files: [file],
    })
  ) {
    try {
      await navigator.share({
        files: [file],

        title: "DailyBread Shawarma — CyberWrap",

        text: `I scored ${gameData.score} points in CyberWrap!`,
      });

      cleanupRecording();

      return;
    } catch (error) {
      console.log("[CyberWrap Recorder] Share cancelled.", error);
    }
  }

  // -----------------------------------------------
  // Download fallback
  // -----------------------------------------------

  downloadRecording(blob);

  cleanupRecording();
}

// ==================================================
// DOWNLOAD
// ==================================================

function downloadRecording(blob: Blob): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = getRecordingFilename(blob.type);

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ==================================================
// CLEANUP
// ==================================================

function cleanupRecording(): void {
  if (renderFrame !== null) {
    cancelAnimationFrame(renderFrame);

    renderFrame = null;
  }

  if (gameplayTimer !== null) {
    clearTimeout(gameplayTimer);

    gameplayTimer = null;
  }

  if (gameOverMonitorTimer !== null) {
    clearTimeout(gameOverMonitorTimer);

    gameOverMonitorTimer = null;
  }

  if (scoreCardTimer !== null) {
    clearInterval(scoreCardTimer);

    scoreCardTimer = null;
  }

  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  recordingStream = null;

  recordingCanvas?.remove();

  recordingCanvas = null;

  recordingContext = null;

  sourceCanvas = null;

  recorder = null;

  recordingChunks = [];

  recordingActive = false;

  gameplayRecordingFinished = false;

  waitingForGameOver = false;

  scoreCardRecording = false;

  gameplayDuration = 0;

  hideRecordingHUD();
}

// ==================================================
// CLEANUP NOTICE
// ==================================================

function cleanupNotice(): void {
  if (noticeTimer !== null) {
    clearTimeout(noticeTimer);

    noticeTimer = null;
  }

  noticeElement?.remove();

  noticeElement = null;
}

// ==================================================
// CLEANUP HUD
// ==================================================

function cleanupHUD(): void {
  recordingHUD?.remove();

  recordingHUD = null;

  recordingTimeElement = null;
}

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "record-button",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        setupRecordingListener();
      });
  },
});

// ==================================================
// PAGE CLEANUP
// ==================================================

window.addEventListener("beforeunload", () => {
  cleanupNotice();

  cleanupHUD();

  cleanupRecording();
});
