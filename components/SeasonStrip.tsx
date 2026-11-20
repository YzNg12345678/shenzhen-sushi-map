/** 12 个月旬期条：实心高柱 = 参考旬；空心矮柱 = 非旬。用形状而非颜色区分，并附文字说明。 */
export default function SeasonStrip({ months, label, highlight }: { months: number[]; label: string; highlight?: number }) {
  const all = months.length === 0;
  return (
    <div className="season" role="img" aria-label={all ? "全年供应，不以旬论" : `参考旬：${label}`}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const on = all || months.includes(m);
        return (
          <span key={m} className={`sm${on ? " on" : ""}${all ? " all" : ""}${highlight === m ? " cur" : ""}`}>
            <i aria-hidden="true" />
            <b aria-hidden="true">{m}</b>
          </span>
        );
      })}
    </div>
  );
}
