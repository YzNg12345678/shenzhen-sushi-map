"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { searchSushi } from "./amap";
import { appDataSchema, emptyData, emptyNote, parseBackup, type AppData, type Checkin, type Poi, type ShopNote } from "./types";

export const STORAGE_KEY = "shenzhen-sushi-map:v1";

interface Store {
  ready: boolean;
  data: AppData;
  notes: (id: string) => ShopNote;
  patchNote: (poi: Poi, patch: Partial<ShopNote>) => void;
  saveCheckin: (c: Checkin, poi?: Poi) => void;
  deleteCheckin: (id: string) => void;
  toggleCompare: (poi: Poi) => { ok: boolean; message?: string };
  replaceAll: (d: AppData) => boolean;
  clearAll: () => boolean;
  persistError: string | null;
}

const Ctx = createContext<Store | null>(null);

export interface LoadResult {
  data: AppData;
  error: string | null;
  /** true 时不得写回存储：原数据既无法解析、也没能另存副本，写入会造成不可恢复的覆盖。 */
  locked: boolean;
}

/** 从存储读取；损坏数据不会被丢弃或覆盖（先另存副本，副本失败则锁定写入）。 */
export function loadFromStorage(storage: Pick<Storage, "getItem" | "setItem">): LoadResult {
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyData(), error: "无法读取浏览器本地存储，本次修改不会被保存。", locked: true };
  }
  if (!text) return { data: emptyData(), error: null, locked: false };
  const r = parseBackup(text);
  if (r.ok) return { data: r.data, error: null, locked: false };
  try {
    storage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, text);
  } catch {
    return {
      data: emptyData(),
      error: `本地数据校验失败，且无法另存损坏副本；为避免覆盖原数据，本次修改不会被保存：${r.error}`,
      locked: true,
    };
  }
  return { data: emptyData(), error: `本地数据校验失败，已另存损坏副本并以空数据启动：${r.error}`, locked: false };
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type CommitResult = { ok: true; skipped: false } | { ok: false; skipped: false; error: string } | { ok: true; skipped: true };

/** 增量提交：锁定时不写（skipped）；写入失败返回错误，内存数据由调用方保留。 */
export function writeCommit(storage: Pick<Storage, "setItem">, next: AppData, locked: boolean): CommitResult {
  if (locked) return { ok: true, skipped: true };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true, skipped: false };
  } catch {
    return { ok: false, skipped: false, error: "保存到浏览器本地存储失败（可能空间已满），请先导出备份。" };
  }
}

export type ReplaceResult = { ok: true; data: AppData } | { ok: false; error: string };

/**
 * 整体替换（导入/清空）：先校验，再备份旧数据到 before-replace，最后写入新数据。
 * 任一步失败都返回 ok:false，且不会写入主键（主键只在最后一步写入）。
 */
export function writeReplace(storage: StorageLike, next: unknown, isClear: boolean, locked: boolean): ReplaceResult {
  const checked = appDataSchema.safeParse(next);
  if (!checked.success) return { ok: false, error: "导入数据未通过校验，现有数据未改动。" };
  if (locked) return { ok: false, error: "本地存储当前不可写，现有数据未改动。" };
  try {
    if (isClear) storage.removeItem(`${STORAGE_KEY}:before-replace`);
    else {
      const prev = storage.getItem(STORAGE_KEY);
      if (prev) storage.setItem(`${STORAGE_KEY}:before-replace`, prev);
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(checked.data));
  } catch {
    return { ok: false, error: "写入浏览器本地存储失败，现有数据未改动，请先导出备份。" };
  }
  return { ok: true, data: checked.data };
}

