import re, sys

pat = re.compile(r'console\.\w+: "\[image-blocker\] (.*)"')
for line in sys.stdin:
    if "image-blocker" in line:
        if m := pat.search(line):
            print(m.group(1), flush=True)
