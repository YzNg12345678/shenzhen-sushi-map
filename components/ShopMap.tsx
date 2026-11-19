"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { loadAMap, SHENZHEN_CENTER } from "@/lib/amap";
import type { Poi } from "@/lib/types";

interface Props {
  pois: Poi[];
  selectedId?: string | null;
  /** id → 标签文字（如“最匹配”），用于突出推荐店。 */
  highlights?: Record<string, string>;
  onSelect: (id: string) => void;
  height?: number | string;
}

const pinHtml = (label: string, hl: boolean, sel: boolean) =>
  `<div class="pin${hl ? " pin-hl" : ""}${sel ? " pin-sel" : ""}" data-testid="pin">${label}</div>`;

export default function ShopMap({ pois, selectedId, highlights, onSelect, height = 520 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markers = useRef<Map<string, { m: any; label: string; hl: boolean }>>(new Map());
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const poisRef = useRef(pois);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
    poisRef.current = pois;
    selectedRef.current = selectedId;
  });

  useEffect(() => {
    let cancelled = false;
    const markerMap = markers.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    loadAMap()
      .then((AMap) => {
        if (cancelled || !el.current) return;
        const map = new AMap.Map(el.current, { zoom: 11, center: SHENZHEN_CENTER, resizeEnable: true });
        mapRef.current = map; // 先登记，保证后续抛错时 cleanup 仍能 destroy
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar());
        setState("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (mapRef.current) {
          mapRef.current.destroy();
          mapRef.current = null;
        }
        setError(e instanceof Error ? e.message : "地图创建失败");
        setState("error");
      });
    return () => {
      cancelled = true;
      markerMap.clear();
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (state !== "ready" || !map || !AMap) return;
    map.remove([...markers.current.values()].map((x) => x.m));
    markers.current.clear();
    const list: any[] = [];
    pois.forEach((p, i) => {
      const hl = Boolean(highlights?.[p.id]);
      const label = hl ? "★" : String(i + 1);
      const m = new AMap.Marker({
        position: [p.lng, p.lat],
        title: p.name,
        content: pinHtml(label, hl, selectedRef.current === p.id),
        offset: new AMap.Pixel(-14, -14),
        zIndex: hl ? 120 : 100,
      });
      m.on("click", () => onSelectRef.current(p.id));
      markers.current.set(p.id, { m, label, hl });
      list.push(m);
    });
    map.add(list);
    if (list.length) map.setFitView(list, false, [60, 60, 60, 60]);
  }, [pois, highlights, state]);

  useEffect(() => {
    if (state !== "ready") return;
    markers.current.forEach(({ m, label, hl }, id) => {
      m.setContent(pinHtml(label, hl, id === selectedId));
      m.setzIndex(id === selectedId ? 200 : hl ? 120 : 100);
    });
  }, [selectedId, pois, highlights, state]);

  // 仅在选中项变化时平移地图，避免筛选/刷新标记时把 setFitView 的结果覆盖掉。
  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map || !selectedId) return;
    const poi = poisRef.current.find((p) => p.id === selectedId);
    if (poi) map.setCenter([poi.lng, poi.lat]);
  }, [selectedId, state]);

  return (
    <div className="map-wrap" style={{ height }}>
      <div ref={el} className="map-canvas" role="region" aria-label="深圳寿司店地图（等价列表见页面其他区域）" />
      {state === "loading" && <div className="map-overlay" role="status">地图加载中…</div>}
      {state === "error" && (
        <div className="map-overlay map-error" role="alert">
          <p>
            <strong>地图暂时无法显示</strong>
          </p>
          <p>{error}</p>
          <p>店铺列表仍可使用。</p>
          <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>
            重试加载地图
          </button>
        </div>
      )}
    </div>
  );
}
