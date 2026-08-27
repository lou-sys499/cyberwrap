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

let currentGameId: string | null = null;

export function startAnonymousGame(): void {
  currentGameId = crypto.randomUUID();
}

export async function loadAnonymousRewardProgress(): Promise<void> {
  const playerId = ensureAnonymousPlayerId();
  const { data, error } = await supabase.rpc("get_anonymous_reward_progress", {
    requested_player_id: playerId,
  });

  if (error || !data?.[0]) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<RewardProgress>("cyberwrap-reward-updated", {
      detail: data[0],
    }),
  );

  trackEvent("reward_progress_updated", {
    cumulativeScore: data[0].cumulative_score,
    couponsEarnedInCycle: data[0].coupons_earned_in_cycle,
  });

  await loadAnonymousCoupons();
}

export async function loadAnonymousCoupons(): Promise<RewardCoupon[]> {
  const playerId = ensureAnonymousPlayerId();
  const { data, error } = await supabase.rpc("get_anonymous_coupons", {
    requested_player_id: playerId,
  });

  if (error) {
    return [];
  }

  const coupons = (data ?? []) as RewardCoupon[];

  window.dispatchEvent(
    new CustomEvent<RewardCoupon[]>("cyberwrap-coupons-updated", {
      detail: coupons,
    }),
  );

  return coupons;
}

export async function submitAnonymousRewardScore(score: number): Promise<void> {
  console.log("[Rewards] Submitting score:", score);
  
  // Always allow submission for session tracking (even 0 scores)
  // Only reject if score is invalid (NaN, null, etc.)
  if (!Number.isFinite(score)) {
    console.log("[Rewards] Invalid score, skipping submission");
    return;
  }

  const playerId = ensureAnonymousPlayerId();
  const gameId = currentGameId ?? crypto.randomUUID();
  
  console.log("[Rewards] Player ID:", playerId);
  console.log("[Rewards] Game ID:", gameId);
  console.log("[Rewards] Session ID:", currentGameId ?? getAnalyticsSessionId());
  
  const { data, error } = await supabase.rpc("record_anonymous_reward_score", {
    requested_player_id: playerId,
    requested_session_id: currentGameId ?? getAnalyticsSessionId(),
    requested_game_id: gameId,
    score_amount: Math.floor(score),
  });

  if (error) {
    console.warn("[Rewards] Anonymous score submission failed:", error.message);
    console.error("[Rewards] Full error:", error);
    return;
  }

  console.log("[Rewards] Score submission successful:", data);

  if (data?.[0]) {
    console.log("[Rewards] New cumulative score:", data[0].cumulative_score);
    console.log("[Rewards] Coupons earned in cycle:", data[0].coupons_earned_in_cycle);
    console.log("[Rewards] Cycle started at:", data[0].cycle_started_at);
    console.log("[Rewards] Cycle expires at:", data[0].cycle_expires_at);
    
    window.dispatchEvent(
      new CustomEvent<RewardProgress>("cyberwrap-reward-updated", {
        detail: data[0],
      }),
    );

    trackEvent("reward_progress_updated", {
      cumulativeScore: data[0].cumulative_score,
      couponsEarnedInCycle: data[0].coupons_earned_in_cycle,
    });

    if (data[0].coupon_code) {
      console.log("[Rewards] Coupon generated:", data[0].coupon_code);
      trackEvent("coupon_generated");
    }

    const coupons = await loadAnonymousCoupons();

    if (data[0].coupon_code) {
      const coupon = coupons.find(
        (item) => item.code === data[0].coupon_code,
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
  } else {
    console.log("[Rewards] No data returned from score submission");
  }
}

// Function to ensure session completion is always recorded
export async function ensureSessionCompletion(score: number): Promise<void> {
  console.log("[Rewards] Ensuring session completion with score:", score);
  
  // Always submit the score to ensure the session is tracked
  // This is called at game over regardless of score
  await submitAnonymousRewardScore(score);
}