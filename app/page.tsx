import type { Metadata } from "next";
import ShopExplorer from "@/components/ShopExplorer";
import { PoiProvider } from "@/lib/store";

export const metadata: Metadata = { title: "深圳 Omakase · 精选板前清单" };

export default function Home() {
  return (
    <PoiProvider>
      <ShopExplorer />
    </PoiProvider>
  );
}
