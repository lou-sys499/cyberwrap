import { supabase } from "./supabase";

export async function submitAuthenticatedScore(score: number): Promise<void> {
  if (!Number.isFinite(score) || score <= 0) {
    return;
  }

  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    return;
  }

  const { error } = await supabase.rpc("record_reward_score", {
    score_amount: Math.floor(score),
  });

  if (error) {
    console.warn("[Rewards] Score submission failed:", error.message);
  }
}
