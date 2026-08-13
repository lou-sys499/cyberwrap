import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { GAME_CONFIG } from "../core/constants";

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
          gameData.state === GameState.SCANNING &&
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

          // ----------------------------------------
          // Play complete countdown sound ONCE
          //
          // countdown.mp3 already contains:
          //
          // 3...
          // 2...
          // 1...
          // GO!
          // ----------------------------------------

          playSound("countdown");

          gameData.state = GameState.COUNTDOWN;

          console.log("[Timer] COUNTDOWN START");

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

          // ----------------------------------------
          // Countdown complete
          //
          // IMPORTANT:
          //
          // DO NOT play "go".
          //
          // countdown.mp3 already contains GO!
          // ----------------------------------------

          if (gameData.countdownTime <= 0) {
            gameStartTime = now;

            gameData.state = GameState.DRIVING;

            gameData.canDrive = true;

            gameData.gameStarted = true;

            // --------------------------------------
            // Start background music
            // --------------------------------------

            startMusic();

            console.log("[Timer] DRIVING START");
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

            console.log("[Timer] GAME OVER");

            console.log("[RESULT]", {
              score: gameData.score,
            });
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
