import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";

// -----------------------------------------------------
// CYBERWRAP HUD
// -----------------------------------------------------

let hudRoot: HTMLDivElement;

let tapPanel: HTMLDivElement;

let dashboard: HTMLDivElement;

let timeValue: HTMLSpanElement;

let scoreValue: HTMLSpanElement;

let scorePopup: HTMLDivElement;

let rulesPanel: HTMLDivElement;

let rulesButton: HTMLButtonElement;

let cameraButton: HTMLButtonElement;

let styleLoaded = false;

// -----------------------------------------------------
// Font
// -----------------------------------------------------

function injectFont() {
  if (document.getElementById("cw-font")) return;

  const link = document.createElement("link");

  link.id = "cw-font";

  link.rel = "stylesheet";

  link.href =
    "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800&display=swap";

  document.head.appendChild(link);
}

// -----------------------------------------------------
// Styles
// -----------------------------------------------------

function injectStyles() {
  if (styleLoaded) return;

  styleLoaded = true;

  const style = document.createElement("style");

  style.innerHTML = `

    body {
      overflow: hidden;
    }

    /* ----------------------------- */
    /* ROOT */
    /* ----------------------------- */

    #cw-root {
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
      font-family: 'Orbitron', sans-serif;
    }

    /* ----------------------------- */
    /* DASHBOARD */
    /* ----------------------------- */

    #cw-dashboard {
      position: absolute;
      left: 18px;
      top: 18px;

      min-width: 210px;

      padding: 14px 18px;

      background:
        rgba(5, 18, 28, .55);

      backdrop-filter:
        blur(8px);

      border:
        1px solid rgba(0, 255, 255, .45);

      box-shadow:
        0 0 25px rgba(0, 255, 255, .18);

      border-radius: 14px;
    }

    /* ----------------------------- */
    /* TITLE */
    /* ----------------------------- */

    .cw-title {
      font-size: 13px;
      letter-spacing: 4px;
      color: #62f6ff;
      margin-bottom: 12px;
      font-weight: 800;
    }

    /* ----------------------------- */
    /* ROW */
    /* ----------------------------- */

    .cw-row {
      display: flex;
      justify-content: space-between;

      margin: 10px 0;

      font-size: 15px;

      letter-spacing: 2px;

      color: white;
    }

    /* ----------------------------- */
    /* VALUE */
    /* ----------------------------- */

    .cw-value {
      font-weight: 800;
      color: #74ffff;
      margin-left: 30px;
    }

    /* ----------------------------- */
    /* TAP TO PLACE */
    /* ----------------------------- */

    #tap-place {
      position: absolute;

      left: 50%;
      top: 50%;

      transform:
        translate(-50%, -50%);

      padding:
        24px 42px;

      border:
        2px solid cyan;

      border-radius: 16px;

      background:
        rgba(0, 20, 35, .7);

      font-size: 24px;

      font-weight: 800;

      letter-spacing: 6px;

      color: white;

      text-align: center;

      box-shadow:
        0 0 25px cyan;

      animation:
        cwBlink 1s infinite;
    }

    /* ----------------------------- */
    /* TAP DECORATION */
    /* ----------------------------- */

    #tap-place:before {
      content: "";

      position: absolute;

      left: -18px;
      right: -18px;

      top: -18px;
      bottom: -18px;

      border:
        1px solid rgba(0, 255, 255, .25);
    }

    /* ----------------------------- */
    /* BUTTONS */
    /* ----------------------------- */

    #cw-buttons {
      position: absolute;

      top: 18px;
      right: 18px;

      display: flex;

      gap: 10px;

      pointer-events: auto;
    }

    .cw-btn {
      width: 54px;
      height: 54px;

      border-radius: 50%;

      border:
        1px solid rgba(0, 255, 255, .45);

      background:
        rgba(0, 20, 35, .6);

      color: white;

      font-size: 22px;

      cursor: pointer;

      transition: .2s;

      -webkit-tap-highlight-color:
        transparent;

      user-select: none;
    }

    .cw-btn:hover {
      transform: scale(1.08);

      background:
        rgba(0, 255, 255, .2);
    }

    .cw-btn:active {
      transform: scale(.94);

      background:
        rgba(0, 255, 255, .3);
    }

    /* ----------------------------- */
    /* RULES PANEL */
    /* ----------------------------- */

    #cw-rules {
      position: absolute;

      right: 18px;
      top: 88px;

      width: 280px;

      padding: 18px;

      display: none;

      background:
        rgba(0, 15, 25, .88);

      border:
        1px solid cyan;

      border-radius: 14px;

      pointer-events: auto;

      color: white;

      font-size: 13px;

      line-height: 1.65;

      box-shadow:
        0 0 25px rgba(0, 255, 255, .2);

      backdrop-filter:
        blur(10px);
    }

    /* ----------------------------- */
    /* RULES TITLE */
    /* ----------------------------- */

    #cw-rules h3 {
      margin:
        0 0 14px;

      color:
        #74ffff;

      letter-spacing:
        2px;

      font-size:
        16px;
    }

    /* ----------------------------- */
    /* RULE ITEMS */
    /* ----------------------------- */

    .cw-rule {
      margin-bottom: 10px;
    }

    .cw-rule strong {
      color:
        #74ffff;

      letter-spacing:
        1px;
    }

    .cw-food-value {
      display: flex;

      justify-content:
        space-between;

      margin-top: 5px;

      padding:
        3px 0;
    }

    /* ----------------------------- */
    /* LOW TIME */
    /* ----------------------------- */

    .lowTime {
      color:
        #ff5555 !important;

      animation:
        cwPulse .8s infinite;
    }

    /* ----------------------------- */
    /* SCORE FLASH */
    /* ----------------------------- */

    .scoreFlash {
      animation:
        cwScore .35s;
    }

    /* ----------------------------- */
/* DELIVERY SCORE POPUP */
/* ----------------------------- */

#cw-score-popup {
  position: fixed;

  left: 50%;
  top: 42%;

  transform:
    translate(-50%, -50%)
    scale(.6);

  font-family: 'Orbitron', sans-serif;

  font-size: 42px;

  font-weight: 800;

  letter-spacing: 3px;

  color: #74ffff;

  text-shadow:
    0 0 10px cyan,
    0 0 25px cyan,
    0 0 45px rgba(0, 255, 255, .7);

  opacity: 0;

  pointer-events: none;

  z-index: 1000000;
}

#cw-score-popup.cw-show {
  animation:
    cwScorePopup .8s
    cubic-bezier(.2, .9, .3, 1);
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

    /* ----------------------------- */
    /* ANIMATIONS */
    /* ----------------------------- */

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
        transform:
          scale(1);
      }

      50% {
        transform:
          scale(1.1);
      }

      100% {
        transform:
          scale(1);
      }
    }

    @keyframes cwScore {
      0% {
        transform:
          scale(1);
      }

      50% {
        transform:
          scale(1.25);
      }

      100% {
        transform:
          scale(1);
      }
    }

  `;

  document.head.appendChild(style);
}

