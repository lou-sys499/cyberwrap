import * as ecs from "@8thwall/ecs";

import { gameData } from "../core/game-data";

function createButton(text: string, x: string, y: string) {
  const btn = document.createElement("button");

  btn.innerHTML = text;

  btn.style.cssText = `

position:fixed;

${x}:40px;

${y}:120px;

width:70px;

height:70px;

border-radius:50%;

font-size:30px;

background:rgba(255,255,255,.35);

border:2px solid white;

z-index:9999;

touch-action:none;

`;

  document.body.appendChild(btn);

  return btn;
}

ecs.registerComponent({
  name: "vehicle-controls",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        const left = createButton("◀", "left", "bottom");

        const right = createButton("▶", "right", "bottom");

        const accel = createButton("▲", "right", "bottom");

        const reverse = createButton("▼", "right", "bottom:40px");

        left.onpointerdown = () => {
          gameData.input.steering = -1;
        };

        left.onpointerup = () => {
          gameData.input.steering = 0;
        };

        right.onpointerdown = () => {
          gameData.input.steering = 1;
        };

        right.onpointerup = () => {
          gameData.input.steering = 0;
        };

        accel.onpointerdown = () => {
          gameData.input.throttle = 1;
        };

        accel.onpointerup = () => {
          gameData.input.throttle = 0;
        };

        reverse.onpointerdown = () => {
          gameData.input.throttle = -1;
        };

        reverse.onpointerup = () => {
          gameData.input.throttle = 0;
        };
      });
  },
});
