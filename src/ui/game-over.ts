import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { resetGame } from "../reset-button";
import { trackEvent } from "../core/analytics";
import { ensureSessionCompletion } from "../core/anonymous-rewards";

// -----------------------------------------------------
// CYBERWRAP GAME OVER
//
// Responsibilities:
// - Detect GAMEOVER state
// - Record final game-over analytics
// - Display final score
// - Allow player to replay
//
// IMPORTANT:
// Analytics are triggered only when GAMEOVER is
// actually reached. Never track analytics at
// module-load time.
// -----------------------------------------------------

let panel: HTMLDivElement | null = null;

let shown = false;

// Prevent duplicate game_over analytics events
// during repeated ECS ticks.
let analyticsRecorded = false;

// -----------------------------------------------------
// Font
// -----------------------------------------------------

function injectFont(): void {
  if (document.getElementById("cw-gameover-font")) {
    return;
  }

  const link = document.createElement("link");

  link.id = "cw-gameover-font";

  link.rel = "stylesheet";

  link.href =
    "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800&display=swap";

  document.head.appendChild(link);
}

// -----------------------------------------------------
// Styles
// -----------------------------------------------------

function injectStyles(): void {
  if (document.getElementById("cw-gameover-styles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "cw-gameover-styles";

  style.innerHTML = `
    body {
      overflow: hidden;
    }

    #cw-gameover {
      position: fixed;

      top: 50%;
      left: 50%;

      transform:
        translate(-50%, -50%);

      width:
        min(360px, calc(100vw - 40px));

      box-sizing: border-box;

      padding:
        32px 28px;

      background:
        rgba(5, 18, 28, 0.88);

      backdrop-filter:
        blur(12px);

      -webkit-backdrop-filter:
        blur(12px);

      border:
        1px solid
        rgba(0, 255, 255, 0.65);

      border-radius:
        18px;

      color:
        white;

      font-family:
        "Orbitron",
        sans-serif;

      text-align:
        center;

      z-index:
        1000000;

      box-shadow:
        0 0 20px
        rgba(0, 255, 255, 0.22),

        0 0 50px
        rgba(0, 255, 255, 0.12),

        inset 0 0 25px
        rgba(0, 255, 255, 0.04);

      animation:
        cwGameOverIn
        0.45s
        ease-out;
    }

    #cw-gameover::before {
      content: "";

      position: absolute;

      left: -8px;
      right: -8px;

      top: -8px;
      bottom: -8px;

      border:
        1px solid
        rgba(0, 255, 255, 0.16);

      border-radius:
        22px;

      pointer-events:
        none;

      box-shadow:
        0 0 20px
        rgba(0, 255, 255, 0.12);
    }

    .cw-gameover-title {
      margin:
        0 0 22px;

      color:
        #74ffff;

      font-size:
        28px;

      font-weight:
        800;

      letter-spacing:
        5px;

      text-shadow:
        0 0 10px
        rgba(0, 255, 255, 0.65),

        0 0 25px
        rgba(0, 255, 255, 0.25);
    }

    .cw-gameover-divider {
      width:
        70%;

      height:
        1px;

      margin:
        0 auto 24px;

      background:
        rgba(0, 255, 255, 0.45);

      box-shadow:
        0 0 10px
        rgba(0, 255, 255, 0.3);
    }

    .cw-gameover-label {
      margin-bottom:
        10px;

      color:
        rgba(255, 255, 255, 0.75);

      font-size:
        13px;

      font-weight:
        600;

      letter-spacing:
        4px;
    }

    .cw-gameover-score {
      margin:
        0 0 30px;

      color:
        #74ffff;

      font-size:
        52px;

      line-height:
        1;

      font-weight:
        800;

      letter-spacing:
        3px;

      text-shadow:
        0 0 10px
        rgba(0, 255, 255, 0.8),

        0 0 25px
        rgba(0, 255, 255, 0.45),

        0 0 50px
        rgba(0, 255, 255, 0.2);

      animation:
        cwScoreReveal
        0.7s
        ease-out;
    }

    #cw-play-again {
      width:
        100%;

      padding:
        15px 20px;

      border:
        1px solid
        rgba(0, 255, 255, 0.65);

      border-radius:
        12px;

      background:
        rgba(0, 255, 255, 0.08);

      color:
        white;

      font-family:
        "Orbitron",
        sans-serif;

      font-size:
        14px;

      font-weight:
        800;

      letter-spacing:
        3px;

      cursor:
        pointer;

      transition:
        0.2s;

      -webkit-tap-highlight-color:
        transparent;

      user-select:
        none;

      -webkit-user-select:
        none;

      box-shadow:
        0 0 15px
        rgba(0, 255, 255, 0.12);

      touch-action:
        manipulation;
    }

    #cw-play-again:hover {
      background:
        rgba(0, 255, 255, 0.18);

      border-color:
        #74ffff;

      box-shadow:
        0 0 25px
        rgba(0, 255, 255, 0.3);

      transform:
        translateY(-2px);
    }

    #cw-play-again:active {
      transform:
        scale(0.97);

      background:
        rgba(0, 255, 255, 0.25);
    }

    @keyframes cwGameOverIn {

      0% {
        opacity: 0;

        transform:
          translate(-50%, -46%)
          scale(0.92);
      }

      100% {
        opacity: 1;

        transform:
          translate(-50%, -50%)
          scale(1);
      }

    }

    @keyframes cwScoreReveal {

      0% {
        opacity: 0;

        transform:
          scale(0.65);
      }

      60% {
        transform:
          scale(1.12);
      }

      100% {
        opacity: 1;

        transform:
          scale(1);
      }

    }

    @media (max-width: 480px) {

      #cw-gameover {

        width:
          calc(100vw - 32px);

        padding:
          28px 22px;
      }

      .cw-gameover-title {

        font-size:
          24px;

        letter-spacing:
          4px;
      }

      .cw-gameover-score {

        font-size:
          46px;
      }

    }
  `;

  document.head.appendChild(style);
}

// -----------------------------------------------------
// Record Game Over Analytics
// -----------------------------------------------------
//
// This is called when GAMEOVER is actually reached.
//
// It is protected so repeated ECS ticks cannot
// generate duplicate game_over events.
// -----------------------------------------------------

function recordGameOverAnalytics(): void {
  if (analyticsRecorded) {
    return;
  }

  analyticsRecorded = true;

  // Ensure session completion is always recorded for cumulative rewards
  void ensureSessionCompletion(gameData.score);

  trackEvent("game_over", {
    score: gameData.score,

    collected: gameData.collectedCount,

    timeRemaining: gameData.timeLeft,

    highestScore: gameData.sessionStats.highestScore,

    gamesStarted: gameData.sessionStats.gamesStarted,

    sessionCollected: gameData.sessionStats.collectiblesCollected,

    deliveriesCompleted: gameData.sessionStats.deliveriesCompleted,
  });
}

// -----------------------------------------------------
// Show Game Over
// -----------------------------------------------------

function showGameOver(world: ecs.World): void {
  if (shown) {
    return;
  }

  shown = true;

  // ---------------------------------------------------
  // Record analytics exactly once
  // ---------------------------------------------------

  recordGameOverAnalytics();

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------

  injectFont();

  injectStyles();

  panel = document.createElement("div");

  panel.id = "cw-gameover";

  panel.innerHTML = `
    <div class="cw-gameover-title">
      TIME UP!
    </div>

    <div class="cw-gameover-divider"></div>

    <div class="cw-gameover-label">
      FINAL SCORE
    </div>

    <div class="cw-gameover-score">
      ${gameData.score}
    </div>

    <button
      id="cw-play-again"
      type="button"
    >
      PLAY AGAIN
    </button>
  `;

  document.body.appendChild(panel);

  // ---------------------------------------------------
  // Play Again
  // ---------------------------------------------------

  const button = document.getElementById(
    "cw-play-again",
  ) as HTMLButtonElement | null;

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    // -----------------------------------------------
    // Hide game-over UI
    // -----------------------------------------------

    hideGameOver();

    // -----------------------------------------------
    // Reset game
    // -----------------------------------------------

    resetGame(world);
    window.dispatchEvent(new Event("cyberwrap-start"));
  });
}

// -----------------------------------------------------
// Hide Game Over
// -----------------------------------------------------

export function hideGameOver(): void {
  if (panel) {
    panel.remove();

    panel = null;
  }

  shown = false;
}

// -----------------------------------------------------
// Reset Analytics Protection
// -----------------------------------------------------
//
// A new round is allowed to generate a new
// game_over event.
//
// IMPORTANT:
// This does NOT reset session statistics.
// Those belong to the browser session.
// -----------------------------------------------------

export function resetGameOverAnalytics(): void {
  analyticsRecorded = false;
}

// -----------------------------------------------------
// ECS Component
// -----------------------------------------------------

ecs.registerComponent({
  name: "game-over",

  schema: {},

  stateMachine: ({ world, defineState }) => {
    defineState("active")
      .initial()

      .onTick(() => {
        if (gameData.state === GameState.GAMEOVER) {
          showGameOver(world);
        }
      });
  },
});

// -----------------------------------------------------
// Hot Reload / Page Cleanup
// -----------------------------------------------------

window.addEventListener("beforeunload", () => {
  hideGameOver();
});
