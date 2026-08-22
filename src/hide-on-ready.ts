import * as ecs from "@8thwall/ecs";
import { trackEvent } from "./core/analytics";

console.log("[CyberWrap] hide-on-ready.ts LOADED");

// ==================================================
// STARTUP STATE
// ==================================================

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
//
// Startup completes only when BOTH conditions are true:
//
// 1. User pressed START AR
// 2. 8th Wall reported REALITY_READY
//
// This allows either event to happen first.
// ==================================================

function tryStart(): void {
  if (startupComplete) {
    return;
  }

  // ----------------------------------------------
  // User has not pressed START AR yet
  // ----------------------------------------------

  if (!userStarted) {
    console.log("[CyberWrap] Waiting for START AR...");

    return;
  }

  // ----------------------------------------------
  // AR is not ready yet
  // ----------------------------------------------

  if (!realityReady) {
    console.log("[CyberWrap] START AR received — waiting for REALITY_READY...");

    return;
  }

  // ----------------------------------------------
  // Everything is ready
  // ----------------------------------------------

  startupComplete = true;

  console.log("[CyberWrap] Startup complete");

  hideOpener();
}

// ==================================================
// START AR
// ==================================================

function startExperience(event: Event): void {
  event.preventDefault();
  event.stopPropagation();

  // ----------------------------------------------
  // Prevent duplicate activation
  // ----------------------------------------------

  if (userStarted) {
    return;
  }

  // ----------------------------------------------
  // Mark startup as user initiated
  // ----------------------------------------------

  userStarted = true;

  console.log("[CyberWrap] START AR pressed");

  // ----------------------------------------------
  // Disable button immediately
  // ----------------------------------------------

  const startButton = document.getElementById(
    "cyberwrap-start-ar",
  ) as HTMLButtonElement | null;

  if (startButton) {
    startButton.disabled = true;
  }

  // ----------------------------------------------
  // Animate opener into starting state
  // ----------------------------------------------

  const opener = document.getElementById("cyberwrap-opener");

  if (opener) {
    opener.classList.add("starting");
  }

  // ----------------------------------------------
  // Analytics
  // ----------------------------------------------

  trackEvent("session_started");

  // ----------------------------------------------
  // Unlock audio
  //
  // This event allows the audio system to begin
  // playback from the user's actual interaction.
  // ----------------------------------------------

  window.dispatchEvent(new Event("cyberwrap-start"));

  console.log("[CyberWrap] Audio start event dispatched");

  // ----------------------------------------------
  // Continue startup
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
    console.error("[CyberWrap] START AR button not found");

    return;
  }

  // ----------------------------------------------
  // Make sure button is initially enabled
  // ----------------------------------------------

  startButton.disabled = false;

  // ----------------------------------------------
  // Attach ONE click listener
  //
  // A real button + click event gives iOS Safari
  // an explicit user interaction.
  // ----------------------------------------------

  startButton.addEventListener("click", startExperience, {
    passive: false,
    once: true,
  });

  console.log("[CyberWrap] START AR button listener attached");
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
        console.log("[CyberWrap] Waiting for START AR...");

        const opener = document.getElementById("cyberwrap-opener");

        if (!opener) {
          console.warn("[CyberWrap] #cyberwrap-opener not found");

          return;
        }

        // ----------------------------------------------
        // Attach START AR button
        // ----------------------------------------------

        attachStartButton();
      })

      // ==================================================
      // AR READY EVENT
      // ==================================================

      .onEvent(ecs.events.REALITY_READY, "ready", {
        target: world.events.globalId,
      });

    // ==================================================
    // READY
    // ==================================================

    defineState("ready").onEnter(() => {
      // ----------------------------------------------
      // Mark AR as ready
      // ----------------------------------------------

      realityReady = true;

      console.log("[CyberWrap] REALITY_READY");

      // ----------------------------------------------
      // Analytics
      // ----------------------------------------------

      trackEvent("ar_ready");

      // ----------------------------------------------
      // Make sure START AR remains available if
      // REALITY_READY happened before the user tap.
      // ----------------------------------------------

      const startButton = document.getElementById(
        "cyberwrap-start-ar",
      ) as HTMLButtonElement | null;

      if (startButton && !userStarted) {
        startButton.disabled = false;
      }

      // ----------------------------------------------
      // Attempt to complete startup
      // ----------------------------------------------

      tryStart();
    });
  },
});
