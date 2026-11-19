"use client";

import type { MobileView } from "./hooks";

export default function ViewToggle({ view, onChange }: { view: MobileView; onChange: (v: MobileView) => void }) {
  return (
    <div className="view-toggle" role="group" aria-label="手机端视图切换">
      <button type="button" className="btn" aria-pressed={view === "list"} onClick={() => onChange("list")}>列表</button>
      <button type="button" className="btn" aria-pressed={view === "map"} onClick={() => onChange("map")}>地图</button>
    </div>
  );
}
