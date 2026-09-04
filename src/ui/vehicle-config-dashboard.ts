/**
 * =============================================================
 * CYBERWRAP VEHICLE CONFIG DEVELOPER DASHBOARD
 * =============================================================
 *
 * Developer-only dashboard for runtime vehicle tuning and testing.
 *
 * Features:
 * - Real-time vehicle physics sliders (Max Speed, Acceleration, Reverse, Friction, Steering)
 * - Steering sensitivity adjustment
 * - Nitro boost tuning (Speed bonus, Accel multiplier, Duration)
 * - Steering control mode toggle (Joystick wheel vs. Left/Right buttons)
 * - Live vehicle kinematics preview
 * - Defaults restore & LocalStorage persistence ("cyberwrap_vehicle_config_v1")
 * - Developer shortcut: Ctrl+Shift+C / Cmd+Shift+C
 * - Console hooks: window.__OPEN_CW_VEHICLE_CONFIG, window.__TOGGLE_CW_VEHICLE_CONFIG
 * - Production toggle: ENABLE_DEV_VEHICLE_CONFIG
 * =============================================================
 */

import { gameData } from "../core/game-data";
import {
  ENABLE_DEV_VEHICLE_CONFIG,
  DEFAULT_VEHICLE_CONFIG,
  VEHICLE_CONFIG_BOUNDS,
  runtimeVehicleConfig,
  setRuntimeVehicleConfig,
  resetRuntimeVehicleConfigToDefaults,
  saveRuntimeVehicleConfigToStorage,
  resetSavedRuntimeVehicleConfig,
  VEHICLE_CONFIG_UPDATED_EVENT,
  SteeringControlMode,
} from "../core/vehicle-config";

let dashboardModal: HTMLDivElement | null = null;
let isOpen = false;
let animFrameId: number | null = null;

// Sliders and badges map for reactive updating
interface SliderControl {
  slider: HTMLInputElement;
  badge: HTMLElement;
  key: keyof typeof VEHICLE_CONFIG_BOUNDS;
  unit?: string;
  format?: (val: number) => string;
}
const sliderControls: SliderControl[] = [];

// Buttons for control mode toggle
let btnModeJoystick: HTMLButtonElement | null = null;
let btnModeButtons: HTMLButtonElement | null = null;

// Status toast
let toastEl: HTMLDivElement | null = null;
let toastTimeout: number | null = null;

function showToast(message: string, isError = false): void {
  if (!toastEl) return;
  if (toastTimeout) window.clearTimeout(toastTimeout);

  toastEl.textContent = message;
  toastEl.style.color = isError ? "#f87171" : "#00f0ff";
  toastEl.style.borderColor = isError ? "#ef4444" : "#00f0ff";
  toastEl.style.opacity = "1";
  toastEl.style.transform = "translateY(0)";

  toastTimeout = window.setTimeout(() => {
    if (toastEl) {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateY(-6px)";
    }
  }, 2200);
}

/**
 * Update all sliders and badges to reflect current runtimeVehicleConfig.
 */
function syncDashboardWithConfig(): void {
  for (const item of sliderControls) {
    const val = runtimeVehicleConfig[item.key] as number;
    item.slider.value = String(val);
    item.badge.textContent = item.format ? item.format(val) : `${val.toFixed(1)}${item.unit || ""}`;
  }

  // Update mode toggle buttons
  const isButtons = runtimeVehicleConfig.controlMode === "buttons";
  if (btnModeJoystick && btnModeButtons) {
    if (isButtons) {
      setToggleButtonActive(btnModeButtons, true);
      setToggleButtonActive(btnModeJoystick, false);
    } else {
      setToggleButtonActive(btnModeJoystick, true);
      setToggleButtonActive(btnModeButtons, false);
    }
  }
}

