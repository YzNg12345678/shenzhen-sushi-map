"use client";

import { usePois } from "@/lib/store";

export default function PoiStatus() {
  const { status, error, pois, search, keyword } = usePois();
  if (status === "loading") return <p role="status" className="muted">正在向高德检索深圳寿司店…</p>;
  if (status === "error")
    return (
      <div className="alert" role="alert">
        <p><strong>检索失败：</strong>{error}</p>
        <button className="btn" onClick={() => search(keyword)}>重新检索</button>
      </div>
    );
  return <p role="status" className="muted small" data-testid="poi-status">高德实时检索到 {pois.length} 家{keyword ? `（关键词“${keyword}”）` : ""}深圳寿司相关店铺。</p>;
}
