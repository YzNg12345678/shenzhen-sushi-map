import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "页面不存在 · 深圳 Omakase" };

export default function NotFound() {
  return (
    <div className="page narrow" data-testid="not-found">
      <p className="eyebrow">404</p>
      <h1 className="page-title">没有找到这个页面</h1>
      <p className="muted">图鉴条目或页面不存在，可能已被移除或地址有误。</p>
      <p className="row">
        <Link className="btn btn-primary" href="/atlas/">返回图鉴</Link>
        <Link className="btn" href="/">回到店铺</Link>
      </p>
    </div>
  );
}
