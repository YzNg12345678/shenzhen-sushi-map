"use client";

import { forwardRef, useState } from "react";
import Link from "next/link";
import { audit, dataset } from "@/lib/data";
import { parseBackup, type AppData } from "@/lib/types";

interface Props {
  data: AppData;
  persistError: string | null;
  onReplace: (d: AppData) => boolean;
  onClear: () => boolean;
  onClose: () => void;
}

const SettingsDialog = forwardRef<HTMLDialogElement, Props>(function SettingsDialog({ data, persistError, onReplace, onClear, onClose }, ref) {
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const count = Object.keys(data.shops).length;
  const notes = dataset.notes;

  const exportData = () => {
    const out = { ...data, exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shenzhen-omakase-personal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ text: `已导出 ${count} 家店的个人记录。`, err: false });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const r = parseBackup(await file.text());
    if (!r.ok) return setMsg({ text: r.error, err: true });
    if (!onReplace(r.data)) return setMsg({ text: "写入本地存储失败，现有数据未改动。", err: true });
    setMsg({ text: `已导入 ${Object.keys(r.data.shops).length} 家店的个人记录（覆盖原有记录，原记录已留备份）。`, err: false });
  };

  return (
    <dialog ref={ref} className="settings" aria-labelledby="settings-title" onClose={() => { setConfirmClear(false); setMsg(null); onClose(); }}>
      <h2 id="settings-title">设置与数据说明</h2>
      {persistError && <p className="msg err" role="alert">{persistError}</p>}
      <h3>我的数据（收藏 / 去过 / 备注）</h3>
      <p className="small muted">只保存在本浏览器的 localStorage，不上传。当前记录 {count} 家。</p>
      <div className="row">
        <button type="button" className="btn" onClick={exportData}>导出 JSON</button>
        <label className="btn" htmlFor="import-file" style={{ display: "inline-grid", placeItems: "center" }}>导入 JSON</label>
        <input id="import-file" className="sr-only" type="file" accept="application/json,.json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
        {!confirmClear ? (
          <button type="button" className="btn" onClick={() => setConfirmClear(true)}>清空…</button>
        ) : (
          <>
            <button type="button" className="btn btn-danger" onClick={() => { setConfirmClear(false); setMsg(onClear() ? { text: "已清空个人记录。", err: false } : { text: "清空失败，现有数据未改动。", err: true }); }}>确认清空</button>
            <button type="button" className="btn" onClick={() => setConfirmClear(false)}>取消</button>
          </>
        )}
      </div>
      {msg && <p className={`msg${msg.err ? " err" : ""}`} role={msg.err ? "alert" : "status"}>{msg.text}</p>}

      <h3>资料来源与更新时间</h3>
      <ul className="small">
        <li>店铺位置、地址、电话、营业时间、人均来自高德地图实时检索；未返回的字段显示“待核实”。高德人均仅供参考，不等同套餐价。</li>
        <li>逐店评价由公开来源与 {notes.length} 篇小红书用户笔记整理，仅保留摘要与来源链接，不复制正文和评论。小红书为用户内容，仅作一手体验参考，互动量不作为质量依据。</li>
        <li>名单数据版本 {audit.dataVersion}，更新于 {audit.updatedAt}。</li>
      </ul>
      <h3>收录标准</h3>
      <p className="small">
        只收录通过 Omakase 身份与价位（每位 ¥{audit.priceFloor} 起）审核的店；证据不足的放在“待核实区”，不计入主清单。逐条规则、被排除的店与原因见
        {" "}<Link href="/audit/" onClick={onClose}>筛选依据</Link>。
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={onClose}>关闭</button>
      </div>
    </dialog>
  );
});

export default SettingsDialog;
