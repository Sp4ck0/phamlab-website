import { ConvexError } from "convex/values";

/**
 * The text to show a person for a failed Convex call. Production redacts the
 * message of a plain Error ("Server Error"), so only a ConvexError's data
 * carries what the backend meant to say; anything else gets `fallback`.
 */
export function serverMessage(err: unknown, fallback: string): string {
  return err instanceof ConvexError && typeof err.data === "string" ? err.data : fallback;
}
