#!/usr/bin/env python3
"""Check related link integrity across all dict data files."""
import os
import re
from collections import defaultdict

DATA_DIR = "lib/dict/data"

# 모든 실존 슬러그 수집
existing = set()
for cat in os.listdir(DATA_DIR):
    cat_dir = os.path.join(DATA_DIR, cat)
    if not os.path.isdir(cat_dir):
        continue
    for f in os.listdir(cat_dir):
        if f.endswith(".ts"):
            slug = f.replace(".ts", "")
            existing.add(f"{cat}/{slug}")

print(f"총 실존 슬러그: {len(existing)}\n")

# 각 파일의 related 추출
broken = defaultdict(list)
total_checked = 0
total_broken = 0

for cat in os.listdir(DATA_DIR):
    cat_dir = os.path.join(DATA_DIR, cat)
    if not os.path.isdir(cat_dir):
        continue
    for f in os.listdir(cat_dir):
        if not f.endswith(".ts"):
            continue
        slug = f.replace(".ts", "")
        src = f"{cat}/{slug}"
        with open(os.path.join(cat_dir, f), encoding="utf-8") as fh:
            text = fh.read()
        for m in re.finditer(
            r'category:\s*"(\w+)"\s*,\s*slug:\s*"([\w-]+)"', text
        ):
            target = f"{m.group(1)}/{m.group(2)}"
            total_checked += 1
            if target not in existing:
                broken[target].append(src)
                total_broken += 1

print(f"총 related 링크: {total_checked}")
print(f"깨진 링크: {total_broken}")
print(f"무결성: {(total_checked - total_broken) / total_checked * 100:.1f}%\n")

if broken:
    print("깨진 링크 (참조 횟수 순):")
    for tgt, srcs in sorted(broken.items(), key=lambda x: -len(x[1])):
        print(f"  → {tgt:35} ({len(srcs)}건)  예: {srcs[0]}")
