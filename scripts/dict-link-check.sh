#!/bin/bash
# 모든 dict data 파일의 related 슬러그가 실제로 파일로 존재하는지 확인

cd /Users/kunjoo/projects/durumi-saju

# 모든 실존 슬러그 수집
declare -A EXISTING
for f in lib/dict/data/*/*.ts; do
  cat=$(basename "$(dirname "$f")")
  slug=$(basename "$f" .ts)
  EXISTING["$cat/$slug"]=1
done

echo "총 실존 슬러그: ${#EXISTING[@]}"
echo ""

# 각 파일의 related 추출 (간단한 정규식 — 완벽하진 않지만 spot check 충분)
declare -A BROKEN_TO
declare -A BROKEN_FROM
total=0

for f in lib/dict/data/*/*.ts; do
  src_cat=$(basename "$(dirname "$f")")
  src_slug=$(basename "$f" .ts)
  src="$src_cat/$src_slug"

  # related 배열에서 category/slug 쌍 추출
  python3 -c "
import re, sys
text = open('$f').read()
# related 배열 안에서 { category: \"X\", slug: \"Y\", ... } 추출
for m in re.finditer(r'category:\s*\"(\w+)\"\s*,\s*slug:\s*\"([\w-]+)\"', text):
    print(f'{m.group(1)}/{m.group(2)}')
" 2>/dev/null | while read -r target; do
    if [ -n "$target" ] && [ -z "${EXISTING[$target]}" ]; then
      echo "BROKEN: $src -> $target"
    fi
  done
done | sort | uniq -c | sort -rn | head -50
