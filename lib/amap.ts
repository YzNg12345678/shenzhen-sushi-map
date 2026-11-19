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

/** 实时检索深圳寿司店 POI（最多 3 页，每页 25 条），按 id 去重。 */
export async function searchSushi(keyword: string): Promise<Poi[]> {
  const AMap = await loadAMap();
  const ps = placeSearch(AMap, 25);
  const kw = keyword.trim();
  const query = /寿司|鮨|鮓|sushi|omakase/i.test(kw) ? kw : kw ? `${kw} 寿司` : "寿司";
  const seen = new Map<string, Poi>();
  for (let page = 1; page <= 3; page++) {
    const { pois, total } = await runPage(ps, query, page);
    for (const raw of pois) {
      const p = mapPoi(raw);
      if (p && !seen.has(p.id)) seen.set(p.id, p);
    }
    if (page * 25 >= total || pois.length < 25) break;
  }
  return [...seen.values()];
}

/** 按 id 拉取单个 POI 详情。 */
export async function fetchPoiById(id: string): Promise<Poi> {
  const AMap = await loadAMap();
  const ps = placeSearch(AMap, 1);
  return new Promise((resolve, reject) => {
    ps.getDetails(id, (status: string, result: any) => {
      const p = status === "complete" ? mapPoi(result?.poiList?.pois?.[0]) : null;
      if (p) resolve(p);
      else reject(new Error("高德未返回该店铺详情，请回到地图重新搜索。"));
    });
  });
}
