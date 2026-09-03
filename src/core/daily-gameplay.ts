// =====================================================
// CyberWrap Daily Gameplay Economy Manager
// Phase 18B: 5 Runs Per Calendar Day Limit
//
// Responsibilities:
// - Track daily gameplay runs (Max 5 per calendar day)
// - Server-authoritative sync via Supabase atomic RPCs
// - Resilient fallback caching preventing client exploitation
// - Synchronize state across Opener, HUD, and Game Over UI
// =====================================================

import { ensureAnonymousPlayerId } from "./anonymous-player";
import { supabase } from "./supabase";
import { trackEvent } from "./analytics";

export const DAILY_RUN_LIMIT = 5;

const LOCAL_STORAGE_KEY = "cyberwrap_daily_runs_cache";

export interface DailyRunStatus {
  dailyRunsUsed: number;
  dailyRunLimit: number;
  dailyRunsRemaining: number;
  canStartRun: boolean;
  dailyRunDate: string;
}

export interface ClaimRunResult {
  success: boolean;
  dailyRunsUsed: number;
  dailyRunLimit: number;
  dailyRunsRemaining: number;
  canStartRun: boolean;
  dailyRunDate: string;
  error?: string;
  message?: string;
}

// -----------------------------------------------------
// Calendar Date Helper (UTC)
// -----------------------------------------------------

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------
// Local Storage Cache
// -----------------------------------------------------

interface LocalRunCache {
  date: string;
  runsUsed: number;
}

function getLocalCache(): LocalRunCache {
  const today = getTodayDateString();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.date === "string" && typeof parsed.runsUsed === "number") {
        if (parsed.date === today) {
          return {
            date: today,
            runsUsed: Math.min(DAILY_RUN_LIMIT, Math.max(0, parsed.runsUsed)),
          };
        }
      }
    }
  } catch {
    // ignore
  }

  // New day or missing data
  const initial = { date: today, runsUsed: 0 };
  saveLocalCache(initial);
  return initial;
}

function saveLocalCache(cache: LocalRunCache): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

// -----------------------------------------------------
// Concurrency Mutex
// -----------------------------------------------------

let isClaimInProgress = false;

// -----------------------------------------------------
// Notification Event Dispatcher
// -----------------------------------------------------

function notifyRunStatusUpdated(status: DailyRunStatus): void {
  try {
    window.dispatchEvent(
      new CustomEvent("cyberwrap-daily-runs-updated", {
        detail: status,
      }),
    );
  } catch {
    // ignore
  }
}

// -----------------------------------------------------
// Get Daily Run Status
// -----------------------------------------------------

export async function getDailyRunStatus(): Promise<DailyRunStatus> {
  const today = getTodayDateString();
  const playerId = ensureAnonymousPlayerId();
  const local = getLocalCache();

  try {
    const { data, error } = await supabase.rpc("get_daily_run_status", {
      requested_player_id: playerId,
      requested_date: today,
    });

    if (!error && data && typeof data.daily_runs_used === "number") {
      const serverRuns = Math.max(local.runsUsed, data.daily_runs_used);
      saveLocalCache({ date: today, runsUsed: serverRuns });

      const status: DailyRunStatus = {
        dailyRunsUsed: serverRuns,
        dailyRunLimit: DAILY_RUN_LIMIT,
        dailyRunsRemaining: Math.max(0, DAILY_RUN_LIMIT - serverRuns),
        canStartRun: serverRuns < DAILY_RUN_LIMIT,
        dailyRunDate: today,
      };

      notifyRunStatusUpdated(status);
      trackEvent("daily_run_status_checked", {
        daily_runs_used: status.dailyRunsUsed,
        daily_run_limit: status.dailyRunLimit,
        daily_runs_remaining: status.dailyRunsRemaining,
        can_start_run: status.canStartRun,
      });

      return status;
    }
  } catch (err) {
    console.warn("[DailyRun] Remote status check failed, using local cache:", err);
  }

  // Fallback using local cache
  const runsUsed = local.runsUsed;
  const status: DailyRunStatus = {
    dailyRunsUsed: runsUsed,
    dailyRunLimit: DAILY_RUN_LIMIT,
    dailyRunsRemaining: Math.max(0, DAILY_RUN_LIMIT - runsUsed),
    canStartRun: runsUsed < DAILY_RUN_LIMIT,
    dailyRunDate: today,
  };

  notifyRunStatusUpdated(status);
  return status;
}

// -----------------------------------------------------
// Get Synchronous Cached Status
// -----------------------------------------------------

export function getCurrentCachedRunStatus(): DailyRunStatus {
  const today = getTodayDateString();
  const local = getLocalCache();
  const runsUsed = local.runsUsed;

  return {
    dailyRunsUsed: runsUsed,
    dailyRunLimit: DAILY_RUN_LIMIT,
    dailyRunsRemaining: Math.max(0, DAILY_RUN_LIMIT - runsUsed),
    canStartRun: runsUsed < DAILY_RUN_LIMIT,
    dailyRunDate: today,
  };
}

// -----------------------------------------------------
// Claim Daily Gameplay Run
//
// Performs atomic server-side increment before entering gameplay.
// -----------------------------------------------------

