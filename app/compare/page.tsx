"use client";

import { useTitle } from "@/components/hooks";
import Link from "next/link";
import { Tag } from "@/components/ShopCard";
import { money, rate, REVISIT_LABEL, RESERVATION_LABEL, text, VINEGAR_LABEL } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function ComparePage() {
  useTitle("店铺比较");
  const { data, notes, toggleCompare } = useStore();
  const shops = data.compare.map((id) => data.pois[id]).filter(Boolean);

  if (shops.length === 0)
    return (
      <div className="page">
        <h1>店铺比较</h1>
        <p className="empty">还没有加入比较的店。在<Link href="/map">地图</Link>或推荐结果里点“加入比较”，最多 3 家。</p>
      </div>
    );

  const userAvg = (id: string) => {
    const cs = data.checkins.filter((c) => c.shopId === id);
    return cs.length ? `${(cs.reduce((a, c) => a + c.overall, 0) / cs.length).toFixed(1)}（${cs.length} 次）` : "无打卡";
  };
  const blank = (s: string) => (s ? s : "待补充");

  const rows: { group: "amap" | "user" | "derived"; label: string; get: (i: number) => string }[] = [
    { group: "amap", label: "区域", get: (i) => text(shops[i].district) },
    { group: "amap", label: "地址", get: (i) => text(shops[i].address) },
    { group: "amap", label: "评分", get: (i) => rate(shops[i].rating) },
    { group: "amap", label: "人均", get: (i) => money(shops[i].cost) },
    { group: "amap", label: "营业时间", get: (i) => text(shops[i].openTime) },
    { group: "amap", label: "电话", get: (i) => text(shops[i].tel) },
    { group: "user", label: "收藏 / 去过", get: (i) => `${notes(shops[i].id).favorite ? "已收藏" : "未收藏"} / ${notes(shops[i].id).visited ? "去过" : "未去过"}` },
    { group: "user", label: "复访意愿", get: (i) => REVISIT_LABEL[notes(shops[i].id).revisit] },
    { group: "derived", label: "我的打卡总评均分（按你的打卡计算）", get: (i) => userAvg(shops[i].id) },
    { group: "user", label: "流派", get: (i) => blank(notes(shops[i].id).style) },
    { group: "user", label: "赤酢/白酢", get: (i) => VINEGAR_LABEL[notes(shops[i].id).vinegar] },
    { group: "user", label: "熟成", get: (i) => blank(notes(shops[i].id).aging) },
    { group: "user", label: "师傅", get: (i) => blank(notes(shops[i].id).chef) },
    { group: "user", label: "座位", get: (i) => blank(notes(shops[i].id).seating) },
    { group: "user", label: "套餐", get: (i) => blank(notes(shops[i].id).setMenu) },
    { group: "user", label: "预约难度", get: (i) => RESERVATION_LABEL[notes(shops[i].id).reservation] },
  ];

  return (
    <div className="page">
      <h1>店铺比较（{shops.length}/3）</h1>
      <div className="table-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th scope="col">项目</th>
              {shops.map((s) => (
                <th scope="col" key={s.id}>
                  <Link href={`/shop?id=${encodeURIComponent(s.id)}`}>{s.name}</Link>
                  <br />
                  <button type="button" className="link-btn small" aria-label={`将 ${s.name} 移出比较`} onClick={() => toggleCompare(s)}>移出比较</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label} <Tag kind={r.group}>{""}</Tag></th>
                {shops.map((s, i) => {
                  const v = r.get(i);
                  return <td key={s.id} className={v === "未知" || v === "待补充" ? "unknown" : ""}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">“未知”= 高德未返回；“待补充”= 你尚未填写。本表不做综合打分。</p>
    </div>
  );
}
