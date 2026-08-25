import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import {
  loadAnonymousCoupons,
  type RewardCoupon,
  type RewardProgress,
} from "../core/anonymous-rewards";

// -----------------------------------------------------
// HUD ELEMENTS
// -----------------------------------------------------

let hudRoot: HTMLDivElement | null = null;

let dashboard: HTMLDivElement | null = null;

let tapPanel: HTMLDivElement | null = null;

let rulesPanel: HTMLDivElement | null = null;

let couponsPanel: HTMLDivElement | null = null;

let rulesButton: HTMLButtonElement | null = null;

let couponButton: HTMLButtonElement | null = null;

let cameraButton: HTMLButtonElement | null = null;

let timeValue: HTMLSpanElement | null = null;

let scoreValue: HTMLSpanElement | null = null;

let rewardScoreValue: HTMLSpanElement | null = null;

let scorePopup: HTMLDivElement | null = null;

let rewardOverlay: HTMLDivElement | null = null;

let couponOverlay: HTMLDivElement | null = null;

let minimapCanvas: HTMLCanvasElement | null = null;

let hudWorld: ecs.World | null = null;

// -----------------------------------------------------
// HUD STATE
// -----------------------------------------------------

let previousScore = 0;

let hudAnimationFrame = 0;

// -----------------------------------------------------
// Font
// -----------------------------------------------------

function injectFont() {
  if (document.getElementById("cw-font")) {
    return;
  }

  const link = document.createElement("link");

  link.id = "cw-font";

  link.rel = "stylesheet";

  link.href =
    "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap";

  document.head.appendChild(link);
}

// -----------------------------------------------------
// Styles
// -----------------------------------------------------

