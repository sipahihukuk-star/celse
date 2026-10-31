"""Gerçekçi ağız kareleri: Higgsfield'da (gpt_image_2_5) aynı kişinin "konuşurken" düzenlenmiş fotoğrafından
yalnızca ağız-çene bölgesi alınır, yüz işaretleriyle (dlib 68 nokta) asıl kesit fotoğrafa hizalanır, rengi eşitlenir
ve yumuşak kenarlı bir yama olarak kaydedilir. Oyun konuşan karakterde bu yamaları sırayla gösterir.

Kullanım: python3 tools/mouth2.py <kesitler: assets/gercek> <düzenlenmiş yüzler klasörü> <src/ui/mouths.ts> [önizleme.jpg]
Düzenlenmiş yüz dosyaları: <anahtar>-a.jpg (açık ağız) ve <anahtar>-o.jpg ('o' sesi). Bunlar 880×1168 düzenlenmiş görüntünün
(x 0.2–0.8, y 0.02–0.55) kırpıntısıdır; hizalama yüz işaretleriyle yapıldığı için kırpma oranı önemli değildir.
Gerekli: shape_predictor_68_face_landmarks.dat (face_recognition_models paketinden) bu betiğin yanında ya da PRED ortam değişkeninde."""
import os, sys
import cv2, dlib, numpy as np
from PIL import Image

SRC, EDIT, TS = sys.argv[1], sys.argv[2], sys.argv[3]
PREVIEW = sys.argv[4] if len(sys.argv) > 4 else None
OUT = os.path.join(SRC, "agiz")
os.makedirs(OUT, exist_ok=True)
PRED = os.environ.get("PRED") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "shape_predictor_68_face_landmarks.dat")
det = dlib.get_frontal_face_detector()
pred = dlib.shape_predictor(PRED)


