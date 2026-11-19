import type { Poi } from "./types";

export const UNKNOWN = "未知";
export const money = (n?: number) => (n === undefined ? UNKNOWN : `¥${n}`);
export const text = (s?: string) => (s && s.trim() ? s : UNKNOWN);
export const rate = (n?: number) => (n === undefined ? UNKNOWN : n.toFixed(1));
export const costBand = (poi: Poi) => poi.cost;

export const VINEGAR_LABEL = { unknown: "待补充", red: "赤酢", white: "白酢", mixed: "混合/其他" } as const;
export const REVISIT_LABEL = { unset: "未填写", yes: "想再去", maybe: "看情况", no: "不再去" } as const;
export const RESERVATION_LABEL = { unknown: "待补充", easy: "容易", normal: "一般", hard: "较难" } as const;

export const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const uid = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
