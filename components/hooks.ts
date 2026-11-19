"use client";

import { useCallback, useEffect, useState } from "react";

const SITE = "深圳寿司地图";

/** 客户端按路由设置不同的页面标题。 */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${SITE}`;
  }, [title]);
}

export type MobileView = "list" | "map";

/** 手机（<=900px）下“列表 / 地图”切换；选中店铺时自动切到地图并滚动到地图。 */
export function useMobileView() {
  const [view, setView] = useState<MobileView>("list");
  const showMapIfMobile = useCallback(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    setView("map");
    setTimeout(() => {
      document.getElementById("map-pane")?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 0);
  }, []);
  return { view, setView, showMapIfMobile };
}
