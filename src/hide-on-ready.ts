import * as ecs from "@8thwall/ecs";
import { trackEvent } from "./core/analytics";

console.log("[CyberWrap] hide-on-ready.ts LOADED");

let userStarted = false;
let realityReady = false;
let startupComplete = false;

// ==================================================
// HIDE OPENER
// ==================================================

function hideOpener(): void {
  const opener = document.getElementById("cyberwrap-opener");

  if (!opener) {
    console.warn("[CyberWrap] Opener not found");
    return;
  }

  console.log("[CyberWrap] Hiding opener");

  opener.classList.add("hidden");

  window.setTimeout(() => {
    if (opener.parentNode) {
      opener.remove();
    }

    document.body.classList.remove("cyberwrap-booting");

    console.log("[CyberWrap] Opener removed");
  }, 850);
}

// ==================================================
// TRY START
// ==================================================

function tryStart(): void {
  if (startupComplete) {
    return;
  }

  if (!userStarted) {
    return;
  }

  if (!realityReady) {
    console.log("[CyberWrap] Waiting for REALITY_READY...");
    return;
  }

  startupComplete = true;

  console.log("[CyberWrap] Startup complete");

  hideOpener();
}

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "hide-on-ready",

  stateMachine: ({ world, defineState }) => {
    defineState("initial")
      .initial()

      .onEnter(() => {
        console.log("[CyberWrap] Waiting for user to start...");

        const opener = document.getElementById("cyberwrap-opener");

        const status = document.getElementById("opener-status");

        if (!opener) {
          console.warn("[CyberWrap] #cyberwrap-opener not found");

          return;
        }

        // ----------------------------------------------
        // Initial text
        // ----------------------------------------------

        if (status) {
          status.textContent = "TAP TO START";
        }

        // ----------------------------------------------
        // START EXPERIENCE
        // ----------------------------------------------

        const startExperience = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();

          if (userStarted) {
            return;
          }

          userStarted = true;

          console.log("[CyberWrap] User started experience");

          if (status) {
            status.textContent = "STARTING...";
          }

          opener.classList.add("starting");

          // --------------------------------------------
          // Analytics
          // --------------------------------------------

          trackEvent("session_started");

          // --------------------------------------------
          // Unlock audio
          // --------------------------------------------

          window.dispatchEvent(new Event("cyberwrap-start"));

          // --------------------------------------------
          // Continue startup
          // --------------------------------------------

          tryStart();
        };

        // ----------------------------------------------
        // IMPORTANT:
        // Attach directly to the opener.
        // ----------------------------------------------

        opener.addEventListener("pointerup", startExperience, {
          passive: false,
        });

        // ----------------------------------------------
        // Touch fallback
        // ----------------------------------------------

        opener.addEventListener("touchend", startExperience, {
          passive: false,
        });

        console.log("[CyberWrap] Tap-to-start listener attached");
      })

      // ==================================================
      // AR READY
      // ==================================================

      .onEvent(ecs.events.REALITY_READY, "ready", {
        target: world.events.globalId,
      });

    // ==================================================
    // READY
    // ==================================================

    defineState("ready").onEnter(() => {
      realityReady = true;

      console.log("[CyberWrap] REALITY_READY");

      trackEvent("ar_ready");

      const status = document.getElementById("opener-status");

      if (status && !userStarted) {
        status.textContent = "TAP TO START";
      }

      tryStart();
    });
  },
});
