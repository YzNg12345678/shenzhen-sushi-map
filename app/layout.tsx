import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PoiProvider, StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "深圳 Omakase 跨境家庭选店地图",
  description: "给常住香港、熟悉 Omakase、会带伴侣或父母去深圳的人：稳不稳、带父母合不合适、值不值得专程过关。",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <StoreProvider>
          <PoiProvider>
            <main id="main">{children}</main>
          </PoiProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
