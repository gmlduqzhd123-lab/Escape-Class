import type { Experience, LessonOptions } from "./learning";
import type { Progress } from "./model";
import { EPISODES } from "../content/episodes";
import { FRIENDS } from "../puzzles/judges";

export type LessonPack = {
  version: 1;
  episode: "classroom" | "library" | "gym";
  title: string;
  intro: string;
  speech: string;
  hints: Record<"P1" | "P2" | "P3" | "P4" | "P5" | "final", string>;
};
export const HINT_KEYS = ["P1", "P2", "P3", "P4", "P5", "final"] as const;
export const escapeLessonText = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function defaultLessonPack(
  episode: LessonPack["episode"] = "classroom",
): LessonPack {
  return {
    version: 1,
    episode,
    title: EPISODES[episode].title,
    intro: EPISODES[episode].intro,
    speech:
      episode === "library"
        ? "함께 읽고 싶어. 읽을 부분을 먼저 알려 주면 좋겠어."
        : episode === "gym"
          ? "나도 함께 뛰고 싶어. 내 차례를 알려 주면 좋겠어."
          : "함께 만들고 싶어. 만드는 방법을 먼저 알려 주면 좋겠어.",
    hints: {
      P1: "친구가 직접 한 말을 확인해요.",
      P2: "렌즈의 위 표시와 창 번호를 살펴봐요.",
      P3: "네 친구를 모두 만나는 길을 찾아요.",
      P4: "모두를 배려하는 연결을 생각해요.",
      P5: "도움을 줄 수 있는 어른에게 말해요.",
      final: "안내판에 적힌 다섯 조각의 순서를 확인해요.",
    },
  };
}
export function validateLessonPack(value: unknown): LessonPack {
  const p = value as LessonPack;
  if (
    !p ||
    p.version !== 1 ||
    !Object.hasOwn(EPISODES, p.episode) ||
    Object.keys(p).sort().join() !== "episode,hints,intro,speech,title,version"
  )
    throw Error("수업 파일 형식이 달라요. 이 화면에서 받은 양식을 사용해요.");
  const text = (v: unknown, max: number) =>
    typeof v === "string" &&
    v.trim().length > 0 &&
    v.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  if (
    !text(p.title, 40) ||
    !text(p.intro, 300) ||
    !text(p.speech, 160) ||
    !p.hints ||
    Object.keys(p.hints).sort().join() !== [...HINT_KEYS].sort().join() ||
    HINT_KEYS.some((k) => !text(p.hints[k], 180))
  )
    throw Error("제목·이야기·대사·힌트의 글자 수와 빈칸을 확인해요.");
  return structuredClone(p);
}
export function parseLessonPack(text: string) {
  if (new TextEncoder().encode(text).length > 16384)
    throw Error("수업 파일은 16KB 이하로 골라요.");
  return validateLessonPack(JSON.parse(text));
}
export function digit(e: Experience | null | undefined, n: number) {
  const shift = e?.options.variation
    ? e.extras.seed
    : e?.options.episode === "gym"
      ? 8
      : 0;
  return (n + (shift ?? 0)) % 10;
}
export function inputDigit(e: Experience | null | undefined, n: string) {
  const shift = digit(e, 0);
  return String((Number(n) - shift + 10) % 10);
}
export function displayCode(e: Experience | null | undefined, code: string) {
  return code.replace(/\d/g, (n) => String(digit(e, Number(n))));
}
export function orderCards<T>(cards: T[], e?: Experience | null) {
  if (!e?.options.variation || cards.length < 2) return cards;
  const hash = (value: T) => {
    let n = e.extras.seed;
    for (const char of JSON.stringify(value))
      n = (Math.imul(n, 31) + char.charCodeAt(0)) | 0;
    return n >>> 0;
  };
  return [...cards].sort((a, b) => hash(a) - hash(b));
}
export const EXPLANATIONS: Record<string, string> = {
  P1: "친구의 마음은 추측보다 직접 한 말을 듣고 확인할 수 있어요.",
  P2: "함께 쓰는 도구도 사용 안내를 읽고, 같은 기준과 순서로 살펴봐요.",
  P3: "빨리 도착하는 것보다 네 친구 모두에게 기회를 나누는 길을 찾았어요.",
  P4: "사진 전달은 멈추고, 도움 요청은 믿을 수 있는 어른에게 이어 줬어요.",
  P5: "도움이 필요하다고 말하고, 편한 방법으로 이야기해도 괜찮아요.",
};
export function diagnose(
  s: Progress,
  e: Experience | null | undefined,
  object: string | null,
) {
  if (object === "O02")
    return !s.discoveredClueIds.includes("P1-C3")
      ? "다른 친구의 추측만으로는 알 수 없어요. 쪽지에서 토끼가 직접 한 말을 찾아요."
      : s.puzzles.p1.order.some((x) => ["P1-C2", "P1-C4"].includes(x))
        ? "고른 메모에 친구의 추측이 섞였어요. 직접 한 말과 그림을 골라요."
        : "시작 ●, 반원, 삼각형, 끝 ●가 이어지는지 살펴봐요.";
  if (object === "O04")
    return !s.puzzles.p2.lensUsed
      ? "먼저 가방의 렌즈를 암호판에 올려요."
      : s.puzzles.p2.rotation !== 0
        ? "숫자보다 먼저 렌즈의 ▲ 표시를 위로 돌려요."
        : `창 1 → 2 → 3 순서예요. 지금 렌즈에는 ${displayCode(e, "713").split("").join(" · ")}이 보여요.`;
  if (object === "O07") {
    const missing = Object.entries(FRIENDS)
      .filter(([n]) => !s.puzzles.p3.path.includes(Number(n)))
      .map(([, name]) => name);
    return missing.length
      ? `아직 ${missing.join("·")}에게 닿지 않았어요. 지나온 칸을 눌러 길을 고칠 수 있어요.`
      : "네 친구를 모두 만났어요. 마지막 깃발까지 길을 잇고 진행 버튼을 눌러요.";
  }
  if (object === "O08")
    return e?.options.episode === "gym"
      ? "두 팀을 합쳐 토끼·여우·곰·다람쥐가 한 번씩만 들어간 계획을 골라요."
      : s.puzzles.p4["photo-1"] || s.puzzles.p4["photo-2"]
        ? "사진이 전달되는 연결이 아직 켜져 있어요. 사진 연결 두 곳을 모두 꺼요."
        : !s.puzzles.p4["help-1"]
          ? "사진은 멈췄어요. 이번에는 친구에게 도움 요청을 연결해요."
          : "친구가 어른 한 분에게 도움을 요청하도록 이어요.";
  if (object === "O09")
    return s.puzzles.p5.place === "담임 자리"
      ? "지금 자리에 없어요. 복도로 돌아가 다른 선생님을 찾아도 괜찮아요."
      : ["교무실", "상담실"].includes(s.puzzles.p5.place)
        ? "도움이 필요한 일을 먼저 말하고, 편한 대화 방법을 골라요."
        : "복도를 거쳐 도움을 줄 수 있는 선생님께 가요.";
  if (object === "O12")
    return "듣기 → 존중 → 함께하기 → 배려 → 도움 순서로 놓아요. 틀린 조각은 눌러 뺄 수 있어요.";
  return "지금 목표에 적힌 물건부터 살펴봐요. 조사한 내용은 단서 노트에 남아요.";
}
export function conversation(e: Experience | null | undefined) {
  const gym = e?.options.episode === "gym",
    library = e?.options.episode === "library";
  return {
    situation: gym
      ? "토끼가 체육관 벤치에서 자기 차례를 기다리고 있어요."
      : library
        ? "토끼가 읽을 부분을 몰라 책 옆에서 기다리고 있어요."
        : "토끼가 만드는 방법을 몰라 창가에서 기다리고 있어요.",
    options: [
      "우리랑 함께할래?",
      "어떤 도움이 필요해?",
      "천천히 해도 괜찮아. 같이 해 보자.",
    ],
    replies: [
      gym
        ? "좋아! 나도 한 번씩 뛰고 싶어."
        : "좋아! 함께하고 싶었어. 먼저 하는 방법을 알려 줄래?",
      library
        ? "내가 읽을 부분을 알려 주면 좋겠어."
        : gym
          ? "내 차례가 언제인지 알려 주면 좋겠어."
          : "만드는 방법을 먼저 알려 주면 좋겠어.",
      "기다려 줘서 고마워. 같이 하면 해볼 수 있을 것 같아.",
    ],
  };
}
export function practiceOptions(o: LessonOptions) {
  return (
    o.variation ||
    o.authored ||
    o.grade === "guided" ||
    o.cooperation ||
    o.episode !== "classroom"
  );
}