// -----------------------------------------------------
// Create HUD
// -----------------------------------------------------

function createHUD() {
  injectFont();

  injectStyles();

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
      <span>TIME</span>

      <span
        id="cw-time"
        class="cw-value"
      >
        60
      </span>
    </div>

    <div class="cw-row">
      <span>SCORE</span>

      <span
        id="cw-score"
        class="cw-value"
      >
        0
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

  // ------------------------------------
  // Tap To Place
  // ------------------------------------

  tapPanel = document.createElement("div");

  tapPanel.id = "tap-place";

  tapPanel.innerHTML = `
    TAP TO PLACE
  `;

  hudRoot.appendChild(tapPanel);

  // ------------------------------------
  // Buttons
  // ------------------------------------

  const buttons = document.createElement("div");

  buttons.id = "cw-buttons";

  // ------------------------------------
  // Rules button
  // ------------------------------------

  rulesButton = document.createElement("button");

  rulesButton.className = "cw-btn";

  rulesButton.innerHTML = "📖";

  rulesButton.setAttribute("aria-label", "Game Rules");

  // ------------------------------------
  // Camera button
  // ------------------------------------

  cameraButton = document.createElement("button");

  cameraButton.className = "cw-btn";

  cameraButton.innerHTML = "📹";

  cameraButton.setAttribute("aria-label", "Record");

  buttons.appendChild(rulesButton);

  buttons.appendChild(cameraButton);

  hudRoot.appendChild(buttons);

  // ------------------------------------
  // Rules Panel
  // ------------------------------------

  rulesPanel = document.createElement("div");

  rulesPanel.id = "cw-rules";

  rulesPanel.innerHTML = `

    <h3>
      HOW TO PLAY
    </h3>

    <div class="cw-rule">
      <strong>1. DRIVE</strong><br>
      Race around the DriveZone
      using your delivery truck.
    </div>

    <div class="cw-rule">
      <strong>2. COLLECT</strong><br>
      Pick up fresh ingredients.
      You can carry multiple items
      at once.
    </div>

    <div class="cw-rule">
      <strong>3. DELIVER</strong><br>
      Return to the glowing cyan
      Delivery Zone to deliver
      your cargo.
    </div>

    <div class="cw-rule">
      <strong>4. SCORE</strong><br>
      Every successful delivery
      earns points based on the
      ingredients collected.
    </div>

    <div class="cw-rule">
      <strong>5. BEAT THE CLOCK</strong><br>
      You have 60 seconds to score
      as many points as possible.
    </div>

    <br>

    <div
      style="
        color:#74ffff;
        text-align:center;
        font-weight:800;
        letter-spacing:1px;
      "
    >
      🏆 GET THE HIGHEST SCORE!
    </div>

    <br>

    <div
      style="
        border-top:1px solid rgba(0,255,255,.2);
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
        <span>🥙 Burrito</span>
        <span>+20</span>
      </div>

      <div class="cw-food-value">
        <span>🥩 Steak</span>
        <span>+15</span>
      </div>

      <div class="cw-food-value">
        <span>🍟 Fries</span>
        <span>+10</span>
      </div>

      <div class="cw-food-value">
        <span>🌶 Chili</span>
        <span>+5</span>
      </div>
    </div>

  `;

  hudRoot.appendChild(rulesPanel);

  // ------------------------------------
  // Add HUD to document
  // ------------------------------------

  document.body.appendChild(hudRoot);

  // ------------------------------------
  // Cache elements
  // ------------------------------------

  timeValue = document.getElementById("cw-time") as HTMLSpanElement;

  scoreValue = document.getElementById("cw-score") as HTMLSpanElement;

  scorePopup = document.getElementById("cw-score-popup") as HTMLDivElement;
}

