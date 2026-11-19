#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/.env.local"

printf '请输入高德 JS API Key（输入不会显示）：' >&2
IFS= read -r -s JS_KEY
printf '\n请输入对应的 securityJsCode（输入不会显示）：' >&2
IFS= read -r -s SECURITY_CODE
printf '\n' >&2

if [[ ! "$JS_KEY" =~ ^[0-9A-Fa-f]{32}$ ]]; then
  printf '错误：高德 JS API Key 应为 32 位十六进制字符串。未写入文件。\n' >&2
  exit 2
fi
if [[ -z "$SECURITY_CODE" || "$SECURITY_CODE" =~ [[:space:]] ]]; then
  printf '错误：securityJsCode 不能为空或包含空白。未写入文件。\n' >&2
  exit 2
fi

umask 077
TMP="$(mktemp "$ROOT/.env.local.tmp.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

python3 - "$TARGET" "$TMP" <<'PY'
from pathlib import Path
import sys

target = Path(sys.argv[1])
tmp = Path(sys.argv[2])
replaced = {"NEXT_PUBLIC_AMAP_JS_KEY", "NEXT_PUBLIC_AMAP_SECURITY_JS_CODE"}
kept = []
if target.exists():
    for line in target.read_text(encoding="utf-8").splitlines():
        name = line.split("=", 1)[0].strip() if "=" in line else ""
        if name not in replaced:
            kept.append(line)
while kept and not kept[-1].strip():
    kept.pop()
tmp.write_text("\n".join(kept) + ("\n\n" if kept else ""), encoding="utf-8")
PY

{
  printf 'NEXT_PUBLIC_AMAP_JS_KEY=%s\n' "$JS_KEY"
  printf 'NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=%s\n' "$SECURITY_CODE"
} >> "$TMP"
chmod 600 "$TMP"
mv -f "$TMP" "$TARGET"
trap - EXIT
unset JS_KEY SECURITY_CODE

printf '已保存 JS API 配置到 %s（权限 600，Git 已忽略）。\n' "$TARGET"
printf '注意：该 Key 不能用于 restapi.amap.com 的 Web 服务数据脚本。\n'
