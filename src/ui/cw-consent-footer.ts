import * as ecs from "@8thwall/ecs";

import {
  getAnalyticsConsent,
  grantAnalyticsConsent,
  denyAnalyticsConsent,
  startAnalyticsSession,
} from "../core/analytics";

// --------------------------------------------------
// CyberWrap Analytics Consent Footer
//
// Analytics are optional.
// Gameplay does NOT depend on consent.
//
// Developer testing:
// Add ?resetConsent=1 to the CyberWrap URL
// to clear the saved analytics choice.
//
// Example:
// ?resetConsent=1
// --------------------------------------------------

let footer: HTMLDivElement | null = null;

// --------------------------------------------------
// DEVELOPER SETTINGS
// --------------------------------------------------
//
// Change these values to quickly reposition the
// consent panel during development.
//

const CONSENT_POSITION = {
  bottom: "12px",
  maxWidth: "520px",
};

// --------------------------------------------------
// Developer consent reset
//
// Shortcuts:
// Ctrl + Shift + C
//
// Also supported:
// ?resetConsent=1
// --------------------------------------------------

function resetConsentForDevelopment(): void {
  try {
    localStorage.removeItem("cyberwrap-analytics-consent");
  } catch {
    // Ignore storage errors.
  }
}

// --------------------------------------------------
// URL reset
// --------------------------------------------------

function checkDeveloperReset(): void {
  try {
    const params = new URLSearchParams(window.location.search);

    if (params.get("resetConsent") !== "1") {
      return;
    }

    resetConsentForDevelopment();

    // Remove the reset parameter after processing.
    params.delete("resetConsent");

    const cleanUrl =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;

    window.history.replaceState({}, "", cleanUrl);
  } catch {
    // Ignore storage / URL errors.
  }
}

// --------------------------------------------------
// Keyboard shortcut
//
// Ctrl + Shift + C
//
// Development convenience only.
// --------------------------------------------------

function setupConsentResetShortcut(): void {
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();

      resetConsentForDevelopment();

      window.location.reload();
    }
  });
}

// --------------------------------------------------
// Styles
// --------------------------------------------------

function injectStyles(): void {
  if (document.getElementById("cw-consent-styles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "cw-consent-styles";

  style.textContent = `
    #cw-consent-footer {

      position: fixed;

      left: 50%;

      bottom: ${CONSENT_POSITION.bottom};

      transform: translateX(-50%);

      width: calc(100% - 24px);

      max-width: ${CONSENT_POSITION.maxWidth};

      box-sizing: border-box;

      padding: 12px 14px;

      border:
        1px solid
        rgba(0,255,255,.35);

      border-radius: 12px;

      background:
        rgba(0,10,18,.94);

      box-shadow:
        0 0 18px
        rgba(0,255,255,.12);

      backdrop-filter:
        blur(10px);

      -webkit-backdrop-filter:
        blur(10px);

      color: white;

      font-family:
        Arial,
        sans-serif;

      font-size: 11px;

      line-height: 1.45;

      z-index: 2000000;

      pointer-events: auto;

      user-select: none;

      -webkit-user-select: none;

      -webkit-touch-callout: none;

      touch-action: manipulation;

      opacity: 0;

      animation:
        cwConsentIn .25s ease-out forwards;
    }


    #cw-consent-text {

      margin-bottom: 10px;

      color:
        rgba(255,255,255,.82);

    }


    #cw-consent-title {

      display: block;

      margin-bottom: 4px;

      color: #74ffff;

      font-weight: 800;

      letter-spacing: 1px;

    }


    #cw-consent-actions {

      display: flex;

      gap: 8px;

    }


    .cw-consent-button {

      flex: 1;

      min-height: 38px;

      border-radius: 8px;

      border:
        1px solid
        rgba(0,255,255,.4);

      background:
        rgba(0,255,255,.08);

      color: white;

      font-weight: 700;

      letter-spacing: .5px;

      cursor: pointer;

      touch-action: manipulation;

      -webkit-tap-highlight-color:
        transparent;

      user-select: none;

      -webkit-user-select: none;

    }


    .cw-consent-button:active {

      transform:
        scale(.97);

    }


    .cw-consent-allow {

      background:
        rgba(0,255,255,.18);

      color: #74ffff;

    }


    .cw-consent-deny {

      background:
        rgba(255,255,255,.05);

    }


    @keyframes cwConsentIn {

      from {

        opacity: 0;

        transform:
          translateX(-50%)
          translateY(12px);

      }

      to {

        opacity: 1;

        transform:
          translateX(-50%)
          translateY(0);

      }

    }


    @media (max-width: 600px) {

      #cw-consent-footer {

        bottom: 8px;

        width:
          calc(100% - 16px);

        padding:
          10px 12px;

        font-size: 10px;

      }

    }
  `;

  document.head.appendChild(style);
}

// --------------------------------------------------
// Hide
// --------------------------------------------------

function hideFooter(): void {
  if (!footer) {
    return;
  }

  footer.remove();

  footer = null;
}

// --------------------------------------------------
// Create
// --------------------------------------------------

function createFooter(): void {
  // Already visible.
  if (footer) {
    return;
  }

  // Player has already made a choice.
  if (getAnalyticsConsent() !== "unknown") {
    return;
  }

  injectStyles();

  footer = document.createElement("div");

  footer.id = "cw-consent-footer";

  footer.innerHTML = `
    <div id="cw-consent-text">

      <span id="cw-consent-title">
        CYBERWRAP ANALYTICS
      </span>

      Help us improve CyberWrap by allowing
      anonymous gameplay statistics.

      No name, email, GPS, camera, microphone,
      or advertising ID is collected.

    </div>

    <div id="cw-consent-actions">

      <button
        type="button"
        class="cw-consent-button cw-consent-deny"
        id="cw-consent-deny"
      >
        NO THANKS
      </button>

      <button
        type="button"
        class="cw-consent-button cw-consent-allow"
        id="cw-consent-allow"
      >
        ALLOW
      </button>

    </div>
  `;

  document.body.appendChild(footer);

  // ------------------------------------------------
  // Buttons
  // ------------------------------------------------

  const allowButton = document.getElementById(
    "cw-consent-allow",
  ) as HTMLButtonElement | null;

  const denyButton = document.getElementById(
    "cw-consent-deny",
  ) as HTMLButtonElement | null;

  // ------------------------------------------------
  // Allow
  // ------------------------------------------------

  allowButton?.addEventListener(
    "click",
    () => {
      grantAnalyticsConsent();

      startAnalyticsSession();

      hideFooter();
    },
    {
      once: true,
    },
  );

  // ------------------------------------------------
  // Deny
  // ------------------------------------------------

  denyButton?.addEventListener(
    "click",
    () => {
      denyAnalyticsConsent();

      hideFooter();
    },
    {
      once: true,
    },
  );
}

// --------------------------------------------------
// ECS Component
// --------------------------------------------------

ecs.registerComponent({
  name: "cw-consent-footer",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        checkDeveloperReset();

        setupConsentResetShortcut();

        createFooter();
      });
  },
});

// --------------------------------------------------
// Cleanup
// --------------------------------------------------

window.addEventListener("beforeunload", () => {
  hideFooter();
});
