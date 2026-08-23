import * as ecs from "@8thwall/ecs";
import { trackEvent } from "./core/analytics";

console.log("[CyberWrap] hide-on-ready.ts LOADED");

// ==================================================
// STARTUP STATE
// ==================================================

let userStarted = false;
let realityReady = false;
let startupComplete = false;

// iOS Safari can delay or miss the ECS REALITY_READY event while the
// camera permission prompt and AR session are starting.
let startupFallbackTimer: number | null = null;

// Prevent multiple physical events from triggering
// startup more than once.
let startInputHandled = false;

// ==================================================
// HIDE OPENER
// ==================================================

function hideOpener(): void {
  const opener = document.getElementById("cyberwrap-opener");

  if (startupFallbackTimer !== null) {
    window.clearTimeout(startupFallbackTimer);
    startupFallbackTimer = null;
  }

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
  console.log("[CyberWrap] tryStart()", {
    userStarted,
    realityReady,
    startupComplete,
  });

  // ----------------------------------------------
  // Already started
  // ----------------------------------------------

  if (startupComplete) {
    console.log("[CyberWrap] Startup already complete");

    return;
  }

  // ----------------------------------------------
  // User hasn't pressed START AR
  // ----------------------------------------------

  if (!userStarted) {
    console.log("[CyberWrap] Waiting for START AR...");

    return;
  }

  // ----------------------------------------------
  // AR isn't ready yet
  // ----------------------------------------------

  if (!realityReady) {
    console.log("[CyberWrap] START AR received.");

    console.log("[CyberWrap] Waiting for REALITY_READY...");

    // Do not leave iPhone users behind the opener if Safari does not
    // deliver REALITY_READY to the ECS listener.
    if (startupFallbackTimer === null) {
      startupFallbackTimer = window.setTimeout(() => {
        startupFallbackTimer = null;

        if (!startupComplete && userStarted) {
          console.warn(
            "[CyberWrap] REALITY_READY delayed; releasing the startup opener",
          );

          startupComplete = true;
          hideOpener();
        }
      }, 4000);
    }

    return;
  }

  // ----------------------------------------------
  // Both conditions satisfied
  // ----------------------------------------------

  startupComplete = true;

  console.log("[CyberWrap] =============================");

  console.log("[CyberWrap] STARTUP COMPLETE");

  console.log("[CyberWrap] =============================");

  hideOpener();
}

// ==================================================
// START EXPERIENCE
// ==================================================

function startExperience(event: Event): void {
  // ----------------------------------------------
  // Stop the event from reaching the AR scene
  // ----------------------------------------------

  event.preventDefault();
  event.stopPropagation();

  console.log("[CyberWrap] START AR INPUT RECEIVED");

  // ----------------------------------------------
  // Prevent duplicate touch/click events
  // ----------------------------------------------

  if (startInputHandled) {
    console.log("[CyberWrap] Duplicate START AR input ignored");

    return;
  }

  startInputHandled = true;

  // ----------------------------------------------
  // User has explicitly started the experience
  // ----------------------------------------------

  userStarted = true;

  console.log("[CyberWrap] userStarted = true");

  console.log("[CyberWrap] realityReady =", realityReady);

  // ----------------------------------------------
  // Disable button
  // ----------------------------------------------

  const startButton = document.getElementById(
    "cyberwrap-start-ar",
  ) as HTMLButtonElement | null;

  if (startButton) {
    startButton.disabled = true;

    console.log("[CyberWrap] START AR button disabled");
  } else {
    console.warn("[CyberWrap] START AR button not found during startup");
  }

  // ----------------------------------------------
  // Starting animation
  // ----------------------------------------------

  const opener = document.getElementById("cyberwrap-opener");

  if (opener) {
    opener.classList.add("starting");
  }

  // ----------------------------------------------
  // Unlock audio
  // ----------------------------------------------

  window.dispatchEvent(new Event("cyberwrap-start"));

  console.log("[CyberWrap] cyberwrap-start event dispatched");

  // ----------------------------------------------
  // Attempt startup
  // ----------------------------------------------

  tryStart();
}

// ==================================================
// ATTACH START AR BUTTON
// ==================================================

function attachStartButton(): void {
  const startButton = document.getElementById(
    "cyberwrap-start-ar",
  ) as HTMLButtonElement | null;

  if (!startButton) {
    console.error("[CyberWrap] =============================");

    console.error("[CyberWrap] START AR BUTTON NOT FOUND");

    console.error("[CyberWrap] =============================");

    return;
  }

  console.log("[CyberWrap] START AR button found");

  // ----------------------------------------------
  // Make sure the button is visible and enabled
  // ----------------------------------------------

  startButton.disabled = false;

  // ----------------------------------------------
  // Pointer event
  //
  // This is the primary interaction.
  // ----------------------------------------------

  startButton.addEventListener("pointerup", startExperience, {
    passive: false,
  });

  // ----------------------------------------------
  // iOS touch fallback
  // ----------------------------------------------

  startButton.addEventListener("touchend", startExperience, {
    passive: false,
  });

  // ----------------------------------------------
  // Standard click fallback
  // ----------------------------------------------

  startButton.addEventListener("click", startExperience, {
    passive: false,
  });

  console.log("[CyberWrap] START AR input listeners attached");

  console.log("[CyberWrap] Waiting for user interaction...");
}

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "hide-on-ready",

  stateMachine: ({ world, defineState }) => {
    // ==================================================
    // INITIAL
    // ==================================================

    defineState("initial")
      .initial()

      .onEnter(() => {
        console.log("[CyberWrap] hide-on-ready INITIAL");

        console.log("[CyberWrap] Waiting for START AR...");

        const opener = document.getElementById("cyberwrap-opener");

        if (!opener) {
          console.warn("[CyberWrap] #cyberwrap-opener not found");

          return;
        }

        // ----------------------------------------------
        // Attach button
        // ----------------------------------------------

        attachStartButton();
      })

      // ==================================================
      // REALITY READY
      // ==================================================

      .onEvent(ecs.events.REALITY_READY, "ready", {
        target: world.events.globalId,
      });

    // ==================================================
    // READY
    // ==================================================

    defineState("ready").onEnter(() => {
      // ----------------------------------------------
      // Mark AR ready
      // ----------------------------------------------

      realityReady = true;

      console.log("[CyberWrap] =============================");

      console.log("[CyberWrap] REALITY_READY");

      console.log("[CyberWrap] userStarted =", userStarted);

      console.log("[CyberWrap] =============================");

      // ----------------------------------------------
      // Analytics
      // ----------------------------------------------

      trackEvent("ar_ready");

      // ----------------------------------------------
      // Keep START AR available if the user
      // hasn't pressed it yet.
      // ----------------------------------------------

      const startButton = document.getElementById(
        "cyberwrap-start-ar",
      ) as HTMLButtonElement | null;

      if (startButton && !userStarted) {
        startButton.disabled = false;

        console.log("[CyberWrap] START AR enabled after REALITY_READY");
      }

      // ----------------------------------------------
      // Continue startup
      // ----------------------------------------------

      tryStart();
    });
  },
});
