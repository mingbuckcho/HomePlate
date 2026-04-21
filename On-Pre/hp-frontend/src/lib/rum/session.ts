/**
 * Anonymous sessionId in localStorage. Key for global context: enduser.session_id.
 */
const STORAGE_KEY = "rum_session_id";

function generateUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUuid();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return generateUuid();
  }
}
