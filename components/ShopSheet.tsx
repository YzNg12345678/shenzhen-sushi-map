"use client";

import { useEffect, useRef } from "react";
import { AXES, AXIS_LABEL, catalog } from "@/lib/catalog";
import type { ShopView } from "@/lib/shops";
import type { ShopState } from "@/lib/types";
import { UNKNOWN } from "./ShopCard";

interface Props {
  v: ShopView;
  state: ShopState;
  onPatch: (patch: Partial<ShopState>) => void;
  onClose: () => void;
}

const Tbd = () => <span className="tbd">{UNKNOWN}</span>;
const Val = ({ s }: { s?: string }) => (s && s.trim() ? <>{s}</> : <Tbd />);

export default function ShopSheet({ v, state, onPatch, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const price = v.curated?.price;
  const noteIds = [...new Set(AXES.flatMap((a) => v.axes[a].evidence.map((e) => e.noteId)))];
  const notes = noteIds.map((id) => catalog.noteById.get(id)).filter((n) => n !== undefined);
  const pos = AXES.flatMap((a) => v.axes[a].evidence.filter((e) => e.polarity === "pos").map((e) => ({ a, e })));
  const neg = AXES.flatMap((a) => v.axes[a].evidence.filter((e) => e.polarity === "neg").map((e) => ({ a, e })));
  const gmap = v.poi ? `https://uri.amap.com/marker?position=${v.poi.lng},${v.poi.lat}&name=${encodeURIComponent(v.name)}` : null;

  useEffect(() => {
    closeRef.current?.focus();
    ref.current?.scrollTo({ top: 0 });
  }, [v.key]);

  return (
    <aside
      ref={ref}
      className="sheet"
      role="dialog"
      aria-label={`${v.name} 详情`}
      data-testid="shop-sheet"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="sheet-head">
        <h2>{v.name}</h2>
        <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="关闭详情">
          ✕
        </button>
      </div>
      <span className={`verdict v-${v.verdict.id}`}>{v.verdict.label}</span>
      <p className="small muted">{v.verdict.reason}</p>
      {v.curated?.branch && <p className="small">分店：{v.curated.branch}</p>}

      <h3>三项判断（不做总分）</h3>
      {AXES.map((a) => {
        const r = v.axes[a];
        return (
          <div className="axis-row" key={a} data-testid={`detail-axis-${a}`}>
            <header>
              <strong>{AXIS_LABEL[a]}</strong>
              <span className={`lv lv-${r.level}`}>{r.level}</span>
              <span className="small muted">
                {r.sources} 篇来源 · 最近 {r.latest ?? UNKNOWN}
              </span>
              {r.disputed && <span className="small warn">⚠ 正文与评论有分歧</span>}
            </header>
            <p>{r.reason}</p>
          </div>
        );
      })}

      <h3>价格（套餐、酒水、加点分开看）</h3>
      <dl className="kv" data-testid="detail-price">
        <dt>正文说法</dt>
        <dd><Val s={price?.set} /></dd>
        <dt>评论补充</dt>
        <dd><Val s={price?.extras} /></dd>
        <dt>酒水</dt>
        <dd><Val s={price?.drinks} /></dd>
        <dt>高德人均</dt>
        <dd>{v.poi?.cost ? `¥${v.poi.cost}` : <Tbd />}</dd>
        <dt>最终人均</dt>
        <dd><Tbd /> <span className="small muted">待店家确认，预约时问清加点与服务费</span></dd>
      </dl>

      <h3>店铺信息</h3>
      <dl className="kv">
        <dt>地址</dt>
        <dd><Val s={v.poi?.address} /></dd>
        <dt>商圈</dt>
        <dd><Val s={v.poi?.businessArea || v.poi?.district} /></dd>
        <dt>营业时间</dt>
        <dd><Val s={v.poi?.openTime} /></dd>
        <dt>电话</dt>
        <dd>{v.poi?.tel ? <a href={`tel:${v.poi.tel.split(";")[0].trim()}`}>{v.poi.tel}</a> : <Tbd />}</dd>
        <dt>风格</dt>
        <dd><Val s={v.curated?.style} /></dd>
        <dt>主厨 / 指定主厨</dt>
        <dd><Tbd /></dd>
        <dt>舍利</dt>
        <dd><Tbd /></dd>
        <dt>一场人数 / 时长</dt>
        <dd><Tbd /></dd>
        <dt>预约与取消</dt>
        <dd><Tbd /></dd>
        <dt>座位 / 安静度</dt>
        <dd><Val s={v.curated?.seating} /></dd>
        <dt>忌口 / 熟食调整</dt>
        <dd><Tbd /></dd>
      </dl>
      {gmap && (
        <p>
          <a href={gmap} target="_blank" rel="noopener noreferrer">在高德地图中打开</a>
        </p>
      )}

      <h3>从口岸过来</h3>
      {v.ports.length > 0 ? (
        <ul className="ev" data-testid="detail-ports">
          {v.ports.map((p) => (
            <li key={p.port.id}>
              {p.port.name}：直线约 {p.km.toFixed(1)} km
            </li>
          ))}
        </ul>
      ) : (
        <p><Tbd /> 暂未取得位置。</p>
      )}
      <p className="small muted">仅按坐标直线距离估算，不含通关、排队和路面时间；香港同价位替代与周边顺路安排尚未整理（待核实）。</p>

      <h3>近期评价摘要</h3>
      {pos.length + neg.length === 0 ? (
        <p>素材里还没有这家店的评价。</p>
      ) : (
        <>
          <p className="small"><strong>正面</strong></p>
          <ul className="ev">{pos.length ? pos.map(({ a, e }, i) => <li key={i}>[{AXIS_LABEL[a]}] {e.text}{e.stale ? "（较早）" : ""}</li>) : <li>暂无</li>}</ul>
          <p className="small"><strong>负面 / 分歧</strong></p>
          <ul className="ev">{neg.length ? neg.map(({ a, e }, i) => <li key={i}>[{AXIS_LABEL[a]}] {e.text}{e.stale ? "（较早）" : ""}</li>) : <li>暂无</li>}</ul>
        </>
      )}

      <h3>来源（小红书，仅摘要与链接）</h3>
      {notes.length === 0 ? (
        <p>暂无来源。</p>
      ) : (
        <ol className="sources" data-testid="detail-sources">
          {notes.map((n) => (
            <li key={n.noteId}>
              <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
              <div className="small muted">发布 {n.publishedAt ?? UNKNOWN} · 采集 {n.collectedAt ?? UNKNOWN}</div>
            </li>
          ))}
        </ol>
      )}
      <p className="small muted">互动量（点赞、收藏）不作为质量依据，也不展示。素材通过店名/标签关联到门店，分店请预约时核实。</p>

      <h3>我的记录（仅保存在本浏览器）</h3>
      <div className="row">
        <button type="button" className="btn" aria-pressed={state.favorite} onClick={() => onPatch({ favorite: !state.favorite })}>
          {state.favorite ? "★ 已收藏" : "☆ 收藏"}
        </button>
        <button type="button" className="btn" aria-pressed={state.visited} onClick={() => onPatch({ visited: !state.visited })}>
          {state.visited ? "✓ 去过" : "标记去过"}
        </button>
      </div>
      <div className="field">
        <label htmlFor="note">备注</label>
        <textarea id="note" maxLength={4000} value={state.note} onChange={(e) => onPatch({ note: e.target.value })} placeholder="例如：和父母去过，座位、洗手间、预约情况" />
      </div>
      <p className="tip">信息可能变化，请预约时复核。</p>
    </aside>
  );
}