function injectStyles() {
  if (document.getElementById("cw-hud-styles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "cw-hud-styles";

  style.textContent = `

    /* =====================================================
       ROOT
    ===================================================== */

    #cw-root {

      position: fixed;

      inset: 0;

      width: 100%;
      height: 100%;

      pointer-events: none;

      font-family:
        'Orbitron',
        sans-serif;

      z-index: 999999;

    }


    /* =====================================================
       DASHBOARD
    ===================================================== */

    #cw-dashboard {

      position: fixed;

      top: 14px;

      left: 14px;

      min-width: 150px;

      padding: 12px 16px;

      border:

        1px solid
        rgba(0, 255, 255, .45);

      border-radius: 12px;

      background:

        rgba(0, 10, 18, .72);

      box-shadow:

        0 0 12px
        rgba(0, 255, 255, .18),

        inset 0 0 12px
        rgba(0, 255, 255, .05);

      backdrop-filter:
        blur(8px);

      -webkit-backdrop-filter:
        blur(8px);

      color: white;

    }


    /* =====================================================
       TITLE
    ===================================================== */

    .cw-title {

      margin-bottom: 8px;

      color: #74ffff;

      font-size: 12px;

      font-weight: 800;

      letter-spacing: 2px;

      text-shadow:

        0 0 8px cyan,

        0 0 15px
        rgba(0, 255, 255, .5);

    }


    /* =====================================================
       ROW
    ===================================================== */

    .cw-row {

      display: flex;

      justify-content:
        space-between;

      align-items: center;

      gap: 20px;

      margin-top: 4px;

      font-size: 11px;

      letter-spacing: 1px;

    }


    /* =====================================================
       VALUES
    ===================================================== */

    .cw-value {

      color: white;

      font-size: 16px;

      font-weight: 800;

      letter-spacing: 1px;

      text-shadow:

        0 0 8px
        rgba(255, 255, 255, .45);

    }


    /* =====================================================
       BUTTONS
    ===================================================== */

    #cw-buttons {

      position: fixed;

      top: 14px;

      left: 50%;

      right: auto;

      transform: translateX(-50%);

      display: flex;

      gap: 8px;

      pointer-events: auto;

    }


    .cw-btn {

      width: 46px;

      height: 46px;

      padding: 0;

      border:

        1px solid
        rgba(0, 255, 255, .45);

      border-radius: 12px;

      background:

        rgba(0, 10, 18, .72);

      color: white;

      font-size: 21px;

      cursor: pointer;

      display: flex;

      align-items: center;

      justify-content: center;

      box-shadow:

        0 0 12px
        rgba(0, 255, 255, .15);

      backdrop-filter:
        blur(8px);

      -webkit-backdrop-filter:
        blur(8px);

      touch-action: manipulation;

      -webkit-user-select: none;

      user-select: none;

      -webkit-touch-callout: none;

    }


    .cw-btn:active {

      transform:
        scale(.92);

    }


    /* =====================================================
      GAME STATUS
    ===================================================== */

    #tap-place {

      position: fixed;

      left: 50%;

      bottom: 24%;

      transform:
        translateX(-50%);

      padding:

        12px
        20px;

      border:

        1px solid
        rgba(0, 255, 255, .55);

      border-radius: 10px;

      background:

        rgba(0, 10, 18, .72);

      color: #74ffff;

      font-size: 13px;

      font-weight: 800;

      letter-spacing: 1.5px;

      text-align: center;

      white-space: nowrap;

      box-shadow:

        0 0 15px
        rgba(0, 255, 255, .18);

      animation:

        cwBlink 1.2s infinite;

      pointer-events: none;

    }


    /* =====================================================
       RULES PANEL
    ===================================================== */

    #cw-rules,
    #cw-coupon-overlay {

  position: fixed;

  top: 76px;

  left: 50%;

  transform: translateX(-50%);

  width: calc(100% - 28px);

  max-width: 340px;

  max-height: calc(100dvh - 90px);

  box-sizing: border-box;

  overflow-y: auto;

  padding: 18px;

  border:
    1px solid
    rgba(0, 255, 255, .4);

  border-radius: 14px;

  background:
    rgba(0, 10, 18, .9);

  box-shadow:
    0 0 20px
    rgba(0, 255, 255, .15);

  backdrop-filter:
    blur(10px);

  -webkit-backdrop-filter:
    blur(10px);

  color: white;

  font-size: 12px;

  line-height: 1.5;

  display: none;

  pointer-events: auto;

  -webkit-overflow-scrolling: touch;

}

    #cw-rules {
      top: 0;
      left: 0;
      transform: none;
      width: 100%;
      max-width: none;
      height: 100%;
      max-height: none;
      padding: 24px;
      box-sizing: border-box;
      overflow-y: auto;
      z-index: 2147483000;
      background: rgba(0, 0, 0, .82);
    }

    #cw-rules.cw-open {

      display: block;

    }

    #cw-rules.cw-open::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -1;
      background: rgba(0, 0, 0, .82);
      pointer-events: auto;
    }

    #cw-coupon-overlay.cw-open {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      padding: 20px;
      background: rgba(0, 0, 0, .72);
    }

    #cw-coupon-card {
      width: min(360px, 100%);
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
      box-sizing: border-box;
      padding: 20px;
      border: 1px solid rgba(0, 255, 255, .55);
      border-radius: 14px;
      background: rgba(0, 10, 18, .96);
      box-shadow: 0 0 24px rgba(0, 255, 255, .28);
      color: white;
      pointer-events: auto;
    }

    #cw-coupon-overlay.cw-open #cw-coupons {
      display: block;
      margin: 0;
      padding: 0;
      border: 0;
    }

    #cw-coupons {
      display: none;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(0, 255, 255, .25);
    }

    #cw-coupons.cw-open {
      display: block;
    }

    .cw-panel-tab {
      min-height: 34px;
      padding: 6px 10px;
      border: 1px solid rgba(0, 255, 255, .55);
      border-radius: 8px;
      background: rgba(0, 255, 255, .08);
      color: #74ffff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .cw-coupon {
      margin-top: 10px;
      padding: 10px;
      border: 1px solid rgba(0, 255, 255, .35);
      border-radius: 8px;
      background: rgba(0, 10, 18, .6);
    }

    .cw-coupon-code {
      color: #ffffff;
      font-weight: 800;
      letter-spacing: 1px;
    }

    .cw-coupon-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .cw-coupon-actions button,
    .cw-coupon-actions a {
      flex: 1;
      padding: 7px 5px;
      border: 1px solid rgba(0, 255, 255, .55);
      border-radius: 6px;
      background: rgba(0, 255, 255, .08);
      color: #74ffff;
      font: inherit;
      font-size: 10px;
      font-weight: 800;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
    }


    /* =====================================================
       RULES TITLE
    ===================================================== */

    #cw-rules h3 {

      margin:

        0
        0
        clamp(10px, 2.5vw, 16px);

      color: #74ffff;

      letter-spacing:
        clamp(1px, .5vw, 2px);

      font-size:
        clamp(14px, 4vw, 18px);

      line-height: 1.2;

    }


    /* =====================================================
       RULE ITEMS
    ===================================================== */

    .cw-rule {

      margin-bottom:
        clamp(8px, 2vw, 12px);

    }


    .cw-rule strong {

      color: #74ffff;

      letter-spacing: 1px;

    }


    .cw-food-value {

      display: flex;

      justify-content:
        space-between;

      margin-top: 5px;

      padding: 3px 0;

    }


    /* =====================================================
       LOW TIME
    ===================================================== */

    .lowTime {

      color:
        #ff5555 !important;

      animation:
        cwPulse .8s infinite;

    }


    /* =====================================================
       SCORE FLASH
    ===================================================== */

    .scoreFlash {

      animation:
        cwScore .35s;

    }


    /* =====================================================
       DELIVERY SCORE POPUP
    ===================================================== */

    #cw-score-popup {

      position: fixed;

      left: 50%;

      top: 42%;

      transform:

        translate(-50%, -50%)
        scale(.6);

      font-family:
        'Orbitron',
        sans-serif;

      font-size:
        clamp(28px, 10vw, 42px);

      font-weight: 800;

      letter-spacing:
        clamp(1px, 1vw, 3px);

      color: #74ffff;

      text-shadow:

        0 0 10px cyan,

        0 0 25px cyan,

        0 0 45px
        rgba(0, 255, 255, .7);

      opacity: 0;

      pointer-events: none;

      z-index: 1000000;

    }


    #cw-score-popup.cw-show {

      animation:

        cwScorePopup .8s
        cubic-bezier(.2, .9, .3, 1);

    }

    #cw-reward-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, .72);
      pointer-events: auto;
      z-index: 2147483000;
    }

    #cw-reward-overlay.cw-open {
      display: flex;
    }

    #cw-reward-card {
      width: min(360px, 100%);
      box-sizing: border-box;
      padding: 26px 22px;
      border: 1px solid rgba(0, 255, 255, .65);
      border-radius: 16px;
      background: rgba(0, 10, 18, .96);
      box-shadow: 0 0 25px rgba(0, 255, 255, .3);
      color: #ffffff;
      text-align: center;
      pointer-events: auto;
    }

    #cw-reward-card h2 {
      margin: 0 0 16px;
      color: #74ffff;
      font-size: 22px;
      letter-spacing: 2px;
    }

    #cw-reward-card .cw-reward-discount {
      margin-bottom: 18px;
      color: #74ffff;
      font-size: 30px;
      font-weight: 800;
    }

    #cw-reward-card .cw-reward-code {
      margin: 8px 0 14px;
      padding: 12px;
      border: 1px solid rgba(0, 255, 255, .35);
      border-radius: 8px;
      color: #ffffff;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 1px;
      overflow-wrap: anywhere;
    }

    #cw-reward-card .cw-reward-expiry {
      margin-bottom: 18px;
      color: rgba(255, 255, 255, .8);
      font-size: 13px;
      line-height: 1.5;
    }

    .cw-reward-action {
      width: 100%;
      min-height: 44px;
      margin-top: 8px;
      border: 1px solid rgba(0, 255, 255, .6);
      border-radius: 8px;
      background: rgba(0, 255, 255, .12);
      color: #74ffff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      touch-action: manipulation;
    }

    #cw-reward-close {
      background: transparent;
      color: rgba(255, 255, 255, .78);
    }


    /* =====================================================
       ANIMATIONS
    ===================================================== */

    @keyframes cwBlink {

      0% {
        opacity: 1;
      }

      50% {
        opacity: .35;
      }

      100% {
        opacity: 1;
      }

    }


    @keyframes cwPulse {

      0% {
        transform: scale(1);
      }

      50% {
        transform: scale(1.1);
      }

      100% {
        transform: scale(1);
      }

    }


    @keyframes cwScore {

      0% {
        transform: scale(1);
      }

      50% {
        transform: scale(1.25);
      }

      100% {
        transform: scale(1);
      }

    }


    @keyframes cwScorePopup {

      0% {

        opacity: 0;

        transform:

          translate(-50%, -50%)
          scale(.55);

      }

      18% {

        opacity: 1;

        transform:

          translate(-50%, -50%)
          scale(1.25);

      }

      35% {

        transform:

          translate(-50%, -50%)
          scale(1);

      }

      100% {

        opacity: 0;

        transform:

          translate(-50%, -90%)
          scale(.9);

      }

    }


    /* =====================================================
       SMALL PHONES
    ===================================================== */

    @media (max-width: 600px) {

      #cw-dashboard {

        top: 10px;

        left: 10px;

        min-width: 130px;

        padding: 10px 12px;

      }


      .cw-title {

        font-size: 10px;

        letter-spacing: 1.5px;

      }


      .cw-row {

        font-size: 10px;

      }


      .cw-value {

        font-size: 14px;

      }


      #cw-buttons {

        top: 10px;

        left: 50%;

        right: auto;

        transform: translateX(-50%);

      }


      .cw-btn {

        width: 42px;

        height: 42px;

        font-size: 19px;

        border-radius: 10px;

      }


      #cw-rules {

        top: 64px;

        right: 10px;

        width:
          calc(100vw - 20px);

        max-width: none;

        max-height:
          calc(100dvh - 80px);

        padding: 14px;

        border-radius: 12px;

        font-size: 12px;

        line-height: 1.45;

      }


      #cw-rules h3 {

        font-size: 16px;

        margin-bottom: 10px;

      }


      .cw-rule {

        margin-bottom: 8px;

      }


      .cw-food-value {

        font-size: 12px;

        padding: 3px 0;

      }

    }


    /* =====================================================
       SHORT SCREENS
    ===================================================== */

    @media (max-height: 600px) {

      #cw-rules {

        top: 60px;

        max-height:
          calc(100dvh - 70px);

        padding: 10px;

        font-size: 11px;

        line-height: 1.35;

      }


      #cw-rules h3 {

        font-size: 14px;

        margin-bottom: 7px;

      }


      .cw-rule {

        margin-bottom: 6px;

      }


      .cw-food-value {

        padding: 2px 0;

      }

    }


    /* =====================================================
       LANDSCAPE PHONES
    ===================================================== */

    @media
      (orientation: landscape)
      and (max-height: 600px) {

      #cw-rules {

        top: 70px;

        right: 10px;

        width:
          min(340px, 45vw);

        max-height:
          calc(100dvh - 80px);

        font-size: 11px;

        overflow-y: auto;

      }

    }

  `;

  document.head.appendChild(style);
}

function createMinimap(): void {
  minimapCanvas = document.createElement("canvas");
  minimapCanvas.id = "cw-minimap";
  minimapCanvas.width = 180;
  minimapCanvas.height = 140;
  minimapCanvas.style.cssText =
    "position:fixed;top:14px;right:14px;width:180px;height:140px;" +
    "border:1px solid rgba(0,255,255,.55);background:rgba(0,10,18,.78);" +
    "box-shadow:0 0 14px rgba(0,255,255,.18);pointer-events:none;";
  hudRoot?.appendChild(minimapCanvas);
}

function updateMinimap(): void {
  if (!minimapCanvas || !hudWorld || gameData.driveZoneEid === null) {
    return;
  }

  const context = minimapCanvas.getContext("2d");

  if (!context) {
    return;
  }

  const zone = hudWorld.transform.getWorldPosition(gameData.driveZoneEid);
  const project = (position: { x: number; z: number }) => ({
    x: 90 + Math.max(-1, Math.min(1, (position.x - zone.x) / 6)) * 78,
    y: 70 + Math.max(-1, Math.min(1, (position.z - zone.z) / 6)) * 58,
  });

  context.clearRect(0, 0, 180, 140);
  context.strokeStyle = "rgba(116,255,255,.45)";
  context.strokeRect(8, 8, 164, 124);

  if (gameData.kitchenDropoffEid !== null) {
    const marker = project(hudWorld.transform.getWorldPosition(gameData.kitchenDropoffEid));
    context.fillStyle = "#74ffff";
    context.fillRect(marker.x - 5, marker.y - 5, 10, 10);
  }

  context.fillStyle = "#ffd166";
  for (const eid of gameData.collectibleEids) {
    const marker = project(hudWorld.transform.getWorldPosition(eid));
    context.beginPath();
    context.arc(marker.x, marker.y, 3, 0, Math.PI * 2);
    context.fill();
  }

  if (gameData.truckEid !== null) {
    const marker = project(hudWorld.transform.getWorldPosition(gameData.truckEid));
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(marker.x, marker.y - 7);
    context.lineTo(marker.x + 6, marker.y + 6);
    context.lineTo(marker.x - 6, marker.y + 6);
    context.closePath();
    context.fill();
  }
}

// -----------------------------------------------------
// Create HUD
// -----------------------------------------------------

function createHUD() {
  // ------------------------------------
  // Prevent duplicate HUD
  // ------------------------------------

  if (document.getElementById("cw-root")) {
    return;
  }

  // ------------------------------------
  // Inject resources
  // ------------------------------------

  injectFont();

  injectStyles();

  // ------------------------------------
  // Reset HUD state
  // ------------------------------------

  previousScore = gameData.score;

  // ------------------------------------
  // Root
  // ------------------------------------

  hudRoot = document.createElement("div");

  hudRoot.id = "cw-root";

  // ------------------------------------
  // Dashboard
  // ------------------------------------

  dashboard = document.createElement("div");

  dashboard.id = "cw-dashboard";

  dashboard.innerHTML = `

    <div class="cw-title">
      CYBERWRAP DB
    </div>

    <div class="cw-row">

      <span>
        TIME
      </span>

      <span
        id="cw-time"
        class="cw-value"
      >
        60
      </span>

    </div>

    <div class="cw-row">

      <span>
        SCORE
      </span>

      <span
        id="cw-score"
        class="cw-value"
      >
        0
      </span>

    </div>

    <div class="cw-row">

      <span>
        REWARD
      </span>

      <span
        id="cw-reward-score"
        class="cw-value"
      >
        0 / 2,000
      </span>

    </div>

  `;

  hudRoot.appendChild(dashboard);

  // ------------------------------------
  // Delivery Score Popup
  // ------------------------------------

  scorePopup = document.createElement("div");

  scorePopup.id = "cw-score-popup";

  scorePopup.textContent = "+0";

  hudRoot.appendChild(scorePopup);

  rewardOverlay = document.createElement("div");
  rewardOverlay.id = "cw-reward-overlay";
  rewardOverlay.innerHTML = `
    <div id="cw-reward-card" role="dialog" aria-modal="true" aria-labelledby="cw-reward-title">
      <h2 id="cw-reward-title">REWARD EARNED!</h2>
      <div class="cw-reward-discount" id="cw-reward-discount"></div>
      <div>YOUR COUPON</div>
      <div class="cw-reward-code" id="cw-reward-code"></div>
      <div class="cw-reward-expiry" id="cw-reward-expiry"></div>
      <button class="cw-reward-action" id="cw-reward-copy" type="button">COPY COUPON CODE</button>
      <button class="cw-reward-action" id="cw-reward-close" type="button">CLOSE</button>
    </div>
  `;

  hudRoot.appendChild(rewardOverlay);

  rewardOverlay.addEventListener("click", (event) => {
    if (event.target === rewardOverlay) {
      rewardOverlay.classList.remove("cw-open");
    }
  });

  document.getElementById("cw-reward-close")?.addEventListener("click", () => {
    rewardOverlay?.classList.remove("cw-open");
  });

  document.getElementById("cw-reward-copy")?.addEventListener("click", async () => {
    const button = document.getElementById("cw-reward-copy") as HTMLButtonElement;
    const code = document.getElementById("cw-reward-code")?.textContent ?? "";

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement("textarea");
        input.value = code;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }

      button.textContent = "COPIED ✓";
      window.setTimeout(() => {
        button.textContent = "COPY COUPON CODE";
      }, 1800);
    } catch {
      button.textContent = "COPY FAILED";
      window.setTimeout(() => {
        button.textContent = "COPY COUPON CODE";
      }, 1800);
    }
  });

  window.addEventListener("cyberwrap-reward-earned", (event) => {
    const coupon = (event as CustomEvent<RewardCoupon>).detail;
    const discount = document.getElementById("cw-reward-discount");
    const code = document.getElementById("cw-reward-code");
    const expiry = document.getElementById("cw-reward-expiry");

    if (!rewardOverlay || !discount || !code || !expiry) {
      return;
    }

    discount.textContent = `${coupon.discount_percent}% OFF`;
    code.textContent = coupon.code;
    expiry.textContent = `Expires: ${new Date(coupon.expires_at).toLocaleString()}`;
    rewardOverlay.classList.add("cw-open");
  });

  // ------------------------------------
  // The DriveZone is created automatically after PLAY.
  // ------------------------------------

  tapPanel = document.createElement("div");

  tapPanel.id = "tap-place";

  tapPanel.innerHTML = `
    DRIVEZONE READY
  `;

  hudRoot.appendChild(tapPanel);

  // ------------------------------------
  // Buttons Container
  // ------------------------------------

  const buttons = document.createElement("div");

  buttons.id = "cw-buttons";

  // ------------------------------------
  // Rules Button
  // ------------------------------------

  rulesButton = document.createElement("button");

  rulesButton.className = "cw-btn";

  rulesButton.innerHTML = "📖";

  rulesButton.setAttribute("aria-label", "Game Rules");

  rulesButton.setAttribute("type", "button");

  // ------------------------------------
  // Camera / Record Button
  // ------------------------------------

  cameraButton = document.createElement("button");

  cameraButton.className = "cw-btn";

  cameraButton.innerHTML = "📹";

  cameraButton.setAttribute("aria-label", "Record");

  cameraButton.setAttribute("type", "button");

  couponButton = document.createElement("button");

  couponButton.className = "cw-btn";
  couponButton.innerHTML = "🎟";
  couponButton.setAttribute("aria-label", "Coupons");
  couponButton.setAttribute("type", "button");

  // ------------------------------------
  // Add Buttons
  // ------------------------------------

  buttons.appendChild(rulesButton);

  buttons.appendChild(couponButton);

  buttons.appendChild(cameraButton);

  hudRoot.appendChild(buttons);

  // ------------------------------------
  // Rules Panel
  // ------------------------------------

  rulesPanel = document.createElement("div");

  rulesPanel.id = "cw-rules";

  rulesPanel.innerHTML = `

    <h3>
      CYBERWRAP RULES
    </h3>

    <div class="cw-rule">
      CyberWrap is a 60-second tabletop arcade delivery challenge.
      Collect food and return it to the Delivery Zone to score.
      Reach 2,000 cumulative points within the 7-day reward cycle to earn a 20% coupon.
      Maximum 2 coupons per 7-day cycle. Each coupon expires 7 days after generation.
      Redeem at <a href="https://dailybreadshawarma.store" target="_blank" rel="noopener noreferrer">dailybreadshawarma.store</a>.
    </div>

    <button class="cw-panel-tab" id="cw-rules-close" type="button">CLOSE</button>


    <div class="cw-rule">

      <strong>
        1. DRIVE
      </strong>

      <br>

      Drive around the DriveZone.

    </div>


    <div class="cw-rule">

      <strong>
        2. COLLECT
      </strong>

      <br>

      Pick up as many ingredients
      as you can.

    </div>


    <div class="cw-rule">

      <strong>
        3. DELIVER
      </strong>

      <br>

      Return to the cyan
      Delivery Zone.

    </div>


    <div class="cw-rule">

      <strong>
        4. SCORE
      </strong>

      <br>

      Deliver your cargo
      to earn points.

    </div>


    <div class="cw-rule">

      <strong>
        5. BEAT THE CLOCK
      </strong>

      <br>

      You have 60 seconds.

    </div>


    <!-- ---------------------------------
         HIGH SCORE MESSAGE
    ---------------------------------- -->

    <div
      style="
        color:#74ffff;
        text-align:center;
        font-weight:800;
        letter-spacing:1px;
        margin:14px 0;
      "
    >

      🏆 GET THE HIGHEST SCORE!

    </div>


    <!-- ---------------------------------
         INGREDIENT VALUES
    ---------------------------------- -->

    <div
      style="
        border-top:1px solid
          rgba(0,255,255,.2);

        padding-top:10px;
      "
    >

      <strong
        style="
          color:#74ffff;
          letter-spacing:1px;
        "
      >

        INGREDIENT VALUES

      </strong>


      <div class="cw-food-value">

        <span>
          🥙 Burrito
        </span>

        <span>
          +20
        </span>

      </div>


      <div class="cw-food-value">

        <span>
          🥩 Steak
        </span>

        <span>
          +15
        </span>

      </div>


      <div class="cw-food-value">

        <span>
          🍟 Fries
        </span>

        <span>
          +10
        </span>

      </div>


      <div class="cw-food-value">

        <span>
          🌶 Chili
        </span>

        <span>
          +5
        </span>

      </div>

    </div>

  `;

  hudRoot.appendChild(rulesPanel);

  couponsPanel = document.createElement("div");
  couponsPanel.id = "cw-coupons";
  couponsPanel.innerHTML = "<div>Loading coupons...</div>";

  couponOverlay = document.createElement("div");
  couponOverlay.id = "cw-coupon-overlay";
  couponOverlay.innerHTML = `
    <div id="cw-coupon-card">
      <h3>MY COUPONS</h3>
    </div>
  `;
  couponOverlay.firstElementChild?.appendChild(couponsPanel);
  couponOverlay.firstElementChild?.insertAdjacentHTML(
    "beforeend",
    '<button class="cw-panel-tab" id="cw-coupons-close" type="button">CLOSE</button>',
  );
  hudRoot.appendChild(couponOverlay);

  // ------------------------------------
  // Add HUD to document
  // ------------------------------------

  document.body.appendChild(hudRoot);

  createMinimap();

  // ------------------------------------
  // Cache elements
  // ------------------------------------

  timeValue = document.getElementById("cw-time") as HTMLSpanElement;

  scoreValue = document.getElementById("cw-score") as HTMLSpanElement;

  rewardScoreValue = document.getElementById(
    "cw-reward-score",
  ) as HTMLSpanElement;

  window.addEventListener("cyberwrap-reward-updated", (event) => {
    const progress = (event as CustomEvent<RewardProgress>).detail;

    if (rewardScoreValue) {
      rewardScoreValue.textContent = `${progress.cumulative_score.toLocaleString()} / 2,000`;
    }
  });

  window.addEventListener("cyberwrap-coupons-updated", (event) => {
    if (!couponsPanel) {
      return;
    }

    const coupons = (event as CustomEvent<RewardCoupon[]>).detail;

    couponsPanel.innerHTML = coupons.length
      ? coupons
          .map(
            (coupon) => `
              <div class="cw-coupon">
                <div><strong>${coupon.discount_percent}% DISCOUNT</strong></div>
                <div class="cw-coupon-code">${coupon.code}</div>
                <div>Expires: ${new Date(coupon.expires_at).toLocaleString()}</div>
                <div>Status: ${coupon.status.toUpperCase()}</div>
                <div class="cw-coupon-actions">
                  <button type="button" data-copy-code="${coupon.code}">COPY CODE</button>
                  <a href="https://dailybreadshawarma.store" target="_blank" rel="noopener noreferrer">REDEEM ONLINE</a>
                </div>
              </div>
            `,
          )
          .join("")
      : "<div>No coupons available yet.</div>";

    couponsPanel.querySelectorAll<HTMLButtonElement>("[data-copy-code]").forEach(
      (button) => {
        button.addEventListener("click", async () => {
          await navigator.clipboard?.writeText(button.dataset.copyCode ?? "");
          button.textContent = "COPIED";
        });
      },
    );
  });

  // ------------------------------------
  // Initial visibility
  // ------------------------------------

  tapPanel.style.display = gameData.driveZonePlaced ? "none" : "block";

  rulesPanel.classList.remove("cw-open");

  document.getElementById("cw-rules-close")?.addEventListener("click", () => {
    rulesPanel?.classList.remove("cw-open");
  });

  document.getElementById("cw-coupons-close")?.addEventListener("click", () => {
    couponOverlay?.classList.remove("cw-open");
  });

  rulesButton.onclick = () => {
    couponOverlay?.classList.remove("cw-open");
    rulesPanel?.classList.toggle("cw-open");
  };

  couponButton.onclick = () => {
    rulesPanel?.classList.remove("cw-open");
    couponOverlay?.classList.toggle("cw-open");
    void loadAnonymousCoupons();
  };
}

