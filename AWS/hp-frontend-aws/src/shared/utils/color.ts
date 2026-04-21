/** Hex to rgb(r,g,b) string so SSR and client render the same (avoids hydration mismatch). */
export function hexToRgb(hex: string): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return "rgb(26, 26, 26)";
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}
