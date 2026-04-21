/**
 * Normalize error for RUM: message (truncated, no PII), stack_hash only (no raw stack).
 */
const MAX_MESSAGE_LEN = 120;
const PII_PATTERNS = [
  /@[\w.-]+\.[a-z]{2,}/gi,
  /\b[\d]{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b\d{10,11}\b/g,
  /(bearer|basic)\s+[\w-]+/gi,
  /password["\s:=]+[^\s"']+/gi,
  /token["\s:=]+[^\s"']+/gi,
];

function maskPii(s: string): string {
  let out = s;
  for (const re of PII_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

/** Simple non-crypto hash for stack dedup (do not send raw stack). */
export function stackHash(stack: string | undefined): string | undefined {
  if (!stack || typeof stack !== "string") return undefined;
  let h = 0;
  const str = stack.slice(0, 2000);
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

export function normalizeError(err: unknown): {
  message: string;
  type: string;
  stack_hash?: string;
} {
  let message = "Unknown error";
  let type = "Error";
  let stack: string | undefined;
  if (err instanceof Error) {
    message = err.message || message;
    type = err.name || type;
    stack = err.stack;
  } else if (typeof err === "string") {
    message = err;
  } else if (err != null && typeof err === "object" && "message" in err) {
    message = String((err as { message?: unknown }).message ?? message);
    if ("name" in err && typeof (err as { name?: unknown }).name === "string") {
      type = (err as { name: string }).name;
    }
  }
  message = maskPii(truncate(message, MAX_MESSAGE_LEN));
  return {
    message,
    type,
    stack_hash: stackHash(stack),
  };
}