// -----------------------------------------------------
// HUD Update Loop
// -----------------------------------------------------

let previousScore = 0;

// -----------------------------------------------------
// Delivery Score Popup
// -----------------------------------------------------

export function showDeliveryScore(amount: number) {
  if (!scorePopup) {
    return;
  }

  scorePopup.textContent = `+${amount}`;

  scorePopup.classList.remove("cw-show");

  // Force animation restart.
  void scorePopup.offsetWidth;

  scorePopup.classList.add("cw-show");
}

function updateHUD() {
  if (!timeValue || !scoreValue) {
    requestAnimationFrame(updateHUD);

    return;
  }

  // ------------------------------------
  // Hide TAP TO PLACE after placement
  // ------------------------------------

  if (gameData.driveZonePlaced) {
    tapPanel.style.display = "none";
  } else {
    tapPanel.style.display = "block";
  }

  // ------------------------------------
  // TIME
  // ------------------------------------

  const seconds = Math.max(0, Math.ceil(gameData.timeLeft));

  timeValue.textContent = seconds.toString();

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

    void scoreValue.offsetWidth;

    scoreValue.classList.add("scoreFlash");

    previousScore = gameData.score;
  }

  scoreValue.textContent = gameData.score.toString();

  // ------------------------------------
  // Continue
  // ------------------------------------

  requestAnimationFrame(updateHUD);
}

// -----------------------------------------------------
// Rules Toggle
// -----------------------------------------------------

function setupButtons() {
  // ------------------------------------
  // Rules
  // ------------------------------------

  rulesButton.onclick = () => {
    if (rulesPanel.style.display === "block") {
      rulesPanel.style.display = "none";
    } else {
      rulesPanel.style.display = "block";
    }
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
  if (hudRoot) {
    hudRoot.remove();
  }
}

// -----------------------------------------------------
// ECS Component
// -----------------------------------------------------

ecs.registerComponent({
  name: "hud",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
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
