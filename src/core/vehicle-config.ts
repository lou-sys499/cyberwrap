/**
 * =============================================================
 * CYBERWRAP VEHICLE CONFIGURATION SYSTEM
 * =============================================================
 *
 * Centralized, authoritative runtime configuration for vehicle physics,
 * Nitro boost tuning, and steering control modes.
 *
 * Architecture:
 *   DEFAULT_VEHICLE_CONFIG -> runtimeVehicleConfig -> driving-system.ts
 *
 * Features:
 * - Runtime in-memory configuration object
 * - Dynamic live tuning without page reload
 * - Safe validation and clamping
 * - Optional persistence in localStorage ("cyberwrap_vehicle_config_v1")
 * - Feature flag ENABLE_DEV_VEHICLE_CONFIG to disable in production
 *
 * NOTE: Never sends vehicle tuning data to Supabase or coupon APIs.
 * =============================================================
 */

export const ENABLE_DEV_VEHICLE_CONFIG = true;

export const VEHICLE_CONFIG_STORAGE_KEY = "cyberwrap_vehicle_config_v1";

export const VEHICLE_CONFIG_UPDATED_EVENT = "cyberwrap-vehicle-config-updated";

export type SteeringControlMode = "joystick" | "buttons";

export interface VehicleConfig {
  // Vehicle physics
  maxSpeed: number;
  acceleration: number;
  reverseSpeed: number;
  friction: number;
  steeringSpeed: number;
  steeringSensitivity: number;

  // Nitro Boost tuning
  nitroMaxSpeedBonus: number;
  nitroAccelerationMultiplier: number;
  nitroDuration: number;

  // Steering control mode
  controlMode: SteeringControlMode;
}

/**
 * Authoritative default values matching the tuned CyberWrap vehicle.
 */
export const DEFAULT_VEHICLE_CONFIG: Readonly<VehicleConfig> = Object.freeze({
  maxSpeed: 4.5,
  acceleration: 2.0,
  reverseSpeed: 1.5,
  friction: 1.0,
  steeringSpeed: 0.7,
  steeringSensitivity: 1.0,

  nitroMaxSpeedBonus: 5.0,
  nitroAccelerationMultiplier: 1.5,
  nitroDuration: 5.0,

  controlMode: "buttons",
});

/**
 * Recommended and validated slider bounds.
 */
export const VEHICLE_CONFIG_BOUNDS = {
  maxSpeed: { min: 0.5, max: 20.0, step: 0.1 },
  acceleration: { min: 0.5, max: 30.0, step: 0.1 },
  reverseSpeed: { min: 0.2, max: 10.0, step: 0.1 },
  friction: { min: 0.0, max: 20.0, step: 0.1 },
  steeringSpeed: { min: 0.5, max: 10.0, step: 0.1 },
  steeringSensitivity: { min: 0.1, max: 2.0, step: 0.05 },

  nitroMaxSpeedBonus: { min: 0.0, max: 15.0, step: 0.1 },
  nitroAccelerationMultiplier: { min: 1.0, max: 3.0, step: 0.1 },
  nitroDuration: { min: 1.0, max: 15.0, step: 0.5 },
} as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, num));
}

/**
 * Validates and clamps an arbitrary input config against known boundaries.
 */
