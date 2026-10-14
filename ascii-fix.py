#!/usr/bin/env python3
"""Post-build ASCII-fier for Super Job Agent.

Chrome rejects JS files with raw multi-byte UTF-8 in executeScript.
This rewrites every non-ASCII codepoint in the chrome-mv3 output as a
backslash-u escape so the final file is pure ASCII while executing the
same logic.
"""
import os
import sys

OUT_DIRS = ["packages/extension/.output/chrome-mv3"]


def asciify_file(path):
    with open(path, "rb") as f:
        buf = f.read()
    if not any(b > 0x7f for b in buf):
        return False
    s = buf.decode("utf-8")
    out = []
    for ch in s:
        cp = ord(ch)
        if cp < 0x80:
            out.append(ch)
        elif cp <= 0xFFFF:
            out.append("\\u%04x" % cp)
        else:
            adj = cp - 0x10000
            hi = 0xD800 + (adj >> 10)
            lo = 0xDC00 + (adj & 0x3FF)
            out.append("\\u%04x\\u%04x" % (hi, lo))
    with open(path, "w", encoding="ascii") as f:
        f.write("".join(out))
    return True


def main():
    roots = [d for d in OUT_DIRS if os.path.isdir(d)]
    if not roots and os.path.isdir(".output/chrome-mv3"):
        roots.append(".output/chrome-mv3")
    if not roots:
        print("ascii-fix: no build output found - run npm run build:ext first", file=sys.stderr)
        return 1
    total = 0
    fixed = 0
    for root_dir in roots:
        for root, _dirs, fnames in os.walk(root_dir):
            for fn in fnames:
                if not fn.endswith(".js"):
                    continue
                total += 1
                fp = os.path.join(root, fn)
                try:
                    if asciify_file(fp):
                        fixed += 1
                except Exception as e:
                    print("  ERROR on %s: %s" % (fp, e), file=sys.stderr)
    print("ascii-fix: scanned %d JS files, rewrote %d to ASCII-only." % (total, fixed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
