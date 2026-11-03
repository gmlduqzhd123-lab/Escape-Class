// "쉬운 말" mode: the same screens with shorter, everyday words for younger or
// struggling readers. It rewrites text between tags only, so IDs, data-values
// and asset paths stay exactly as the game logic expects.
export const PLAIN_WORDS: [string, string][] = [
  ["조작 안내", "누르는 방법"],
  ["조작 연습", "눌러 보기 연습"],
  ["조작", "누르기"],
  ["탐색 도구", "둘러보기 도구"],
  ["탐색", "둘러보기"],
  ["조사한 내용", "살펴본 것"],
  ["조사", "살펴보기"],
  ["추측", "짐작"],
  ["조합판", "조각 맞추는 판"],
  ["암호판", "비밀번호 판"],
  ["연결망", "연결 그림"],
  ["가상 친구", "이야기 속 친구"],
  ["가상 상황", "이야기 속 상황"],
  ["가상", "이야기 속"],
  ["확정 점수", "마지막 점수"],
  ["성찰", "되돌아보기"],
  ["도움 요청", "도움 부탁"],
  ["기호 순서", "모양 순서"],
  ["기호", "모양"],
  ["일시정지", "잠깐 멈춤"],
  ["재개", "다시 하기"],
  ["협동 단서", "힘 모으기 단서"],
  ["협동", "힘 모으기"],
  ["역할", "맡은 일"],
  ["필수 퍼즐", "꼭 풀 퍼즐"],
  ["추가 단서", "덤 단서"],
  ["선택 활동", "해도 되고 안 해도 되는 활동"],
  ["획득", "얻기"],
];
// One short "what to do now" line per object, shown above the device.
export const PLAIN_TIPS: Record<string, string> = {
  O01: "안내판을 읽어요. 모양 다섯 개의 순서를 기억해요.",
  O02: "토끼가 직접 한 말이 적힌 메모를 골라요.",
  O03: "쪽지를 읽어요. 토끼가 무엇을 바라는지 봐요.",
  O04: "렌즈를 올리고, 창에 보이는 숫자를 차례로 눌러요.",
  O05: "사물함을 살펴봐요. 쓰기 전에 물어봐요.",
  O06: "함께 쓰는 렌즈를 가방에 넣어요.",
  O07: "친구 네 명을 모두 지나는 길을 만들어요.",
  O08: "사진 보내기는 끄고, 도움 부탁은 켜요.",
  O09: "복도로 가서 선생님을 찾아요.",
  O10: "두 그림에서 같은 모양을 찾아요.",
  O11: "열쇠가 숨어 있는지 살펴봐요.",
  O12: "조각 다섯 개를 순서대로 놓고, 열쇠로 문을 열어요.",
};
const pairs = [...PLAIN_WORDS].sort((a, b) => b[0].length - a[0].length);
const pattern = new RegExp(
  pairs.map(([a]) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g",
);
export function plainText(text: string) {
  return text.replace(pattern, (m) => pairs.find(([a]) => a === m)![1]);
}
export function plainLanguage(html: string) {
  // Only the text between tags changes; attributes keep their values.
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") ? part : plainText(part)))
    .join("");
}