export function validateVehicleConfig(raw: Partial<VehicleConfig> | null | undefined): VehicleConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VEHICLE_CONFIG };
  }

  const b = VEHICLE_CONFIG_BOUNDS;
  const d = DEFAULT_VEHICLE_CONFIG;

  const controlMode: SteeringControlMode =
    raw.controlMode === "joystick" ? "joystick" : "buttons";

  return {
    maxSpeed: clamp(raw.maxSpeed, b.maxSpeed.min, b.maxSpeed.max, d.maxSpeed),
    acceleration: clamp(raw.acceleration, b.acceleration.min, b.acceleration.max, d.acceleration),
    reverseSpeed: clamp(raw.reverseSpeed, b.reverseSpeed.min, b.reverseSpeed.max, d.reverseSpeed),
    friction: clamp(raw.friction, b.friction.min, b.friction.max, d.friction),
    steeringSpeed: clamp(raw.steeringSpeed, b.steeringSpeed.min, b.steeringSpeed.max, d.steeringSpeed),
    steeringSensitivity: clamp(
      raw.steeringSensitivity,
      b.steeringSensitivity.min,
      b.steeringSensitivity.max,
      d.steeringSensitivity
    ),
    nitroMaxSpeedBonus: clamp(
      raw.nitroMaxSpeedBonus,
      b.nitroMaxSpeedBonus.min,
      b.nitroMaxSpeedBonus.max,
      d.nitroMaxSpeedBonus
    ),
    nitroAccelerationMultiplier: clamp(
      raw.nitroAccelerationMultiplier,
      b.nitroAccelerationMultiplier.min,
      b.nitroAccelerationMultiplier.max,
      d.nitroAccelerationMultiplier
    ),
    nitroDuration: clamp(raw.nitroDuration, b.nitroDuration.min, b.nitroDuration.max, d.nitroDuration),
    controlMode,
  };
}

export const BUTTONS_MAIN_STEERING_MIGRATION_KEY = "cyberwrap_steering_main_buttons_v1";

/**
 * Load saved configuration from localStorage, or return defaults.
 */
export function loadVehicleConfigFromStorage(): VehicleConfig {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_VEHICLE_CONFIG };
  }

  try {
    // Migration: ensure Left/Right buttons are the default main steering controls
    if (window.localStorage.getItem(BUTTONS_MAIN_STEERING_MIGRATION_KEY) !== "true") {
      window.localStorage.setItem(BUTTONS_MAIN_STEERING_MIGRATION_KEY, "true");
      const raw = window.localStorage.getItem(VEHICLE_CONFIG_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          parsed.controlMode = "buttons";
          window.localStorage.setItem(VEHICLE_CONFIG_STORAGE_KEY, JSON.stringify(parsed));
          return validateVehicleConfig(parsed);
        } catch {}
      }
      return { ...DEFAULT_VEHICLE_CONFIG };
    }

    const raw = window.localStorage.getItem(VEHICLE_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_VEHICLE_CONFIG };
    }
    const parsed = JSON.parse(raw);
    return validateVehicleConfig(parsed);
  } catch (err) {
    console.warn("[CyberWrap] Failed to parse vehicle config from localStorage, using defaults", err);
    return { ...DEFAULT_VEHICLE_CONFIG };
  }
}

/**
 * Active in-memory vehicle configuration.
 * Initialized immediately from localStorage if available, otherwise defaults.
 */
export let runtimeVehicleConfig: VehicleConfig = loadVehicleConfigFromStorage();

/**
 * Dispatches an event when runtimeVehicleConfig changes.
 */
export function dispatchVehicleConfigUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<VehicleConfig>(VEHICLE_CONFIG_UPDATED_EVENT, {
        detail: { ...runtimeVehicleConfig },
      })
    );
  }
}

/**
 * Updates in-memory runtime configuration with live validation.
 */
export function setRuntimeVehicleConfig(updates: Partial<VehicleConfig>): void {
  const merged = { ...runtimeVehicleConfig, ...updates };
  runtimeVehicleConfig = validateVehicleConfig(merged);
  dispatchVehicleConfigUpdate();
}

/**
 * Restores defaults in runtime memory (does not overwrite localStorage unless saved).
 */
export function resetRuntimeVehicleConfigToDefaults(): void {
  runtimeVehicleConfig = { ...DEFAULT_VEHICLE_CONFIG };
  dispatchVehicleConfigUpdate();
}

/**
 * Saves the active runtime configuration to localStorage.
 */
export function saveRuntimeVehicleConfigToStorage(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    window.localStorage.setItem(
      VEHICLE_CONFIG_STORAGE_KEY,
      JSON.stringify(runtimeVehicleConfig)
    );
    return true;
  } catch (err) {
    console.error("[CyberWrap] Failed to save vehicle config to localStorage", err);
    return false;
  }
}

/**
 * Clears saved configuration from localStorage and resets memory to defaults.
 */
export function resetSavedRuntimeVehicleConfig(): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(VEHICLE_CONFIG_STORAGE_KEY);
    } catch {}
  }
  resetRuntimeVehicleConfigToDefaults();
}
