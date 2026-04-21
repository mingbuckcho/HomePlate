/**
 * Sanitize attributes: allowlist keys only, no PII, pathname-only URL, 80-char limit, amount bucket.
 */
import { ALLOWED_ATTR_KEYS, isAllowedAttrKey } from "./events";

const MAX_STR_LEN = 80;
const DROP_KEYS = new Set(
  [
    "email",
    "phone",
    "token",
    "cookie",
    "authorization",
    "password",
    "secret",
    "credit",
    "card",
    "name",
    "address",
    "user",
    "userId",
    "orderId",
    "paymentId",
    "seatId",
  ].flatMap((k) => [k, k.toLowerCase(), k.toUpperCase()])
);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return [...DROP_KEYS].some((d) => lower.includes(d.toLowerCase()));
}

function pathnameOnly(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const u = new URL(value, "http://localhost");
    return u.pathname || "/";
  } catch {
    return "/";
  }
}

const AMOUNT_BUCKETS = ["0-1k", "1k-10k", "10k-50k", "50k+"] as const;
function toAmountBucket(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0-1k";
  if (n < 1000) return "0-1k";
  if (n < 10000) return "1k-10k";
  if (n < 50000) return "10k-50k";
  return "50k+";
}

function truncateStr(s: string): string {
  return s.length > MAX_STR_LEN ? s.slice(0, MAX_STR_LEN - 3) + "..." : s;
}

export type SanitizedValue = string | number | boolean;

export function sanitizeAttributes(
  obj: Record<string, unknown> | null | undefined
): Record<string, SanitizedValue> {
  const out: Record<string, SanitizedValue> = {};
  if (!obj || typeof obj !== "object") return out;

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) continue;
    if (!isAllowedAttrKey(key)) continue;

    if (value === null || value === undefined) continue;

    if (key === "payment.amount_bucket") {
      out["payment.amount_bucket"] = toAmountBucket(value);
      continue;
    }

    if (
      key === "page.path" ||
      key === "page.route" ||
      key === "page.referrer" ||
      key === "api.base"
    ) {
      const path = pathnameOnly(value);
      out[key] = truncateStr(path || String(value).slice(0, MAX_STR_LEN));
      continue;
    }

    if (typeof value === "string") {
      out[key] = truncateStr(value);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}
