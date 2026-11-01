"""src/data/cases klasöründe olup index.ts'e kayıtlı olmayan JSON dosyalarını kaydeder (import + liste)."""
import os, re

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "cases")
P = os.path.join(D, "index.ts")
s = open(P).read()
files = sorted(f for f in os.listdir(D) if f.endswith(".json"))
missing = [f for f in files if f'"./{f}"' not in s]


def ident(f):
    parts = re.split(r"[^a-zA-Z0-9]+", f[:-5])
    name = parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])
    return ("c" + name) if name[0].isdigit() else name


if missing:
    imports = "".join(f'import {ident(f)} from "./{f}";\n' for f in missing)
    last = max(m.end() for m in re.finditer(r'^import .* from "\./[^"]+\.json";\n', s, re.M))
    s = s[:last] + imports + s[last:]
    s = s.replace("].map(c => normalizeCase(", "".join(f",\n  {ident(f)}" for f in missing) + "].map(c => normalizeCase(", 1)
    open(P, "w").write(s)
print(len(missing), "dosya kaydedildi")
