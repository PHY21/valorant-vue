import { createClient } from "@supabase/supabase-js";
import { publicAuthConfig } from "./auth.js";
const env = import.meta.env || {};
const config = publicAuthConfig(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
// Only the public client key belongs here. Authorization lives in Postgres RLS.
export const supabase = config
  ? createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    })
  : null;
