"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import SettingsDialog from "@/components/SettingsDialog";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "店铺" },
  { href: "/atlas/", label: "图鉴" },
  { href: "/audit/", label: "筛选依据" },
];

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export default function SiteShell({ children }: { children: ReactNode }) {
  const path = norm(usePathname() ?? "/");
  const { data, replaceAll, clearAll, persistError } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === norm(href) || path.startsWith(`${norm(href)}/`));

  return (
    <>
      <a className="skip" href="#main">跳到正文</a>
      <header className="site-head">
        <div className="head-row">
          <div className="brand">
            <Link href="/" className="brand-name">深圳 Omakase</Link>
            <p className="brand-note">仅收录经过身份与价位审核的板前 Omakase（每位 ¥300 起）</p>
          </div>
          <nav className="nav" aria-label="主导航">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="head-btn"
            aria-label="设置与数据说明"
            onClick={(e) => {
              opener.current = e.currentTarget;
              dialog.current?.showModal();
            }}
          >
            设置
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <SettingsDialog
        ref={dialog}
        data={data}
        persistError={persistError}
        onReplace={replaceAll}
        onClear={clearAll}
        onClose={() => {
          dialog.current?.close();
          opener.current?.focus?.();
        }}
      />
    </>
  );
}
