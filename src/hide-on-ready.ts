import * as ecs from "@8thwall/ecs";
import {
  claimDailyGameplayRun,
  getCurrentCachedRunStatus,
} from "./core/daily-gameplay";
import { showDailyLimitModal } from "./ui/daily-run-ui";

function hideOpener(): void {
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

ecs.registerComponent({
  name: "browser-start-gate",

  stateMachine: ({ defineState }) => {
    defineState("initial")
      .initial()
      .onEnter(() => {
        const startButton = document.getElementById(
          "cyberwrap-start",
        ) as HTMLButtonElement | null;

        if (!startButton) {
          console.error("[CyberWrap] Browser start button not found");
          return;
        }

        startButton.addEventListener("click", async () => {
          const cached = getCurrentCachedRunStatus();
          if (cached.dailyRunsRemaining <= 0 || !cached.canStartRun) {
            showDailyLimitModal(cached);
            return;
          }

          startButton.disabled = true;
          const originalText = startButton.textContent || "PLAY";
          startButton.textContent = "STARTING...";

          try {
            const claimResult = await claimDailyGameplayRun();

            if (!claimResult.success) {
              startButton.disabled = false;
              startButton.textContent = originalText;
              showDailyLimitModal(claimResult);
              return;
            }

            // Run successfully claimed
            hideOpener();
            window.dispatchEvent(new Event("cyberwrap-start"));
          } catch (err) {
            console.error("[CyberWrap] Error claiming daily run:", err);
            // Allow start on critical error
            hideOpener();
            window.dispatchEvent(new Event("cyberwrap-start"));
          }
        });
      });
  },
});

