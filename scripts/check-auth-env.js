import { publicAuthConfig } from "../src/lib/auth.js";
if (
  !publicAuthConfig(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
) {
  console.error(
    "Set the Supabase project URL and public publishable key in GitHub repository variables before deploying online accounts.",
  );
  process.exitCode = 1;
}
