"use client";

import { useMemo, useState } from "react";
import ShopCard from "@/components/ShopCard";
import ShopMap from "@/components/ShopMap";
import PoiStatus from "@/components/PoiStatus";
import ViewToggle from "@/components/ViewToggle";
import { useMobileView, useTitle } from "@/components/hooks";
import { usePois, useStore } from "@/lib/store";

type Sort = "default" | "rating" | "cost";

export default function MapPage() {
  useTitle("寿司地图");
  const { view, setView, showMapIfMobile } = useMobileView();
  const { pois, search, status } = usePois();
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyVisited, setOnlyVisited] = useState(false);
  const [sort, setSort] = useState<Sort>("default");
  const [selected, setSelected] = useState<string | null>(null);

  const select = (id: string) => {
    setSelected(id);
    showMapIfMobile();
  };

  const districts = useMemo(() => [...new Set(pois.map((p) => p.district).filter((d): d is string => Boolean(d)))].sort(), [pois]);
  const activeDistrict = districts.includes(district) ? district : "";
  const list = useMemo(() => {
    const cap = Number(maxCost);
    let l = pois.filter((p) => {
      const n = data.notes[p.id];
      if (activeDistrict && p.district !== activeDistrict) return false;
      if (cap > 0 && (p.cost === undefined || p.cost > cap)) return false;
      if (onlyFav && !n?.favorite) return false;
      if (onlyVisited && !n?.visited) return false;
      return true;
    });
    if (sort === "rating") l = [...l].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    if (sort === "cost") l = [...l].sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity));
    return l;
  }, [pois, activeDistrict, maxCost, onlyFav, onlyVisited, sort, data.notes]);

  return (
    <div className="page">
      <h1>深圳寿司地图</h1>
      <h2 className="sr-only">筛选与店铺列表</h2>
      <form
        className="filters"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
      >
        <div className="field">
          <label htmlFor="q">搜索店名/关键词</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="如 鮨、omakase、福田" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={status === "loading"}>搜索高德</button>
      </form>
      <div className="filters filters-local" role="group" aria-label="本地筛选（不重新检索）">
        <div className="field">
          <label htmlFor="district">区域</label>
          <select id="district" value={activeDistrict} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">全部区域</option>
            {districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cap">人均上限（元，仅含高德有人均的店）</label>
          <input id="cap" type="number" min={1} value={maxCost} onChange={(e) => setMaxCost(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sort">排序</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="default">高德返回顺序</option>
            <option value="rating">评分高→低（未知在后）</option>
            <option value="cost">人均低→高（未知在后）</option>
          </select>
        </div>
        <label className="check"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> 只看收藏</label>
        <label className="check"><input type="checkbox" checked={onlyVisited} onChange={(e) => setOnlyVisited(e.target.checked)} /> 只看去过</label>
      </div>
      <PoiStatus />
      <p className="muted small" role="status" data-testid="filter-count">当前筛选后显示 {list.length} 家。</p>
      <ViewToggle view={view} onChange={setView} />
      <div className={`map-layout view-${view}`}>
        <section className="list-col list-pane" aria-label="店铺列表（地图等价列表）">
          {list.length === 0 && status === "ready" && <p className="empty">{pois.length === 0 ? "高德没有返回结果，换个关键词再搜。" : "没有符合筛选的店铺，试试放宽条件。"}</p>}
          {list.map((p, i) => (
            <ShopCard key={p.id} poi={p} index={i} selected={selected === p.id} onSelect={() => select(p.id)} />
          ))}
        </section>
        <div className="map-col sticky-map map-pane" id="map-pane">
          <ShopMap pois={list} selectedId={selected} onSelect={setSelected} height="calc(100vh - 140px)" />
        </div>
      </div>
    </div>
  );
}
