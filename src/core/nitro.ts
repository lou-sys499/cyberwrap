import { gameData } from "./game-data";
import { GameState } from "./game-state";
import { runtimeVehicleConfig } from "./vehicle-config";
import { playSound } from "../systems/audio-system";
import { showNitroReadyNotice } from "../ui/hud";

export const NITRO_UPDATED_EVENT = "cyberwrap-nitro-updated";

export interface NitroStatus {
  available: boolean;
  active: boolean;
  timeRemaining: number;
  reason?: "recharged" | "activated" | "tick" | "expired" | "reset";
}

export function dispatchNitroUpdate(reason?: NitroStatus["reason"]): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<NitroStatus>(NITRO_UPDATED_EVENT, {
        detail: {
          available: gameData.nitroAvailable,
          active: gameData.nitroActive,
          timeRemaining: gameData.nitroTimeRemaining,
          reason,
        },
      })
    );
  }
}

/**
 * Activate Nitro Boost
 *
 * Rules:
 * - Can only activate when nitroAvailable is true AND nitroActive is false.
 * - State becomes: nitroAvailable = false, nitroActive = true, nitroTimeRemaining = 5.0
 * - Triggers punchy audio feedback
 * - Dispatches event for UI state update
 */
export function activateNitro(): boolean {
  if (gameData.state !== GameState.DRIVING) {
    return false;
  }

  if (!gameData.nitroAvailable || gameData.nitroActive) {
    return false;
  }

  gameData.nitroAvailable = false;
  gameData.nitroActive = true;
  gameData.nitroTimeRemaining = runtimeVehicleConfig.nitroDuration;

  playSound("go");
  dispatchNitroUpdate("activated");
  return true;
}

/**
 * Award Nitro Boost on Successful Delivery
 *
 * Rules:
 * - Player can hold a MAXIMUM OF ONE charge.
 * - If nitroAvailable is false and nitroActive is false: set nitroAvailable = true.
 * - If nitroAvailable is true: DO NOTHING (no stacking, no double charges).
 * - If nitroActive is true: DO NOTHING (no queueing, no extending duration, no timer reset).
 */
export function rechargeNitroOnDelivery(): boolean {
  if (gameData.nitroAvailable || gameData.nitroActive) {
    return false;
  }

  gameData.nitroAvailable = true;
  dispatchNitroUpdate("recharged");
  showNitroReadyNotice("⚡ NITRO READY!");
  return true;
}

/**
 * Decrement active Nitro timer using authoritative ECS delta time.
 * Must be called in the driving loop.
 */
export function tickNitro(delta: number): void {
  if (!gameData.nitroActive) {
    return;
  }

  gameData.nitroTimeRemaining = Math.max(0, gameData.nitroTimeRemaining - delta);

  if (gameData.nitroTimeRemaining <= 0) {
    gameData.nitroActive = false;
    gameData.nitroTimeRemaining = 0;
    dispatchNitroUpdate("expired");
  } else {
    dispatchNitroUpdate("tick");
  }
}

/**
 * Reset Nitro Boost state on game start or restart.
 */
export function resetNitro(): void {
  gameData.nitroAvailable = false;
  gameData.nitroActive = false;
  gameData.nitroTimeRemaining = 0;
  dispatchNitroUpdate("reset");
}
