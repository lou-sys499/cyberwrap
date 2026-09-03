// =====================================================
// CyberWrap Daily Runs UI Component
// Phase 18B: Daily Gameplay Cap & Runs Remaining Display
//
// Responsibilities:
// - Render "TODAY'S RUNS" badge on pre-game opener
// - Render "TODAY'S RUNS COMPLETE" modal dialog
// - Provide helper formatters for game-over & HUD indicators
// - Seamlessly sync with Supabase daily runs state
// =====================================================

import {
  DAILY_RUN_LIMIT,
  getDailyRunStatus,
  getCurrentCachedRunStatus,
  type DailyRunStatus,
} from "../core/daily-gameplay";

let stylesInjected = false;
let modalElement: HTMLDivElement | null = null;

// -----------------------------------------------------
// Inject CSS Styles
// -----------------------------------------------------

function injectDailyRunStyles(): void {
  if (stylesInjected || document.getElementById("cw-daily-run-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "cw-daily-run-styles";
  style.textContent = `
    /* =====================================================
       PRE-GAME OPENER DAILY RUNS BADGE
    ===================================================== */
    #cw-opener-runs-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 10px auto 4px auto;
      padding: 7px 16px;
      background: rgba(0, 20, 30, 0.75);
      border: 1px solid rgba(0, 240, 255, 0.45);
      border-radius: 999px;
      font-family: 'Orbitron', 'Rajdhani', -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #00f0ff;
      text-transform: uppercase;
      box-shadow: 0 0 14px rgba(0, 240, 255, 0.2);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      pointer-events: auto;
      transition: all 0.25s ease;
      max-width: 90%;
    }

    #cw-opener-runs-badge.cw-runs-exhausted {
      border-color: rgba(255, 170, 0, 0.55);
      color: #ffaa00;
      box-shadow: 0 0 14px rgba(255, 170, 0, 0.25);
    }

    #cw-opener-runs-badge .cw-runs-icon {
      font-size: 13px;
      line-height: 1;
      filter: drop-shadow(0 0 4px currentColor);
    }

    #cw-opener-runs-badge .cw-runs-count {
      font-weight: 900;
      color: #ffffff;
      text-shadow: 0 0 8px currentColor;
    }

    /* =====================================================
       TODAY'S RUNS COMPLETE MODAL
    ===================================================== */
    #cw-daily-limit-overlay {
      position: fixed;
      inset: 0;
      background: rgba(4, 10, 18, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 10000002;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Orbitron', 'Rajdhani', -apple-system, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }

    #cw-daily-limit-overlay.cw-open {
      opacity: 1;
      pointer-events: auto;
    }

    #cw-daily-limit-card {
      position: relative;
      width: 100%;
      max-width: 440px;
      background: linear-gradient(175deg, rgba(8, 22, 38, 0.96) 0%, rgba(3, 11, 20, 0.98) 100%);
      border: 1.5px solid rgba(0, 240, 255, 0.55);
      border-radius: 18px;
      box-shadow: 0 0 35px rgba(0, 240, 255, 0.25), 0 20px 40px rgba(0, 0, 0, 0.8);
      padding: 24px 22px;
      box-sizing: border-box;
      text-align: center;
      color: #ffffff;
      transform: scale(0.92) translateY(12px);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    #cw-daily-limit-overlay.cw-open #cw-daily-limit-card {
      transform: scale(1) translateY(0);
    }

    .cw-limit-glow-accent {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      width: 220px;
      height: 80px;
      background: radial-gradient(circle, rgba(0, 240, 255, 0.35) 0%, transparent 70%);
      pointer-events: none;
    }

    .cw-limit-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #00f0ff;
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.4);
      border-radius: 999px;
      padding: 4px 12px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }

    .cw-limit-title {
      font-size: clamp(20px, 5vw, 24px);
      font-weight: 900;
      letter-spacing: 2px;
      color: #ffffff;
      margin: 0 0 10px 0;
      text-shadow: 0 0 16px rgba(0, 240, 255, 0.6);
      line-height: 1.2;
    }

    .cw-limit-desc {
      font-family: 'Rajdhani', -apple-system, sans-serif;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.45;
      color: rgba(220, 240, 255, 0.88);
      margin: 0 0 18px 0;
    }

    .cw-limit-status-box {
      background: rgba(0, 30, 50, 0.5);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cw-limit-status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      letter-spacing: 1px;
      color: rgba(180, 220, 245, 0.85);
    }

    .cw-limit-status-highlight {
      font-weight: 900;
      font-size: 13px;
      color: #74ffff;
    }

    .cw-limit-reset-note {
      font-size: 10px;
      letter-spacing: 0.8px;
      color: rgba(160, 200, 230, 0.65);
      text-align: center;
      margin-top: 4px;
    }

    .cw-limit-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .cw-limit-store-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 18px;
      background: linear-gradient(90deg, #ff8c00 0%, #ff5500 100%);
      color: #ffffff;
      font-family: 'Orbitron', sans-serif;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      text-decoration: none;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(255, 120, 0, 0.35);
      box-sizing: border-box;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }

    .cw-limit-store-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 28px rgba(255, 120, 0, 0.55);
    }

    .cw-limit-close-btn {
      width: 100%;
      padding: 12px 18px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.85);
      font-family: 'Orbitron', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .cw-limit-close-btn:hover {
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }
  `;

  document.head.appendChild(style);
  stylesInjected = true;
}

// -----------------------------------------------------
// Initialize Daily Runs UI & Opener Badge
// -----------------------------------------------------

export function initDailyRunUI(): void {
  injectDailyRunStyles();
  createDailyLimitModal();
  updateOpenerRunsBadge();

  // Listen for background status updates
  window.addEventListener("cyberwrap-daily-runs-updated", (e) => {
    const status = (e as CustomEvent<DailyRunStatus>).detail;
    if (status) {
      applyStatusToUI(status);
    }
  });

  // Fetch fresh status from Supabase
  void getDailyRunStatus().then((status) => {
    applyStatusToUI(status);
  });
}

// -----------------------------------------------------
// Update Pre-game Opener Badge
// -----------------------------------------------------

export function updateOpenerRunsBadge(): void {
  const openerContent = document.getElementById("opener-content");
  if (!openerContent) return;

  let badge = document.getElementById("cw-opener-runs-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "cw-opener-runs-badge";

    const playButton = document.getElementById("cyberwrap-start");
    if (playButton) {
      openerContent.insertBefore(badge, playButton);
    } else {
      openerContent.appendChild(badge);
    }
  }

  const cached = getCurrentCachedRunStatus();
  applyStatusToUI(cached);
}

function applyStatusToUI(status: DailyRunStatus): void {
  const badge = document.getElementById("cw-opener-runs-badge");
  if (badge) {
    if (status.dailyRunsRemaining > 0) {
      badge.classList.remove("cw-runs-exhausted");
      badge.innerHTML = `
        <span class="cw-runs-icon">⚡</span>
        <span>TODAY'S RUNS:</span>
        <span class="cw-runs-count">${status.dailyRunsRemaining} / ${status.dailyRunLimit}</span>
      `;
    } else {
      badge.classList.add("cw-runs-exhausted");
      badge.innerHTML = `
        <span class="cw-runs-icon">✓</span>
        <span>TODAY'S RUNS COMPLETE</span>
        <span class="cw-runs-count">(${status.dailyRunLimit}/${status.dailyRunLimit})</span>
      `;
    }
  }

  // Update HUD row if present
  const hudRunsVal = document.getElementById("cw-daily-runs-val");
  if (hudRunsVal) {
    hudRunsVal.textContent = `${status.dailyRunsUsed} / ${status.dailyRunLimit}`;
  }
}

// -----------------------------------------------------
// Create "Today's Runs Complete" Modal
// -----------------------------------------------------

function createDailyLimitModal(): void {
  if (modalElement || document.getElementById("cw-daily-limit-overlay")) {
    return;
  }

  modalElement = document.createElement("div");
  modalElement.id = "cw-daily-limit-overlay";
  modalElement.innerHTML = `
    <div id="cw-daily-limit-card" role="dialog" aria-modal="true" aria-labelledby="cw-limit-card-title">
      <div class="cw-limit-glow-accent"></div>
      
      <div class="cw-limit-badge">DAILY BREAD SHAWARMA</div>
      <h2 class="cw-limit-title" id="cw-limit-card-title">TODAY'S RUNS COMPLETE</h2>
      
      <p class="cw-limit-desc">
        You've completed all <strong>5 runs for today</strong>.<br>
        Come back tomorrow for <strong>5 fresh delivery runs</strong> and more chances to earn rewards!
      </p>

      <div class="cw-limit-status-box">
        <div class="cw-limit-status-row">
          <span>RUNS COMPLETED TODAY</span>
          <span class="cw-limit-status-highlight">5 / 5</span>
        </div>
        <div class="cw-limit-status-row">
          <span>DAILY REWARD ECONOMY</span>
          <span style="color: #10b981; font-weight: 700;">PROTECTED</span>
        </div>
        <div class="cw-limit-reset-note">
          Daily allowance resets at 00:00 UTC
        </div>
      </div>

      <div class="cw-limit-actions">
        <a
          href="https://dailybreadshawarma.store"
          target="_blank"
          rel="noopener noreferrer"
          class="cw-limit-store-btn"
          id="cw-limit-store-link"
        >
          ORDER ONLINE AT STORE ↗
        </a>
        <button
          type="button"
          class="cw-limit-close-btn"
          id="cw-limit-close-btn"
        >
          CLOSE
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalElement);

  // Event bindings
  const closeBtn = modalElement.querySelector("#cw-limit-close-btn");
  closeBtn?.addEventListener("click", () => {
    hideDailyLimitModal();
  });

  modalElement.addEventListener("click", (e) => {
    if (e.target === modalElement) {
      hideDailyLimitModal();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalElement?.classList.contains("cw-open")) {
      hideDailyLimitModal();
    }
  });
}

// -----------------------------------------------------
// Show / Hide Daily Limit Modal
// -----------------------------------------------------

export function showDailyLimitModal(status?: DailyRunStatus): void {
  injectDailyRunStyles();
  createDailyLimitModal();

  if (!modalElement) return;

  const current = status ?? getCurrentCachedRunStatus();
  applyStatusToUI(current);

  modalElement.classList.add("cw-open");
}

export function hideDailyLimitModal(): void {
  if (modalElement) {
    modalElement.classList.remove("cw-open");
  }
}

// Auto-initialize on module import
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initDailyRunUI());
  } else {
    initDailyRunUI();
  }
}

