/** 三个常用口岸的坐标取自高德 POI（GCJ-02，口岸主体，约值）。仅用于直线距离估算，不代表通行时间。 */
export interface Port {
  id: "futian" | "szbay" | "luohu";
  name: string;
  lng: number;
  lat: number;
}

export const PORTS: Port[] = [
  { id: "futian", name: "福田口岸", lng: 114.069966, lat: 22.515706 },
  { id: "szbay", name: "深圳湾口岸", lng: 113.948081, lat: 22.496116 },
  { id: "luohu", name: "罗湖口岸", lng: 114.118895, lat: 22.528393 },
];

export function distanceKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface PortDistance {
  port: Port;
  km: number;
}

/** 各口岸直线距离，由近到远。 */
export function portDistances(p: { lng: number; lat: number }): PortDistance[] {
  return PORTS.map((port) => ({ port, km: distanceKm(p, port) })).sort((a, b) => a.km - b.km);
}
