"""The reel's own music: a light groove in G major, synthesized (no samples, no rights to clear).

Usage: python music.py timeline.json out.wav
The Zumda sound (G5 then D6 on a soft bell, as in packages/app/src/lib/sound.ts) rings when each
role is done and twice on the closing logo; taps tick softly, messages pop. The timeline comes
from stage.html (`window.TIMELINE`, saved by render.mjs).
"""
import json
import sys
import wave

import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

timeline = json.load(open(sys.argv[1]))
DUR = timeline["duration"] + 1.0
N = int(DUR * SR)
L = np.zeros(N)
R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i + len(sig) <= 0:
        return
    j = min(N, i + len(sig))
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan))
    R[i:j] += s * np.sqrt(0.5 * (1 + pan))


def tvec(length):
    return np.arange(int(length * SR)) / SR


def smooth(x, k):
    kernel = np.ones(k) / k
    return np.convolve(x, kernel, mode="same")


# Chords, one a bar: Gadd9, D/F#, Em7, Cmaj7
PADS = [[55, 59, 62, 69], [54, 57, 62, 66], [52, 59, 62, 67], [48, 55, 59, 64]]
BASS = [43, 42, 40, 36]
ARPS = [[67, 71, 74, 79], [66, 69, 74, 78], [64, 67, 71, 76], [64, 67, 72, 76]]
ARP_ORDER = [0, 2, 1, 3, 2, 1, 3, 2]


def pad_note(m, length):
    t = tvec(length)
    f = hz(m)
    s = np.zeros_like(t)
    for det in (-0.004, 0.004):
        for n in range(1, 7):
            s += np.sin(2 * np.pi * f * (1 + det) * n * t + n) / (n ** 1.6)
    env = np.minimum(1, t / 0.5) * np.minimum(1, (length - t) / 0.6)
    return s * env * 0.05


def pluck(m, length=0.9):
    t = tvec(length)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 9)
    s += 0.08 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 22)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 4.2)
    return s * env * 0.11


def bass(m, length):
    t = tvec(length)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / 0.01) * np.minimum(1, (length - t) / 0.05) * (0.75 + 0.25 * np.exp(-t * 6))
    return s * env * 0.16


def kick():
    t = tvec(0.4)
    f = 48 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 8.5) * 0.55


def noise(length):
    return rng.standard_normal(int(length * SR))


def clap():
    t = tvec(0.3)
    n = noise(0.3)
    n = n - smooth(n, 6)
    env = np.exp(-t * 20)
    for d in (0.0, 0.011, 0.022):
        env += 0.5 * np.exp(-np.maximum(0, t - d) * 90) * (t >= d)
    body = 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (n * 0.5 + body) * env * 0.16


def hat(length=0.06, decay=70):
    t = tvec(length)
    n = noise(length)
    n = n - smooth(n, 3)
    return n * np.exp(-t * decay) * 0.05


def shaker():
    t = tvec(0.12)
    n = noise(0.12)
    n = n - smooth(n, 4)
    return n * np.sin(np.pi * np.minimum(1, t / 0.12)) * 0.035


def riser(length):
    t = tvec(length)
    n = noise(length)
    out = np.zeros_like(n)
    # Brighter as it rises: less smoothing toward the end, in four pieces.
    pieces = np.array_split(np.arange(len(n)), 4)
    for k, idx in enumerate(pieces):
        out[idx] = smooth(n, 24 - 5 * k)[idx]
    return out * (t / length) ** 2.2 * 0.07


def crash():
    t = tvec(2.2)
    n = noise(2.2)
    n = n - smooth(n, 3)
    return n * np.exp(-t * 2.4) * 0.05


def bell(f, length, volume):
    t = tvec(length + 0.05)
    s = np.zeros_like(t)
    for ratio, level, decay in ((1, 1, 4.5), (2.76, 0.35, 13.5), (5.4, 0.2, 22.5)):
        s += level * np.sin(2 * np.pi * f * ratio * t) * np.exp(-decay * t)
    return s * np.minimum(1, t / 0.006) * volume


