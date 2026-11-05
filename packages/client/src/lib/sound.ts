import { usePreferences } from "./preferences";

let context: AudioContext | null = null;

/** The shared context, resumed if the browser left it suspended (Safari and iOS start suspended until a gesture). */
function audioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

// Browsers only allow audio after a gesture; unlocking on the first one lets later chimes (triggered by the network) play.
if (typeof window !== "undefined") {
  const unlock = () => {
    audioContext();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

/** A low rumble of filtered noise for a lightning strike (`strength` 0 to 1), synthesized like the chime. */
export function thunder(strength = 1) {
  if (!usePreferences.getState().sounds) return;
  const context = audioContext();
  if (!context) return;
  const seconds = 2.6;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 180 + strength * 120;
  const gain = context.createGain();
  const start = context.currentTime;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.55 * strength + 0.05, start + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.18 * strength + 0.02, start + 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
}

/** A short two-note chime, synthesized so no sound file is downloaded. */
export function chime() {
  if (!usePreferences.getState().sounds) return;
  const context = audioContext();
  if (!context) return;
  const start = context.currentTime;
  for (const [i, frequency] of [660, 880].entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.2, start + i * 0.15 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.15 + 0.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + i * 0.15);
    oscillator.stop(start + i * 0.15 + 0.45);
  }
}
