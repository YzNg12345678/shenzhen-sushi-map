/** 从高德营业时间文本中解析时间段（分钟，结束时间可超过 1440 表示跨午夜）。无法解析返回空数组。 */
export function parseRanges(text: string | undefined): Array<[number, number]> {
  if (!text) return [];
  const out: Array<[number, number]> = [];
  const re = /(\d{1,2}):(\d{2})\s*[-~—–至到]\s*(\d{1,2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [h1, m1, h2, m2] = [m[1], m[2], m[3], m[4]].map(Number);
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) continue;
    const s = h1 * 60 + m1;
    let e = h2 * 60 + m2;
    if (e <= s) e += 1440;
    out.push([s, e]);
  }
  return out;
}

/** 营业时间文本明确显示营业到 22:00 之后（严格晚于 22:00；恰好 22:00 打烊不算）。未知返回 undefined（不猜）。 */
export function opensLate(text: string | undefined): boolean | undefined {
  const r = parseRanges(text);
  if (r.length === 0) return undefined;
  return r.some(([, e]) => e > 22 * 60);
}
