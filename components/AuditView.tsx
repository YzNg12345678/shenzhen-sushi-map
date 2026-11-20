"use client";

import { useMemo } from "react";
import { ClaimView, SourceChips, Tbd } from "@/components/Sources";
import { audit } from "@/lib/data";
import type { Candidate } from "@/lib/schema";
import { buildShops } from "@/lib/shops";
import { usePois } from "@/lib/store";
import { CATEGORY_LABEL, CHECK_LABEL, DECISION_LABEL, POI_CODE_LABEL, RULE_KIND_LABEL } from "@/lib/ui/format";
import type { PoiCode } from "@/lib/rules";

const ruleById = new Map(audit.rules.map((r) => [r.id, r]));
const GROUPS: { decision: Candidate["decision"]; title: string; note: string }[] = [
  { decision: "include", title: "主清单", note: "身份与价位均有来源证明，逐店整理评价。" },
  { decision: "pending", title: "待核实区", note: "不计入主清单：证据不足或存在未解决的疑问，核实后才会移入。" },
  { decision: "exclude", title: "已排除", note: "明确不符合规则的店，列出原因。" },
];

function CandidateItem({ c }: { c: Candidate }) {
  return (
    <details className="cand" data-testid="audit-candidate" data-decision={c.decision}>
      <summary>
        <span className="cand-name">{c.name}</span>
        <span className="cand-meta">{CATEGORY_LABEL[c.category]} · {c.price.label}</span>
      </summary>
      <div className="cand-body">
        <p className="cand-reason">{c.reason}</p>
        {c.branchNote && <p className="small muted">门店：{c.branchNote}</p>}

        <h4>逐条规则检查</h4>
        <ul className="checks">
          {c.checks.map((k, i) => {
            const r = ruleById.get(k.rule);
            const res = CHECK_LABEL[k.result];
            return (
              <li key={i} className={`check check-${k.result}`}>
                <span className="check-res"><span aria-hidden="true">{res.mark} </span>{res.text}</span>
                <span className="check-body">
                  <strong>{k.rule}{r ? ` · ${r.title}` : ""}</strong>
                  <span>{k.note}</span>
                  <SourceChips ids={k.sources} />
                </span>
              </li>
            );
          })}
        </ul>

        <h4>Omakase 身份证据（{CHECK_LABEL[c.identity.result].text}）</h4>
        {c.identity.basis.length ? <ul className="claims">{c.identity.basis.map((b, i) => <li key={i}><ClaimView claim={b} as="span" /></li>)}</ul> : <p><Tbd /></p>}

        <h4>价位证据（{CHECK_LABEL[c.price.result].text}）</h4>
        {c.price.basis.length ? <ul className="claims">{c.price.basis.map((b, i) => <li key={i}><ClaimView claim={b} as="span" /></li>)}</ul> : <p><Tbd /></p>}
        <p className="small muted">更新于 {c.updatedAt}</p>
      </div>
    </details>
  );
}

export default function AuditView() {
  const { pois, status, error, failed, reload } = usePois();
  const split = useMemo(() => (status === "ready" ? buildShops(pois).split : null), [pois, status]);
  const groups = useMemo(() => {
    const m = new Map<PoiCode, NonNullable<typeof split>["rejected"]>();
    for (const r of split?.rejected ?? []) m.set(r.verdict.code, [...(m.get(r.verdict.code) ?? []), r]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [split]);

  return (
    <div className="page">
      <p className="eyebrow">方法 · Method</p>
      <h1 className="page-title">筛选依据</h1>
      <p className="lede wide">
        名单只收录能被来源证明“板前 Omakase”身份、且每位 ¥{audit.priceFloor} 起的店。下面是我们对深圳 Omakase 的观察、规则，以及每家候选的逐条检查与结论。
      </p>
      <p className="small muted" data-testid="audit-updated">数据更新时间：{audit.updatedAt}　·　数据版本 {audit.dataVersion}</p>

      <section aria-labelledby="au-char">
        <h2 id="au-char">深圳 Omakase 的特点</h2>
        <ul className="claims airy" data-testid="audit-characteristics">
          {audit.characteristics.map((c, i) => (
            <li key={i}><ClaimView claim={c} as="span" /></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="au-rules">
        <h2 id="au-rules">筛选规则</h2>
        <ol className="rules" data-testid="audit-rules">
          {audit.rules.map((r) => (
            <li key={r.id}>
              <span className="rid">{r.id}</span>
              <span>
                <strong>{r.title}</strong>
                <span className="rkind">{RULE_KIND_LABEL[r.kind]}</span>
                <span className="rtext">{r.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="au-cands">
        <h2 id="au-cands">候选清单与结论</h2>
        {GROUPS.map((g) => {
          const list = audit.candidates.filter((c) => c.decision === g.decision);
          return (
            <div key={g.decision} className="cand-group" data-testid={`audit-group-${g.decision}`}>
              <h3>
                {DECISION_LABEL[g.decision]} <span className="num">{list.length}</span>
              </h3>
              <p className="small muted">{g.note}</p>
              {list.length === 0 ? <p className="small">暂无。</p> : list.map((c) => <CandidateItem key={c.id} c={c} />)}
            </div>
          );
        })}
      </section>

      <section aria-labelledby="au-poi">
        <h2 id="au-poi">本次高德动态检索：被规则拒绝的条目</h2>
        <p className="small muted">
          每次打开页面都会向高德检索深圳的 Omakase 相关地点；检索结果必须逐条通过同一套规则才会出现在店铺页，其余在这里按原因汇总。
        </p>
        {status === "loading" && <p role="status">正在向高德检索…</p>}
        {status === "error" && (
          <div className="alert" role="alert">
            <p><strong>高德检索失败：</strong>{error}</p>
            <p className="small">无法统计本次被拒绝的条目；上方的规则与候选结论不受影响。</p>
            <button type="button" className="btn btn-primary" onClick={reload}>重新检索</button>
          </div>
        )}
        {split && (
          <div data-testid="audit-rejected">
            <p className="strong" data-testid="rejected-count">
              共检索到 {pois.length} 个地点，其中 {split.admitted.length} 个通过规则，{split.rejected.length} 个被拒绝。
            </p>
            {failed > 0 && <p className="small warn">有 {failed} 项检索失败，统计可能不完整。</p>}
            {groups.map(([code, list]) => (
              <details key={code} className="cand">
                <summary>
                  <span className="cand-name">{POI_CODE_LABEL[code]}</span>
                  <span className="cand-meta">{list.length} 项</span>
                </summary>
                <ul className="rej">
                  {list.map(({ poi, verdict }) => (
                    <li key={poi.id}>
                      <strong>{poi.name}</strong>
                      {poi.address && <span className="small muted"> · {poi.address}</span>}
                      <br />
                      <span className="small">{verdict.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {split.rejected.length === 0 && <p className="small">本次没有被拒绝的条目。</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="au-pat">
        <h2 id="au-pat">动态检索的名称排除模式</h2>
        <ul className="tags">
          {audit.excludeNamePatterns.map((p) => (
            <li key={p.pattern}>{p.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
