import * as ecs from "@8thwall/ecs";
import { claimDailyGameplayRun } from "./core/daily-gameplay";
import { gameData } from "./core/game-data";
import { GAME_CONFIG } from "./core/constants";

export function hideOpener(): void {
  const opener = document.getElementById("cyberwrap-opener");

  if (!opener) {
    return;
  }

  opener.classList.add("hidden");
  document.body.classList.remove("cyberwrap-booting");
  
  // Add mountain background when game starts
  document.body.style.backgroundImage = "url('/assets/mountain-view.jpg')";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "fixed";
}

export function showOpener(): void {
  const opener = document.getElementById("cyberwrap-opener");
  if (!opener) {
    return;
  }

  opener.classList.remove("hidden");
  opener.classList.remove("starting");
  document.body.classList.add("cyberwrap-booting");

  const startBtn = document.getElementById("cyberwrap-start") as HTMLButtonElement | null;
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = "PLAY CHALLENGE";
  }

  const freeRoamBtn = document.getElementById("cw-btn-freeroam") as HTMLButtonElement | null;
  if (freeRoamBtn) {
    freeRoamBtn.disabled = false;
    freeRoamBtn.textContent = "FREE ROAM";
  }
}

ecs.registerComponent({
  name: "browser-start-gate",

  stateMachine: ({ defineState }) => {
    defineState("initial")
      .initial()
      .onEnter(() => {
        // --------------------------------------------------
        // 1. Daily Challenge Button
        // --------------------------------------------------
        const startButton = document.getElementById(
          "cyberwrap-start",
        ) as HTMLButtonElement | null;

        if (startButton) {
          startButton.addEventListener("click", async () => {
            startButton.disabled = true;
            startButton.textContent = "STARTING...";

            // Configure Challenge Mode
            gameData.gameMode = "challenge";
            gameData.timeLeft = GAME_CONFIG.ROUND_TIME;

            try {
              await claimDailyGameplayRun();
              hideOpener();
              window.dispatchEvent(new Event("cyberwrap-start"));
            } catch (err) {
              console.error("[CyberWrap] Error claiming daily run:", err);
              hideOpener();
              window.dispatchEvent(new Event("cyberwrap-start"));
            }
          });
        } else {
          console.error("[CyberWrap] Challenge start button not found");
        }

        // --------------------------------------------------
        // 2. Free Roam Button
        // --------------------------------------------------
        const freeRoamButton = document.getElementById(
          "cw-btn-freeroam",
        ) as HTMLButtonElement | null;

        if (freeRoamButton) {
          freeRoamButton.addEventListener("click", () => {
            freeRoamButton.disabled = true;
            freeRoamButton.textContent = "STARTING...";

            // Configure Free Roam Mode
            gameData.gameMode = "freeRoam";
            gameData.timeLeft = GAME_CONFIG.FREE_ROAM_TIME;
            gameData.freeRoamSessionScore = 0;

            // Free Roam does NOT consume daily runs or affect rewards
            hideOpener();
            window.dispatchEvent(new Event("cyberwrap-start"));
          });
        }
      });
  },
});


