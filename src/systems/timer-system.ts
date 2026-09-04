import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { GAME_CONFIG } from "../core/constants";
import { trackEvent } from "../core/analytics";
import { ensureAnonymousPlayerId } from "../core/anonymous-player";
import {
  loadAnonymousRewardProgress,
  startAnonymousGame,
} from "../core/anonymous-rewards";

import {
  playSound,
  startMusic,
  stopMusic,
  resetAudioRound,
  checkLowTime,
  resetLowTimePlayed,
} from "./audio-system";
import { recordFakoLifecycleEvent } from "../core/diagnostics";
import { showTimeoutContinue } from "../ui/timeout-continue";
import { showGameOver } from "../ui/game-over";
import { resetNitro } from "../core/nitro";

// --------------------------------------------------
// Timer Variables
// --------------------------------------------------

let countdownStartTime = 0;

let gameStartTime = 0;

let lastDrivingTickTime = 0;

// Prevents repeated GAME OVER calls
let gameOverTriggered = false;

// Prevents repeated timeout offer triggers
let timeoutTriggered = false;

// --------------------------------------------------
// External Resumption & Game Over Handlers
// --------------------------------------------------

export function resumeGameWithBonusTime(seconds = 15): void {
  gameData.timeLeft = seconds;
  lastDrivingTickTime = performance.now();
  timeoutTriggered = false;
  gameOverTriggered = false;

  gameData.state = GameState.DRIVING;
  gameData.canDrive = true;

  resetLowTimePlayed();
  startMusic();
}

export function triggerGameOverFromTimeout(world: ecs.World): void {
  gameOverTriggered = true;
  gameData.canDrive = false;
  gameData.input.throttle = 0;
  gameData.input.steering = 0;
  gameData.state = GameState.GAMEOVER;

  stopMusic();
  playSound("gameover");
  showGameOver(world);
}

// --------------------------------------------------
// Timer System
// --------------------------------------------------

ecs.registerComponent({
  name: "timer-system",

  schema: {},

  stateMachine: ({ world, defineState }) => {
    defineState("active")
      .initial()

      .onTick(() => {
        const now = performance.now();

        // ==========================================
        // WAITING FOR TRUCK + FOOD SETUP
        // ==========================================

        if (
          gameData.state === GameState.START &&
          gameData.truckPlaced &&
          gameData.collectiblesSpawned
        ) {
          resetRoundData();

          countdownStartTime = now;

          gameData.countdownTime = GAME_CONFIG.COUNTDOWN_TIME;

          // ----------------------------------------
          // Reset audio for new round
          // ----------------------------------------

          resetAudioRound();

          recordFakoLifecycleEvent("countdownStartCount");
          console.log("[FakoLifecycle] State transition: START -> COUNTDOWN");

          gameData.state = GameState.COUNTDOWN;

          return;
        }

        // ==========================================
        // COUNTDOWN
        // ==========================================

        if (gameData.state === GameState.COUNTDOWN) {
          const elapsed = (now - countdownStartTime) / 1000;

          gameData.countdownTime = Math.max(
            0,
            GAME_CONFIG.COUNTDOWN_TIME - elapsed,
          );

          if (gameData.countdownTime <= 0) {
            gameStartTime = now;
            lastDrivingTickTime = now;

            ensureAnonymousPlayerId();
            if (gameData.gameMode === "challenge") {
              startAnonymousGame();
              void loadAnonymousRewardProgress();
            }

            gameData.state = GameState.DRIVING;

            gameData.canDrive = true;

            gameData.gameStarted = true;

            console.log("[FakoCamera] FIRST PLAYING FRAME (GameState.DRIVING active)");

            // --------------------------------------
            // Session analytics
            // --------------------------------------

            gameData.sessionStats.gamesStarted++;

            trackEvent("game_started", {
              gameNumber: gameData.sessionStats.gamesStarted,
            });

            // --------------------------------------
            // Start background music
            // --------------------------------------

            startMusic();
          }

          return;
        }

        // ==========================================
        // DRIVING TIMER
        // ==========================================

        if (gameData.state === GameState.DRIVING) {
          if (lastDrivingTickTime === 0) {
            lastDrivingTickTime = now;
          }

          const dt = Math.min(Math.max(0, (now - lastDrivingTickTime) / 1000), 0.1);
          lastDrivingTickTime = now;

          gameData.timeLeft = Math.max(0, gameData.timeLeft - dt);

          // ----------------------------------------
          // LOW TIME WARNING
          //
          // low-time.mp3 plays once at <= 10 sec
          // ----------------------------------------

          checkLowTime(gameData.timeLeft);

          // ----------------------------------------
          // OUT OF TIME: OFFER REWARDED CONTINUE (+15s) IN CHALLENGE,
          // OR DIRECT END IN FREE ROAM
          // ----------------------------------------

          if (gameData.timeLeft <= 0 && !timeoutTriggered && !gameOverTriggered) {
            timeoutTriggered = true;
            gameData.timeLeft = 0;

            // Pause vehicle movement and input
            gameData.canDrive = false;
            gameData.input.throttle = 0;
            gameData.input.steering = 0;

            if (gameData.gameMode === "challenge") {
              // Enter timeout pending state
              gameData.state = GameState.TIMEOUT_PENDING_CONTINUE;

              // Pause music while offer is shown
              stopMusic();

              // Display timeout continue dialog
              void showTimeoutContinue(world);
            } else {
              // Free Roam ends directly without rewarded video continue
              gameOverTriggered = true;
              gameData.state = GameState.GAMEOVER;
              stopMusic();
              playSound("gameover");
              showGameOver(world);
            }
          }

          return;
        }

        // ==========================================
        // TIMEOUT PENDING CONTINUE LOCK
        // ==========================================

        if (gameData.state === GameState.TIMEOUT_PENDING_CONTINUE) {
          gameData.canDrive = false;
          gameData.input.throttle = 0;
          gameData.input.steering = 0;
          return;
        }

        // ==========================================
        // GAME OVER LOCK
        // ==========================================

        if (gameData.state === GameState.GAMEOVER) {
          gameData.canDrive = false;
        }
      });
  },
});

// --------------------------------------------------
// Reset round values
// --------------------------------------------------

function resetRoundData() {
  // ----------------------------------------------
  // Score
  // ----------------------------------------------

  gameData.score = 0;
  gameData.freeRoamSessionScore = 0;

  // ----------------------------------------------
  // Food statistics
  // ----------------------------------------------

  gameData.collectedCount = 0;

  gameData.deliveriesCompleted = 0;

  // ----------------------------------------------
  // Timer
  // ----------------------------------------------

  gameData.timeLeft =
    gameData.gameMode === "freeRoam"
      ? GAME_CONFIG.FREE_ROAM_TIME
      : GAME_CONFIG.ROUND_TIME;

  // ----------------------------------------------
  // Game flags
  // ----------------------------------------------

  gameData.canDrive = false;

  gameData.gameStarted = false;

  // ----------------------------------------------
  // Game over & Timeout protection
  // ----------------------------------------------

  lastDrivingTickTime = 0;
  gameOverTriggered = false;
  timeoutTriggered = false;

  // ----------------------------------------------
  // Nitro Boost
  // ----------------------------------------------

  resetNitro();
}
