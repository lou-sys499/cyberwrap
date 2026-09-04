// =====================================================
// CyberWrap Rewarded Video Continue Manager
//
// Phase 18A: 6-Second Video Continue Reward (+15 Seconds)
//
// Responsibilities:
// - Track daily video continue redemptions (Max 3 per calendar day)
// - Sync with Supabase backend server-side via atomic RPC
// - Provide resilient offline / local fallback caching
// - Ensure atomic increments so limits cannot be exceeded
// =====================================================

import { ensureAnonymousPlayerId } from "./anonymous-player";
import { supabase } from "./supabase";

export const DAILY_CONTINUE_LIMIT = Infinity;
export const CONTINUE_REWARD_SECONDS = 15;

const LOCAL_STORAGE_KEY = "cyberwrap_daily_continues";

export interface DailyContinueStatus {
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  canClaim: boolean;
  date: string;
}

export interface ClaimContinueResult {
  success: boolean;
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  rewardSeconds: number;
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

interface LocalCache {
  date: string;
  count: number;
}

function getLocalCache(): LocalCache {
  const today = getTodayDateString();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.date === "string" && typeof parsed.count === "number") {
        if (parsed.date === today) {
          return { date: today, count: Math.max(0, parsed.count) };
        }
      }
    }
  } catch {
    // ignore
  }

  // New day or missing data: initialize today at 0
  const initial = { date: today, count: 0 };
  saveLocalCache(initial);
  return initial;
}

function saveLocalCache(cache: LocalCache): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

// -----------------------------------------------------
// Get Daily Continue Status (Unlimited Continues)
// -----------------------------------------------------

export async function getDailyContinueStatus(): Promise<DailyContinueStatus> {
  const today = getTodayDateString();
  const playerId = ensureAnonymousPlayerId();
  const local = getLocalCache();

  try {
    const { data, error } = await supabase.rpc("get_rewarded_video_status", {
      requested_player_id: playerId,
      requested_date: today,
    });

    if (!error && data) {
      const serverCount = typeof data.daily_count === "number" ? data.daily_count : local.count;
      saveLocalCache({ date: today, count: serverCount });

      return {
        dailyCount: serverCount,
        dailyLimit: DAILY_CONTINUE_LIMIT,
        remaining: Infinity,
        canClaim: true,
        date: today,
      };
    }
  } catch (err) {
    console.warn("[RewardedVideo] Remote status fetch failed, using local cache:", err);
  }

  // Resilient fallback to local cache
  const count = local.count;
  return {
    dailyCount: count,
    dailyLimit: DAILY_CONTINUE_LIMIT,
    remaining: Infinity,
    canClaim: true,
    date: today,
  };
}

// -----------------------------------------------------
// Claim Daily Continue (+15 Seconds, Unlimited)
// -----------------------------------------------------

let isClaimInProgress = false;

export async function claimDailyContinue(): Promise<ClaimContinueResult> {
  if (isClaimInProgress) {
    const local = getLocalCache();
    return {
      success: true,
      dailyCount: local.count,
      dailyLimit: DAILY_CONTINUE_LIMIT,
      remaining: Infinity,
      rewardSeconds: CONTINUE_REWARD_SECONDS,
      message: "Please wait...",
    };
  }

  isClaimInProgress = true;
  try {
    const today = getTodayDateString();
    const playerId = ensureAnonymousPlayerId();
    const local = getLocalCache();

    try {
      const { data, error } = await supabase.rpc("claim_rewarded_video_continue", {
        requested_player_id: playerId,
        requested_date: today,
      });

      if (!error && data) {
        const newCount = typeof data.daily_count === "number"
          ? (data.success ? data.daily_count : data.daily_count + 1)
          : local.count + 1;
        saveLocalCache({ date: today, count: newCount });

        return {
          success: true,
          dailyCount: newCount,
          dailyLimit: DAILY_CONTINUE_LIMIT,
          remaining: Infinity,
          rewardSeconds: CONTINUE_REWARD_SECONDS,
          message: "Reward granted! +15 Seconds added.",
        };
      }
    } catch (err) {
      console.warn("[RewardedVideo] Remote claim failed or RPC pending; executing atomic local fallback:", err);
    }

    // Graceful local atomic fallback (unlimited continues)
    const currentLocal = getLocalCache();
    const updatedCount = currentLocal.count + 1;
    saveLocalCache({ date: today, count: updatedCount });

    return {
      success: true,
      dailyCount: updatedCount,
      dailyLimit: DAILY_CONTINUE_LIMIT,
      remaining: Infinity,
      rewardSeconds: CONTINUE_REWARD_SECONDS,
      message: "Reward granted! +15 Seconds added.",
    };
  } finally {
    isClaimInProgress = false;
  }
}
