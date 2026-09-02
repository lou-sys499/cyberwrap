// --------------------------------------------------
// CyberWrap Supabase Client
//
// Browser-safe Supabase configuration.
//
// IMPORTANT:
// - Publishable key is intended for frontend use.
// - NEVER put a Supabase secret/service-role key here.
// - Database security is enforced through RLS.
// - CyberWrap uses anonymous RPCs; it does not use Supabase Auth.
// --------------------------------------------------

import { createClient } from "@supabase/supabase-js";

// --------------------------------------------------
// Supabase Configuration
// --------------------------------------------------

const SUPABASE_URL = "https://zblulelxxyvffqqrtslq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_kS0BkItcJS1XbWJP0VzPzQ_l-79G0MD";

// Safe fetch wrapper that intercepts uncaught network drops / offline states gracefully
const safeFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (err) {
    // If the network or Supabase endpoint is unreachable, return a synthetic 503 response
    // so that Supabase JS client handles it as an error object rather than crashing with an unhandled TypeError: Failed to fetch
    console.warn("[CyberWrap] Network fetch failed, falling back gracefully:", err);
    return new Response(
      JSON.stringify({
        message: "Network unreachable or offline",
        error: "Failed to fetch",
      }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// --------------------------------------------------
// Supabase Client
// --------------------------------------------------

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: {
    schema: "public",
  },

  global: {
    fetch: safeFetch,
  },

  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

