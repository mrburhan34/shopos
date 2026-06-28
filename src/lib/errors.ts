/**
 * Map backend / Supabase errors to safe, user-friendly messages.
 * Raw error text (which can include schema, table, or constraint names)
 * is logged to the console but never returned to the UI.
 */
type AnyErr = { message?: string; code?: string; details?: string } | null | undefined;

export function humanizeError(err: AnyErr, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  // eslint-disable-next-line no-console
  console.error("[app error]", err);

  const code = (err as any)?.code as string | undefined;
  const msg = (err?.message ?? "").toLowerCase();

  if (code === "23505" || msg.includes("duplicate key")) return "An entry with that value already exists.";
  if (code === "23503" || msg.includes("foreign key")) return "This item is referenced elsewhere and can't be changed.";
  if (code === "23502" || msg.includes("not-null") || msg.includes("null value")) return "Please fill in all required fields.";
  if (code === "23514" || msg.includes("check constraint")) return "One of the values isn't allowed.";
  if (code === "42501" || msg.includes("permission") || msg.includes("rls") || msg.includes("policy")) {
    return "You don't have permission to do that. Your subscription may have expired.";
  }
  if (msg.includes("network") || msg.includes("fetch")) return "Network error. Please check your connection.";
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) return "Invalid email or password.";
  if (msg.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (msg.includes("user already registered")) return "An account with this email already exists.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";

  return fallback;
}
