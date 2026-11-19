import type { AxisResult } from "@/lib/judge";
import { AXIS_LABEL } from "@/lib/catalog";

/** 三轴小徽章：文字标明等级，不只靠颜色。 */
export default function AxisBadge({ r }: { r: AxisResult }) {
  return (
    <div className={`axis lv-${r.level}`} data-testid={`axis-${r.axis}`}>
      {AXIS_LABEL[r.axis]}
      <b>{r.level}</b>
    </div>
  );
}
