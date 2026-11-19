"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const LINKS = [
  { href: "/", label: "今天怎么吃" },
  { href: "/map", label: "寿司地图" },
  { href: "/passport", label: "寿司护照" },
  { href: "/season", label: "鱼种季节" },
  { href: "/compare", label: "比较" },
  { href: "/data", label: "数据管理" },
];

export default function Nav() {
  const path = usePathname();
  const { data, persistError } = useStore();
  return (
    <>
      <a className="skip" href="#main">跳到主要内容</a>
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>鮨</span> 深圳寿司地图
        </Link>
        <nav aria-label="主导航">
          <ul>
            {LINKS.map((l) => {
              const active = l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.href === "/map" && path.startsWith("/shop"));
              return (
                <li key={l.href}>
                  <Link href={l.href} aria-current={active ? "page" : undefined}>
                    {l.label}
                    {l.href === "/compare" && data.compare.length > 0 ? ` (${data.compare.length})` : ""}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      {persistError && <div className="banner" role="alert">{persistError}</div>}
    </>
  );
}
