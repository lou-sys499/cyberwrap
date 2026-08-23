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

// --------------------------------------------------
// Supabase Client
// --------------------------------------------------

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: {
    schema: "public",
  },

  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
