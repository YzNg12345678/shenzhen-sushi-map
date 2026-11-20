import type { Metadata } from "next";
import AuditView from "@/components/AuditView";
import { PoiProvider } from "@/lib/store";

export const metadata: Metadata = { title: "深圳 Omakase · 筛选依据" };

export default function AuditPage() {
  return (
    <PoiProvider>
      <AuditView />
    </PoiProvider>
  );
}
