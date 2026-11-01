"""Cübbe yaka renkleri (Hâkim ve Savcıların Resmî Kıyafet Yönetmeliği m.4; avukatlar kırmızı).

- Avukat görselleri (av-*): boyun çevresindeki yaka kırmızı, aşağı inen şeritler ve kol ağızları yeşil olur
  (yeşil görselde yaka kırmızıya, kırmızı görselde şeritler yeşile çevrilir). Ağız yamaları da aynı işlemden geçer.
- Hâkim görselleri (hk-*): kırmızı asıldan iki türev üretilir: <anahtar>-yesil (hukuk mahkemeleri) ve <anahtar>-gri (idari yargı).
  Türevlerin ağız yamaları da üretilir; src/ui/photos.ts ve src/ui/mouths.ts kayıtları eksikse eklenir.
Yüz (dudaklar dahil) dlib yüz işaretleriyle korunur. Betik tekrar çalıştırılabilir: kırmızıya çevrilmiş avukatta yeşil kalmaz.
mouth2.py yeniden çalıştırıldıktan sonra bu betik de yeniden çalıştırılmalıdır (yamalar yeniden üretildiği için).

Kullanım: PRED=.../shape_predictor_68_face_landmarks.dat python3 tools/cubbe.py
"""
import os, re
import cv2, dlib, numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
G = os.path.join(ROOT, "assets/gercek")
PHOTOS_TS = os.path.join(ROOT, "src/ui/photos.ts")
MOUTHS_TS = os.path.join(ROOT, "src/ui/mouths.ts")
det = dlib.get_frontal_face_detector()
pred = dlib.shape_predictor(os.environ["PRED"])


