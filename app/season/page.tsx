"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FISH, FISH_TARGET, fishMatches } from "@/lib/fish";
import { useStore } from "@/lib/store";
import { useTitle } from "@/components/hooks";
import type { Checkin, Piece } from "@/lib/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type Rec = { c: Checkin; p: Piece };

function Related({ name, rs }: { name: string; rs: Rec[] }) {
  return (
    <div className="panel" role="region" aria-label={`${name} 相关记录`}>
      <h3>{name} 的个人记录 <span className="tag tag-user">你填写</span></h3>
      {rs.length === 0 ? <p className="empty">你还没有记录过这个鱼种。去<Link href="/passport">寿司护照</Link>添加。</p> : (
        <ul className="plain">
          {rs.map(({ c, p }, i) => (
            <li key={i}>
              {c.date} · {c.shopId ? <Link href={`/shop?id=${encodeURIComponent(c.shopId)}`}>{c.shopName}</Link> : c.shopName} · {p.rating}/5
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SeasonPage() {
  useTitle("鱼种季节日历");
  const { data } = useStore();
  // 服务端预渲染与浏览器的“当前月份”可能不同，先用固定值，挂载后再取本地月份，避免 hydration 不一致。
  const [month, setMonth] = useState(1);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(new Date().getMonth() + 1);
  }, []);
  const [open, setOpen] = useState<string | null>(null);

  const inSeason = FISH.filter((f) => f.months.includes(month));
  const unlisted = useMemo(() => {
    const names = new Set<string>();
    data.checkins.forEach((c) => c.pieces.forEach((p) => { if (!FISH.some((f) => fishMatches(f, p.fish))) names.add(p.fish); }));
    return [...names];
  }, [data.checkins]);

  const records = (match: (s: string) => boolean) =>
    data.checkins.flatMap((c) => c.pieces.filter((p) => match(p.fish)).map((p) => ({ c, p })));

  return (
    <div className="page">
      <h1>鱼种季节日历</h1>
      <div className="alert-info" role="note">
        <p>
          <strong>资料收录进度：{FISH.length} / {FISH_TARGET} 种。</strong>
          本页只收录有明确来源的条目；目前来源仅给出“季节”粒度，且尚未逐条与权威资料交叉核验，因此按整季显示并标注“来源待核验”。其余鱼种为<strong>待补充</strong>，不会凭印象填写。
          数据维护位置：<code>lib/fish.ts</code>（新增条目必须附来源）。
        </p>
      </div>
      <div className="field">
        <label htmlFor="month">查看月份</label>
        <select id="month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m) => <option key={m} value={m}>{m} 月</option>)}
        </select>
      </div>
      <h2>{month} 月 · 来源中标为当季的鱼种</h2>
      {inSeason.length === 0 && <p className="empty">已收录条目里没有标注为 {month} 月当季的鱼种（不代表没有，资料待补充）。</p>}
      <ul className="fish-list">
        {inSeason.map((f) => (
          <li key={f.id}>
            <button className="card fish" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)}>
              <strong>{f.name}</strong> <span className="muted">{f.ja}</span> · {f.seasonLabel}
            </button>
            {open === f.id && <Related name={f.name} rs={records((s) => fishMatches(f, s))} />}
          </li>
        ))}
      </ul>

      <h2>全年日历（已收录 {FISH.length} 种）</h2>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">鱼种全年季节表</caption>
          <thead>
            <tr><th scope="col">鱼种</th>{MONTHS.map((m) => <th scope="col" key={m}>{m}</th>)}<th scope="col">来源</th></tr>
          </thead>
          <tbody>
            {FISH.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.name}<br /><span className="muted small">{f.ja}</span></th>
                {MONTHS.map((m) => <td key={m} className={f.months.includes(m) ? "in-season" : ""}>{f.months.includes(m) ? "●" : ""}<span className="sr-only">{f.months.includes(m) ? "当季" : "—"}</span></td>)}
                <td className="small"><a href={f.source.url} target="_blank" rel="noreferrer">{f.source.label}</a>（待核验）</td>
              </tr>
            ))}
            <tr><th scope="row">其余 {FISH_TARGET - FISH.length} 种</th><td colSpan={13}>待补充（无经核验的资料，不展示）</td></tr>
          </tbody>
        </table>
      </div>

      <h2>你记录过、但尚无季节资料的鱼种</h2>
      {unlisted.length === 0 ? <p className="empty">暂无。</p> : (
        <ul className="fish-list">
          {unlisted.map((n) => (
            <li key={n}>
              <button className="card fish" aria-expanded={open === `u:${n}`} onClick={() => setOpen(open === `u:${n}` ? null : `u:${n}`)}>{n} <span className="muted">季节：待补充</span></button>
              {open === `u:${n}` && <Related name={n} rs={records((s) => s === n)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
