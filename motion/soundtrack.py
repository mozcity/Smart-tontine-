"""Bande son originale de la vidéo Smart Tontine (65 s, 100 BPM), synthétisée : aucun droit d'auteur.

Nappe d'accords, basse, marimba aux accents afro-pop, grosse caisse, shaker, claps,
et un « souffle » à chaque transition de scène. Calée sur le montage de index.html.
    python3 soundtrack.py  → soundtrack.wav
"""
import wave
import numpy as np

SR = 44100
DUR = 65.0
BPM = 100
BEAT = 60 / BPM          # 0,6 s
BAR = 4 * BEAT           # 2,4 s
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)

def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

def add(sig, t, pan=0.0, gain=1.0):
    """Ajoute un signal mono à l'instant t (s), panoramique -1 (gauche) … 1 (droite)."""
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2)

def env(n, attack, release, total):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(attack, 1e-4))
    return e * np.clip((total - t) / max(release, 1e-4), 0, 1)

# Accords (notes MIDI) : constat en mineur, puis progression lumineuse C – G – Am – F.
C, G, Am, F = [48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69]
def chord_at(t):
    if 5.5 <= t < 12.5:
        return [Am, F][int((t - 5.5) // BAR) % 2]
    return [C, G, Am, F][int(t // BAR) % 4]

# ── Nappe : partiels doux, léger désaccord gauche/droite, attaque lente ──
def pad(notes, t, d):
    n = int(d * SR)
    tt = np.arange(n) / SR
    e = env(n, 0.8, 1.2, d)
    for k, m in enumerate(notes):
        f = hz(m + (12 if k == 0 else 0))
        for det, pan in ((-0.0025, -0.6), (0.0025, 0.6)):
            s = np.sin(2 * np.pi * f * (1 + det) * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) + 0.08 * np.sin(2 * np.pi * 3 * f * tt)
            add(s * e, t, pan, 0.026)

t = 0.0
while t < DUR - 0.1:
    d = min(BAR, DUR - t)
    pad(chord_at(t + 0.01), t, d + 0.9)
    t += BAR

# ── Basse : fondamentale, temps 1 et 3 (à partir du constat) ──
def bass(m, t, d=0.5, g=0.12):
    n = int(d * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(m) * tt) + 0.5 * np.sin(2 * np.pi * 2 * hz(m) * tt) + 0.25 * np.sin(2 * np.pi * 3 * hz(m) * tt)
    add(s * np.exp(-tt * 4) * env(n, 0.01, 0.05, d), t, 0, g)

# ── Marimba : fondamentale + 4e partiel, extinction rapide ──
def marimba(m, t, pan, g=0.11):
    d = 0.6; n = int(d * SR); tt = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 7) + 0.35 * np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt * 22)
    add(s * env(n, 0.002, 0.05, d), t, pan, g)

# ── Percussions ──
def kick(t, g=0.30):
    d = 0.4; n = int(d * SR); tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(45 + 80 * np.exp(-tt * 28)) / SR
    add(np.sin(ph) * np.exp(-tt * 8), t, 0, g)

def shaker(t, g=0.05, pan=0.35):
    d = 0.09; n = int(d * SR); tt = np.arange(n) / SR
    s = np.diff(rng.standard_normal(n + 1))           # bruit aigu (dérivée = passe-haut)
    add(s * np.exp(-tt * 45) * env(n, 0.004, 0.02, d), t, pan, g)

def clap(t, g=0.13):
    d = 0.25; n = int(d * SR); tt = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = np.convolve(s, np.ones(6) / 6, mode='same') - np.convolve(s, np.ones(40) / 40, mode='same')  # bande médium
    e = np.exp(-tt * 18) * (1 + 0.6 * np.exp(-((tt - 0.012) ** 2) / 1e-5))
    add(s * e, t, -0.15, g)

def whoosh(t0):
    """Souffle montant qui culmine à t0 (transitions de scène)."""
    d = 1.1; n = int(d * SR); tt = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = np.convolve(s, np.ones(12) / 12, mode='same')
    e = np.where(tt < 0.8, (tt / 0.8) ** 2.5, np.exp(-(tt - 0.8) * 14))
    for pan in (-0.7, 0.7):
        add(s * e, t0 - 0.8, pan, 0.12)

def bell(t, m, g=0.10):
    d = 2.5; n = int(d * SR); tt = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * 2.76 * f * tt) * np.exp(-tt * 3) + 0.25 * np.sin(2 * np.pi * 5.4 * f * tt) * np.exp(-tt * 6)
    add(s * np.exp(-tt * 1.6) * env(n, 0.003, 0.3, d), t, 0, g)

# Ouverture : carillon sur l'apparition du logo et du nom
bell(0.35, 79); bell(1.55, 84, 0.08); bell(2.35, 76, 0.06)

beat = 0
t = 0.0
PATTERN = [(0, 1, -0.4), (3, 2, 0.4), (4, 3, -0.2), (6, 2, 0.3), (7, 1, -0.3)]  # croches jouées, note de l'accord, pan
while t < DUR - 0.05:
    groove = 12.5 <= t < 59
    if t >= 5.5 and t < 61:
        b = int(round(t / BEAT)) % 4
        ch = chord_at(t + 0.01)
        if b in (0, 2):
            bass(ch[0] - 12 if ch[0] > 45 else ch[0], t)
        if groove or (t >= 9.5 and b == 0):
            if b in (0, 2) or (groove and b == 3 and int(t // BAR) % 2):
                kick(t + (0.3 if b == 3 else 0))
        if groove and b in (1, 3) and t >= 20.5:
            clap(t)
    if groove:
        shaker(t, 0.022); shaker(t + BEAT / 2, 0.04)
    if t >= 20.5 and t < 61.5 and int(round(t / BEAT)) % 4 == 0:
        ch = chord_at(t + 0.01)
        for eighth, idx, pan in PATTERN:
            marimba(ch[idx] + 12, t + eighth * BEAT / 2, pan, 0.17 if t < 44 else 0.20)
    t += BEAT

for t0 in (12.5, 29, 44, 59):
    whoosh(t0)

# Final : accord tenu et carillon
bell(59.6, 84, 0.09); bell(60.0, 79, 0.07)
pad(C, 59.0, 6.0)

# ── Mastering : compression douce, normalisation à -1 dBFS, fondus ──
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.6) / 1.6
mix /= np.max(np.abs(mix)) / 0.89
fade_in = np.minimum(1, np.arange(N) / (0.4 * SR))
fade_out = np.clip((DUR - np.arange(N) / SR) / 3.0, 0, 1)
mix *= (fade_in * fade_out)[:, None]
pcm = (mix * 32767).astype('<i2')
with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
rms = np.sqrt(np.mean(mix ** 2))
print(f'soundtrack.wav : {DUR:.0f} s, crête {20*np.log10(np.max(np.abs(mix))):.1f} dBFS, RMS {20*np.log10(rms):.1f} dBFS')
