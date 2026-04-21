export function toKstIso(date: string, time: string) {
  // date: YYYY-MM-DD, time: HH:mm
  // store explicit +09:00 offset so parsing is stable.
  const safeTime = time.length === 5 ? `${time}:00` : time;
  return `${date}T${safeTime}+09:00`;
}

export function fromKstIso(iso: string) {
  // returns { date: YYYY-MM-DD, time: HH:mm }
  const d = new Date(iso);
  // toLocaleString can vary; use numeric parts
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

export function formatKst(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR");
}

export function formatMMDDHHmm(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${mi}`;
}

/** 오늘 날짜 YYYY-MM-DD (KST) */
export function getTodayKstDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** ISO → "YYYY년 MM월 DD일" (경기일 표시용) */
export function formatYYYYMMDDKorean(iso: string): string {
  const { date } = fromKstIso(iso);
  const [y, m, d] = date.split("-");
  return `${y}년 ${m}월 ${d}일`;
}

/** 경기 시작 시각이 이미 지났는지. 지났으면 true → 노출 제외 */
export function isGameStartPast(gameAtISO: string): boolean {
  return new Date(gameAtISO).getTime() <= Date.now();
}

export function diffMs(aIso: string, bIso: string) {
  return new Date(aIso).getTime() - new Date(bIso).getTime();
}

/** YYYY-MM-DD → { year, month, day } for calendar */
export function parseDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Days in month (1-31), 0 = empty cell for calendar grid */
export function getMonthCalendar(
  year: number,
  month: number,
): (number | null)[][] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const flat: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) flat.push(null);
  for (let d = 1; d <= daysInMonth; d++) flat.push(d);
  while (flat.length < totalCells) flat.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
  return rows;
}
