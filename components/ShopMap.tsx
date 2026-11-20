"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { loadAMap, SHENZHEN_CENTER } from "@/lib/amap";
import type { ShopView } from "@/lib/shops";

interface Props {
  shops: ShopView[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
}

const pinHtml = (label: string, sel: boolean) => `<div class="pin${sel ? " pin-sel" : ""}" data-testid="pin">${label}</div>`;

export default function ShopMap({ shops, selectedKey, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const fitKey = useRef("");
  const markers = useRef<Map<string, { m: any; label: string }>>(new Map());
  const onSelectRef = useRef(onSelect);
  const shopsRef = useRef(shops);
  const selectedRef = useRef(selectedKey);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
    shopsRef.current = shops;
    selectedRef.current = selectedKey;
  });

  useEffect(() => {
    let cancelled = false;
    const markerMap = markers.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    loadAMap()
      .then((AMap) => {
        if (cancelled || !el.current) return;
        const map = new AMap.Map(el.current, { zoom: 11, center: SHENZHEN_CENTER, resizeEnable: true, mapStyle: "amap://styles/whitesmoke" });
        mapRef.current = map;
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
      fitKey.current = "";
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [attempt]);

  // 仅当可见店铺集合/顺序变化时重建标记；收藏等个人状态变化不触发（97 个标记重建在慢设备上要数秒）。
  const idKey = shops.map((v) => v.key).join(",");
  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (state !== "ready" || !map || !AMap) return;
    const shops = shopsRef.current;
    map.remove([...markers.current.values()].map((x) => x.m));
    markers.current.clear();
    const list: any[] = [];
    shops.forEach((v, i) => {
      if (!v.poi) return;
      const label = String(i + 1);
      const m = new AMap.Marker({
        position: [v.poi.lng, v.poi.lat],
        title: v.name,
        content: pinHtml(label, selectedRef.current === v.key),
        offset: new AMap.Pixel(-14, -14),
        zIndex: 100,
      });
      m.on("click", () => onSelectRef.current(v.key));
      markers.current.set(v.key, { m, label });
      list.push(m);
    });
    map.add(list);
    // 仅在店铺集合变化时重新取景，不打断用户的平移/缩放。
    if (list.length && fitKey.current !== idKey) {
      fitKey.current = idKey;
      map.setFitView(list, false, [50, 50, 50, 50]);
    }
  }, [idKey, state]);

  useEffect(() => {
    if (state !== "ready") return;
    markers.current.forEach(({ m, label }, key) => {
      m.setContent(pinHtml(label, key === selectedKey));
      m.setzIndex(key === selectedKey ? 200 : 100);
    });
  }, [selectedKey, idKey, state]);

  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map || !selectedKey) return;
    const v = shopsRef.current.find((x) => x.key === selectedKey);
    if (v?.poi) map.setCenter([v.poi.lng, v.poi.lat], true);
  }, [selectedKey, state]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map-canvas" role="region" aria-label="深圳 Omakase 地图（等价的店铺列表在地图下方或左侧）" />
      {state === "loading" && <div className="map-overlay" role="status">地图加载中…</div>}
      {state === "error" && (
        <div className="map-overlay map-error" role="alert">
          <p><strong>地图暂时无法显示</strong></p>
          <p>{error}</p>
          <p>店铺列表仍可使用，但不含位置。</p>
          <button type="button" className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
            重试加载地图
          </button>
        </div>
      )}
    </div>
  );
}
