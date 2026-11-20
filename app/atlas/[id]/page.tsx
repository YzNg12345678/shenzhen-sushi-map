import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasDetail from "@/components/AtlasDetail";
import { atlas } from "@/lib/data";
import { atlasById } from "@/lib/atlas";

export const dynamicParams = false;

export function generateStaticParams() {
  return atlas.items.map((it) => ({ id: it.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const it = atlasById(id);
  return { title: it ? `${it.zh} · 深圳 Omakase 鱼种食材季节图鉴` : "深圳 Omakase · 鱼种食材季节图鉴" };
}

export default async function AtlasItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idx = atlas.items.findIndex((x) => x.id === id);
  if (idx < 0) notFound();
  return <AtlasDetail item={atlas.items[idx]} prev={atlas.items[idx - 1]} next={atlas.items[idx + 1]} />;
}
