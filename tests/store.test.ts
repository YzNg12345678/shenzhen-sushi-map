import { describe, expect, it } from "vitest";
import { STORAGE_KEY, loadFromStorage, writeCommit, writeReplace } from "@/lib/store";
import { emptyData } from "@/lib/types";

function mem(init: Record<string, string> = {}, failSet: boolean | ((k: string) => boolean) = false) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (typeof failSet === "function" ? failSet(k) : failSet) throw new Error("quota");
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
}

describe("loadFromStorage", () => {
  it("空存储得到空数据", () => {
    const r = loadFromStorage(mem());
    expect(r.data).toEqual(emptyData());
    expect(r.error).toBeNull();
    expect(r.locked).toBe(false);
  });
  it("有效数据被读取", () => {
    const d = { ...emptyData(), compare: ["a"] };
    expect(loadFromStorage(mem({ [STORAGE_KEY]: JSON.stringify(d) })).data.compare).toEqual(["a"]);
  });
  it("损坏数据：另存副本、原键保持不变、报错", () => {
    const s = mem({ [STORAGE_KEY]: "{broken" });
    const r = loadFromStorage(s);
    expect(r.error).toContain("损坏副本");
    expect(r.locked).toBe(false);
    expect(s.m.get(STORAGE_KEY)).toBe("{broken");
    const copies = [...s.m.keys()].filter((k) => k.includes(":corrupt-"));
    expect(copies).toHaveLength(1);
    expect(s.m.get(copies[0])).toBe("{broken");
  });
  it("损坏且无法另存副本：锁定写入", () => {
    const r = loadFromStorage(mem({ [STORAGE_KEY]: "{broken" }, true));
    expect(r.locked).toBe(true);
    expect(r.data).toEqual(emptyData());
  });
  it("存储不可读：锁定写入而不抛异常", () => {
    const r = loadFromStorage({ getItem: () => { throw new Error("denied"); }, setItem: () => {} });
    expect(r.locked).toBe(true);
    expect(r.error).toBeTruthy();
  });
  it("版本不符视为损坏而非静默迁移", () => {
    const s = mem({ [STORAGE_KEY]: JSON.stringify({ schemaVersion: 2 }) });
    expect(loadFromStorage(s).error).toContain("schemaVersion");
  });
});

describe("writeReplace", () => {
  const BK = `${STORAGE_KEY}:before-replace`;
  const oldData = JSON.stringify({ ...emptyData(), compare: ["old"] });
  const next = { ...emptyData(), compare: ["new"] };

  it("成功：备份旧数据并写入新数据", () => {
    const s = mem({ [STORAGE_KEY]: oldData });
    const r = writeReplace(s, next, false, false);
    expect(r.ok).toBe(true);
    expect(s.m.get(BK)).toBe(oldData);
    expect(JSON.parse(s.m.get(STORAGE_KEY)!).compare).toEqual(["new"]);
  });
  it("成功：空存储无备份也能写入", () => {
    const s = mem();
    expect(writeReplace(s, next, false, false).ok).toBe(true);
    expect(s.m.has(BK)).toBe(false);
    expect(s.m.has(STORAGE_KEY)).toBe(true);
  });
  it("清空：删除旧备份并写入空数据", () => {
    const s = mem({ [STORAGE_KEY]: oldData, [BK]: "stale" });
    const r = writeReplace(s, emptyData(), true, false);
    expect(r.ok).toBe(true);
    expect(s.m.has(BK)).toBe(false);
    expect(JSON.parse(s.m.get(STORAGE_KEY)!)).toEqual(emptyData());
  });
  it("非法导入：拒绝且已存数据逐字节不变", () => {
    const s = mem({ [STORAGE_KEY]: oldData });
    for (const bad of [null, "x", {}, { schemaVersion: 2 }, { ...emptyData(), compare: "nope" }]) {
      const r = writeReplace(s, bad, false, false);
      expect(r.ok).toBe(false);
    }
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
    expect(s.m.has(BK)).toBe(false);
  });
  it("锁定：拒绝且不写任何键", () => {
    const s = mem({ [STORAGE_KEY]: oldData });
    const r = writeReplace(s, next, false, true);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("不可写") });
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
    expect(s.m.size).toBe(1);
    expect(writeReplace(s, emptyData(), true, true).ok).toBe(false);
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
  });
  it("setItem 全部抛错：失败且旧数据不变", () => {
    const s = mem({ [STORAGE_KEY]: oldData }, true);
    const r = writeReplace(s, next, false, false);
    expect(r.ok).toBe(false);
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
  });
  it("仅主键写入抛错：失败，主键不变（备份可能已写入）", () => {
    const s = mem({ [STORAGE_KEY]: oldData }, (k) => k === STORAGE_KEY);
    const r = writeReplace(s, next, false, false);
    expect(r.ok).toBe(false);
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
  });
  it("备份写入抛错：失败，主键不变", () => {
    const s = mem({ [STORAGE_KEY]: oldData }, (k) => k === BK);
    expect(writeReplace(s, next, false, false).ok).toBe(false);
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
  });
  it("getItem/removeItem 抛错：失败而不抛异常", () => {
    const s = mem({ [STORAGE_KEY]: oldData });
    const thrower = () => {
      throw new Error("denied");
    };
    expect(writeReplace({ ...s, getItem: thrower }, next, false, false).ok).toBe(false);
    expect(writeReplace({ ...s, removeItem: thrower }, emptyData(), true, false).ok).toBe(false);
    expect(s.m.get(STORAGE_KEY)).toBe(oldData);
  });
  it("返回的是校验后的数据", () => {
    const r = writeReplace(mem(), next, false, false);
    expect(r.ok && r.data.compare).toEqual(["new"]);
  });
});

describe("writeCommit", () => {
  it("正常写入", () => {
    const s = mem();
    expect(writeCommit(s, emptyData(), false)).toEqual({ ok: true, skipped: false });
    expect(JSON.parse(s.m.get(STORAGE_KEY)!)).toEqual(emptyData());
  });
  it("锁定时跳过写入", () => {
    const s = mem();
    expect(writeCommit(s, emptyData(), true)).toEqual({ ok: true, skipped: true });
    expect(s.m.size).toBe(0);
  });
  it("setItem 抛错返回错误", () => {
    const r = writeCommit(mem({}, true), emptyData(), false);
    expect(r.ok).toBe(false);
    expect(!r.ok && !r.skipped && r.error).toContain("失败");
  });
});