def landmarks(rgb, up=2):
    big = cv2.resize(rgb, None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    faces = det(big, 1)
    if not faces:
        return None
    f = max(faces, key=lambda r: r.width() * r.height())
    return np.array([[p.x / up, p.y / up] for p in pred(big, f).parts()], np.float32)


# Hizalamada kullanılan sabit noktalar: göz köşeleri, burun sırtı ve kanatları (ağız ve çene hareket eder, bunlar etmez).
STABLE = [36, 39, 42, 45, 27, 28, 29, 30, 31, 33, 35, 0, 16]


def patch_for(cut_rgba, P, edit_rgb):
    Q = landmarks(edit_rgb, up=1)
    if Q is None:
        return None
    M, _ = cv2.estimateAffinePartial2D(Q[STABLE], P[STABLE], method=cv2.LMEDS)
    h, w = cut_rgba.shape[:2]
    warped = cv2.warpAffine(edit_rgb, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    Qw = cv2.transform(Q[None], M)[0]
    # Bölge: burun altından çene ucunun biraz altına, iki yanda çene hattına kadar; iki yüzün çene hatlarının birleşimi.
    pts = np.concatenate([P[3:14], P[31:36], Qw[3:14]])
    hull = cv2.convexHull(pts.astype(np.float32))
    mask = np.zeros((h, w), np.float32)
    cv2.fillConvexPoly(mask, np.round(hull).astype(np.int32), 1.0, lineType=cv2.LINE_AA)
    fw = P[16, 0] - P[0, 0]
    mask = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=max(1, int(fw * 0.03)))
    mask = cv2.GaussianBlur(mask, (0, 0), fw * 0.045)
    # Ağız çevresi tam örtsün (kenarlardaki yumuşamadan bağımsız).
    core = np.zeros((h, w), np.float32)
    cv2.fillConvexPoly(core, np.round(cv2.convexHull(np.concatenate([P[48:60], Qw[48:60]]))).astype(np.int32), 1.0)
    core = cv2.GaussianBlur(cv2.dilate(core, np.ones((3, 3), np.uint8), iterations=max(1, int(fw * 0.04))), (0, 0), fw * 0.02)
    mask = np.maximum(mask, core)
    alpha = cut_rgba[..., 3].astype(np.float32) / 255
    mask *= alpha
    # Renk eşitleme: ağız dışındaki deri bölgesinde ortalama ve sapmayı eşitle.
    skin = (mask > 0.3) & (core < 0.05)
    out = warped.astype(np.float32)
    base = cut_rgba[..., :3].astype(np.float32)
    if skin.sum() > 30:
        for c in range(3):
            ms, ss = out[..., c][skin].mean(), out[..., c][skin].std() + 1e-3
            mb, sb = base[..., c][skin].mean(), base[..., c][skin].std() + 1e-3
            out[..., c] = (out[..., c] - ms) * (sb / ss) * 0.85 + (out[..., c] - ms) * 0.15 + mb
    out = np.clip(out, 0, 255)
    # Kesit fotoğraf küçük olduğundan düzenlenmiş yüzün keskinliği ona uydurulur.
    scale = abs(M[0, 0]) if abs(M[0, 0]) > 0 else 1
    if scale < 0.8:
        out = cv2.GaussianBlur(out, (0, 0), 0.35)
    ys, xs = np.where(mask > 0.01)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.dstack([out, mask * 255]).astype(np.uint8)[y0:y1, x0:x1]
    comp = base * (1 - mask[..., None]) + out * mask[..., None]
    return rgba, (x0, y0, x1 - x0, y1 - y0), comp.astype(np.uint8)


meta, rows = {}, []
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".webp"):
        continue
    key = f[:-5]
    cut = np.array(Image.open(os.path.join(SRC, f)).convert("RGBA"))
    h, w = cut.shape[:2]
    P = landmarks(np.ascontiguousarray(cut[..., :3]), up=3)
    if P is None:
        print("yüz yok:", key); continue
    frames, boxes, comps = {}, [], []
    for fr in ("a", "o"):
        p = os.path.join(EDIT, f"{key}-{fr}.jpg")
        if not os.path.exists(p):
            continue
        r = patch_for(cut, P, np.array(Image.open(p).convert("RGB")))
        if r is None:
            print("düzenlenmiş yüz bulunamadı:", key, fr); continue
        frames[fr], box, comp = r
        boxes.append(box); comps.append(comp)
    if not frames:
        continue
    # İki kare aynı kutuda olsun (kutuların birleşimi).
    X0 = min(b[0] for b in boxes); Y0 = min(b[1] for b in boxes)
    X1 = max(b[0] + b[2] for b in boxes); Y1 = max(b[1] + b[3] for b in boxes)
    names = {}
    for fr, (rgba) in frames.items():
        b = boxes[list(frames).index(fr)]
        canvas = np.zeros((Y1 - Y0, X1 - X0, 4), np.uint8)
        canvas[b[1] - Y0:b[1] - Y0 + b[3], b[0] - X0:b[0] - X0 + b[2]] = rgba
        Image.fromarray(canvas).save(os.path.join(OUT, f"{key}-{fr}.webp"), "WEBP", quality=90, method=6)
        names[fr] = f"{key}-{fr}.webp"
    meta[key] = dict(x=X0 / w, y=Y0 / h, w=(X1 - X0) / w, h=(Y1 - Y0) / h, names=names)
    if PREVIEW:
        fy0, fy1 = int(max(0, P[19, 1] - 8)), int(min(h, P[8, 1] + 14))
        fx0, fx1 = int(max(0, P[0, 0] - 8)), int(min(w, P[16, 0] + 8))
        bg = np.full((h, w, 3), 220, np.float32); a = cut[..., 3:4] / 255
        orig = (cut[..., :3] * a + bg * (1 - a)).astype(np.uint8)
        tiles = [orig] + [(c * a + bg * (1 - a)).astype(np.uint8) for c in comps]
        rows.append(np.concatenate([np.array(Image.fromarray(t[fy0:fy1, fx0:fx1]).resize((180, int(180 * (fy1 - fy0) / (fx1 - fx0))))) for t in tiles], 1))
    print(key, "→", ", ".join(names))

lines = ["// tools/mouth2.py tarafından üretildi: konuşma ağız yamaları ve görüntüdeki yerleri (kesir).",
         "// a: açık ağız, o: yuvarlak ağız. Yalnız ağız-çene bölgesini kapsar, kenarları saydamdır.",
         "export const MOUTHS: Record<string, { x: number; y: number; w: number; h: number; a?: any; o?: any }> = {"]
for k, m in meta.items():
    parts = [f'x: {m["x"]:.4f}, y: {m["y"]:.4f}, w: {m["w"]:.4f}, h: {m["h"]:.4f}']
    for fr, n in m["names"].items():
        parts.append(f'{fr}: require("../../assets/gercek/agiz/{n}")')
    lines.append(f'  "{k}": {{ ' + ", ".join(parts) + " },")
lines.append("};")
open(TS, "w").write("\n".join(lines) + "\n")

if PREVIEW and rows:
    W = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 4), (0, W - r.shape[1]), (0, 0)), constant_values=255) for r in rows]
    Image.fromarray(np.concatenate(rows, 0)).save(PREVIEW, quality=85)
print(len(meta), "karakter")
