// Optional read-aloud: the browser's own Korean voice reads clues and feedback.
// Nothing is sent anywhere; when the browser has no speech engine the option is hidden.
export function speechAvailable() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}
export function stopSpeaking() {
  if (speechAvailable()) speechSynthesis.cancel();
}
export function speak(text: string) {
  const words = text.replace(/\s+/g, " ").trim().slice(0, 800);
  if (!speechAvailable() || !words) return false;
  speechSynthesis.cancel();
  const say = new SpeechSynthesisUtterance(words);
  say.lang = "ko-KR";
  say.rate = 0.95;
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("ko"));
  if (voice) say.voice = voice;
  speechSynthesis.speak(say);
  return true;
}
// Reads what a child would read on screen: headings, sentences and notes, not button labels.
export function readableText(...parts: (Element | null | undefined)[]) {
  return parts
    .filter((el): el is Element => !!el)
    .map((el) => {
      const copy = el.cloneNode(true) as Element;
      copy
        .querySelectorAll(
          "button, svg, input, select, textarea, [aria-hidden='true'], [hidden], .sr-only, details:not([open]) > :not(summary)",
        )
        .forEach((x) => x.remove());
      return copy.textContent ?? "";
    })
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
}
export const readAloudButton = (where: "panel" | "dialog") =>
  `<button type="button" class="read-aloud" data-action="read-aloud" data-value="${where}" aria-label="화면 글 소리 내어 읽어 주기"><span aria-hidden="true">🔊</span> 읽어 주기</button>`;
