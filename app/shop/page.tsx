"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import ShopMap from "@/components/ShopMap";
import { Tag } from "@/components/ShopCard";
import { fetchPoiById } from "@/lib/amap";
import { money, rate, REVISIT_LABEL, RESERVATION_LABEL, text, VINEGAR_LABEL } from "@/lib/format";
import { usePois, useStore } from "@/lib/store";
import { useTitle } from "@/components/hooks";
import { REVISIT, RESERVATION, VINEGAR, type Poi, type ShopNote } from "@/lib/types";

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const { pois } = usePois();
  const { data, ready, notes, patchNote, toggleCompare } = useStore();
  const known = pois.find((p) => p.id === id) ?? data.pois[id];
  const [fetched, setFetched] = useState<Poi | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const poi = known ?? (fetched?.id === id ? fetched : null);
  const mapPois = useMemo(() => (poi ? [poi] : []), [poi]);
  useTitle(poi ? poi.name : "店铺详情");

  useEffect(() => {
    if (!ready || !id || known) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErr("");
    fetchPoiById(id)
      .then((p) => { if (!cancelled) setFetched(p); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : "加载失败"); });
    return () => { cancelled = true; };
  }, [ready, id, known]);

  if (!id) return <p className="empty">缺少店铺参数。请从<Link href="/map">地图</Link>进入。</p>;
  if (!poi)
    return err ? (
      <div className="alert" role="alert">
        <p>{err}</p>
        <Link className="btn" href="/map">回到地图</Link>
      </div>
    ) : (
      <p role="status">加载店铺详情…</p>
    );

  const note = notes(poi.id);
  const set = (patch: Partial<ShopNote>) => patchNote(poi, patch);
  const visits = data.checkins.filter((c) => c.shopId === poi.id).sort((a, b) => b.date.localeCompare(a.date));
  const inCompare = data.compare.includes(poi.id);

  const rows: [string, string][] = [
    ["名称", poi.name],
    ["地址", text(poi.address)],
    ["坐标（高德 GCJ-02）", `${poi.lng.toFixed(6)}, ${poi.lat.toFixed(6)}`],
    ["区域", text(poi.district)],
    ["商圈", text(poi.businessArea)],
    ["类别", text(poi.type)],
    ["电话", text(poi.tel)],
    ["营业时间", text(poi.openTime)],
    ["评分", rate(poi.rating)],
    ["人均", money(poi.cost)],
  ];

  return (
    <div className="page">
      <p><Link href="/map">← 回到地图</Link></p>
      <h1>{poi.name}</h1>
      <div className="detail-grid">
        <section aria-labelledby="amap-h">
          <h2 id="amap-h">高德提供的信息 <Tag kind="amap">{""}</Tag></h2>
          <dl className="facts facts-col">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className={v === "未知" ? "unknown" : ""}>
                  {k === "电话" && poi.tel
                    ? poi.tel.split(/[;；,，\s]+/).filter(Boolean).map((t, i) => (
                        <span key={t}>{i > 0 && "，"}<a href={`tel:${t.replace(/[^\d+]/g, "")}`}>{t}</a></span>
                      ))
                    : v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted small">检索时间：{new Date(poi.fetchedAt).toLocaleString("zh-CN")}。“未知”表示高德没有返回该字段，不代表店铺没有。</p>
          <ShopMap pois={mapPois} selectedId={poi.id} onSelect={() => {}} height={280} />
        </section>

        <section aria-labelledby="mine-h">
          <h2 id="mine-h">我的补充 <Tag kind="user">{""}</Tag></h2>
          <div className="actions">
            <button className="btn" aria-pressed={note.favorite} onClick={() => set({ favorite: !note.favorite })}>{note.favorite ? "★ 已收藏" : "☆ 收藏"}</button>
            <button className="btn" aria-pressed={note.visited} onClick={() => set({ visited: !note.visited })}>{note.visited ? "✓ 去过" : "标记去过"}</button>
            <button className="btn" aria-pressed={inCompare} onClick={() => { const r = toggleCompare(poi); setMsg(r.ok ? "" : (r.message ?? "")); }}>{inCompare ? "移出比较" : "加入比较"}</button>
            <Link className="btn btn-primary" href={`/passport?shop=${encodeURIComponent(poi.id)}`}>写一条打卡</Link>
          </div>
          {msg && <p role="alert" className="error small">{msg}</p>}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="revisit">复访意愿</label>
              <select id="revisit" value={note.revisit} onChange={(e) => set({ revisit: e.target.value as ShopNote["revisit"] })}>
                {REVISIT.map((v) => <option key={v} value={v}>{REVISIT_LABEL[v]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vinegar">赤酢/白酢</label>
              <select id="vinegar" value={note.vinegar} onChange={(e) => set({ vinegar: e.target.value as ShopNote["vinegar"] })}>
                {VINEGAR.map((v) => <option key={v} value={v}>{VINEGAR_LABEL[v]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reservation">预约难度</label>
              <select id="reservation" value={note.reservation} onChange={(e) => set({ reservation: e.target.value as ShopNote["reservation"] })}>
                {RESERVATION.map((v) => <option key={v} value={v}>{RESERVATION_LABEL[v]}</option>)}
              </select>
            </div>
            {([
              ["style", "流派", "如 江户前（自行填写）"],
              ["aging", "熟成", ""],
              ["chef", "师傅", ""],
              ["seating", "座位", "吧台/桌席/包间…"],
              ["setMenu", "套餐", "套餐名与价格"],
            ] as const).map(([k, label, ph]) => (
              <div className="field" key={k}>
                <label htmlFor={k}>{label}</label>
                <input id={k} value={note[k]} placeholder={ph || "待补充"} onChange={(e) => set({ [k]: e.target.value })} />
              </div>
            ))}
            <div className="field wide">
              <label htmlFor="pn">私人备注</label>
              <textarea id="pn" rows={4} value={note.privateNote} onChange={(e) => set({ privateNote: e.target.value })} />
            </div>
          </div>
          <p className="muted small">所有字段仅保存在本浏览器；留空即“待补充”，本应用不会替你猜。</p>

          <h3>我在这家的打卡 <Tag kind="user">{""}</Tag></h3>
          {visits.length === 0 ? <p className="empty">还没有打卡记录。</p> : (
            <ul className="plain">
              {visits.map((c) => <li key={c.id}>{c.date} · 总评 {c.overall}/5 · {c.pieces.length} 贯</li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return <Suspense fallback={<p role="status">加载中…</p>}><Detail /></Suspense>;
}
