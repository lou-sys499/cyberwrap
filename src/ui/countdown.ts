import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";
import { playSound } from "../systems/audio-system";

// --------------------------------------------------
// CyberWrap Countdown
//
// Displays: 3, 2, 1, GO! with cyberpunk typography and audio
// --------------------------------------------------

ecs.registerComponent({
  name: "countdown",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()
      .onEnter(() => {
        const div = document.createElement("div");
        div.id = "cw-countdown-display";
        div.style.cssText = `
          position: fixed;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(84px, 20vw, 150px);
          font-weight: 900;
          color: #ffffff;
          text-shadow:
            0 0 20px rgba(0, 240, 255, 0.9),
            0 0 45px rgba(0, 240, 255, 0.6),
            0 8px 16px rgba(0, 0, 0, 0.9);
          z-index: 9999999;
          display: none;
          pointer-events: none;
          font-family: 'Orbitron', -apple-system, sans-serif;
          line-height: 1;
          letter-spacing: 2px;
          user-select: none;
          -webkit-user-select: none;
          transition: transform 0.1s ease-out;
        `;

        document.body.appendChild(div);

        let lastSecond = -1;
        let goShown = false;

        const loop = () => {
          if (gameData.state === GameState.COUNTDOWN) {
            div.style.display = "block";
            const value = Math.max(1, Math.ceil(gameData.countdownTime));

            if (value !== lastSecond) {
              lastSecond = value;
              div.textContent = value.toString();
              div.style.color = "#00f0ff";
              div.style.transform = "translate(-50%, -50%) scale(1.2)";
              setTimeout(() => {
                div.style.transform = "translate(-50%, -50%) scale(1)";
              }, 120);

              playSound(
                value === 3
                  ? "countdown3"
                  : value === 2
                    ? "countdown2"
                    : "countdown1",
              );
            }

            goShown = false;
          } else if (gameData.state === GameState.DRIVING) {
            if (!goShown) {
              goShown = true;
              lastSecond = -1;
              div.textContent = "GO!";
              div.style.color = "#10b981";
              div.style.textShadow =
                "0 0 25px rgba(16, 185, 129, 0.9), 0 0 50px rgba(16, 185, 129, 0.7), 0 8px 16px rgba(0, 0, 0, 0.9)";
              div.style.display = "block";
              div.style.transform = "translate(-50%, -50%) scale(1.3)";

              playSound("go");

              window.setTimeout(() => {
                if (gameData.state === GameState.DRIVING) {
                  div.style.display = "none";
                }
              }, 800);
            }
          } else {
            div.style.display = "none";
            lastSecond = -1;
            goShown = false;
          }

          requestAnimationFrame(loop);
        };

        loop();
      });
  },
});
