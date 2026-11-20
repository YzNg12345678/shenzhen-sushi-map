import Link from "next/link";
import SeasonStrip from "@/components/SeasonStrip";
import { SourceChip } from "@/components/Sources";
import { atlas } from "@/lib/data";
import { monthsLabel } from "@/lib/atlas";
import { resolveSource } from "@/lib/data";
import { isXhs } from "@/lib/ui/format";
import type { AtlasItem } from "@/lib/schema";

export default function AtlasDetail({ item, prev, next }: { item: AtlasItem; prev?: AtlasItem; next?: AtlasItem }) {
  const label = monthsLabel(item.season.months);
  return (
    <article className="page narrow" data-testid="atlas-detail">
      <nav className="crumbs" aria-label="面包屑">
        <Link href="/atlas/">← 全部图鉴</Link>
      </nav>
      <p className="eyebrow">{item.category}</p>
      <h1 className="page-title">{item.zh}</h1>
      <p className="ja">
        {item.ja}
        {item.aliases.length > 0 && <span className="aliases">　又称：{item.aliases.join("、")}</span>}
      </p>

      <section className="season-card" aria-labelledby="a-season">
        <h2 id="a-season">旬与供应</h2>
        <p className="season-label">
          <strong>{item.season.months.length === 0 ? "不以旬论（全年供应）" : `参考旬：${label}`}</strong>
        </p>
        <SeasonStrip months={item.season.months} label={label} />
        <p className="season-note" data-testid="season-note">{item.season.note}</p>
        <p className="small muted">月份仅为常见参考，随产地、养殖、冷冻与供应批次变化，不是绝对保证。</p>
      </section>

      <section aria-labelledby="a-flavor">
        <h2 id="a-flavor">风味与口感</h2>
        <p>{item.flavor}</p>
      </section>
      <section aria-labelledby="a-tech">
        <h2 id="a-tech">常见处理与技法</h2>
        <ul className="tags">
          {item.techniques.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="a-role">
        <h2 id="a-role">在 Omakase 套餐中的角色</h2>
        <p>{item.omakaseRole}</p>
      </section>
      <section aria-labelledby="a-tips">
        <h2 id="a-tips">识别与食用要点</h2>
        <p>{item.tips}</p>
      </section>
      <section aria-labelledby="a-src">
        <h2 id="a-src">来源</h2>
        {item.sources.some(isXhs) && <p className="small notice">含小红书用户笔记，仅作一手体验参考。</p>}
        <ol className="source-list">
          {item.sources.map((id) => (
            <li key={id}>
              <SourceChip id={id} />
              <span className="small muted"> {resolveSource(id).label}</span>
            </li>
          ))}
        </ol>
        <p className="small muted">图鉴数据更新于 {atlas.updatedAt}。</p>
      </section>

      <nav className="pager" aria-label="上一条与下一条">
        {prev ? <Link href={`/atlas/${prev.id}/`} rel="prev"><span>上一条</span>{prev.zh}</Link> : <span />}
        {next ? <Link href={`/atlas/${next.id}/`} rel="next"><span>下一条</span>{next.zh}</Link> : <span />}
      </nav>
    </article>
  );
}
