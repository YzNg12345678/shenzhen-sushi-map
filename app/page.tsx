"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ShopCard from "@/components/ShopCard";
import ShopMap from "@/components/ShopMap";
import PoiStatus from "@/components/PoiStatus";
import ViewToggle from "@/components/ViewToggle";
import { useMobileView, useTitle } from "@/components/hooks";
import { recommend, SCENES, type SceneId } from "@/lib/recommend";
import { usePois, useStore } from "@/lib/store";

export default function Home() {
  useTitle("今天怎么吃");
  const { view, setView, showMapIfMobile } = useMobileView();
  const { pois, status } = usePois();
  const { data } = useStore();
  const [scene, setScene] = useState<SceneId | null>(null);
  const [budget, setBudget] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const budgetNum = Number(budget);
  const budgetRef = useRef<HTMLInputElement>(null);
  const sceneRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const budgetInvalid = scene === "budget" && !(budgetNum > 0);
  useEffect(() => {
    if (scene === "budget") budgetRef.current?.focus();
  }, [scene]);
  const onSceneKey = (e: React.KeyboardEvent, i: number) => {
    const n = SCENES.length;
    let j = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    const target = SCENES[j];
    if (!target) return;
    setScene(target.id);
    sceneRefs.current[j]?.focus();
  };
  const select = (id: string) => {
    setSelected(id);
    showMapIfMobile();
  };

  const picks = useMemo(() => {
    if (!scene) return null;
    return recommend(pois, scene, { notes: data.notes, checkins: data.checkins }, budgetNum > 0 ? budgetNum : undefined);
  }, [scene, pois, data.notes, data.checkins, budgetNum]);

  const highlights = useMemo(() => Object.fromEntries((picks ?? []).map((p) => [p.poi.id, p.badge])), [picks]);
  const sceneInfo = SCENES.find((s) => s.id === scene);
  const mapPois = picks && picks.length ? picks.map((p) => p.poi) : pois;

  return (
    <div className={`page home-grid view-${view}`}>
      <ViewToggle view={view} onChange={setView} />
      <section aria-labelledby="ask" className="list-pane">
        <h1 id="ask">今天怎么吃？</h1>
        <p className="lead">选一个场景，从高德实时检索到的深圳寿司店里挑出最多 3 家。</p>
        <div className="scene-grid" role="radiogroup" aria-label="用餐场景">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => { sceneRefs.current[i] = el; }}
              type="button"
              role="radio"
              className="scene"
              aria-checked={scene === s.id}
              tabIndex={scene === s.id || (scene === null && i === 0) ? 0 : -1}
              onKeyDown={(e) => onSceneKey(e, i)}
              onClick={() => setScene(s.id)}
            >
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </button>
          ))}
        </div>
        {scene === "budget" && (
          <div className="field">
            <label htmlFor="budget">每人预算上限（元）</label>
            <input ref={budgetRef} id="budget" type="number" min={1} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="例如 300" aria-invalid={budgetInvalid} aria-describedby={budgetInvalid ? "budget-err" : undefined} />
          </div>
        )}
        <PoiStatus />

        <p role="status" className="sr-only">{sceneInfo && picks && picks.length > 0 ? `已为你选出 ${picks.length} 家推荐` : ""}</p>
        {sceneInfo && (
          <div className="results" data-testid="results">
            <h2>{sceneInfo.label}推荐</h2>
            <p className="note-derived"><span className="tag tag-derived">推导</span> 规则：{sceneInfo.rule} 以下是按规则算出的建议，不是客观评价；理由只引用高德字段和你自己的记录。</p>
            {budgetInvalid && <p className="error" id="budget-err">请先填写预算上限。</p>}
            {status === "ready" && picks && picks.length === 0 && !(scene === "budget" && !(budgetNum > 0)) && (
              <p className="empty">没有店铺满足条件（高德返回的字段不足时不会硬凑）。可换一个场景，或到<Link href="/map">地图页</Link>手动筛选。</p>
            )}
            {picks && picks.length > 0 && picks.length < 3 && <p className="muted small">满足条件的店不足 3 家，仅显示 {picks.length} 家。</p>}
            <ol className="picks">
              {picks?.map((p) => (
                <li key={p.poi.id}>
                  <ShopCard poi={p.poi} badge={`${p.badge}（推导）`} selected={selected === p.poi.id} onSelect={() => select(p.poi.id)} />
                  <ul className="reasons">
                    {p.reasons.map((r, i) => (
                      <li key={i}>
                        <span className={`tag tag-${r.source === "高德" ? "amap" : r.source === "你的记录" ? "user" : "derived"}`}>{r.source}</span> {r.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
        {!sceneInfo && <p className="muted">还没选场景？也可以直接去 <Link href="/map">寿司地图</Link> 自己搜和筛。</p>}
        {status === "ready" && pois.length > 0 && (
          <details className="all-list">
            <summary>查看全部 {pois.length} 家检索结果（与地图标记一一对应）</summary>
            <div className="list-col">
              {pois.map((p, i) => (
                <ShopCard key={p.id} poi={p} index={i} selected={selected === p.id} onSelect={() => select(p.id)} />
              ))}
            </div>
          </details>
        )}
      </section>
      <section aria-label="地图" id="map-pane" className="sticky-map map-pane">
        <ShopMap pois={mapPois} highlights={highlights} selectedId={selected} onSelect={setSelected} height="calc(100vh - 140px)" />
        <p className="muted small">地图上 ★ 为推荐店；无推荐时显示全部检索结果。</p>
      </section>
    </div>
  );
}
