/**
 * Event and attribute allowlists. Only these pass through.
 */
export const ALLOWED_EVENT_NAMES = [
  "ui.page_view",
  "ui.click",
  "ui.error",
  "ui.web_vital",
  "biz.seat_select",
  "biz.seat_lock_start",
  "biz.payment_start",
  "biz.payment_result",
  "api.call",
  "api.error",
] as const;

export type RumEventName = (typeof ALLOWED_EVENT_NAMES)[number];

export const ALLOWED_ATTR_KEYS = [
  "page.path",
  "page.route",
  "page.referrer",
  "ui.target",
  "ui.action",
  "http.method",
  "http.status_code",
  "http.route",
  "api.name",
  "api.base",
  "outcome",
  "error_code",
  "error.kind",
  "error.type",
  "error.message",
  "error.stack_hash",
  "perf.cls",
  "perf.lcp_ms",
  "perf.fid_ms",
  "perf.inp_ms",
  "seat.stage",
  "payment.method",
  "payment.amount_bucket",
  "enduser.session_id",
  "deployment.environment",
  "k8s.cluster.name",
] as const;

export type RumAttrKey = (typeof ALLOWED_ATTR_KEYS)[number];

const ALLOWED_ATTR_SET = new Set<string>(ALLOWED_ATTR_KEYS);
const ALLOWED_EVENT_SET = new Set<string>(ALLOWED_EVENT_NAMES);

export function isAllowedEventName(name: string): name is RumEventName {
  return ALLOWED_EVENT_SET.has(name);
}

export function isAllowedAttrKey(key: string): key is RumAttrKey {
  return ALLOWED_ATTR_SET.has(key);
}
