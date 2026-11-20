import type { Claim } from "@/lib/schema";
import { resolveSource } from "@/lib/data";
import { isXhs } from "@/lib/ui/format";

/** 单个来源 chip：有链接则可点击外链；小红书标注为用户内容。 */
export function SourceChip({ id }: { id: string }) {
  const s = resolveSource(id);
  const user = isXhs(id);
  const text = `${user ? "小红书用户笔记" : s.publisher}${s.date ? ` · ${s.date}` : ""}`;
  const tip = `${s.label}（${s.tier}）${user ? "：小红书用户笔记，仅作一手体验参考" : ""}`;
  const body = (
    <>
      <span>{text}</span>
      <span className="src-tier">{user ? "用户内容" : s.tier}</span>
    </>
  );
  return s.url ? (
    <a className={`src${user ? " src-user" : ""}`} href={s.url} target="_blank" rel="noopener noreferrer" title={tip} data-source={id}>
      {body}
      <span className="sr-only">（{s.label}，在新窗口打开）</span>
    </a>
  ) : (
    <span className={`src${user ? " src-user" : ""}`} title={tip} data-source={id}>
      {body}
      <span className="sr-only">（{s.label}）</span>
    </span>
  );
}

export function SourceChips({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="srcs">
      {ids.map((id) => (
        <SourceChip key={id} id={id} />
      ))}
    </span>
  );
}

/** 一条 Claim：文字 + 来源 chip + 来源日期。 */
export function ClaimView({ claim, as: Tag = "p" }: { claim: Claim; as?: "p" | "span" | "div" }) {
  return (
    <Tag className="claim">
      <span className="claim-text">{claim.text}</span>
      <SourceChips ids={claim.sources} />
      {claim.asOf && <span className="asof">资料日期 {claim.asOf}</span>}
    </Tag>
  );
}

/** 待核实 / 有值。 */
export function ClaimOrTbd({ claim }: { claim: Claim | null | undefined }) {
  return claim ? <ClaimView claim={claim} /> : <span className="tbd">待核实</span>;
}

export function Tbd({ children = "待核实" }: { children?: string }) {
  return <span className="tbd">{children}</span>;
}
