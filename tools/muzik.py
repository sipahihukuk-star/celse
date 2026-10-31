"""Hafif arka plan müziği: sakin piyano arpejleri ve yumuşak bir pad. Kesintisiz döngü olacak şekilde üretilir
(yankı da dairesel uygulanır, döngünün sonu başına bağlanır). Çıktı: assets/muzik/fon.mp3
Kullanım: python3 tools/muzik.py assets/muzik/fon.mp3"""
import subprocess, sys, wave
import numpy as np

SR = 44100
BPM = 66
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

def hz(n):  # MIDI nota → frekans
    return 440 * 2 ** ((n - 69) / 12)

# Am – F – C – G, ardından Dm – Am – F – E (ilk dört ölçü tekrar edilerek 16 ölçü)
CH = {
    "Am": [57, 60, 64], "F": [53, 57, 60], "C": [48, 52, 55], "G": [55, 59, 62],
    "Dm": [50, 53, 57], "E": [52, 56, 59], "Em": [52, 55, 59],
}
PROG = ["Am", "F", "C", "G", "Am", "F", "C", "Em", "Dm", "Am", "F", "C", "Dm", "Am", "F", "E"]
N = int(len(PROG) * BAR * SR)
out = np.zeros(N)
t_all = np.arange(N) / SR

def add(sig, start):
    i = int(start * SR) % N
    end = i + len(sig)
    if end <= N:
        out[i:end] += sig
    else:  # döngünün başına sar
        k = N - i
        out[i:] += sig[:k]
        out[: end - N] += sig[k:]

def piano(f, dur, vel):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.42), (3, 0.18), (4, 0.09), (5, 0.04)):
        s += a * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k * k)) * np.exp(-t * (1.6 + 0.9 * k))
    att = np.minimum(1, t / 0.006)
    return vel * s * att

def pad(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = hz(f + det / 1.0)
            s += np.sin(2 * np.pi * ff * t) + 0.25 * np.sin(2 * np.pi * 2 * ff * t)
    env = np.minimum(1, t / 1.4) * np.minimum(1, (dur - t) / 1.4).clip(0, 1)
    return s * env / (len(freqs) * 3)

for b, name in enumerate(PROG):
    notes = CH[name]
    st = b * BAR
    # pad: akorun bir oktav altı ve kökü
    add(pad([notes[0] - 12, notes[1] - 12, notes[2] - 12], BAR + 1.2) * 0.13, st - 0.3)
    # bas: kök nota, yumuşak
    add(piano(hz(notes[0] - 24), BAR, 0.20), st)
    # arpej: 8'lik notalar, yukarı-aşağı; her ikinci turda bir oktav yukarı tepe
    pattern = [0, 1, 2, 1, 0 + 12 - 12, 2, 1 + 12, 2]
    seq = [notes[0], notes[1], notes[2], notes[1] + 12 if b % 2 else notes[2], notes[0] + 12, notes[2], notes[1], notes[2]]
    for i, n in enumerate(seq):
        tt = st + i * BEAT / 2 + rng.normal(0, 0.008)
        vel = 0.16 * (1.0 if i % 4 == 0 else 0.72) * rng.uniform(0.88, 1.05)
        add(piano(hz(n), BEAT * 3, vel), tt)
    # ara sıra tek bir yüksek nota (melodi kırıntısı)
    if b % 4 == 3:
        add(piano(hz(notes[2] + 12), BAR, 0.08), st + BEAT * 2.5)

# dairesel yankı: üstel sönümlü gürültü, FFT ile döngü üzerinde konvolüsyon
L = int(2.4 * SR)
tt = np.arange(L) / SR
ir = rng.normal(0, 1, L) * np.exp(-tt * 2.6)
ir[0] = 0
ir /= np.sqrt((ir ** 2).sum())
irp = np.zeros(N); irp[:L] = ir
wet = np.fft.irfft(np.fft.rfft(out) * np.fft.rfft(irp), N)
mix = out * 0.75 + wet * 0.45
# hafif alçak geçiren süzgeç (yumuşak tını)
F = np.fft.rfft(mix)
fr = np.fft.rfftfreq(N, 1 / SR)
F *= 1 / (1 + (fr / 3800) ** 2)
mix = np.fft.irfft(F, N)
mix = mix / np.abs(mix).max() * 0.55
st = np.stack([mix, np.roll(mix, int(0.011 * SR))], 1)  # hafif stereo genişlik
pcm = (st * 32767).astype(np.int16)

dst = sys.argv[1]
tmp = dst + ".wav"
with wave.open(tmp, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libmp3lame", "-b:a", "96k", dst], check=True)
import os; os.remove(tmp)
print(dst, round(N / SR, 1), "sn")
