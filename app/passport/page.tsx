"use client";

import { useTitle } from "@/components/hooks";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { today, uid } from "@/lib/format";
import { FISH } from "@/lib/fish";
import { usePois, useStore } from "@/lib/store";
import { buildTaste } from "@/lib/taste";
import type { Checkin, Piece, Poi } from "@/lib/types";

interface Draft {
  id: string;
  date: string;
  shopId: string;
  shopName: string;
  menu: string;
  price: string;
  pieces: Piece[];
  overall: number;
  note: string;
}

const blank = (shopId = "", shopName = ""): Draft => ({ id: uid(), date: today(), shopId, shopName, menu: "", price: "", pieces: [], overall: 4, note: "" });

function Passport() {
  const params = useSearchParams();
  const { pois } = usePois();
  const { data, ready, saveCheckin, deleteCheckin } = useStore();
  const all = useMemo(() => {
    const m = new Map<string, Poi>(Object.entries(data.pois));
    pois.forEach((p) => m.set(p.id, p));
    return [...m.values()];
  }, [pois, data.pois]);

  const pre = params.get("shop") ?? "";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState("");
  const formHeading = useRef<HTMLHeadingElement>(null);
  const newBtn = useRef<HTMLButtonElement>(null);
  const prevDraftId = useRef<string | null>(null);
  const opener = useRef<string>("new");
  const skipFocus = useRef(false);
  const [fishName, setFishName] = useState("");
  const [fishRating, setFishRating] = useState(4);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const taste = useMemo(() => buildTaste(data.checkins), [data.checkins]);
  const sorted = [...data.checkins].sort((a, b) => b.date.localeCompare(a.date));

  const startNew = () => {
    const p = all.find((x) => x.id === pre);
    opener.current = "new";
    setDraft(blank(p?.id ?? "", p?.name ?? ""));
    setError("");
    setSaved("");
    setFishName("");
  };
  useEffect(() => {
    if (!ready || !pre || started) return;
    const p = data.pois[pre] ?? all.find((x) => x.id === pre);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStarted(true);
    skipFocus.current = true;
    opener.current = "new";
    setDraft(blank(pre, p?.name ?? ""));
  }, [ready, pre, started, data.pois, all]);
  const draftId = draft?.id ?? null;
  useEffect(() => {
    const prev = prevDraftId.current;
    prevDraftId.current = draftId;
    if (draftId !== null) {
      if (skipFocus.current) skipFocus.current = false;
      else if (draftId !== prev) formHeading.current?.focus();
    } else if (prev !== null) {
      const el = opener.current === "new" ? null : document.querySelector<HTMLElement>(`[data-edit-id="${CSS.escape(opener.current)}"]`);
      (el ?? newBtn.current)?.focus();
    }
  }, [draftId]);
  const edit = (c: Checkin) => {
    opener.current = c.id;
    setDraft({ ...c, price: c.price === undefined ? "" : String(c.price) });
    setError("");
    setSaved("");
    setFishName("");
  };
  const change = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setError("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.shopName.trim()) return setError("请选择或填写店铺名称。");
    const price = draft.price.trim() === "" ? undefined : Number(draft.price);
    if (price !== undefined && !(price >= 0)) return setError("价格必须是不小于 0 的数字。");
    const pending = fishName.trim();
    const pieces = pending ? [...draft.pieces, { fish: pending, rating: fishRating, note: "" }] : draft.pieces;
    const c: Checkin = {
      id: draft.id,
      date: draft.date,
      shopId: draft.shopId,
      shopName: draft.shopName.trim(),
      menu: draft.menu,
      price,
      pieces,
      overall: draft.overall,
      note: draft.note,
    };
    saveCheckin(c, all.find((p) => p.id === draft.shopId));
    setFishName("");
    setError("");
    setDraft(null);
    setSaved(`已保存：${c.date} ${c.shopName}${pending ? `（已自动添加输入框中的鱼种“${pending}”）` : ""}`);
  };

  const addPiece = () => {
    if (!draft) return;
    if (!fishName.trim()) return setError("请先填写鱼种名称再添加这一贯。");
    change({ pieces: [...draft.pieces, { fish: fishName.trim(), rating: fishRating, note: "" }] });
    setFishName("");
    setError("");
  };

  return (
    <div className="page">
      <h1>寿司护照</h1>
      <section aria-labelledby="taste-h" className="panel">
        <h2 id="taste-h">我的口味画像 <span className="tag tag-derived">推导</span></h2>
        {taste.checkinCount === 0 ? (
          <p className="empty">还没有打卡。点击下方“新增打卡”，记录日期、店铺和每一贯的评分，攒够数据后这里会总结你的偏好。</p>
        ) : (
          <>
            <ul className="stats">
              <li><strong>{taste.checkinCount}</strong> 次打卡</li>
              <li><strong>{taste.pieceCount}</strong> 贯评分</li>
              <li>总评均分 <strong>{taste.avgOverall}</strong></li>
              <li>平均花费 <strong>{taste.avgPrice === null ? "未填写" : `¥${taste.avgPrice}`}</strong></li>
            </ul>
            {taste.enough ? (
              <ul className="plain">{taste.statements.map((s) => <li key={s}>{s}</li>)}</ul>
            ) : (
              <p className="muted">数据还不足以下结论：{taste.needMore}（至少 3 次打卡且 8 贯评分）。</p>
            )}
            <p className="muted small">画像只统计你自己填写的评分，样本小时仅供参考。</p>
          </>
        )}
      </section>

      <p role="status" className="ok small">{saved}</p>
      {!draft && <p><button ref={newBtn} className="btn btn-primary" onClick={startNew}>新增打卡</button></p>}

      {draft && (
        <form className="panel" onSubmit={submit} aria-label="打卡表单">
          <h2 ref={formHeading} tabIndex={-1}>{data.checkins.some((c) => c.id === draft.id) ? "编辑打卡" : "新增打卡"}</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="d-date">日期</label>
              <input id="d-date" type="date" required value={draft.date} onChange={(e) => change({ date: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="d-shop">店铺（从已检索店铺选择）</label>
              <select
                id="d-shop"
                value={draft.shopId}
                onChange={(e) => {
                  const p = all.find((x) => x.id === e.target.value);
                  change({ shopId: e.target.value, shopName: p ? p.name : draft.shopName });
                }}
              >
                <option value="">（手动填写店名）</option>
                {all.map((p) => <option key={p.id} value={p.id}>{p.name}{p.district ? ` · ${p.district}` : ""}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-name">店名</label>
              <input id="d-name" value={draft.shopName} onChange={(e) => change({ shopId: all.some((p) => p.id === draft.shopId && p.name === e.target.value) ? draft.shopId : "", shopName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="d-menu">套餐/菜单</label>
              <input id="d-menu" value={draft.menu} onChange={(e) => change({ menu: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="d-price">实际花费（元，可空）</label>
              <input id="d-price" type="number" min={0} value={draft.price} onChange={(e) => change({ price: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="d-overall">总评（1–5）</label>
              <select id="d-overall" value={draft.overall} onChange={(e) => change({ overall: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <fieldset>
            <legend>每一贯 / 鱼种评分</legend>
            <div className="piece-add">
              <div className="field">
                <label htmlFor="p-fish">鱼种</label>
                <input id="p-fish" list="fish-list" value={fishName} onChange={(e) => { setFishName(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPiece(); } }} />
                <datalist id="fish-list">{FISH.map((f) => <option key={f.id} value={f.name.replace(/（.*）/, "")} />)}</datalist>
              </div>
              <div className="field">
                <label htmlFor="p-rating">评分</label>
                <select id="p-rating" value={fishRating} onChange={(e) => setFishRating(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button type="button" className="btn" onClick={addPiece}>添加这一贯</button>
            </div>
            {draft.pieces.length === 0 ? <p className="muted small">还没有添加。鱼种可自由输入。</p> : (
              <ul className="plain">
                {draft.pieces.map((p, i) => (
                  <li key={i}>
                    {p.fish} · {p.rating}/5{" "}
                    <button type="button" className="link-btn" onClick={() => change({ pieces: draft.pieces.filter((_, j) => j !== i) })} aria-label={`移除 ${p.fish}`}>移除</button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <div className="field">
            <label htmlFor="d-note">备注</label>
            <textarea id="d-note" rows={3} value={draft.note} onChange={(e) => change({ note: e.target.value })} />
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <div className="actions">
            <button className="btn btn-primary" type="submit">保存打卡</button>
            <button className="btn" type="button" onClick={() => setDraft(null)}>取消</button>
          </div>
        </form>
      )}

      <section aria-labelledby="hist-h">
        <h2 id="hist-h">打卡记录</h2>
        {sorted.length === 0 && <p className="empty">暂无记录。</p>}
        <ul className="history">
          {sorted.map((c) => (
            <li key={c.id} className="card" data-testid="checkin">
              <h3>{c.date} · {c.shopName}</h3>
              <p>总评 {c.overall}/5{c.price !== undefined ? ` · 花费 ¥${c.price}` : ""}{c.menu ? ` · ${c.menu}` : ""}</p>
              {c.pieces.length > 0 && <p className="small">{c.pieces.map((p) => `${p.fish} ${p.rating}`).join("，")}</p>}
              {c.note && <p className="small">备注：{c.note}</p>}
              <div className="actions">
                <button className="btn" data-edit-id={c.id} aria-label={`编辑 ${c.shopName} ${c.date} 的打卡`} onClick={() => edit(c)}>编辑</button>
                {confirmDel === c.id ? (
                  <>
                    <button className="btn btn-danger" aria-label={`确认删除 ${c.shopName} ${c.date} 的打卡`} onClick={() => { deleteCheckin(c.id); setConfirmDel(null); }}>确认删除</button>
                    <button className="btn" onClick={() => setConfirmDel(null)}>取消</button>
                  </>
                ) : (
                  <button className="btn" aria-label={`删除 ${c.shopName} ${c.date} 的打卡`} onClick={() => setConfirmDel(c.id)}>删除</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function PassportPage() {
  useTitle("寿司护照");
  return <Suspense fallback={<p role="status">加载中…</p>}><Passport /></Suspense>;
}
