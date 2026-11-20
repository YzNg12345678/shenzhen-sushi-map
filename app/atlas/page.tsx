import type { Metadata } from "next";
import AtlasBrowser from "@/components/AtlasBrowser";

export const metadata: Metadata = { title: "深圳 Omakase · 鱼种食材季节图鉴" };

export default function AtlasPage() {
  return <AtlasBrowser />;
}
