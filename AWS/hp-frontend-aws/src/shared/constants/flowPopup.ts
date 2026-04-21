/** 대기열~결제 팝업 플로우에서만 사용. sessionStorage 키 */
export const FLOW_POPUP_KEY = "flowPopup";

export function isFlowPopup(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.opener || !!sessionStorage.getItem(FLOW_POPUP_KEY);
}

export function setFlowPopup(): void {
  try {
    sessionStorage.setItem(FLOW_POPUP_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearFlowPopup(): void {
  try {
    sessionStorage.removeItem(FLOW_POPUP_KEY);
  } catch {
    // ignore
  }
}
