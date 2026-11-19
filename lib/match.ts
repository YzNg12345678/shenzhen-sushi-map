/** 名称归一：小写，去掉空白与常见标点（· . ・ 括号 连字符），便于“寿司処·小志”与“寿司処.小志”互相匹配。 */
export const normName = (s: string): string => s.toLowerCase().replace(/[\s·.•・()（）\-_]/g, "");

export const nameHasAny = (name: string, keywords: string[]): boolean => {
  const n = normName(name);
  return keywords.some((k) => n.includes(normName(k)));
};
