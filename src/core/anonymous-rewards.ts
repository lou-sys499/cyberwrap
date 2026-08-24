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
  if (!Number.isFinite(score) || score <= 0) {
    return;
  }

  const playerId = ensureAnonymousPlayerId();
  const { data, error } = await supabase.rpc("record_anonymous_reward_score", {
    requested_player_id: playerId,
    requested_session_id: currentGameId ?? getAnalyticsSessionId(),
    requested_game_id: currentGameId ?? crypto.randomUUID(),
    score_amount: Math.floor(score),
  });

  if (error) {
    console.warn("[Rewards] Anonymous score submission failed:", error.message);
    return;
  }

  if (data?.[0]) {
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
      trackEvent("coupon_generated");
    }

    const coupons = await loadAnonymousCoupons();

    if (data[0].coupon_code) {
      const coupon = coupons.find(
        (item) => item.code === data[0].coupon_code,
      );

      if (coupon) {
        window.dispatchEvent(
          new CustomEvent<RewardCoupon>("cyberwrap-reward-earned", {
            detail: coupon,
          }),
        );
      }
    }
  }
}