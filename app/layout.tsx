import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import SiteShell from "@/components/SiteShell";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "深圳 Omakase · 精选板前清单",
  description: "仅收录经过身份与价位审核的深圳板前 Omakase（每位 ¥300 起），逐店整理风格、套餐、预约与风险，附来源；另有鱼种食材季节图鉴。",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f2e8" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <StoreProvider>
          <SiteShell>{children}</SiteShell>
        </StoreProvider>
      </body>
    </html>
  );
}
