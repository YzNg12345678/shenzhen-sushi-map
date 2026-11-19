import type { Checkin } from "./types";

export interface TasteProfile {
  checkinCount: number;
  pieceCount: number;
  avgOverall: number | null;
  avgPrice: number | null;
  enough: boolean;
  needMore: string;
  topFish: { fish: string; avg: number; n: number }[];
  lowFish: { fish: string; avg: number; n: number }[];
  topShops: { shopName: string; avg: number; n: number }[];
  statements: string[];
}

const MIN_CHECKINS = 3;
const MIN_PIECES = 8;
const MIN_FISH_N = 2;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function buildTaste(checkins: Checkin[]): TasteProfile {
  const pieces = checkins.flatMap((c) => c.pieces);
  const prices = checkins.map((c) => c.price).filter((p): p is number => typeof p === "number");
  const fishMap = new Map<string, number[]>();
  for (const p of pieces) {
    const k = p.fish.trim();
    if (!k) continue;
    fishMap.set(k, [...(fishMap.get(k) ?? []), p.rating]);
  }
  // 阈值按未四舍五入的均值判断，避免 3.96 显示为 4.0 而误入高分
  const fish = [...fishMap.entries()].map(([f, rs]) => ({ fish: f, raw: mean(rs), avg: r1(mean(rs)), n: rs.length }));
  const eligible = fish.filter((f) => f.n >= MIN_FISH_N);
  const shopMap = new Map<string, number[]>();
  for (const c of checkins) shopMap.set(c.shopName, [...(shopMap.get(c.shopName) ?? []), c.overall]);
  const shops = [...shopMap.entries()].map(([s, rs]) => ({ shopName: s, raw: mean(rs), avg: r1(mean(rs)), n: rs.length }));

  const enough = checkins.length >= MIN_CHECKINS && pieces.length >= MIN_PIECES;
  const needs: string[] = [];
  if (checkins.length < MIN_CHECKINS) needs.push(`再记录 ${MIN_CHECKINS - checkins.length} 次打卡`);
  if (pieces.length < MIN_PIECES) needs.push(`再记录 ${MIN_PIECES - pieces.length} 贯评分`);

  const strip = <T extends { raw: number }>(x: T): Omit<T, "raw"> => {
    const { raw, ...rest } = x;
    void raw;
    return rest;
  };
  const topFish = eligible
    .filter((f) => f.raw >= 4)
    .sort((a, b) => b.raw - a.raw || b.n - a.n || a.fish.localeCompare(b.fish))
    .slice(0, 5)
    .map(strip);
  const lowFish = eligible
    .filter((f) => f.raw <= 2.5)
    .sort((a, b) => a.raw - b.raw || b.n - a.n || a.fish.localeCompare(b.fish))
    .slice(0, 5)
    .map(strip);
  const topShops = shops
    .filter((s) => s.raw >= 4)
    .sort((a, b) => b.raw - a.raw || b.n - a.n || a.shopName.localeCompare(b.shopName))
    .slice(0, 5)
    .map(strip);

  const statements: string[] = [];
  if (enough) {
    if (topFish.length)
      statements.push(`你给高分（均分≥4，且至少吃过 ${MIN_FISH_N} 次）的鱼种：${topFish.map((f) => `${f.fish}（${f.avg}，${f.n} 贯）`).join("、")}。`);
    if (lowFish.length)
      statements.push(`你给低分（均分≤2.5）的鱼种：${lowFish.map((f) => `${f.fish}（${f.avg}，${f.n} 贯）`).join("、")}。`);
    if (!topFish.length && !lowFish.length)
      statements.push(`同一鱼种至少记录 ${MIN_FISH_N} 贯后才能判断偏好，目前还没有鱼种达到。`);
    if (topShops.length)
      statements.push(`总评均分≥4 的店：${topShops.map((s) => `${s.shopName}（${s.avg}，${s.n} 次）`).join("、")}。`);
    if (prices.length >= 3) statements.push(`你填写过价格的 ${prices.length} 次打卡，平均每次 ¥${Math.round(mean(prices))}。`);
  }
  return {
    checkinCount: checkins.length,
    pieceCount: pieces.length,
    avgOverall: checkins.length ? r1(mean(checkins.map((c) => c.overall))) : null,
    avgPrice: prices.length ? Math.round(mean(prices)) : null,
    enough,
    needMore: needs.join("，"),
    topFish,
    lowFish,
    topShops,
    statements,
  };
}
