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
} from "./audio-system";

// --------------------------------------------------
// Timer Variables
// --------------------------------------------------

let countdownStartTime = 0;

let gameStartTime = 0;

// Prevents repeated GAME OVER calls
let gameOverTriggered = false;

// --------------------------------------------------
// Timer System
// --------------------------------------------------

ecs.registerComponent({
  name: "timer-system",

  schema: {},

  stateMachine: ({ defineState }) => {
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

            ensureAnonymousPlayerId();
            startAnonymousGame();
            void loadAnonymousRewardProgress();

            gameData.state = GameState.DRIVING;

            gameData.canDrive = true;

            gameData.gameStarted = true;

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
          const elapsed = (now - gameStartTime) / 1000;

          gameData.timeLeft = Math.max(0, GAME_CONFIG.ROUND_TIME - elapsed);

          // ----------------------------------------
          // LOW TIME WARNING
          //
          // low-time.mp3 plays once at <= 10 sec
          // ----------------------------------------

          checkLowTime(gameData.timeLeft);

          // ----------------------------------------
          // GAME OVER
          // ----------------------------------------

          if (gameData.timeLeft <= 0 && !gameOverTriggered) {
            gameOverTriggered = true;

            gameData.canDrive = false;

            gameData.state = GameState.GAMEOVER;

            // --------------------------------------
            // Stop background music
            // --------------------------------------

            stopMusic();

            // --------------------------------------
            // Play game over sound
            // --------------------------------------

            playSound("gameover");
          }

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

  // ----------------------------------------------
  // Food statistics
  // ----------------------------------------------

  gameData.collectedCount = 0;

  gameData.deliveriesCompleted = 0;

  // IMPORTANT:
  //
  // DO NOT RESET totalSpawned HERE.
  //
  // It tracks all food spawned during the round.
  //
  // ----------------------------------------------

  // ----------------------------------------------
  // Timer
  // ----------------------------------------------

  gameData.timeLeft = GAME_CONFIG.ROUND_TIME;

  // ----------------------------------------------
  // Game flags
  // ----------------------------------------------

  gameData.canDrive = false;

  gameData.gameStarted = false;

  // ----------------------------------------------
  // Game over protection
  // ----------------------------------------------

  gameOverTriggered = false;
}
