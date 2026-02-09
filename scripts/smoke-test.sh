#!/bin/bash
set -o errexit -o errtrace -o noclobber -o pipefail -o nounset

# ビルド
cmd.exe /c 'npm run build:dev >NUL'

# Firefox 起動 → テスト URL を開く
#cmd.exe /c 'npx web-ext run' 2>>tmp/stderr | python3 "$(dirname "$0")/filter-log.py" || true
cmd 'npx web-ext run | python.exe scripts/filter-log.py'
