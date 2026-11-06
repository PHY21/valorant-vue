import { hasVerifiedEmail, safeReturnPath } from "./auth.js";
export const publicAccountPaths = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];
export function accessDestination(to, user, recovering = false) {
  if (recovering)
    return to.path === "/reset-password" ? true : "/reset-password";
  if (publicAccountPaths.includes(to.path)) return true;
  if (hasVerifiedEmail(user)) return true;
  return { path: "/login", query: { returnTo: safeReturnPath(to.fullPath) } };
}