def face_mask(rgb):
    """Yüzün (alın dahil) korunacak bölgesi (1 = yüz) ve yakanın şeride dönüştüğü yükseklik."""
    h, w = rgb.shape[:2]
    big = cv2.resize(rgb, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    faces = det(big, 1)
    m = np.zeros((h, w), np.float32)
    if not faces:
        return m, h * 0.42
    f = max(faces, key=lambda r: r.width() * r.height())
    P = np.array([[p.x / 2, p.y / 2] for p in pred(big, f).parts()], np.float32)
    top = P[19:25, 1].min() - (P[8, 1] - P[27, 1]) * 0.6
    pts = np.vstack([P[0:17], [[P[16, 0], top], [P[0, 0], top]]]).astype(np.int32)
    cv2.fillConvexPoly(m, cv2.convexHull(pts), 1.0)
    # Yaka çizgisi: çenenin altında, yüz yüksekliğinin (burun kökü–çene) 0,6'sı kadar aşağıda.
    line = P[8, 1] + 0.6 * (P[8, 1] - P[27, 1])
    return cv2.GaussianBlur(cv2.dilate(m, np.ones((7, 7), np.uint8)), (9, 9), 0), line


def ramp(x, a, b):
    return np.clip((x - a) / (b - a), 0, 1)


def hue_dist(H, c):
    d = np.abs(H - c) % 360
    return np.minimum(d, 360 - d)


def to_rgb(H, S, V):
    return cv2.cvtColor(np.dstack([H, S, V]).astype(np.float32), cv2.COLOR_HSV2RGB)


def recolor(rgba, kind, protect, yy=None, line=None):
    """kind: 'avukat' (yaka kırmızı, şeritler yeşil), 'yesil' (kırmızı→yeşil), 'gri' (kırmızı→gri).
    yy: her satırın asıl görseldeki y değeri; line: yaka çizgisi (yalnız 'avukat')."""
    a = rgba.astype(np.float32) / 255
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    if kind == "avukat":
        green = (1 - ramp(hue_dist(H, 160), 40, 60)) * ramp(S, 0.18, 0.32)
        red = (1 - ramp(hue_dist(H, 352), 18, 32)) * ramp(S, 0.3, 0.5)
        top = (1 - ramp(yy, line - 3, line + 3))[:, None] * np.ones_like(H)
        w1 = green * top * (1 - protect)          # yakadaki yeşil → kırmızı
        w2 = red * (1 - top) * (1 - protect)      # şeritteki kırmızı → yeşil
        o1 = to_rgb(np.full_like(H, 353), np.minimum(1, S * 1.4), np.minimum(0.86, V * 1.75))
        o2 = to_rgb(np.full_like(H, 165), S * 0.68, V * 0.56)
        rgb = a[..., :3] * (1 - w1[..., None] - w2[..., None]) + o1 * w1[..., None] + o2 * w2[..., None]
        return (np.clip(np.dstack([rgb, a[..., 3]]), 0, 1) * 255).round().astype(np.uint8)
    else:
        w = (1 - ramp(hue_dist(H, 352), 18, 32)) * ramp(S, 0.3, 0.5)
        if kind == "yesil":
            nH, nS, nV = np.full_like(H, 150), S * 0.78, V * 0.62
        else:
            nH, nS, nV = H, S * 0.05, np.minimum(0.8, V * 0.95 + 0.04)
    w = w * (1 - protect)
    out = cv2.cvtColor(np.dstack([nH, nS, nV]).astype(np.float32), cv2.COLOR_HSV2RGB)
    rgb = a[..., :3] * (1 - w[..., None]) + out * w[..., None]
    res = np.dstack([rgb, a[..., 3]])
    return (np.clip(res, 0, 1) * 255).round().astype(np.uint8)


def load(p):
    return np.array(Image.open(p).convert("RGBA"))


def save(arr, p):
    Image.fromarray(arr).save(p, quality=90)


mouths_src = open(MOUTHS_TS).read()
RECT = {m.group(1): tuple(map(float, m.group(2, 3, 4, 5))) for m in
        re.finditer(r'"([^"]+)": \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+)', mouths_src)}


def patch_geom(full_protect, key, patch_shape):
    """Yamanın asıl görseldeki yerine göre yüz maskesi ve satırların y değerleri."""
    x, y, w, h = RECT[key]
    H, W = full_protect.shape
    x0, y0, x1, y1 = round(x * W), round(y * H), round((x + w) * W), round((y + h) * H)
    crop = full_protect[max(0, y0):y1, max(0, x0):x1]
    prot = cv2.resize(crop, (patch_shape[1], patch_shape[0]), interpolation=cv2.INTER_LINEAR)
    yy = y0 + np.arange(patch_shape[0]) * (y1 - y0) / patch_shape[0]
    return prot, yy


def do(key, kind, out_key):
    base = load(os.path.join(G, key + ".webp"))
    prot, line = face_mask(np.ascontiguousarray(base[..., :3]))
    save(recolor(base, kind, prot, np.arange(base.shape[0], dtype=np.float32), line), os.path.join(G, out_key + ".webp"))
    for v in "ao":
        p = os.path.join(G, "agiz", f"{key}-{v}.webp")
        if key in RECT and os.path.exists(p):
            pa = load(p)
            pp, yy = patch_geom(prot, key, pa.shape)
            save(recolor(pa, kind, pp, yy.astype(np.float32), line), os.path.join(G, "agiz", f"{out_key}-{v}.webp"))
    return base.shape[1], base.shape[0]


photos = open(PHOTOS_TS).read()
keys = re.findall(r'^  "([^"]+)":', photos, re.M)
lawyers = [k for k in keys if k.startswith("av-")]
judges = [k for k in keys if re.fullmatch(r"hk-[a-z]+-\d+", k)]

for k in lawyers:
    do(k, "avukat", k)
    print("avukat →", k)

add_photos, add_mouths = [], []
for k in judges:
    for kind in ("yesil", "gri"):
        nk = f"{k}-{kind}"
        w, h = do(k, kind, nk)
        if f'"{nk}":' not in photos:
            add_photos.append(f'  "{nk}": {{ src: require("../../assets/gercek/{nk}.webp"), w: {w}, h: {h} }},\n')
        if k in RECT and f'"{nk}":' not in mouths_src:
            x, y, mw, mh = RECT[k]
            add_mouths.append(f'  "{nk}": {{ x: {x:.4f}, y: {y:.4f}, w: {mw:.4f}, h: {mh:.4f}, a: require("../../assets/gercek/agiz/{nk}-a.webp"), o: require("../../assets/gercek/agiz/{nk}-o.webp") }},\n')
        print("hâkim →", nk)

if add_photos:
    photos = photos.replace("} as const;", "".join(add_photos) + "} as const;")
    open(PHOTOS_TS, "w").write(photos)
if add_mouths:
    i = mouths_src.rstrip().rfind("};")
    mouths_src = mouths_src[:i] + "".join(add_mouths) + mouths_src[i:]
    open(MOUTHS_TS, "w").write(mouths_src)
print(len(add_photos), "görsel,", len(add_mouths), "ağız kaydı eklendi")
