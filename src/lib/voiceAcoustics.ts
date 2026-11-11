// Frame-level acoustic features for a recorded voice turn, computed in the
// browser so raw audio never needs a second trip anywhere: the backend's
// Confident Delivery analysis (phamlab convex/lib/deliveryTurn.ts) only
// receives these frames alongside the audio it already transcribes.
//
// Per 10 ms frame: RMS level in dBFS, and F0 (pitch) in Hz via YIN
// (de Cheveigné & Kawahara, 2002), 0 when unvoiced. Audio is decoded at
// 8 kHz — plenty for speech pitch (65–500 Hz) and ~4x cheaper than 16 kHz.

export const HOP_MS = 10;
const WINDOW_MS = 30;
const DECODE_RATE = 8000;
const MIN_F0_HZ = 65;
const MAX_F0_HZ = 500;
const YIN_THRESHOLD = 0.15;
// Pitch is only tracked on frames within this many dB of the recording's
// loud end (95th percentile) — skips silence, which is most of the cost.
const PITCH_GATE_DB = 35;

export interface TurnAcoustics {
  hopMs: number;
  frames: ArrayBuffer; // interleaved Float32 [dBFS, F0 Hz] per frame
}

/** Decode a recording and extract frame features; undefined if the browser can't decode it. */
export async function extractAcoustics(blob: Blob): Promise<TurnAcoustics | undefined> {
  try {
    // decodeAudioData resamples to the context's rate.
    const decoded = await new OfflineAudioContext(1, 1, DECODE_RATE).decodeAudioData(await blob.arrayBuffer());
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
    }
    return { hopMs: HOP_MS, frames: analyzeSamples(mono, decoded.sampleRate).buffer as ArrayBuffer };
  } catch {
    return undefined;
  }
}

export function analyzeSamples(samples: Float32Array, sampleRate: number): Float32Array {
  const hop = Math.round((sampleRate * HOP_MS) / 1000);
  const window = Math.round((sampleRate * WINDOW_MS) / 1000);
  const count = Math.ceil(samples.length / hop);
  const out = new Float32Array(count * 2);

  for (let f = 0; f < count; f++) {
    const start = f * hop, end = Math.min(samples.length, start + window);
    let energy = 0;
    for (let i = start; i < end; i++) energy += samples[i] * samples[i];
    out[2 * f] = Math.max(-120, Math.min(0, 10 * Math.log10(energy / Math.max(1, end - start) + 1e-12)));
  }

  const levels = Array.from({ length: count }, (_, f) => out[2 * f]).sort((a, b) => a - b);
  const gate = levels[Math.floor(0.95 * (count - 1))] - PITCH_GATE_DB;
  const tauMin = Math.floor(sampleRate / MAX_F0_HZ);
  const tauMax = Math.ceil(sampleRate / MIN_F0_HZ);
  const diff = new Float64Array(tauMax + 2);
  for (let f = 0; f < count; f++) {
    const start = f * hop;
    if (out[2 * f] < gate || start + window + tauMax + 1 > samples.length) continue;
    out[2 * f + 1] = yin(samples, start, window, tauMin, tauMax, sampleRate, diff);
  }
  return out;
}

function yin(x: Float32Array, start: number, window: number, tauMin: number, tauMax: number, sampleRate: number, d: Float64Array): number {
  // Difference function, then cumulative-mean normalization (YIN steps 2–3).
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let j = start; j < start + window; j++) {
      const delta = x[j] - x[j + tau];
      sum += delta * delta;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
  }
  // Absolute threshold: first dip below it, followed to its local minimum (step 4).
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (d[tau] >= YIN_THRESHOLD) continue;
    while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
    // Parabolic interpolation around the minimum (step 5).
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const shift = a + c - 2 * b !== 0 ? (a - c) / (2 * (a + c - 2 * b)) : 0;
    const hz = sampleRate / (tau + Math.max(-1, Math.min(1, shift)));
    return hz >= MIN_F0_HZ && hz <= MAX_F0_HZ ? hz : 0;
  }
  return 0;
}

/**
 * Peak amplitude per waveform bar for samples `from`–`to` seconds, normalized
 * to the loudest bar so quiet recordings stay readable (relative shape, not
 * absolute volume).
 */
export function clipPeaks(samples: Float32Array, sampleRate: number, from: number, to: number, bars: number): number[] {
  const start = Math.floor(from * sampleRate);
  const end = Math.min(samples.length, Math.ceil(to * sampleRate));
  const step = Math.max(1, (end - start) / bars);
  const peaks = Array.from({ length: bars }, (_, bar) => {
    let peak = 0;
    for (let i = Math.floor(start + bar * step); i < Math.min(end, start + (bar + 1) * step); i++) peak = Math.max(peak, Math.abs(samples[i]));
    return peak;
  });
  const loudest = Math.max(...peaks) || 1;
  return peaks.map((p) => p / loudest);
}
