import { AXES } from "@/lib/catalog";
import type { ShopView } from "@/lib/shops";
import type { ShopState } from "@/lib/types";
import AxisBadge from "./LevelBadge";

export const UNKNOWN = "待核实";

/** 一句话理由：只引用素材里的原有判断，无素材时明说。 */
export function oneLiner(v: ShopView): string {
  if (v.sources === 0) return "素材里还没有这家店的评价，三项都待核实。";
  for (const a of AXES) {
    const e = v.axes[a].evidence.find((x) => x.strength === "strong" && x.polarity === (v.axes[a].level === "低" ? "neg" : "pos"));
    if (e) return e.text;
  }
  return v.axes.stability.evidence[0]?.text ?? v.axes.parents.evidence[0]?.text ?? "只有零散旁证，暂不下结论。";
}

export function priceLine(v: ShopView): string {
  if (v.curated?.price?.set) return v.curated.price.set;
  if (v.poi?.cost) return `高德人均 ¥${v.poi.cost}（套餐、酒水、加点待核实）`;
  return `人均${UNKNOWN}`;
}

interface Props {
  v: ShopView;
  index: number;
  state: ShopState;
  selected: boolean;
  onOpen: () => void;
}

export default function ShopCard({ v, index, state, selected, onOpen }: Props) {
  const place = [v.poi?.businessArea || v.poi?.district, v.ports[0] ? `近${v.ports[0].port.name}（直线约 ${v.ports[0].km.toFixed(1)} km）` : ""].filter(Boolean).join(" · ");
  const disputed = AXES.some((a) => v.axes[a].disputed);
  return (
    <article className="card" data-selected={selected} data-testid="shop-card" aria-label={v.name}>
      <h3>
        <button type="button" onClick={onOpen} aria-label={`${index + 1}. ${v.name}，查看详情`}>
          {index + 1}. {v.name}
          {state.favorite ? " ★" : ""}
          {state.visited ? " ✓" : ""}
        </button>
      </h3>
      <p className="meta">{place || `位置${UNKNOWN}`}</p>
      <span className={`verdict v-${v.verdict.id}`}>{v.verdict.label}</span>
      <div className="axes">
        {AXES.map((a) => (
          <AxisBadge key={a} r={v.axes[a]} />
        ))}
      </div>
      <p className="meta" data-testid="card-price">人均：{priceLine(v)}</p>
      <p className="reason">{oneLiner(v)}</p>
      {(disputed || v.hasNegative) && <p className="reason warn">⚠ 素材中有负面或分歧说法，详情里查看。</p>}
      <div className="card-foot">
        <span>
          {v.sources} 篇来源 · 资料 {v.latest ?? UNKNOWN}
        </span>
        <button type="button" className="btn" onClick={onOpen}>
          详情
        </button>
      </div>
    </article>
  );
}
