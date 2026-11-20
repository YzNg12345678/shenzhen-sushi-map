import { nameHasAny } from "./match";
import type { Poi } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

export const SHENZHEN_CENTER: [number, number] = [114.0579, 22.5431];

let loading: Promise<any> | null = null;

export function amapConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AMAP_JS_KEY && process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE);
}

/** 加载高德 JS API 2.0。失败后可再次调用重试。 */
const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

export function loadAMap(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("仅限浏览器环境"));
  if (window.AMap?.PlaceSearch) return Promise.resolve(window.AMap);
  if (!amapConfigured()) {
    return Promise.reject(new Error("未配置高德 JS API Key 或安全密钥（见 README“环境配置”）。"));
  }
  if (loading) return loading;
  window._AMapSecurityConfig = { securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE as string };
  loading = withTimeout(new Promise<any>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      process.env.NEXT_PUBLIC_AMAP_JS_KEY as string,
    )}&plugin=AMap.PlaceSearch,AMap.Scale,AMap.ToolBar`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) resolve(window.AMap);
      else reject(new Error("高德脚本已加载但未提供 AMap 对象。"));
    };
    script.onerror = () => reject(new Error("无法加载高德地图脚本，请检查网络。"));
    document.head.appendChild(script);
  }), 20_000, "加载高德地图脚本超时，请检查网络后重试。").catch((e) => {
    loading = null;
    document.querySelectorAll('script[src^="https://webapi.amap.com/maps"]').forEach((n) => n.remove());
    throw e;
  });
  return loading;
}

const str = (v: unknown): string | undefined => {
  if (typeof v === "string") {
    const t = v.trim();
    return t && t !== "[]" ? t : undefined;
  }
  return undefined;
};
const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return undefined;
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** 把高德 POI 原始对象映射为本应用的 Poi；缺失字段保持 undefined。 */
export function mapPoi(raw: any): Poi | null {
  if (!raw?.id || !raw?.name || !raw?.location) return null;
  const lng = typeof raw.location.getLng === "function" ? raw.location.getLng() : raw.location.lng;
  const lat = typeof raw.location.getLat === "function" ? raw.location.getLat() : raw.location.lat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const ext = raw.biz_ext ?? {};
  const rating = num(raw.rating ?? ext.rating);
  return {
    id: String(raw.id),
    name: String(raw.name),
    address: str(raw.address),
    lng,
    lat,
    tel: str(raw.tel),
    district: str(raw.adname),
    businessArea: str(raw.business_area ?? raw.businessArea),
    type: str(raw.type),
    rating: rating !== undefined && rating <= 5 ? rating : undefined,
    cost: num(raw.cost ?? ext.cost),
    openTime: str(raw.opentime_week ?? raw.opentime_today ?? raw.opentime2 ?? raw.opentime ?? ext.opentime2),
    fetchedAt: new Date().toISOString(),
  };
}

function placeSearch(AMap: any, pageSize: number) {
  return new AMap.PlaceSearch({
    city: "深圳",
    citylimit: true,
    pageSize,
    type: "餐饮服务",
    extensions: "all",
  });
}

function runPage(ps: any, keyword: string, page: number): Promise<{ pois: any[]; total: number }> {
  return withTimeout(new Promise<{ pois: any[]; total: number }>((resolve, reject) => {
    ps.setPageIndex(page);
    ps.search(keyword, (status: string, result: any) => {
      if (status === "complete" && result?.poiList) resolve({ pois: result.poiList.pois ?? [], total: result.poiList.count ?? 0 });
      else if (status === "no_data") resolve({ pois: [], total: 0 });
      else reject(new Error(`高德 POI 搜索失败（${status}：${typeof result === "string" ? result : result?.info ?? "未知原因"}）。`));
    });
  }), 20_000, "高德 POI 搜索超时，请重试。");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 高德对并发有限流；失败时等一会儿重试一次。 */
async function searchKeyword(AMap: any, keyword: string, pages: number): Promise<Poi[]> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await searchKeywordOnce(AMap, keyword, pages);
    } catch (e) {
      last = e;
      await sleep(800 * (attempt + 1));
    }
  }
  throw last;
}

async function searchKeywordOnce(AMap: any, keyword: string, pages: number): Promise<Poi[]> {
  const ps = placeSearch(AMap, 25);
  const out: Poi[] = [];
  for (let page = 1; page <= pages; page++) {
    const { pois, total } = await runPage(ps, keyword, page);
    for (const raw of pois) {
      const p = mapPoi(raw);
      if (p) out.push(p);
    }
    if (page * 25 >= total || pois.length < 25) break;
  }
  return out;
}

/** 通用发现：Omakase / 板前 / 鮨 关键词，只保留名称或类型像 Omakase / 寿司的店。 */
export const DISCOVERY_QUERIES = ["Omakase", "板前寿司", "鮨"];
export const looksLikeOmakase = (p: Poi): boolean =>
  /omakase|板前|鮨|鮓|おまかせ|割烹|怀石/i.test(p.name);

export interface SearchResult {
  pois: Poi[];
  /** 失败的检索数量（部分失败时仍返回已得到的结果）。 */
  failed: number;
}

/**
 * 实时检索：通用发现 + 为每家已整理门店按关键词检索（只保留名称含关键词的结果），按 id 去重。
 * 全部失败才抛错，部分失败时返回已得到的结果并给出失败数。
 */
export async function searchOmakase(curated: { keywords: string[] }[]): Promise<SearchResult> {
  const AMap = await loadAMap();
  const jobs = [
    ...DISCOVERY_QUERIES.map((q) => () => searchKeyword(AMap, q, 2).then((l) => l.filter(looksLikeOmakase))),
    ...curated.map((c) => () => searchKeyword(AMap, c.keywords[0], 1).then((l) => l.filter((p) => nameHasAny(p.name, c.keywords)))),
  ];
  const results: PromiseSettledResult<Poi[]>[] = [];
  for (let i = 0; i < jobs.length; i += 3) results.push(...(await Promise.allSettled(jobs.slice(i, i + 3).map((j) => j()))));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed === results.length) {
    const first = results[0] as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new Error("高德检索失败");
  }
  const seen = new Map<string, Poi>();
  for (const r of results) if (r.status === "fulfilled") for (const p of r.value) if (!seen.has(p.id)) seen.set(p.id, p);
  return { pois: [...seen.values()], failed };
}