/** 访问 localStorage 本身可能抛 SecurityError（如 Safari 禁用存储）；此时返回一个读写都失败的存储，由既有错误态呈现。 */
function safeStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    const fail = () => {
      throw new Error("浏览器禁止访问本地存储");
    };
    return { getItem: fail, setItem: fail, removeItem: fail, clear: fail, key: fail, length: 0 } as unknown as Storage;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const dataRef = useRef(data);
  const lockedRef = useRef(false);

  useEffect(() => {
    const l = loadFromStorage(safeStorage());
    dataRef.current = l.data;
    lockedRef.current = l.locked;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(l.data);
    setPersistError(l.error);
    setReady(true);
  }, []);

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    const r = writeCommit(safeStorage(), next, lockedRef.current);
    if (r.skipped) return;
    setPersistError(r.ok ? null : r.error);
  }, []);

  /** 整体替换：先写存储，失败则保持现有数据不变。 */
  const replace = useCallback((next: AppData, isClear = false): boolean => {
    const r = writeReplace(safeStorage(), next, isClear, lockedRef.current);
    if (!r.ok) {
      setPersistError(r.error);
      return false;
    }
    dataRef.current = r.data;
    setData(r.data);
    setPersistError(null);
    return true;
  }, []);

  const value = useMemo<Store>(() => {
    const withPoi = (d: AppData, poi?: Poi): AppData => (poi ? { ...d, pois: { ...d.pois, [poi.id]: poi } } : d);
    return {
      ready,
      data,
      persistError,
      notes: (id) => data.notes[id] ?? emptyNote(),
      patchNote: (poi, patch) => {
        const d = dataRef.current;
        const cur = d.notes[poi.id] ?? emptyNote();
        commit(withPoi({ ...d, notes: { ...d.notes, [poi.id]: { ...cur, ...patch } } }, poi));
      },
      saveCheckin: (c, poi) => {
        const d = dataRef.current;
        const exists = d.checkins.some((x) => x.id === c.id);
        const checkins = exists ? d.checkins.map((x) => (x.id === c.id ? c : x)) : [...d.checkins, c];
        commit(withPoi({ ...d, checkins }, poi));
      },
      deleteCheckin: (id) => {
        const d = dataRef.current;
        commit({ ...d, checkins: d.checkins.filter((c) => c.id !== id) });
      },
      toggleCompare: (poi) => {
        const d = dataRef.current;
        if (d.compare.includes(poi.id)) {
          commit({ ...d, compare: d.compare.filter((x) => x !== poi.id) });
          return { ok: true };
        }
        if (d.compare.length >= 3) return { ok: false, message: "最多同时比较 3 家，请先移除一家。" };
        commit(withPoi({ ...d, compare: [...d.compare, poi.id] }, poi));
        return { ok: true };
      },
      replaceAll: (d) => replace(d),
      clearAll: () => replace(emptyData(), true),
    };
  }, [data, ready, persistError, commit, replace]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider 缺失");
  return v;
}

/* ---------- 高德 POI 检索状态 ---------- */

interface PoiState {
  status: "loading" | "ready" | "error";
  pois: Poi[];
  error: string | null;
  keyword: string;
  search: (keyword: string) => void;
}

const PoiCtx = createContext<PoiState | null>(null);

export function PoiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<PoiState, "search">>({ status: "loading", pois: [], error: null, keyword: "" });
  const seq = useRef(0);

  const search = useCallback((keyword: string) => {
    const my = ++seq.current;
    setState((s) => ({ ...s, status: "loading", error: null, keyword }));
    searchSushi(keyword)
      .then((pois) => {
        if (my === seq.current) setState({ status: "ready", pois, error: null, keyword });
      })
      .catch((e: unknown) => {
        if (my === seq.current)
          setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "检索失败" }));
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    search("");
  }, [search]);

  const value = useMemo(() => ({ ...state, search }), [state, search]);
  return <PoiCtx.Provider value={value}>{children}</PoiCtx.Provider>;
}

export function usePois(): PoiState {
  const v = useContext(PoiCtx);
  if (!v) throw new Error("PoiProvider 缺失");
  return v;
}
