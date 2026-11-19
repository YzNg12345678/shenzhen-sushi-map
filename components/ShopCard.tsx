"use client";

import Link from "next/link";
import { useState } from "react";
import { money, rate, text } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Poi } from "@/lib/types";

export function Tag({ kind, children }: { kind: "amap" | "user" | "derived"; children: React.ReactNode }) {
  const label = kind === "amap" ? "高德" : kind === "user" ? "你填写" : "推导";
  return (
    <span className={`tag tag-${kind}`}>
      <span className="sr-only">来源：</span>
      {label}
      {children}
    </span>
  );
}

interface Props {
  poi: Poi;
  index?: number;
  selected?: boolean;
  badge?: string;
  onSelect?: () => void;
}

export default function ShopCard({ poi, index, selected, badge, onSelect }: Props) {
  const { notes, patchNote, toggleCompare, data } = useStore();
  const note = notes(poi.id);
  const [msg, setMsg] = useState("");
  const inCompare = data.compare.includes(poi.id);
  return (
    <article className={`card${selected ? " card-sel" : ""}`} aria-label={poi.name}>
      <div className="card-head">
        <h3>
          {index !== undefined && <span className="idx">{index + 1}</span>}
          {badge && <span className="badge">{badge}</span>}
          {selected && <span className="sel-label">已选中</span>}
          <button className="link-btn" onClick={onSelect} aria-pressed={selected}>
            {poi.name}
          </button>
        </h3>
      </div>
      <dl className="facts">
        <div><dt>区域</dt><dd>{text(poi.district)}</dd></div>
        <div><dt>地址</dt><dd>{text(poi.address)}</dd></div>
        <div><dt>评分</dt><dd>{rate(poi.rating)}</dd></div>
        <div><dt>人均</dt><dd>{money(poi.cost)}</dd></div>
      </dl>
      <p className="muted small"><Tag kind="amap">{""}</Tag> 以上字段来自高德，“未知”表示高德未返回</p>
      <div className="actions">
        <Link className="btn btn-primary" href={`/shop?id=${encodeURIComponent(poi.id)}`}>
          详情与补充
        </Link>
        <button className="btn" aria-pressed={note.favorite} onClick={() => patchNote(poi, { favorite: !note.favorite })}>
          {note.favorite ? "★ 已收藏" : "☆ 收藏"}
        </button>
        <button className="btn" aria-pressed={note.visited} onClick={() => patchNote(poi, { visited: !note.visited })}>
          {note.visited ? "✓ 去过" : "标记去过"}
        </button>
        <button
          className="btn"
          aria-pressed={inCompare}
          onClick={() => {
            const r = toggleCompare(poi);
            setMsg(r.ok ? "" : (r.message ?? ""));
          }}
        >
          {inCompare ? "移出比较" : "加入比较"}
        </button>
      </div>
      {msg && <p role="alert" className="error small">{msg}</p>}
    </article>
  );
}

