# Ağız yamalarını yüzle kaynaştırır (mouth2.py ve cubbe.py'den sonra çalıştırılır).
# 1) Yamanın ten rengi, alttaki yüzün ten rengine kanal kanal eşitlenir (yama çoğu karakterde daha koyu kalıyordu).
# 2) Yamanın yumuşak kenarında renk, alttaki yüzün kendi rengine doğru geçirilir; böylece konuşurken
#    ağız çevresinde kenar, leke ya da renk sıçraması görünmez. Kullanım: python3 tools/mouthblend.py [anahtar ...]
import re, sys
import numpy as np
from PIL import Image

s = open("src/ui/mouths.ts").read()
only = set(sys.argv[1:])
done = set()
for m in re.finditer(r'"([^"]+)": \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+)(.*?)\},?\n', s):
    k = m.group(1)
    if only and k not in only: continue
    x, y, w, h = map(float, m.groups()[1:5])
    files = re.findall(r'(?:a|o): require\("../../assets/gercek/(agiz/[^"]+)"\)', m.group(6))
    base = Image.open(f"assets/gercek/{k}.webp").convert("RGBA"); W, H = base.size
    box = (round(x * W), round(y * H), round((x + w) * W), round((y + h) * H))
    for f in files:
        if f in done: continue          # hâkim varyantları aynı yamayı kullanır
        done.add(f)
        path = "assets/gercek/" + f
        pim = Image.open(path).convert("RGBA")
        p = np.asarray(pim).astype(np.float64)
        b = np.asarray(base.crop(box).resize(pim.size, Image.LANCZOS)).astype(np.float64)
        a = p[..., 3] / 255.0
        lp, lb = p[..., :3].mean(-1), b[..., :3].mean(-1)
        # Ten pikselleri: yamanın dolu kısmı, ama ağzın koyu içi ve dişler değil.
        skin = (a > 0.9) & (lp > 70) & (lb > 70) & (lp < 235)
        if skin.sum() < 30: continue
        out = p.copy()
        for c in range(3):
            pc, bc = p[..., c][skin], b[..., c][skin]
            gain = np.clip(bc.std() / max(pc.std(), 1e-3), 0.8, 1.25)
            off = bc.mean() - gain * pc.mean()
            out[..., c] = np.clip(gain * p[..., c] + off, 0, 255)
        # Kenara doğru alttaki yüzün rengi: alfa 0.35'in altı tamamen yüz, 0.95'in üstü tamamen yama.
        t = np.clip((a - 0.35) / 0.6, 0, 1); t = t * t * (3 - 2 * t)
        out[..., :3] = b[..., :3] * (1 - t[..., None]) + out[..., :3] * t[..., None]
        out[..., 3] = p[..., 3]
        Image.fromarray(out.round().astype(np.uint8), "RGBA").save(path, "WEBP", quality=92, method=6)
        print("kaynaştırıldı", f)

# 3) Ağız dışını sabitle: yamanın yalnız ağzın açıldığı bölgeyi değiştirmesi için alfa, ağız merkezli yumuşak bir elipsle
#    sınırlanır. Burun, bıyık üstü ve yanaklar her karede aynı kalır (konuşurken yüzün "kayması" önlenir).
def ellipse_limit(k, box, base, f):
    path = "assets/gercek/" + f
    pim = Image.open(path).convert("RGBA"); p = np.asarray(pim).astype(np.float64)
    b = np.asarray(base.crop(box).resize(pim.size, Image.LANCZOS)).astype(np.float64)
    a = p[..., 3] / 255.0; hh, ww = a.shape
    d = (b[..., :3].mean(-1) - p[..., :3].mean(-1)) * (a > 0.8)
    d[: hh // 4] = 0                                   # ağız burnun altında
    if (d > 20).sum() < 8: cy, cx = hh * 0.58, ww * 0.5
    else:
        ys, xs = np.nonzero(d > 20); wts = d[ys, xs]
        cy, cx = (ys * wts).sum() / wts.sum(), (xs * wts).sum() / wts.sum()
    Y, X = np.mgrid[0:hh, 0:ww]
    r = np.sqrt(((X - cx) / (ww * 0.36)) ** 2 + ((Y - cy) / (hh * 0.30)) ** 2)
    m = np.clip((1.1 - r) / 0.45, 0, 1); m = m * m * (3 - 2 * m)
    p[..., 3] = a * m * 255
    Image.fromarray(p.round().astype(np.uint8), "RGBA").save(path, "WEBP", quality=92, method=6)

done2 = set()
for m in re.finditer(r'"([^"]+)": \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+)(.*?)\},?\n', s):
    k = m.group(1)
    if only and k not in only: continue
    x, y, w, h = map(float, m.groups()[1:5])
    base = Image.open(f"assets/gercek/{k}.webp").convert("RGBA"); W, H = base.size
    box = (round(x * W), round(y * H), round((x + w) * W), round((y + h) * H))
    for f in re.findall(r'(?:a|o): require\("../../assets/gercek/(agiz/[^"]+)"\)', m.group(6)):
        if f in done2: continue
        done2.add(f); ellipse_limit(k, box, base, f)