// -----------------------------------------------------
// Delivery Score Popup
// -----------------------------------------------------

export function showDeliveryScore(amount: number) {
  if (!scorePopup) {
    return;
  }

  scorePopup.textContent = `+${amount}`;

  // ------------------------------------
  // Restart animation
  // ------------------------------------

  scorePopup.classList.remove("cw-show");

  // Force browser reflow so the
  // animation can restart immediately.

  void scorePopup.offsetWidth;

  scorePopup.classList.add("cw-show");
}

// -----------------------------------------------------
// HUD Update Loop
// -----------------------------------------------------

function updateHUD() {
  // ------------------------------------
  // HUD not ready
  // ------------------------------------

  if (!timeValue || !scoreValue || !tapPanel) {
    hudAnimationFrame = requestAnimationFrame(updateHUD);

    return;
  }

  // ------------------------------------
  // The fixed DriveZone needs no placement prompt.
  // ------------------------------------

  tapPanel.style.display = "none";

  // ------------------------------------
  // TIME
  // ------------------------------------

  const seconds = Math.max(0, Math.ceil(gameData.timeLeft));

  timeValue.textContent = seconds.toString();

  // ------------------------------------
  // LOW TIME WARNING
  // ------------------------------------

  if (seconds <= 10) {
    timeValue.classList.add("lowTime");
  } else {
    timeValue.classList.remove("lowTime");
  }

  // ------------------------------------
  // SCORE
  // ------------------------------------

  if (gameData.score !== previousScore) {
    scoreValue.classList.remove("scoreFlash");

    // Force animation restart.

    void scoreValue.offsetWidth;

    scoreValue.classList.add("scoreFlash");

    previousScore = gameData.score;
  }

  scoreValue.textContent = gameData.score.toString();

  updateMinimap();

  // ------------------------------------
  // Continue update loop
  // ------------------------------------

  hudAnimationFrame = requestAnimationFrame(updateHUD);
}

