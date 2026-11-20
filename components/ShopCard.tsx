import type { ShopView } from "@/lib/shops";
import type { ShopState } from "@/lib/types";
import { audit, resolveSource } from "@/lib/data";
import { CATEGORY_LABEL, TBD, nearestPortText, priceFreshness } from "@/lib/ui/format";

interface Props {
  v: ShopView;
  index: number;
  state: ShopState;
  selected: boolean;
  onOpen: () => void;
}

/** 编辑式条目：只显示该店真实具备的字段，不同店的内容与长度自然不同。 */
export default function ShopCard({ v, index, state, selected, onOpen }: Props) {
  const c = v.candidate;
  const p = c.profile;
  const where = [v.poi?.district, v.poi?.businessArea].filter(Boolean).join(" · ");
  const style = p?.cuisine?.text ?? p?.ingredients?.text;
  const risk = p?.risks[0]?.text;
  const port = nearestPortText(v);
  const fresh = priceFreshness(c, audit.updatedAt, resolveSource);
  return (
    <article className="shop" data-selected={selected} data-testid="shop-card" data-shop-key={v.key} aria-label={v.name}>
      <p className="shop-eyebrow">
        <span className="no" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span>{CATEGORY_LABEL[c.category]}</span>
        <span>{where || `区域${TBD}`}</span>
      </p>
      <h3 className="shop-name">
        <button type="button" onClick={onOpen} aria-label={`${index + 1}. ${v.name}，查看详情`}>
          {v.name}
          {state.favorite && <span className="mark" title="已收藏">★</span>}
          {state.visited && <span className="mark" title="去过">✓</span>}
        </button>
      </h3>
      <p className="shop-price" data-testid="card-price">
        <strong>¥{v.priceMin} 起</strong>
        <span>{c.price.label}</span>
      </p>
      {p && <p className="shop-headline">{p.headline.text}</p>}
      {style && (
        <p className="shop-line">
          <span className="k">风格与招牌</span>
          {style}
        </p>
      )}
      {risk && (
        <p className="shop-line shop-risk">
          <span className="k">需留意</span>
          {risk}
        </p>
      )}
      <p className="shop-foot">
        <span>资料置信度 {c.confidence?.level ?? TBD}</span>
        <span>更新 {c.updatedAt}</span>
        {fresh.stale && <span className="stale-flag" data-testid="card-price-stale">价格来源 {fresh.newest}，可能已调整</span>}
        {port ? <span>{port}</span> : !v.poi && <span>位置{TBD}</span>}
      </p>
    </article>
  );
}
