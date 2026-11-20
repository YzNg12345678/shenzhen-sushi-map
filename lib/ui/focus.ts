const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 在容器内循环 Tab 焦点（模态抽屉用）。 */
export function trapTab(e: { key: string; shiftKey: boolean; preventDefault: () => void }, root: HTMLElement | null): void {
  if (e.key !== "Tab" || !root) return;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const cur = document.activeElement;
  if (e.shiftKey && (cur === first || !root.contains(cur))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (cur === last || !root.contains(cur))) {
    e.preventDefault();
    first.focus();
  }
}
