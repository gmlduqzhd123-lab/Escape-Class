import { asset } from "../ranking/service";
/** Short synthesized notes; no extra audio files, and only when sound is on. */
export function createSoundPlayer(enabled: () => boolean) {
  let audio: AudioContext | null = null;
  /** Create or wake the audio context inside a tap; iOS keeps it suspended otherwise. */
  function prime() {
    if (!enabled()) return;
    try {
      audio ??= new AudioContext();
      if (audio.state !== "running") void audio.resume();
    } catch {
      // Audio is optional.
    }
  }
  function notes(freqs: number[], step: number) {
    try {
      audio ??= new AudioContext();
      // Contexts are suspended after backgrounding or a screen lock; wake before scheduling.
      if (audio.state !== "running") void audio.resume();
      const start = audio.currentTime + 0.05;
      freqs.forEach((freq, i) => {
        const osc = audio!.createOscillator(),
          gain = audio!.createGain(),
          at = start + i * step;
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + step * 1.8);
        osc.connect(gain).connect(audio!.destination);
        osc.start(at);
        osc.stop(at + step * 2);
      });
    } catch {
      // Audio is optional; every cue is also shown on screen.
    }
  }
  function play(kind: "ok" | "piece" | "escape" = "ok") {
    if (!enabled()) return;
    if (kind === "ok")
      void new Audio(asset("assets/chime.wav")).play().catch(() => {});
    // A friendship piece rises; escaping plays a short bright fanfare.
    if (kind === "piece") notes([523.25, 659.25, 783.99], 0.11);
    if (kind === "escape")
      notes([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.13);
  }
  return { prime, play };
}
