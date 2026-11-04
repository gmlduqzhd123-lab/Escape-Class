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
// Shorter hints for "쉬운 말로 보기": one idea per sentence, everyday words.
// They are written for the classroom and adapted per story like the others.
export const PLAIN_HINTS: Record<string, string[]> = {
  P1: [
    "게시판과 바구니 옆 쪽지를 봐요.",
    "토끼가 직접 한 말을 찾아요. 친구의 짐작은 빼요.",
    "창가의 토끼 → 토끼의 직접 이야기 → 안내 그림 순서로 놓아요.",
  ],
  P2: [
    "렌즈를 먼저 찾아요. 공용 도구함에 있어요.",
    "렌즈를 암호판에 올리고 ▲가 위로 오게 돌려요.",
    "창 1 → 2 → 3의 숫자를 차례로 눌러요.",
  ],
  P3: [
    "바닥 놀이판에서 네 친구를 찾아요.",
    "공 옆 칸을 하나씩 눌러 길을 만들어요. 같은 칸은 다시 가지 않아요.",
    "네 친구를 모두 지나 골대까지 가요. 그다음 공 굴리기를 눌러요.",
  ],
  P4: [
    "태블릿에서 사진 줄과 도움 줄을 나눠 봐요.",
    "사진 줄은 끊어요. 도움 줄은 이어요.",
    "도움은 친구를 거쳐 선생님께 닿게 이어요.",
  ],
  P5: [
    "뒤편 도움 지도로 가요.",
    "선생님이 안 계시면 복도로 나와 다른 곳으로 가요.",
    "교무실이나 상담실에서 “도움이 필요한 일이 있어요.”를 먼저 골라요.",
  ],
  final: [
    "칠판에 적힌 조각 순서를 봐요.",
    "듣기 → 존중 → 함께하기 → 배려 → 도움 순서로 눌러요.",
    "창가 둥근 화분 받침 아래에서 열쇠를 찾아 출구를 열어요.",
  ],
};
