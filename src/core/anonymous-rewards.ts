import { getAnalyticsSessionId, trackEvent } from "./analytics";
import { ensureAnonymousPlayerId } from "./anonymous-player";
import { supabase } from "./supabase";

export interface RewardProgress {
  cumulative_score: number;
  cycle_started_at: string;
  cycle_expires_at: string;
  coupons_earned_in_cycle: number;
  reward_status: string;
}

export interface RewardCoupon {
  code: string;
  discount_percent: number;
  status: "active" | "expired" | "redeemed";
  generated_at: string;
  expires_at: string;
}

const LOCAL_PROGRESS_KEY = "cyberwrap_local_reward_progress";
const LOCAL_COUPONS_KEY = "cyberwrap_local_coupons";

function getLocalRewardProgress(): RewardProgress {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.cumulative_score === "number") {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {
    cumulative_score: 0,
    cycle_started_at: new Date().toISOString(),
    cycle_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    coupons_earned_in_cycle: 0,
    reward_status: "in_progress",
  };
}

function saveLocalRewardProgress(progress: RewardProgress): void {
  try {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

function getLocalCoupons(): RewardCoupon[] {
  try {
    const raw = localStorage.getItem(LOCAL_COUPONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalCoupons(coupons: RewardCoupon[]): void {
  try {
    localStorage.setItem(LOCAL_COUPONS_KEY, JSON.stringify(coupons));
  } catch {
    // ignore
  }
}

let currentGameId: string | null = null;

export function startAnonymousGame(): void {
  currentGameId = crypto.randomUUID();
}

export async function loadAnonymousRewardProgress(): Promise<void> {
  const playerId = ensureAnonymousPlayerId();
  try {
    const { data, error } = await supabase.rpc("get_anonymous_reward_progress", {
      requested_player_id: playerId,
    });

    if (!error && data?.[0]) {
      const progress: RewardProgress = data[0];
      saveLocalRewardProgress(progress);

      window.dispatchEvent(
        new CustomEvent<RewardProgress>("cyberwrap-reward-updated", {
          detail: progress,
        }),
      );

      trackEvent("reward_progress_updated", {
        cumulativeScore: progress.cumulative_score,
        couponsEarnedInCycle: progress.coupons_earned_in_cycle,
      });

      await loadAnonymousCoupons();
      return;
    }
  } catch (err) {
    console.warn("[Rewards] Remote progress fetch unavailable, using local progress:", err);
  }

  // Fallback to local progress on network failure or if data is not available yet
  const localProg = getLocalRewardProgress();
  window.dispatchEvent(
    new CustomEvent<RewardProgress>("cyberwrap-reward-updated", {
      detail: localProg,
    }),
  );
  await loadAnonymousCoupons();
}

export async function loadAnonymousCoupons(): Promise<RewardCoupon[]> {
  const playerId = ensureAnonymousPlayerId();
  try {
    const { data, error } = await supabase.rpc("get_anonymous_coupons", {
      requested_player_id: playerId,
    });

    if (!error && data) {
      const coupons = data as RewardCoupon[];
      saveLocalCoupons(coupons);

      window.dispatchEvent(
        new CustomEvent<RewardCoupon[]>("cyberwrap-coupons-updated", {
          detail: coupons,
        }),
      );

      return coupons;
    }
  } catch (err) {
    console.warn("[Rewards] Remote coupons fetch unavailable, using local cache:", err);
  }

  const localCoupons = getLocalCoupons();
  window.dispatchEvent(
    new CustomEvent<RewardCoupon[]>("cyberwrap-coupons-updated", {
      detail: localCoupons,
    }),
  );
  return localCoupons;
}

export async function submitAnonymousRewardScore(score: number): Promise<void> {
  console.log("[Rewards] Submitting score:", score);

  // The database table cyberwrap_reward_claims has a check constraint (cyberwrap_claim_score_check)
  // requiring score_amount > 0.
  // If score is 0 or invalid, we refresh current reward state instead of attempting an invalid insert.
  const scoreAmount = Math.floor(score);
  if (!Number.isFinite(scoreAmount) || scoreAmount <= 0) {
    console.log("[Rewards] Score is 0 or non-positive, refreshing rewards without claim insertion");
    await loadAnonymousRewardProgress();
    return;
  }

  const playerId = ensureAnonymousPlayerId();
  const gameId = currentGameId ?? crypto.randomUUID();
  
  console.log("[Rewards] Player ID:", playerId);
  console.log("[Rewards] Game ID:", gameId);
  console.log("[Rewards] Session ID:", currentGameId ?? getAnalyticsSessionId());
  
  try {
    const { data, error } = await supabase.rpc("record_anonymous_reward_score", {
      requested_player_id: playerId,
      requested_session_id: currentGameId ?? getAnalyticsSessionId(),
      requested_game_id: gameId,
      score_amount: scoreAmount,
    });

    if (error) {
      console.warn("[Rewards] Anonymous score submission failed:", error.message);
      console.error("[Rewards] Full error:", error);
      updateLocalProgressFallback(scoreAmount);
      return;
    }

    console.log("[Rewards] Score submission successful:", data);

    if (data?.[0]) {
      const result = data[0];
      console.log("[Rewards] New cumulative score:", result.cumulative_score);
      console.log("[Rewards] Coupons earned in cycle:", result.coupons_earned_in_cycle);
      console.log("[Rewards] Cycle started at:", result.cycle_started_at);
      console.log("[Rewards] Cycle expires at:", result.cycle_expires_at);
      
      const progress: RewardProgress = {
        cumulative_score: result.cumulative_score,
        cycle_started_at: result.cycle_started_at,
        cycle_expires_at: result.cycle_expires_at,
        coupons_earned_in_cycle: result.coupons_earned_in_cycle,
        reward_status: result.reward_status ?? "in_progress",
      };
      saveLocalRewardProgress(progress);

      window.dispatchEvent(
        new CustomEvent<RewardProgress>("cyberwrap-reward-updated", {
          detail: progress,
        }),
      );

      trackEvent("reward_progress_updated", {
        cumulativeScore: progress.cumulative_score,
        couponsEarnedInCycle: progress.coupons_earned_in_cycle,
      });

      if (result.coupon_code) {
        console.log("[Rewards] Coupon generated:", result.coupon_code);
        trackEvent("coupon_generated");
      }

      const coupons = await loadAnonymousCoupons();

      if (result.coupon_code) {
        const coupon = coupons.find(
          (item) => item.code === result.coupon_code,
        );

        if (coupon) {
          console.log("[Rewards] Coupon earned:", coupon);
          window.dispatchEvent(
            new CustomEvent<RewardCoupon>("cyberwrap-reward-earned", {
              detail: coupon,
            }),
          );
        }
      }
      return;
    }
  } catch (err) {
    console.warn("[Rewards] Remote score submission encountered network error:", err);
    updateLocalProgressFallback(scoreAmount);
  }
}

function updateLocalProgressFallback(scoreAmount: number): void {
  const currentProg = getLocalRewardProgress();
  const newScore = currentProg.cumulative_score + scoreAmount;
  const oldScore = currentProg.cumulative_score;
  const currentCoupons = getLocalCoupons();

  let earnedCoupon: RewardCoupon | null = null;
  // Check if crossed 2,000 threshold
  if (oldScore < 2000 && newScore >= 2000) {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newCoupon: RewardCoupon = {
      code: `CW-20-${randomSuffix}`,
      discount_percent: 20,
      status: "active",
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
    currentCoupons.push(newCoupon);
    saveLocalCoupons(currentCoupons);
    earnedCoupon = newCoupon;
  }

  const updatedProg: RewardProgress = {
    ...currentProg,
    cumulative_score: newScore,
    coupons_earned_in_cycle: currentCoupons.length,
  };
  saveLocalRewardProgress(updatedProg);

  window.dispatchEvent(
    new CustomEvent<RewardProgress>("cyberwrap-reward-updated", {
      detail: updatedProg,
    }),
  );

  window.dispatchEvent(
    new CustomEvent<RewardCoupon[]>("cyberwrap-coupons-updated", {
      detail: currentCoupons,
    }),
  );

  if (earnedCoupon) {
    window.dispatchEvent(
      new CustomEvent<RewardCoupon>("cyberwrap-reward-earned", {
        detail: earnedCoupon,
      }),
    );
  }
}

// Function to ensure session completion is always recorded
export async function ensureSessionCompletion(score: number): Promise<void> {
  console.log("[Rewards] Ensuring session completion with score:", score);
  
  // Always submit the score to ensure the session is tracked
  // This is called at game over regardless of score
  await submitAnonymousRewardScore(score);
}