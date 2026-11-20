"use client";

import { useEffect, useRef } from "react";
import { ClaimOrTbd, ClaimView, SourceChip, Tbd } from "@/components/Sources";
import { resolveSource } from "@/lib/data";
import { PROFILE_FIELDS } from "@/lib/schema";
import type { ShopView } from "@/lib/shops";
import type { ShopState } from "@/lib/types";
import { trapTab } from "@/lib/ui/focus";
import { CATEGORY_LABEL, CHECK_LABEL, XHS_NOTE, amapMarkerUrl, isXhs, nearestPortText, shopSourceIds } from "@/lib/ui/format";

interface Props {
  v: ShopView;
  state: ShopState;
  onPatch: (patch: Partial<ShopState>) => void;
  onClose: () => void;
}

const Val = ({ s }: { s?: string | number | null }) => (s !== undefined && s !== null && String(s).trim() ? <>{s}</> : <Tbd />);

export default function ShopSheet({ v, state, onPatch, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const c = v.candidate;
  const p = c.profile;
  const poi = v.poi;
  const facts = c.amapFacts;
  const gmap = amapMarkerUrl(v);
  const port = nearestPortText(v);
  const sourceIds = shopSourceIds(c);
  const hasXhs = sourceIds.some(isXhs);
  const idChecks = c.checks.filter((k) => k.result !== "pass");

  useEffect(() => {
    closeRef.current?.focus();
    ref.current?.scrollTo({ top: 0 });
  }, [v.key]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${v.name} 详情`}
        data-testid="shop-sheet"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          } else trapTab(e, ref.current);
        }}
      >
        <div className="sheet-bar">
          <span className="sheet-kicker">{CATEGORY_LABEL[c.category]}</span>
          <button ref={closeRef} type="button" className="close-btn" onClick={onClose} aria-label="关闭详情">
            关闭
          </button>
        </div>
        <div className="sheet-body">
          <header className="sheet-head">
            <h2>{v.name}</h2>
            <p className="sheet-sub">
              {[poi?.district, poi?.businessArea].filter(Boolean).join(" · ") || "位置待核实"}
              {" · "}¥{v.priceMin} 起 · {c.price.label}
            </p>
            {c.branchNote && <p className="small muted">门店：{c.branchNote}</p>}
            {p && <p className="lede">{p.headline.text}</p>}
            {p && <ClaimMeta claim={p.headline} />}
          </header>

          {p ? (
            <>
              <section aria-labelledby="s-fields">
                <h3 id="s-fields">逐店评价</h3>
                <dl className="fields">
                  {PROFILE_FIELDS.map((f) => (
                    <div key={f.key} className="field-row" data-testid={`field-${f.key}`}>
                      <dt>{f.label}</dt>
                      <dd><ClaimOrTbd claim={p[f.key]} /></dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section aria-labelledby="s-str" data-testid="strengths">
                <h3 id="s-str">突出优势</h3>
                {p.strengths.length ? (
                  <ul className="claims">
                    {p.strengths.map((s, i) => (
                      <li key={i}><ClaimView claim={s} as="span" /></li>
                    ))}
                  </ul>
                ) : (
                  <p><Tbd>暂无来源支持的突出优势</Tbd></p>
                )}
              </section>

              <section aria-labelledby="s-risk" data-testid="risks">
                <h3 id="s-risk">风险与争议</h3>
                {p.risks.length > 0 && (
                  <ul className="claims">
                    {p.risks.map((s, i) => (
                      <li key={i}><ClaimView claim={s} as="span" /></li>
                    ))}
                  </ul>
                )}
                {p.disputes.length > 0 && (
                  <>
                    <p className="sub-h">来源之间存在分歧</p>
                    <ul className="claims disputes">
                      {p.disputes.map((s, i) => (
                        <li key={i}><ClaimView claim={s} as="span" /></li>
                      ))}
                    </ul>
                  </>
                )}
                {p.risks.length === 0 && p.disputes.length === 0 && (
                  <p className="small muted">现有来源中没有记录到风险或争议；这不等于没有风险，请预约时向店家确认。</p>
                )}
              </section>
            </>
          ) : (
            <p><Tbd>该店暂无逐店评价</Tbd></p>
          )}

          <section aria-labelledby="s-price">
            <h3 id="s-price">价位证据</h3>
            <p className="strong">{c.price.label}</p>
            {c.price.basis.length ? (
              <ul className="claims">
                {c.price.basis.map((b, i) => (
                  <li key={i}><ClaimView claim={b} as="span" /></li>
                ))}
              </ul>
            ) : (
              <p><Tbd /></p>
            )}
            <p className="small muted">收录门槛为每位 ¥300 起；实际费用以套餐、酒水、加点与服务费为准，预约时请向店家确认。</p>
          </section>

          <section aria-labelledby="s-id">
            <h3 id="s-id">Omakase 身份依据</h3>
            {c.identity.basis.length ? (
              <ul className="claims">
                {c.identity.basis.map((b, i) => (
                  <li key={i}><ClaimView claim={b} as="span" /></li>
                ))}
              </ul>
            ) : (
              <p><Tbd /></p>
            )}
            {idChecks.length > 0 && (
              <p className="small muted">
                {idChecks.map((k) => `规则 ${k.rule}：${CHECK_LABEL[k.result].text}（${k.note}）`).join("；")}
              </p>
            )}
          </section>

          <section aria-labelledby="s-conf" data-testid="confidence">
            <h3 id="s-conf">资料置信度</h3>
            {c.confidence ? (
              <p>
                <strong>{c.confidence.level}</strong>
                <span className="sep">·</span>
                {c.confidence.reason}
              </p>
            ) : (
              <p><Tbd /></p>
            )}
            <p className="small muted" data-testid="updated-at">最近更新：{c.updatedAt}</p>
          </section>

          <section aria-labelledby="s-amap">
            <h3 id="s-amap">高德地图信息</h3>
            <dl className="kv">
              <dt>地址</dt>
              <dd><Val s={poi?.address ?? facts?.address} /></dd>
              <dt>电话</dt>
              <dd>{poi?.tel ? <a href={`tel:${poi.tel.split(";")[0].trim()}`}>{poi.tel}</a> : <Tbd />}</dd>
              <dt>营业时间</dt>
              <dd><Val s={poi?.openTime} /></dd>
              <dt>高德人均</dt>
              <dd>{poi?.cost ? `¥${poi.cost}` : facts?.cost ? `¥${facts.cost}（${facts.checkedAt} 核对）` : <Tbd />}</dd>
            </dl>
            <p className="small muted">高德人均为平台口径，仅供参考，不等同套餐价。{!poi && "本次未取得高德位置，以上为审计时核对的信息（如有）。"}</p>
            {port && <p className="small">{port}。不含通关、排队与路面时间。</p>}
            {gmap && (
              <p>
                <a href={gmap} target="_blank" rel="noopener noreferrer">在高德地图中打开</a>
              </p>
            )}
          </section>

          <section aria-labelledby="s-src">
            <h3 id="s-src">本店来源</h3>
            {hasXhs && <p className="small notice">{XHS_NOTE}。互动量不作为质量依据。</p>}
            <ol className="source-list" data-testid="detail-sources">
              {sourceIds.map((id) => {
                const s = resolveSource(id);
                return (
                  <li key={id}>
                    <SourceChip id={id} />
                    <span className="small muted"> {s.label}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="s-mine">
            <h3 id="s-mine">我的记录</h3>
            <p className="small muted">仅保存在本浏览器。</p>
            <div className="row">
              <button type="button" className="btn" aria-pressed={state.favorite} onClick={() => onPatch({ favorite: !state.favorite })}>
                {state.favorite ? "★ 已收藏" : "☆ 收藏"}
              </button>
              <button type="button" className="btn" aria-pressed={state.visited} onClick={() => onPatch({ visited: !state.visited })}>
                {state.visited ? "✓ 去过" : "标记去过"}
              </button>
            </div>
            <div className="field">
              <label htmlFor="note">备注</label>
              <textarea id="note" maxLength={4000} value={state.note} onChange={(e) => onPatch({ note: e.target.value })} placeholder="例如：同行人数、座位、预约与取消情况" />
            </div>
            <p className="small muted">信息可能变化，请预约时复核。</p>
          </section>
        </div>
      </aside>
    </>
  );
}

function ClaimMeta({ claim }: { claim: { sources: string[]; asOf?: string } }) {
  return (
    <p className="small muted claim-meta">
      {claim.sources.map((id) => (
        <SourceChip key={id} id={id} />
      ))}
      {claim.asOf && <span className="asof">资料日期 {claim.asOf}</span>}
    </p>
  );
}
