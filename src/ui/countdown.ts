import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";
import { GameState } from "../core/game-state";

ecs.registerComponent({
  name: "countdown",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        console.log("[Countdown] Loaded");

        const div = document.createElement("div");

        div.style.cssText = `

        position:fixed;

        top:50%;

        left:50%;

        transform:translate(-50%,-50%);

        font-size:100px;

        font-weight:bold;

        color:white;

        text-shadow:0 5px 15px black;

        z-index:99999;

        display:none;

      `;

        document.body.appendChild(div);

        let lastSecond = -1;

        const loop = () => {
          if (gameData.state === GameState.COUNTDOWN) {
            div.style.display = "block";

            const value = Math.ceil(gameData.countdownTime);

            if (value !== lastSecond) {
              lastSecond = value;

              div.innerHTML = value.toString();

              console.log("[Countdown]", value);
            }
          } else if (gameData.state === GameState.DRIVING) {
            if (div.innerHTML !== "GO!") {
              div.innerHTML = "GO!";

              setTimeout(() => {
                div.style.display = "none";
              }, 800);
            }
          }

          requestAnimationFrame(loop);
        };

        loop();
      });
  },
});