export async function claimDailyGameplayRun(): Promise<ClaimRunResult> {
  if (isClaimInProgress) {
    console.warn("[DailyRun] Claim request already in flight, debouncing.");
    const current = getCurrentCachedRunStatus();
    return {
      success: false,
      dailyRunsUsed: current.dailyRunsUsed,
      dailyRunLimit: current.dailyRunLimit,
      dailyRunsRemaining: current.dailyRunsRemaining,
      canStartRun: current.canStartRun,
      dailyRunDate: current.dailyRunDate,
      error: "claim_in_progress",
      message: "Please wait, game starting...",
    };
  }

  isClaimInProgress = true;
  const today = getTodayDateString();
  const playerId = ensureAnonymousPlayerId();
  const local = getLocalCache();

  try {
    const { data, error } = await supabase.rpc("claim_daily_gameplay_run", {
      requested_player_id: playerId,
      requested_date: today,
    });

    if (!error && data) {
      if (data.success === true) {
        const newRuns = typeof data.daily_runs_used === "number" ? data.daily_runs_used : local.runsUsed + 1;
        saveLocalCache({ date: today, runsUsed: newRuns });

        const result: ClaimRunResult = {
          success: true,
          dailyRunsUsed: newRuns,
          dailyRunLimit: DAILY_RUN_LIMIT,
          dailyRunsRemaining: Math.max(0, DAILY_RUN_LIMIT - newRuns),
          canStartRun: newRuns < DAILY_RUN_LIMIT,
          dailyRunDate: today,
          message: data.message,
        };

        notifyRunStatusUpdated({
          dailyRunsUsed: result.dailyRunsUsed,
          dailyRunLimit: result.dailyRunLimit,
          dailyRunsRemaining: result.dailyRunsRemaining,
          canStartRun: result.canStartRun,
          dailyRunDate: today,
        });

        trackEvent("daily_run_started", {
          daily_run_number: result.dailyRunsUsed,
          daily_run_limit: DAILY_RUN_LIMIT,
          daily_runs_remaining: result.dailyRunsRemaining,
        });

        return result;
      } else {
        // Limit reached on server
        const currentRuns = typeof data.daily_runs_used === "number" ? data.daily_runs_used : DAILY_RUN_LIMIT;
        saveLocalCache({ date: today, runsUsed: currentRuns });

        const result: ClaimRunResult = {
          success: false,
          dailyRunsUsed: currentRuns,
          dailyRunLimit: DAILY_RUN_LIMIT,
          dailyRunsRemaining: 0,
          canStartRun: false,
          dailyRunDate: today,
          error: data.error || "daily_limit_reached",
          message: data.message || "You have completed all 5 runs for today.",
        };

        notifyRunStatusUpdated({
          dailyRunsUsed: result.dailyRunsUsed,
          dailyRunLimit: result.dailyRunLimit,
          dailyRunsRemaining: 0,
          canStartRun: false,
          dailyRunDate: today,
        });

        trackEvent("daily_run_limit_reached", {
          daily_run_limit: DAILY_RUN_LIMIT,
          daily_runs_used: currentRuns,
          daily_runs_remaining: 0,
        });

        return result;
      }
    }
  } catch (err) {
    console.warn("[DailyRun] Remote claim failed, using resilient local fallback:", err);
  } finally {
    isClaimInProgress = false;
  }

  // Resilient local fallback if network / RPC is offline
  if (local.runsUsed >= DAILY_RUN_LIMIT) {
    const result: ClaimRunResult = {
      success: false,
      dailyRunsUsed: local.runsUsed,
      dailyRunLimit: DAILY_RUN_LIMIT,
      dailyRunsRemaining: 0,
      canStartRun: false,
      dailyRunDate: today,
      error: "daily_limit_reached",
      message: "You have completed all 5 runs for today. Come back tomorrow for 5 new delivery runs.",
    };

    trackEvent("daily_run_limit_reached", {
      daily_run_limit: DAILY_RUN_LIMIT,
      daily_runs_used: local.runsUsed,
      daily_runs_remaining: 0,
    });

    return result;
  }

  const updatedRuns = local.runsUsed + 1;
  saveLocalCache({ date: today, runsUsed: updatedRuns });

  const fallbackResult: ClaimRunResult = {
    success: true,
    dailyRunsUsed: updatedRuns,
    dailyRunLimit: DAILY_RUN_LIMIT,
    dailyRunsRemaining: Math.max(0, DAILY_RUN_LIMIT - updatedRuns),
    canStartRun: updatedRuns < DAILY_RUN_LIMIT,
    dailyRunDate: today,
    message: `Run started! ${Math.max(0, DAILY_RUN_LIMIT - updatedRuns)} runs remaining today.`,
  };

  notifyRunStatusUpdated({
    dailyRunsUsed: fallbackResult.dailyRunsUsed,
    dailyRunLimit: fallbackResult.dailyRunLimit,
    dailyRunsRemaining: fallbackResult.dailyRunsRemaining,
    canStartRun: fallbackResult.canStartRun,
    dailyRunDate: today,
  });

  trackEvent("daily_run_started", {
    daily_run_number: fallbackResult.dailyRunsUsed,
    daily_run_limit: DAILY_RUN_LIMIT,
    daily_runs_remaining: fallbackResult.dailyRunsRemaining,
  });

  return fallbackResult;
}
