"""Her karakter fotoğrafı için ağız açık kareleri üretir (çene aşağı iner, dudak arası koyulaşır).
Çıktı: assets/gercek/agiz/<anahtar>-1.webp (yarı açık), -2.webp (açık) — yalnızca ağız/çene bölgesini kapsayan yama,
ve src/ui/mouths.ts (yamanın görüntüdeki yeri, kesir olarak)."""
import json, os, sys
import cv2, dlib, numpy as np
from PIL import Image

SRC = sys.argv[1]           # assets/gercek
OUT = os.path.join(SRC, "agiz")
TS = sys.argv[2]            # src/ui/mouths.ts
PRED = os.path.join(os.path.dirname(__file__), "shape_predictor_68_face_landmarks.dat")
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(OUT, exist_ok=True)
det = dlib.get_frontal_face_detector()
pred = dlib.shape_predictor(PRED)
UP = 3  # küçük yüzler için büyütme


def landmarks(rgb):
    big = cv2.resize(rgb, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    faces = det(big, 1)
    if not faces:
        return None
    f = max(faces, key=lambda r: r.width() * r.height())
    sh = pred(big, f)
    return np.array([[p.x / UP, p.y / UP] for p in sh.parts()], dtype=np.float32)


def frame(rgba, P, amt):
    h, w = rgba.shape[:2]
    mouth = P[48:68]
    mw = P[54, 0] - P[48, 0]
    cx = (P[48, 0] + P[54, 0]) / 2
    my = (P[62, 1] + P[66, 1]) / 2          # dudak arası
    chin = P[8, 1]
    d = mw * 0.27 * amt                      # çene inişi (piksel)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # yatay ağırlık: ağız ortasında 1, çene kenarına doğru 0
    jaw_half = (P[12, 0] - P[4, 0]) / 2
    wx = np.clip(1 - (np.abs(xx - cx) / (jaw_half * 1.05)) ** 2, 0, 1)
    # dikey: dudak arasının altı tam iner, çenenin altında boyuna doğru söner
    fade = (chin - my) * 0.9
    wy = np.where(yy < my, 0, np.where(yy < chin, 1, np.clip(1 - (yy - chin) / fade, 0, 1)))
    # dudak köşeleri yerinde kalsın: ağız hizasında köşelere yaklaştıkça azalt
    near = np.exp(-((yy - my) / (mw * 0.35)) ** 2)
    corner = np.clip(np.abs(xx - cx) / (mw / 2), 0, 1)
    wc = 1 - near * corner ** 2 * 0.85
    D = d * wx * wy * wc
    mapy = yy - D
    warped = cv2.remap(rgba, xx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # ağız boşluğu: üst iç dudak (60-64) sabit, alt iç dudak (64-67,60) inmiş hâli
    up = P[60:65]
    low = P[[64, 65, 66, 67, 60]].copy()
    for i, p in enumerate(low):
        if i in (0, 4):
            continue  # köşeler sabit
        wxp = max(0.0, 1 - (abs(p[0] - cx) / (jaw_half * 1.05)) ** 2)
        cp = min(1.0, abs(p[0] - cx) / (mw / 2))
        p[1] = max(p[1], my) + d * wxp * (1 - cp ** 2 * 0.85)
    poly = np.concatenate([up, low]).astype(np.float32)
    S = 8  # alt piksel hassasiyeti için büyük maske
    mask = np.zeros((h * S, w * S), np.uint8)
    cv2.fillPoly(mask, [np.round(poly * S).astype(np.int32)], 255, lineType=cv2.LINE_AA)
    mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    mask = cv2.GaussianBlur(mask, (0, 0), 0.6)
    # iç renk: üstte hafif diş, altta koyu
    gap = max(1.0, (low[2, 1] - up[2, 1]))
    t = np.clip((yy - up[2, 1]) / gap, 0, 1)
    inner = np.stack([46 + 0 * t, 18 + 0 * t, 20 + 0 * t], -1)
    teeth = np.array([196, 186, 176], np.float32)
    tw = np.clip(1 - t / 0.22, 0, 1)[..., None] * (0.6 if amt > 0.6 else 0.35)
    col = inner * (1 - tw) + teeth * tw
    out = warped.astype(np.float32)
    m = mask[..., None]
    out[..., :3] = out[..., :3] * (1 - m) + col * m
    return np.clip(out, 0, 255).astype(np.uint8)


meta = {}
sheets = []
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".webp"):
        continue
    key = f[:-5]
    rgba = np.array(Image.open(os.path.join(SRC, f)).convert("RGBA"))
    P = landmarks(np.ascontiguousarray(rgba[..., :3]))
    if P is None:
        print("yüz bulunamadı:", key)
        continue
    h, w = rgba.shape[:2]
    mw = P[54, 0] - P[48, 0]
    x0 = int(max(0, P[4, 0] - 2)); x1 = int(min(w, P[12, 0] + 3))
    y0 = int(max(0, P[33, 1])); y1 = int(min(h, P[8, 1] + (P[8, 1] - P[62, 1]) * 0.9 + 3))
    frames = []
    for i, amt in ((1, 0.5), (2, 1.0)):
        fr = frame(rgba, P, amt)
        patch = fr[y0:y1, x0:x1]
        Image.fromarray(patch).save(os.path.join(OUT, f"{key}-{i}.webp"), "WEBP", quality=88, method=6)
        frames.append(fr)
    meta[key] = dict(x=x0 / w, y=y0 / h, w=(x1 - x0) / w, h=(y1 - y0) / h)
    if PREVIEW:
        fy0, fy1 = int(max(0, P[19, 1] - 10)), int(min(h, P[8, 1] + 20))
        fx0, fx1 = int(max(0, P[0, 0] - 10)), int(min(w, P[16, 0] + 10))
        row = [np.array(Image.fromarray(a[fy0:fy1, fx0:fx1]).resize(((fx1 - fx0) * 3, (fy1 - fy0) * 3))) for a in (rgba, *frames)]
        sheets.append((key, row))
    print(key, "ok", round(float(mw), 1))

lines = ["// mouth.py tarafından üretildi: ağız yamaları (yarı açık, açık) ve görüntüdeki yerleri (kesir).",
         "export const MOUTHS: Record<string, { x: number; y: number; w: number; h: number; a: any; b: any }> = {"]
for k, m in meta.items():
    lines.append(f'  "{k}": {{ x: {m["x"]:.4f}, y: {m["y"]:.4f}, w: {m["w"]:.4f}, h: {m["h"]:.4f}, '
                 f'a: require("../../assets/gercek/agiz/{k}-1.webp"), b: require("../../assets/gercek/agiz/{k}-2.webp") }},')
lines.append("};")
open(TS, "w").write("\n".join(lines) + "\n")

if PREVIEW and sheets:
    rows = []
    for key, row in sheets:
        H = max(r.shape[0] for r in row)
        row = [np.pad(r, ((0, H - r.shape[0]), (0, 4), (0, 0)), constant_values=255) for r in row]
        im = np.concatenate(row, 1)
        bg = np.full(im.shape[:2] + (3,), 230, np.uint8)
        a = im[..., 3:4] / 255
        rows.append((im[..., :3] * a + bg * (1 - a)).astype(np.uint8))
    Wm = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 4), (0, Wm - r.shape[1]), (0, 0)), constant_values=255) for r in rows]
    Image.fromarray(np.concatenate(rows, 0)).save(PREVIEW, quality=85)
print(len(meta), "karakter")