function setToggleButtonActive(btn: HTMLButtonElement, active: boolean): void {
  if (active) {
    btn.style.background = "linear-gradient(180deg, rgba(0, 240, 255, 0.35) 0%, rgba(0, 140, 200, 0.4) 100%)";
    btn.style.borderColor = "#00f0ff";
    btn.style.color = "#ffffff";
    btn.style.boxShadow = "0 0 14px rgba(0, 240, 255, 0.6), inset 0 0 8px rgba(0, 240, 255, 0.4)";
  } else {
    btn.style.background = "rgba(10, 20, 35, 0.6)";
    btn.style.borderColor = "rgba(0, 240, 255, 0.25)";
    btn.style.color = "rgba(255, 255, 255, 0.6)";
    btn.style.boxShadow = "none";
  }
}

// Live preview telemetry elements
let previewSpeedEl: HTMLElement | null = null;
let previewMaxEl: HTMLElement | null = null;
let previewNitroMaxEl: HTMLElement | null = null;
let previewAccelEl: HTMLElement | null = null;
let previewSteerEl: HTMLElement | null = null;
let previewModeEl: HTMLElement | null = null;
let previewNitroStatusEl: HTMLElement | null = null;

function updateLivePreview(): void {
  if (!isOpen) return;

  if (previewSpeedEl) {
    previewSpeedEl.textContent = `${gameData.truckSpeed.toFixed(2)} m/s`;
  }
  if (previewMaxEl) {
    previewMaxEl.textContent = `${runtimeVehicleConfig.maxSpeed.toFixed(2)} m/s`;
  }
  if (previewNitroMaxEl) {
    const nitroMax = runtimeVehicleConfig.maxSpeed + runtimeVehicleConfig.nitroMaxSpeedBonus;
    previewNitroMaxEl.textContent = `${nitroMax.toFixed(2)} m/s`;
  }
  if (previewAccelEl) {
    previewAccelEl.textContent = `${runtimeVehicleConfig.acceleration.toFixed(2)}`;
  }
  if (previewSteerEl) {
    previewSteerEl.textContent = `${gameData.steeringValue.toFixed(2)}`;
  }
  if (previewModeEl) {
    previewModeEl.textContent =
      runtimeVehicleConfig.controlMode === "buttons" ? "Left / Right Buttons" : "Joystick Wheel";
  }
  if (previewNitroStatusEl) {
    if (gameData.nitroActive) {
      previewNitroStatusEl.innerHTML = `<span style="color: #60a5fa; font-weight: bold;">ACTIVE (${gameData.nitroTimeRemaining.toFixed(1)}s)</span>`;
    } else if (gameData.nitroAvailable) {
      previewNitroStatusEl.innerHTML = `<span style="color: #34d399; font-weight: bold;">READY ⚡</span>`;
    } else {
      previewNitroStatusEl.innerHTML = `<span style="color: rgba(255,255,255,0.4);">EMPTY</span>`;
    }
  }

  animFrameId = requestAnimationFrame(updateLivePreview);
}

/**
 * Builds the CW Vehicle Config developer modal.
 */
