import { usePreferences } from "./preferences";

let context: AudioContext | null = null;

/** A short two-note chime, synthesized so no sound file is downloaded. */
export function chime() {
  if (!usePreferences.getState().sounds || typeof AudioContext === "undefined") return;
  context ??= new AudioContext();
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
