"use client";

import { useId } from "react";
import { KINDS, PRICE_BANDS, SORTS, type Filters } from "@/lib/shops";

interface Props {
  f: Filters;
  set: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  districts: string[];
}

function Choice<T extends string>({ legend, value, options, onChange }: { legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice-row">
        {options.map((o) => (
          <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function FilterPanel({ f, set, districts }: Props) {
  const id = useId();
  return (
    <div className="filters">
      <Choice legend="价位（每位）" value={f.price} options={PRICE_BANDS} onChange={(v) => set("price", v)} />
      <Choice legend="类型" value={f.kind} options={KINDS} onChange={(v) => set("kind", v)} />
      {districts.length > 0 ? (
        <Choice legend="区域" value={f.district} options={[{ value: "any", label: "区域不限" }, ...districts.map((d) => ({ value: d, label: d }))]} onChange={(v) => set("district", v)} />
      ) : (
        <p className="small muted">区域筛选需要高德返回位置后才可用。</p>
      )}
      <Choice
        legend="资料置信度"
        value={f.confidence}
        options={[
          { value: "any", label: "不限" },
          { value: "高", label: "高" },
          { value: "中", label: "中" },
          { value: "低", label: "低" },
        ]}
        onChange={(v) => set("confidence", v)}
      />
      <fieldset className="choice">
        <legend>我的记录</legend>
        <div className="choice-row">
          <button type="button" className="chip" aria-pressed={f.mine} onClick={() => set("mine", !f.mine)}>
            仅看我的收藏与去过
          </button>
        </div>
      </fieldset>
      <div className="choice">
        <label htmlFor={`${id}-sort`} className="legend">排序</label>
        <select id={`${id}-sort`} className="select" value={f.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
