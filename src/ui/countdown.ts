import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { playSound } from "../systems/audio-system";

// --------------------------------------------------
// CyberWrap Countdown
//
// Displays:
//
// 3
// 2
// 1
// GO!
//
// Audio is triggered at the same moment as each
// countdown number changes.
// --------------------------------------------------

ecs.registerComponent({
  name: "countdown",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        // --------------------------------------------
        // Create countdown element
        // --------------------------------------------

        const div = document.createElement("div");

        div.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);

          font-size: clamp(80px, 20vw, 140px);

          font-weight: 900;

          color: white;

          text-shadow:
            0 5px 15px rgba(0,0,0,.8),
            0 0 25px rgba(0,255,255,.7);

          z-index: 99999;

          display: none;

          pointer-events: none;

          font-family:
            Arial,
            sans-serif;

          line-height: 1;
        `;

        document.body.appendChild(div);

        // --------------------------------------------
        // State
        // --------------------------------------------

        let lastSecond = -1;

        let goShown = false;

        // --------------------------------------------
        // Countdown loop
        // --------------------------------------------

        const loop = () => {
          // ==========================================
          // COUNTDOWN
          // ==========================================

          if (gameData.state === GameState.COUNTDOWN) {
            div.style.display = "block";

            const value = Math.max(1, Math.ceil(gameData.countdownTime));

            // ----------------------------------------
            // New countdown number
            // ----------------------------------------

            if (value !== lastSecond) {
              lastSecond = value;

              div.textContent = value.toString();

              // --------------------------------------
              // Countdown sound
              // --------------------------------------

              playSound("countdown");
            }

            goShown = false;
          }

          // ==========================================
          // DRIVING
          // ==========================================
          else if (gameData.state === GameState.DRIVING) {
            // ----------------------------------------
            // Show GO only once
            // ----------------------------------------

            if (!goShown) {
              goShown = true;

              lastSecond = -1;

              div.textContent = "GO!";

              div.style.display = "block";

              // --------------------------------------
              // Countdown / GO sound
              //
              // Uses the same countdown audio so we
              // don't need another asset.
              // --------------------------------------

              playSound("countdown");

              // --------------------------------------
              // Hide GO
              // --------------------------------------

              window.setTimeout(() => {
                if (gameData.state === GameState.DRIVING) {
                  div.style.display = "none";
                }
              }, 700);
            }
          }

          // ==========================================
          // OTHER STATES
          // ==========================================
          else {
            div.style.display = "none";

            lastSecond = -1;

            goShown = false;
          }

          // ------------------------------------------
          // Continue
          // ------------------------------------------

          requestAnimationFrame(loop);
        };

        loop();
      });
  },
});
