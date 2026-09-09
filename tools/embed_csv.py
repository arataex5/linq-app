#!/usr/bin/env python3
"""data/linq_topics.csv の内容を js/data.js の EMBEDDED_CSV に書き戻す。

CSV を更新したら:
    python3 tools/embed_csv.py
を実行してください（file:// / APK 実行時のフォールバックが同期されます）。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, 'data', 'linq_topics.csv')
JS = os.path.join(ROOT, 'js', 'data.js')

def main():
    with open(CSV, encoding='utf-8-sig') as f:
        lines = [ln.rstrip('\n').rstrip('\r') for ln in f if ln.strip()]
    body = ',\n'.join(
        "    '" + ln.replace('\\', '\\\\').replace("'", "\\'") + "'" for ln in lines
    )
    with open(JS, encoding='utf-8') as f:
        src = f.read()
    new, cnt = re.subn(
        r'(var EMBEDDED_CSV = \[\n)(.*?)(\n  \]\.join)',
        lambda m: m.group(1) + body + m.group(3),
        src, count=1, flags=re.S,
    )
    if not cnt:
        print('EMBEDDED_CSV ブロックが見つかりませんでした', file=sys.stderr)
        return 1
    with open(JS, 'w', encoding='utf-8') as f:
        f.write(new)
    print('embedded %d lines into js/data.js' % len(lines))
    return 0

if __name__ == '__main__':
    sys.exit(main())
