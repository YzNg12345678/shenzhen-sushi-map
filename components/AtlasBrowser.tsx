"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SeasonStrip from "@/components/SeasonStrip";
import { ATLAS_CATEGORIES, defaultAtlasFilters, filterAtlas, monthsLabel, seasonStatus, type AtlasFilters } from "@/lib/atlas";
import { atlas } from "@/lib/data";

export default function AtlasBrowser() {
  const [f, setF] = useState<AtlasFilters>(defaultAtlasFilters);
  const [thisMonth, setThisMonth] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThisMonth(new Date().getMonth() + 1);
  }, []);
  const shown = useMemo(() => filterAtlas(atlas.items, f), [f]);
  const set = <K extends keyof AtlasFilters>(k: K, v: AtlasFilters[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = f.query !== "" || f.category !== "any" || f.month !== 0;

  return (
    <div className="page">
      <p className="eyebrow">图鉴 · Neta</p>
      <h1 className="page-title">鱼种食材季节图鉴</h1>
      <p className="notice season-disclaimer" data-testid="season-disclaimer" role="note">{atlas.seasonDisclaimer}</p>

      <div className="toolbar" role="search">
        <label className="sr-only" htmlFor="aq">搜索中文名、日文名或别名</label>
        <input id="aq" className="search" type="search" placeholder="搜索中文名、日文名、别名" value={f.query} onChange={(e) => set("query", e.target.value)} />

        <fieldset className="choice">
          <legend>类别</legend>
          <div className="choice-row">
            <button type="button" className="chip" aria-pressed={f.category === "any"} onClick={() => set("category", "any")}>全部</button>
            {ATLAS_CATEGORIES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={f.category === c} onClick={() => set("category", c)}>{c}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice">
          <legend>月份</legend>
          <div className="choice-row">
            <button type="button" className="chip" aria-pressed={f.month === 0} onClick={() => set("month", 0)}>不限月份</button>
            <button type="button" className="chip" disabled={!thisMonth} aria-pressed={thisMonth !== 0 && f.month === thisMonth} onClick={() => set("month", thisMonth)}>
              本月当季{thisMonth ? `（${thisMonth}月）` : ""}
            </button>
            <label className="sr-only" htmlFor="am">任选月份</label>
            <select id="am" className="select" value={f.month} onChange={(e) => set("month", Number(e.target.value))}>
              <option value={0}>任选月份</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>

      <p className="count" role="status" data-testid="atlas-count">
        共 {shown.length} 种{f.month ? `（${f.month} 月当季与全年供应）` : ""}
        {dirty && <button type="button" className="link-btn" onClick={() => setF(defaultAtlasFilters())}>清除筛选</button>}
      </p>

      {shown.length === 0 ? (
        <div className="empty" data-testid="atlas-empty">
          <p className="empty-title">没有符合条件的条目</p>
          <p className="small muted">试试别的写法（日文名、别名），或放宽类别与月份。</p>
          <button type="button" className="btn btn-primary" onClick={() => setF(defaultAtlasFilters())}>清除筛选</button>
        </div>
      ) : (
        <ul className="atlas-grid">
          {shown.map((it) => {
            const label = monthsLabel(it.season.months);
            const st = f.month ? seasonStatus(it, f.month) : null;
            return (
              <li key={it.id}>
                <article className="atlas-card" data-testid="atlas-card">
                  <p className="eyebrow">{it.category}</p>
                  <h2>
                    <Link href={`/atlas/${it.id}/`}>
                      {it.zh}
                      <span className="ja-inline">{it.ja}</span>
                    </Link>
                  </h2>
                  <p className="season-label">
                    旬：{label}
                    {st === "peak" && <span className="flag">当季</span>}
                    {st === "all" && <span className="flag">全年供应</span>}
                  </p>
                  <SeasonStrip months={it.season.months} label={label} highlight={f.month || undefined} />
                  <p className="atlas-flavor">{it.flavor}</p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