// -----------------------------------------------------
// Rules + Recorder Buttons
// -----------------------------------------------------

function setupButtons() {
  // ------------------------------------
  // Safety check
  // ------------------------------------

  if (!rulesButton || !couponButton || !cameraButton || !rulesPanel) {
    return;
  }

  // ------------------------------------
  // Rules
  // ------------------------------------

  rulesButton.onclick = () => {
    couponOverlay?.classList.remove("cw-open");
    rulesPanel?.classList.add("cw-open");
  };

  couponButton.onclick = () => {
    rulesPanel?.classList.remove("cw-open");
    couponOverlay?.classList.add("cw-open");
    void loadAnonymousCoupons();
  };

  // ------------------------------------
  // Recorder
  // ------------------------------------

  cameraButton.onclick = () => {
    window.dispatchEvent(new CustomEvent("cyberwrap-record"));
  };
}

// -----------------------------------------------------
// Cleanup
// -----------------------------------------------------

function destroyHUD() {
  // ------------------------------------
  // Stop animation loop
  // ------------------------------------

  if (hudAnimationFrame) {
    cancelAnimationFrame(hudAnimationFrame);

    hudAnimationFrame = 0;
  }

  // ------------------------------------
  // Remove HUD
  // ------------------------------------

  if (hudRoot) {
    hudRoot.remove();
  }

  // ------------------------------------
  // Clear references
  // ------------------------------------

  hudRoot = null;

  dashboard = null;

  tapPanel = null;

  rulesPanel = null;

  couponsPanel = null;

  rulesButton = null;

  couponButton = null;

  cameraButton = null;

  timeValue = null;

  scoreValue = null;

  scorePopup = null;

  rewardOverlay = null;

  couponOverlay = null;

  minimapCanvas = null;

  hudWorld = null;
}

// -----------------------------------------------------
// ECS Component
// -----------------------------------------------------

ecs.registerComponent({
  name: "hud",

  stateMachine: ({ world, defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        hudWorld = world;
        createHUD();

        setupButtons();

        updateHUD();
      });
  },
});

// -----------------------------------------------------
// Optional Hot Reload Cleanup
// -----------------------------------------------------

window.addEventListener("beforeunload", () => {
  destroyHUD();
});
