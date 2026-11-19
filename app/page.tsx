"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SettingsDialog from "@/components/SettingsDialog";
import ShopCard from "@/components/ShopCard";
import ShopMap from "@/components/ShopMap";
import ShopSheet from "@/components/ShopSheet";
import { defaultFilters, buildShops, filterShops, stateOf, type Filters, type PriceBand } from "@/lib/shops";
import { PORTS } from "@/lib/ports";
import { usePois, useStore } from "@/lib/store";

export default function Home() {
  const { pois, status, error, failed, reload } = usePois();
  const { data, patch, replaceAll, clearAll, persistError } = useStore();
  const [f, setF] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 高德检索期间不先展示“无位置”的整理门店，避免检索完成后列表整体重排。
  const all = useMemo(() => (status === "loading" ? [] : buildShops(pois)), [pois, status]);
  const shown = useMemo(() => filterShops(all, f, data.shops), [all, f, data.shops]);
  const sel = shown.find((v) => v.key === selected) ?? all.find((v) => v.key === selected) ?? null;
  const active = f.parents || f.crossing || f.stable || f.mine || f.price !== "any" || f.port !== "any" || f.query !== "";
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    document.title = "深圳 Omakase 跨境家庭选店地图";
  }, []);

  const open = (key: string, el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement as HTMLElement | null);
    setSelected(key);
  };
  const close = () => {
    setSelected(null);
    opener.current?.focus?.();
  };

  return (
    <div className="app">
      <header className="top">
        <h1>
          深圳 Omakase 跨境家庭选店地图
          <small>给常住香港、熟悉 Omakase、会带伴侣或父母来深圳的你</small>
        </h1>
        <button type="button" className="icon-btn" aria-label="设置与数据说明" onClick={(e) => { opener.current = e.currentTarget; dialog.current?.showModal(); }}>
          ⚙ 设置
        </button>
      </header>
      <section className="intro" aria-label="三个判断">
        <p>每家店只回答三件事：</p>
        <ul>
          <li>① 稳不稳</li>
          <li>② 带父母合不合适</li>
          <li>③ 值不值得专程过关</li>
        </ul>
      </section>
      <div className="toolbar" role="search">
        <label className="sr-only" htmlFor="q">搜索店名、商圈、口岸</label>
        <input id="q" className="search" type="search" placeholder="搜索店名、商圈、口岸" value={f.query} onChange={(e) => set("query", e.target.value)} />
        <div className="chips" role="group" aria-label="筛选">
          <button type="button" className="chip" aria-pressed={f.parents} onClick={() => set("parents", !f.parents)}>带父母 高</button>
          <button type="button" className="chip" aria-pressed={f.crossing} onClick={() => set("crossing", !f.crossing)}>值得过关 高</button>
          <button type="button" className="chip" aria-pressed={f.stable} onClick={() => set("stable", !f.stable)}>近期稳定 高</button>
          <select className="chip" aria-label="人均" value={f.price} onChange={(e) => set("price", e.target.value as PriceBand)}>
            <option value="any">人均不限</option>
            <option value="lt300">人均 &lt;300</option>
            <option value="300-600">人均 300–600</option>
            <option value="gt600">人均 &gt;600</option>
          </select>
          <select className="chip" aria-label="口岸" value={f.port} onChange={(e) => set("port", e.target.value as Filters["port"])}>
            <option value="any">口岸不限</option>
            {PORTS.map((p) => <option key={p.id} value={p.id}>近{p.name}</option>)}
          </select>
          <button type="button" className="chip" aria-pressed={f.mine} onClick={() => set("mine", !f.mine)}>我的收藏/去过</button>
        </div>
      </div>

      <div className="map-pane">
        <ShopMap shops={shown} selectedKey={selected} onSelect={(k) => open(k, document.getElementById(`card-${k}`)?.querySelector("button"))} />
      </div>

      <div className="list-pane" ref={listRef}>
        {status === "error" && (
          <div className="alert" role="alert">
            <p><strong>高德检索失败：</strong>{error}</p>
            <p className="small">仍可浏览已整理的门店资料，但没有位置和高德信息。</p>
            <button type="button" className="btn btn-primary" onClick={reload}>重新检索</button>
          </div>
        )}
        {status === "ready" && failed > 0 && <p className="small warn" role="status">有 {failed} 项高德检索失败，结果可能不完整。</p>}
        <p className="count" role="status" data-testid="count">
          {status === "loading" ? "正在向高德检索深圳 Omakase 店…" : `共 ${shown.length} 家${active ? `（筛选前 ${all.length} 家）` : ""}`}
        </p>
        {status !== "loading" && shown.length === 0 && (
          <div className="empty" data-testid="empty">
            <p><strong>没有符合条件的店。</strong></p>
            <p className="small">
              {f.parents || f.crossing || f.stable
                ? "“高”需要至少 2 篇详细正面记述，目前素材里没有店同时满足所选条件（例如没有任何店在“过关价值”上达到“高”）。可以取消一项筛选，或清除全部筛选。"
                : "换个关键词，或放宽人均与口岸条件。"}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setF(defaultFilters())}>清除全部筛选</button>
          </div>
        )}
        <ol className="cards">
          {shown.map((v, i) => (
            <li key={v.key} id={`card-${v.key}`}>
              <ShopCard v={v} index={i} state={stateOf(data.shops, v)} selected={selected === v.key} onOpen={() => open(v.key)} />
            </li>
          ))}
        </ol>
      </div>

      {sel && <ShopSheet v={sel} state={stateOf(data.shops, sel)} onPatch={(p) => patch(sel.key, stateOf(data.shops, sel), p)} onClose={close} />}
      <SettingsDialog ref={dialog} data={data} persistError={persistError} onReplace={replaceAll} onClear={clearAll} onClose={() => { dialog.current?.close(); opener.current?.focus?.(); }} />
    </div>
  );
}
