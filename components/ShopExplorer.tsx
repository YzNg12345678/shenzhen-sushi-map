"use client";

import { useMemo, useRef, useState } from "react";
import FilterPanel from "@/components/FilterPanel";
import ShopCard from "@/components/ShopCard";
import ShopMap from "@/components/ShopMap";
import ShopSheet from "@/components/ShopSheet";
import { KINDS, PRICE_BANDS, buildShops, defaultFilters, districtsOf, filterShops, isFiltered, stateOf, type Filters } from "@/lib/shops";
import { usePois, useStore } from "@/lib/store";

function activeList(f: Filters): { id: keyof Filters; label: string }[] {
  const out: { id: keyof Filters; label: string }[] = [];
  if (f.query) out.push({ id: "query", label: `搜索：${f.query}` });
  if (f.price !== "any") out.push({ id: "price", label: PRICE_BANDS.find((p) => p.value === f.price)?.label ?? f.price });
  if (f.kind !== "any") out.push({ id: "kind", label: KINDS.find((p) => p.value === f.kind)?.label ?? f.kind });
  if (f.district !== "any") out.push({ id: "district", label: f.district });
  if (f.confidence !== "any") out.push({ id: "confidence", label: `置信度 ${f.confidence}` });
  if (f.mine) out.push({ id: "mine", label: "我的收藏与去过" });
  return out;
}

export default function ShopExplorer() {
  const { pois, status, error, failed, reload } = usePois();
  const { data, patch } = useStore();
  const [f, setF] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const drawerBtn = useRef<HTMLButtonElement>(null);

  // 高德检索期间不先展示“无位置”的店，避免检索完成后列表整体重排；检索失败时仍展示已审计店铺（无位置）。
  const built = useMemo(() => (status === "loading" ? null : buildShops(pois)), [pois, status]);
  const all = useMemo(() => built?.shops ?? [], [built]);
  const shown = useMemo(() => filterShops(all, f, data.shops), [all, f, data.shops]);
  const districts = useMemo(() => districtsOf(all), [all]);
  const sel = all.find((v) => v.key === selected) ?? null;
  const chips = activeList(f);
  const active = isFiltered(f);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));
  const reset = <K extends keyof Filters>(k: K) => setF((x) => ({ ...x, [k]: defaultFilters()[k] }));

  const open = (key: string, el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement as HTMLElement | null);
    setSelected(key);
  };
  const cardButton = (key: string) => document.getElementById(`card-${key}`)?.querySelector("button") ?? null;
  const close = () => {
    const key = selected;
    setSelected(null);
    const el = opener.current?.isConnected ? opener.current : key ? cardButton(key) : null;
    el?.focus?.();
  };

  return (
    <div className="explorer">
      <>
        <div className="toolbar" role="search">
          <h1 className="explorer-title">精选板前清单</h1>
          <label className="sr-only" htmlFor="q">搜索店名、商圈、食材、风格</label>
          <div className="search-row">
            <input id="q" className="search" type="search" placeholder="搜索店名、商圈、食材、风格" value={f.query} onChange={(e) => set("query", e.target.value)} />
            <button ref={drawerBtn} type="button" className="btn filter-btn" onClick={() => drawer.current?.showModal()}>
              筛选{chips.filter((c) => c.id !== "query").length > 0 ? `（${chips.filter((c) => c.id !== "query").length}）` : ""}
            </button>
          </div>
          {chips.length > 0 && (
            <ul className="applied" aria-label="当前筛选条件">
              {chips.map((c) => (
                <li key={c.id}>
                  <button type="button" className="tag" onClick={() => reset(c.id)} aria-label={`清除条件：${c.label}`}>
                    {c.label}
                    <span aria-hidden="true"> ×</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="link-btn" onClick={() => setF(defaultFilters())}>清除全部</button>
              </li>
            </ul>
          )}
        </div>

        <div className="map-pane">
          <ShopMap shops={shown} selectedKey={selected} onSelect={(k) => open(k, cardButton(k))} />
        </div>

        <section className="list-pane" aria-label="店铺列表">
          {status === "error" && (
            <div className="alert" role="alert">
              <p><strong>高德检索失败：</strong>{error}</p>
              <p className="small">仍可浏览已审计的店铺资料，但没有位置、电话、营业时间等高德信息，地图上也不会出现标记。</p>
              <button type="button" className="btn btn-primary" onClick={reload}>重新检索</button>
            </div>
          )}
          {status === "ready" && failed > 0 && <p className="small warn" role="status">有 {failed} 项高德检索失败，位置信息可能不完整。</p>}
          <p className="count" role="status" data-testid="count">
            {status === "loading" ? "正在向高德检索…" : `共 ${shown.length} 家`}
          </p>
          {status !== "loading" && shown.length === 0 && (
            <div className="empty" data-testid="empty">
              <p className="empty-title">没有符合条件的店</p>
              <p className="small muted">{active ? "换个关键词，或放宽价位、类型与区域条件。" : "目前没有通过审核的店铺。"}</p>
              {active && <button type="button" className="btn btn-primary" onClick={() => setF(defaultFilters())}>清除筛选</button>}
            </div>
          )}
          <ol className="shops">
            {shown.map((v, i) => (
              <li key={v.key} id={`card-${v.key}`}>
                <ShopCard v={v} index={i} state={stateOf(data.shops, v)} selected={selected === v.key} onOpen={() => open(v.key)} />
              </li>
            ))}
          </ol>
        </section>
      </>

      {sel && <ShopSheet v={sel} state={stateOf(data.shops, sel)} onPatch={(p) => patch(sel.key, stateOf(data.shops, sel), p)} onClose={close} />}

      <dialog ref={drawer} className="drawer" aria-labelledby="drawer-title" onClose={() => drawerBtn.current?.focus()}>
        <div className="drawer-head">
          <h2 id="drawer-title">筛选与排序</h2>
          <button type="button" className="close-btn" onClick={() => drawer.current?.close()}>完成</button>
        </div>
        <FilterPanel f={f} set={set} districts={districts} />
        <div className="drawer-foot">
          <button type="button" className="btn" onClick={() => setF(defaultFilters())} disabled={!active}>清除全部</button>
          <button type="button" className="btn btn-primary" onClick={() => drawer.current?.close()}>查看 {shown.length} 家</button>
        </div>
      </dialog>
    </div>
  );
}
