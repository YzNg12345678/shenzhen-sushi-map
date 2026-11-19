"use client";

import { useTitle } from "@/components/hooks";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { SCHEMA_VERSION, parseBackup, type AppData } from "@/lib/types";

export default function DataPage() {
  useTitle("数据管理");
  const { data, replaceAll, clearAll } = useStore();
  const [pending, setPending] = useState<AppData | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clearBtn = useRef<HTMLButtonElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const [clearErr, setClearErr] = useState("");

  useEffect(() => {
    if (confirmClear) cancelBtn.current?.focus();
    else if (wasConfirming.current) clearBtn.current?.focus();
    wasConfirming.current = confirmClear;
  }, [confirmClear]);

  const summary = (d: AppData) => `${d.checkins.length} 条打卡、${Object.keys(d.notes).length} 家店铺笔记、${Object.keys(d.pois).length} 家缓存店铺`;

  const exportJson = () => {
    const payload: AppData = { ...data, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shenzhen-sushi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg({ kind: "ok", text: `已导出：${summary(data)}。` });
  };

  const onFile = async (f: File | undefined) => {
    setPending(null);
    setMsg(null);
    if (!f) return;
    let content: string;
    try {
      content = await f.text();
    } catch {
      setMsg({ kind: "err", text: "读取文件失败，请重新选择文件。" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const r = parseBackup(content);
    if (r.ok) {
      setPending(r.data);
      setMsg({ kind: "ok", text: `文件校验通过：${summary(r.data)}。确认后将替换当前数据。` });
    } else setMsg({ kind: "err", text: r.error });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="page narrow">
      <h1>数据管理</h1>
      <p className="lead">所有个人数据只保存在本浏览器（localStorage），无账号、无服务器。换浏览器或清理缓存前请先导出备份。</p>
      <div data-testid="data-msg">
        <p role="status" className="ok">{msg?.kind === "ok" ? msg.text : ""}</p>
        <p role="alert" className="error">{msg?.kind === "err" ? msg.text : ""}</p>
      </div>
      <p>当前数据：{summary(data)}。</p>

      <section className="panel" aria-labelledby="ex-h">
        <h2 id="ex-h">导出备份</h2>
        <p>下载包含 schemaVersion 的完整 JSON。</p>
        <button className="btn btn-primary" onClick={exportJson}>导出 JSON</button>
      </section>

      <section className="panel" aria-labelledby="im-h">
        <h2 id="im-h">导入恢复</h2>
        <p>先校验再替换；校验失败不会改动现有数据。</p>
        <div className="field">
          <label htmlFor="file">选择备份文件（.json）</label>
          <input id="file" ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {pending && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => { if (replaceAll(pending)) { setMsg({ kind: "ok", text: `已恢复：${summary(pending)}。` }); setPending(null); } else setMsg({ kind: "err", text: "导入失败：写入浏览器存储未成功，现有数据未改动。" }); }}>确认导入并替换当前数据</button>
            <button className="btn" onClick={() => { setPending(null); setMsg(null); }}>取消</button>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="cl-h">
        <h2 id="cl-h">清空数据</h2>
        <p>删除所有打卡、店铺笔记和比较列表，无法撤销。建议先导出。</p>
        {!confirmClear ? (
          <button ref={clearBtn} className="btn btn-danger" onClick={() => { setClearErr(""); setConfirmClear(true); }}>清空所有个人数据…</button>
        ) : (
          <div role="alertdialog" aria-label="确认清空" className="confirm">
            <p><strong>确定要清空吗？</strong>将删除 {summary(data)}。</p>
            <div className="actions">
              <button className="btn btn-danger" onClick={() => {
                if (clearAll()) { setClearErr(""); setMsg({ kind: "ok", text: "已清空所有个人数据。" }); setConfirmClear(false); }
                else setClearErr("清空失败：写入浏览器存储未成功，现有数据未改动。");
              }}>确认清空</button>
              <button ref={cancelBtn} className="btn" onClick={() => setConfirmClear(false)}>取消</button>
            </div>
            {clearErr && <p role="alert" className="error">{clearErr}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
