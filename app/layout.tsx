import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PoiProvider, StoreProvider } from "@/lib/store";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "深圳寿司地图",
  description: "个人自用：今天去哪吃寿司，以及吃过什么。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <StoreProvider>
          <PoiProvider>
            <Nav />
            <main id="main" tabIndex={-1}>{children}</main>
            <footer className="site-footer">
              店铺事实来自高德地图；标注“你填写”的内容为个人记录；标注“推导”的是本应用按公开规则计算的建议，不是客观评价。数据仅保存在本浏览器。
            </footer>
          </PoiProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