function createDashboardDOM(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = "cw-vehicle-config-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(4, 8, 16, 0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 10000005;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top, 12px)) max(12px, env(safe-area-inset-right, 12px)) max(12px, env(safe-area-inset-bottom, 12px)) max(12px, env(safe-area-inset-left, 12px));
    box-sizing: border-box;
    font-family: 'Rajdhani', sans-serif;
    user-select: none;
    -webkit-user-select: none;
  `;

  const container = document.createElement("div");
  container.id = "cw-vehicle-config-container";
  container.style.cssText = `
    position: relative;
    width: 100%;
    max-width: 520px;
    max-height: min(92vh, 760px);
    background: linear-gradient(180deg, rgba(12, 22, 38, 0.96) 0%, rgba(6, 12, 22, 0.98) 100%);
    border: 1.5px solid rgba(0, 240, 255, 0.5);
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.85), 0 0 30px rgba(0, 240, 255, 0.25), inset 0 0 20px rgba(0, 240, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #ffffff;
    box-sizing: border-box;
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: linear-gradient(90deg, rgba(0, 240, 255, 0.12) 0%, rgba(0, 240, 255, 0.02) 100%);
    border-bottom: 1px solid rgba(0, 240, 255, 0.25);
  `;

  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 10px; height: 10px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 8px #00f0ff;"></div>
      <div>
        <div style="font-family: 'Orbitron', sans-serif; font-size: clamp(13px, 2.2vw, 16px); font-weight: 900; letter-spacing: 1.5px; color: #00f0ff; text-shadow: 0 0 8px rgba(0,240,255,0.6);">
          CYBERWRAP VEHICLE CONFIG
        </div>
        <div style="font-size: 11px; letter-spacing: 1px; color: rgba(255, 255, 255, 0.6); text-transform: uppercase;">
          DEVELOPER CONTROL PANEL • LIVE TUNING
        </div>
      </div>
    </div>
  `;

  const btnClose = document.createElement("button");
  btnClose.type = "button";
  btnClose.setAttribute("aria-label", "Close Vehicle Config");
  btnClose.style.cssText = `
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #ffffff;
    font-family: 'Orbitron', sans-serif;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
  `;
  btnClose.textContent = "✕ CLOSE";
  btnClose.addEventListener("mouseenter", () => {
    btnClose.style.background = "rgba(239, 68, 68, 0.3)";
    btnClose.style.borderColor = "#ef4444";
    btnClose.style.color = "#fca5a5";
  });
  btnClose.addEventListener("mouseleave", () => {
    btnClose.style.background = "rgba(255, 255, 255, 0.08)";
    btnClose.style.borderColor = "rgba(255, 255, 255, 0.2)";
    btnClose.style.color = "#ffffff";
  });
  btnClose.addEventListener("click", () => closeDashboard());
  header.appendChild(btnClose);
  container.appendChild(header);

  // Status Toast
  toastEl = document.createElement("div");
  toastEl.style.cssText = `
    padding: 6px 14px;
    margin: 8px 18px 0;
    background: rgba(10, 25, 45, 0.9);
    border: 1px solid #00f0ff;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.5px;
    color: #00f0ff;
    opacity: 0;
    transform: translateY(-6px);
    transition: all 0.2s ease;
    pointer-events: none;
  `;
  container.appendChild(toastEl);

  // Scrollable Body
  const body = document.createElement("div");
  body.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    -webkit-overflow-scrolling: touch;
  `;

  // Custom slider inject style
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    #cw-vehicle-config-container input[type="range"] {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    #cw-vehicle-config-container input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #00f0ff;
      box-shadow: 0 0 10px #00f0ff;
      cursor: pointer;
      border: 1.5px solid #ffffff;
      transition: transform 0.1s ease;
    }
    #cw-vehicle-config-container input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }
    #cw-vehicle-config-container input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #00f0ff;
      box-shadow: 0 0 10px #00f0ff;
      cursor: pointer;
      border: 1.5px solid #ffffff;
    }
  `;
  container.appendChild(styleEl);

  // SECTION HELPER
  function createSection(title: string, subtitle?: string): HTMLDivElement {
    const sec = document.createElement("div");
    sec.style.cssText = `
      background: rgba(14, 25, 45, 0.55);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const secHeader = document.createElement("div");
    secHeader.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-bottom: 1px solid rgba(0, 240, 255, 0.15);
      padding-bottom: 8px;
    `;
    secHeader.innerHTML = `
      <div style="font-family: 'Orbitron', sans-serif; font-size: 12px; font-weight: 800; color: #00f0ff; letter-spacing: 1px;">
        ${title}
      </div>
      ${subtitle ? `<div style="font-size: 11px; color: rgba(255, 255, 255, 0.5);">${subtitle}</div>` : ""}
    `;
    sec.appendChild(secHeader);
    return sec;
  }

  // SLIDER ROW HELPER
  function addSliderRow(
    parent: HTMLElement,
    key: keyof typeof VEHICLE_CONFIG_BOUNDS,
    label: string,
    desc: string,
    unit = "",
    format?: (v: number) => string
  ): void {
    const bounds = VEHICLE_CONFIG_BOUNDS[key];
    const initialVal = runtimeVehicleConfig[key] as number;

    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const topRow = document.createElement("div");
    topRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = `
      <span style="font-weight: 700; font-size: 13px; color: #e2e8f0; letter-spacing: 0.5px;">${label}</span>
      <span style="font-size: 10.5px; color: rgba(255, 255, 255, 0.45); margin-left: 6px;">(${desc})</span>
    `;

    const badge = document.createElement("span");
    badge.style.cssText = `
      font-family: 'Orbitron', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #00f0ff;
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.35);
      padding: 2px 8px;
      border-radius: 6px;
      min-width: 52px;
      text-align: right;
    `;
    badge.textContent = format ? format(initialVal) : `${initialVal.toFixed(1)}${unit}`;

    topRow.appendChild(labelDiv);
    topRow.appendChild(badge);
    row.appendChild(topRow);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(bounds.min);
    slider.max = String(bounds.max);
    slider.step = String(bounds.step);
    slider.value = String(initialVal);

    slider.addEventListener("input", () => {
      const val = parseFloat(slider.value);
      badge.textContent = format ? format(val) : `${val.toFixed(1)}${unit}`;
      setRuntimeVehicleConfig({ [key]: val });
    });

    row.appendChild(slider);
    parent.appendChild(row);

    sliderControls.push({ slider, badge, key, unit, format });
  }

  // ==================================================
  // 1. VEHICLE PHYSICS SECTION
  // ==================================================
  const secVehicle = createSection("1. VEHICLE PHYSICS", "Core drivetrain, forward acceleration & turning");
  addSliderRow(secVehicle, "maxSpeed", "MAX SPEED", "Forward top speed", " m/s");
  addSliderRow(secVehicle, "acceleration", "ACCELERATION", "Throttle punch", " m/s²");
  addSliderRow(secVehicle, "reverseSpeed", "REVERSE SPEED", "Max backup speed", " m/s");
  addSliderRow(secVehicle, "friction", "FRICTION", "Rolling decay rate", " 1/s");
  addSliderRow(secVehicle, "steeringSpeed", "STEERING SPEED", "Yaw turning authority", " rad/s");
  addSliderRow(secVehicle, "steeringSensitivity", "STEERING SENSITIVITY", "Input responsiveness", "x");
  body.appendChild(secVehicle);

  // ==================================================
  // 2. NITRO BOOST SECTION
  // ==================================================
  const secNitro = createSection("2. NITRO BOOST TUNING", "Active boost multipliers and duration");
  addSliderRow(secNitro, "nitroMaxSpeedBonus", "NITRO SPEED BONUS", "Added to normal max speed", " m/s", (v) => `+${v.toFixed(1)} m/s`);
  addSliderRow(secNitro, "nitroAccelerationMultiplier", "NITRO ACCEL MULTIPLIER", "Thrust multiplier", "x", (v) => `${v.toFixed(1)}x`);
  addSliderRow(secNitro, "nitroDuration", "NITRO DURATION", "Active boost burn time", "s", (v) => `${v.toFixed(1)}s`);
  body.appendChild(secNitro);

  // ==================================================
  // 3. STEERING CONTROL MODE SECTION
  // ==================================================
  const secControl = createSection("3. STEERING CONTROL MODE", "Select player steering interface");
  const modeBtnContainer = document.createElement("div");
  modeBtnContainer.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
  `;

  btnModeJoystick = document.createElement("button");
  btnModeJoystick.type = "button";
  btnModeJoystick.style.cssText = `
    padding: 10px;
    border-radius: 8px;
    border: 1px solid rgba(0, 240, 255, 0.4);
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  `;
  btnModeJoystick.innerHTML = `
    <span style="font-size: 16px;">🕹️</span>
    <span>JOYSTICK WHEEL</span>
  `;
  btnModeJoystick.addEventListener("click", () => {
    setRuntimeVehicleConfig({ controlMode: "joystick" });
    syncDashboardWithConfig();
  });

  btnModeButtons = document.createElement("button");
  btnModeButtons.type = "button";
  btnModeButtons.style.cssText = `
    padding: 10px;
    border-radius: 8px;
    border: 1px solid rgba(0, 240, 255, 0.4);
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  `;
  btnModeButtons.innerHTML = `
    <span style="font-size: 16px;">◀ ▶</span>
    <span>LEFT / RIGHT BUTTONS</span>
  `;
  btnModeButtons.addEventListener("click", () => {
    setRuntimeVehicleConfig({ controlMode: "buttons" });
    syncDashboardWithConfig();
  });

  modeBtnContainer.appendChild(btnModeJoystick);
  modeBtnContainer.appendChild(btnModeButtons);
  secControl.appendChild(modeBtnContainer);
  body.appendChild(secControl);

  // ==================================================
  // 4. LIVE VEHICLE PREVIEW SECTION
  // ==================================================
  const secPreview = createSection("4. LIVE VEHICLE PREVIEW", "Real-time truck telemetry & active parameters");
  const previewGrid = document.createElement("div");
  previewGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    font-size: 12px;
  `;

  function addPreviewCard(label: string): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = `
      background: rgba(6, 14, 26, 0.7);
      border: 1px solid rgba(0, 240, 255, 0.15);
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;
    const labelSpan = document.createElement("span");
    labelSpan.style.cssText = "color: rgba(255, 255, 255, 0.5); font-size: 10.5px;";
    labelSpan.textContent = label;
    const valSpan = document.createElement("span");
    valSpan.style.cssText = "font-family: 'Orbitron', sans-serif; font-weight: 700; color: #00f0ff;";
    valSpan.textContent = "-";
    card.appendChild(labelSpan);
    card.appendChild(valSpan);
    previewGrid.appendChild(card);
    return valSpan;
  }

  previewSpeedEl = addPreviewCard("Current Speed");
  previewMaxEl = addPreviewCard("Normal Max Speed");
  previewNitroMaxEl = addPreviewCard("Nitro Boost Max");
  previewAccelEl = addPreviewCard("Base Acceleration");
  previewSteerEl = addPreviewCard("Steering Input");
  previewModeEl = addPreviewCard("Steering Mode");
  previewNitroStatusEl = addPreviewCard("Nitro Boost State");

  secPreview.appendChild(previewGrid);
  body.appendChild(secPreview);

  // ==================================================
  // 5. ACTIONS / PERSISTENCE BUTTONS
  // ==================================================
  const secActions = document.createElement("div");
  secActions.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 4px;
  `;

  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.style.cssText = `
    flex: 1 1 45%;
    padding: 10px;
    background: linear-gradient(180deg, rgba(0, 240, 255, 0.3) 0%, rgba(0, 150, 210, 0.35) 100%);
    border: 1.5px solid #00f0ff;
    border-radius: 8px;
    color: #ffffff;
    font-family: 'Orbitron', sans-serif;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
    box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
    outline: none;
    transition: all 0.15s ease;
  `;
  btnSave.textContent = "💾 SAVE SETTINGS";
  btnSave.addEventListener("click", () => {
    const ok = saveRuntimeVehicleConfigToStorage();
    if (ok) {
      showToast("✓ Vehicle settings saved to LocalStorage!");
    } else {
      showToast("✗ Failed to save to LocalStorage", true);
    }
  });

  const btnResetDefaults = document.createElement("button");
  btnResetDefaults.type = "button";
  btnResetDefaults.style.cssText = `
    flex: 1 1 45%;
    padding: 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
    color: #e2e8f0;
    font-family: 'Orbitron', sans-serif;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  `;
  btnResetDefaults.textContent = "↺ RESET DEFAULTS";
  btnResetDefaults.addEventListener("click", () => {
    resetRuntimeVehicleConfigToDefaults();
    syncDashboardWithConfig();
    showToast("↺ Restored default CyberWrap vehicle settings!");
  });

  const btnClearStorage = document.createElement("button");
  btnClearStorage.type = "button";
  btnClearStorage.style.cssText = `
    flex: 1 1 100%;
    padding: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 8px;
    color: #fca5a5;
    font-family: 'Orbitron', sans-serif;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  `;
  btnClearStorage.textContent = "🗑 RESET SAVED SETTINGS (CLEAR STORAGE)";
  btnClearStorage.addEventListener("click", () => {
    resetSavedRuntimeVehicleConfig();
    syncDashboardWithConfig();
    showToast("🗑 LocalStorage cleared & reset to defaults!");
  });

  secActions.appendChild(btnSave);
  secActions.appendChild(btnResetDefaults);
  secActions.appendChild(btnClearStorage);
  body.appendChild(secActions);

  container.appendChild(body);
  overlay.appendChild(container);

  // Close when clicking overlay backdrop
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeDashboard();
    }
  });

  return overlay;
}

