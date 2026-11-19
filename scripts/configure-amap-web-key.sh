#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/.env.local"

printf '请输入高德 Web 服务 Key（输入不会显示）：' >&2
IFS= read -r -s AMAP_KEY
printf '\n' >&2

if [[ ! "$AMAP_KEY" =~ ^[0-9A-Fa-f]{32}$ ]]; then
  printf '错误：高德 Web 服务 Key 应为 32 位十六进制字符串。未写入文件。\n' >&2
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
replaced = {"AMAP_WEB_SERVICE_KEY", "AMAP_KEY"}
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
  printf 'AMAP_WEB_SERVICE_KEY=%s\n' "$AMAP_KEY"
  printf 'AMAP_KEY=%s\n' "$AMAP_KEY"
} >> "$TMP"
chmod 600 "$TMP"
mv -f "$TMP" "$TARGET"
trap - EXIT
unset AMAP_KEY

printf '已保存到 %s（权限 600，Git 已忽略）。\n' "$TARGET"
