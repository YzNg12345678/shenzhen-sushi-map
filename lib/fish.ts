export interface FishEntry {
  id: string;
  name: string;
  ja: string;
  /** 来源仅给出季节时，按整季记月份。 */
  months: number[];
  seasonLabel: string;
  source: { label: string; url: string };
  /** pending：已标注来源，但尚未逐条与权威资料交叉核验。 */
  status: "pending";
}

const SRC = {
  label: "寿司辞典（cookdoor.jp）季节分类，检索摘要",
  url: "https://www.cookdoor.jp/sushi/dictionary/21618_sushi_018/",
};

/**
 * 可维护的鱼种季节数据。目标是 40 种，但只收录有明确来源的条目；
 * 未经核验的条目不得添加。新增时必须填写 source。
 */
export const FISH: FishEntry[] = [
  { id: "katsuo", name: "鲣鱼", ja: "カツオ", months: [3, 4, 5], seasonLabel: "春", source: SRC, status: "pending" },
  { id: "sayori", name: "针鱼", ja: "サヨリ", months: [3, 4, 5], seasonLabel: "春", source: SRC, status: "pending" },
  { id: "hotaruika", name: "萤火鱿", ja: "ホタルイカ", months: [3, 4, 5], seasonLabel: "春", source: SRC, status: "pending" },
  { id: "suzuki", name: "鲈鱼", ja: "スズキ", months: [6, 7, 8], seasonLabel: "夏", source: SRC, status: "pending" },
  { id: "hamo", name: "鳢鳗", ja: "ハモ", months: [6, 7, 8], seasonLabel: "夏", source: SRC, status: "pending" },
  { id: "buri", name: "鰤鱼（寒鰤）", ja: "ブリ", months: [12, 1, 2], seasonLabel: "冬", source: SRC, status: "pending" },
  { id: "ankimo", name: "鮟鱇鱼肝", ja: "あん肝", months: [12, 1, 2], seasonLabel: "冬", source: SRC, status: "pending" },
];

export const FISH_TARGET = 40;

/** 记录中的鱼种名是否对应某条目（名称/日文/括号前名称互相包含）。 */
export function fishMatches(entry: FishEntry, text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const base = entry.name.replace(/（.*）/, "");
  // 单字输入（如“鱼”）过于宽泛，不允许反向包含匹配
  return t.includes(base) || (t.length >= 2 && base.includes(t)) || t.includes(entry.ja);
}