/**
 * Open the developer vehicle configuration dashboard.
 */
export function openDashboard(): void {
  if (!ENABLE_DEV_VEHICLE_CONFIG) {
    console.info("[CyberWrap] Dev Vehicle Config is disabled via ENABLE_DEV_VEHICLE_CONFIG.");
    return;
  }

  if (!dashboardModal) {
    dashboardModal = createDashboardDOM();
    document.body.appendChild(dashboardModal);
  }

  syncDashboardWithConfig();
  dashboardModal.style.display = "flex";
  isOpen = true;

  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateLivePreview();
}

/**
 * Close the developer vehicle configuration dashboard.
 */
export function closeDashboard(): void {
  if (dashboardModal) {
    dashboardModal.style.display = "none";
  }
  isOpen = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

/**
 * Toggle the developer dashboard.
 */
export function toggleDashboard(): void {
  if (isOpen) {
    closeDashboard();
  } else {
    openDashboard();
  }
}

// ==================================================
// DEVELOPER SHORTCUT & MOBILE TOUCH ACTIVATION
// ==================================================

function setupDevListeners(): void {
  if (typeof window === "undefined" || !ENABLE_DEV_VEHICLE_CONFIG) {
    return;
  }

  // Keyboard shortcut: Ctrl+Shift+C or Cmd+Shift+C
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    // Check if within normal input
    if (
      e.target instanceof HTMLInputElement &&
      e.target.type !== "range"
    ) {
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    if (isCtrlOrMeta && e.shiftKey && (e.code === "KeyC" || e.key.toLowerCase() === "c")) {
      e.preventDefault();
      toggleDashboard();
    }

    // ESC to close if open
    if (e.code === "Escape" && isOpen) {
      e.preventDefault();
      closeDashboard();
    }
  });

  // Mobile multi-tap shortcut: 3 rapid taps on the top CyberWrap area
  let tapCount = 0;
  let tapTimer: number | null = null;
  window.addEventListener("pointerdown", (e: PointerEvent) => {
    // Only detect if tap is in top 15% of screen
    if (e.clientY < window.innerHeight * 0.15) {
      tapCount++;
      if (tapTimer) window.clearTimeout(tapTimer);
      if (tapCount >= 3) {
        tapCount = 0;
        toggleDashboard();
      } else {
        tapTimer = window.setTimeout(() => {
          tapCount = 0;
        }, 600);
      }
    }
  });

  // Global console hooks for developer ease
  (window as any).__OPEN_CW_VEHICLE_CONFIG = openDashboard;
  (window as any).__CLOSE_CW_VEHICLE_CONFIG = closeDashboard;
  (window as any).__TOGGLE_CW_VEHICLE_CONFIG = toggleDashboard;

  // Auto-open if dev query parameter is present
  try {
    if (
      window.location.search.includes("devconfig=1") ||
      window.location.search.includes("cw_config=1")
    ) {
      setTimeout(openDashboard, 400);
    }
  } catch {}
}

// Initialize listeners on module load
setupDevListeners();