def zumda(at, volume):
    add(bell(783.99, 0.9, volume), at, 1, -0.1)
    add(bell(1174.66, 1.4, volume), at + 0.16, 1, 0.1)


def tick():
    t = tvec(0.03)
    return np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 180) * 0.05


def pop(up):
    t = tvec(0.09)
    f = (700 if up else 900) + (500 if up else 300) * t / 0.09
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.09) * 0.035


roles = timeline["roles"]
outro = timeline["outro"]
groove_from = roles[0]["card"]
groove_to = outro

# Music: bars from 0 to the end of the outro.
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    at = b * BAR
    c = b % 4
    for m in PADS[c]:
        add(pad_note(m, BAR + 0.6), at, 1.0, rng.uniform(-0.4, 0.4))
    in_outro = at >= groove_to
    if in_outro and at > groove_to + BAR:
        continue
    for k in range(8):
        tt = at + k * BEAT / 2 + (0.018 if k % 2 else 0)
        level = 0.55 if at < groove_from else 1.0
        add(pluck(ARPS[c][ARP_ORDER[k]]), tt, level * (1.0 if k % 2 == 0 else 0.7), -0.35 if k % 2 == 0 else 0.35)
    if at < groove_from or in_outro:
        continue
    # Groove
    for beat, length in ((0, 1.4), (1.5, 0.45), (2, 0.9), (3.5, 0.45)):
        add(bass(BASS[c], length * BEAT), at + beat * BEAT, 1.0)
    for beat in (0, 1.5, 2):
        add(kick(), at + beat * BEAT, 1.0)
    for beat in (1, 3):
        add(clap(), at + beat * BEAT, 1.0, 0.1)
    for k in range(8):
        add(hat(), at + k * BEAT / 2 + (0.018 if k % 2 else 0), 1.0 if k % 2 else 0.6, 0.45)
    for k in range(4):
        add(shaker(), at + (k + 0.75) * BEAT, 1.0, -0.4)

# Every role card: a swell into it and a soft cymbal on it.
for r in roles:
    add(riser(BAR), r["card"] - BAR, 1.0)
    add(crash(), r["card"], 1.0, 0.2)
add(riser(BAR), outro - BAR, 1.0)
add(crash(), outro, 1.0, -0.2)

# The Zumda sound when each role is done, and twice on the closing logo.
msgs = timeline["messages"]
done = timeline["done"]
for at in done:
    zumda(at, 0.16)
zumda(outro + 0.25, 0.24)
zumda(outro + 0.25 + 1.06 + 0.25, 0.24)

for at in timeline["taps"]:
    add(tick(), at, 1.0, 0.0)
for m in msgs:
    add(pop(m["out"]), m["at"], 1.0, 0.2 if m["out"] else -0.2)

# Room: a short decaying noise impulse.
ir_t = tvec(1.1)
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4.5)
ir = ir - smooth(ir, 8) * 0.5
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + len(ir))))
IR = np.fft.rfft(ir, size)


def verb(x):
    return np.fft.irfft(np.fft.rfft(x, size) * IR, size)[:N]


L2 = L + 0.22 * verb(L)
R2 = R + 0.22 * verb(R)

# Fades and level
t = np.arange(N) / SR
fade = np.minimum(1, t / 1.2) * np.clip((DUR - t) / 2.6, 0, 1)
L2 *= fade
R2 *= fade
peak = max(np.max(np.abs(L2)), np.max(np.abs(R2)))
L2 = np.tanh(1.3 * L2 / peak) / np.tanh(1.3) * 0.89
R2 = np.tanh(1.3 * R2 / peak) / np.tanh(1.3) * 0.89

pcm = (np.stack([L2, R2], axis=1) * 32767).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("music", round(DUR, 2), "s, done at", [round(x, 2) for x in done])
