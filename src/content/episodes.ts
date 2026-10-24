export const EPISODES = {
  classroom: {
    id: "classroom",
    shell: "classroom",
    coopSequence: ["별", "하트", "원"],
    coopDigits: { 별: "4", 하트: "2", 원: "6" } as Record<string, string>,
    label: "EP.01",
    title: "사라진 우정 열쇠",
    room: "교실",
    intro:
      "친구사랑 축제의 마지막 활동! 함께 장치를 풀고 사라진 열쇠를 찾아요.",
    objects: {} as Record<string, string>,
    replacements: [] as [string, string][],
  },
  library: {
    id: "library",
    shell: "library",
    coopSequence: ["원", "별", "하트"],
    coopDigits: { 별: "4", 하트: "2", 원: "6" } as Record<string, string>,
    label: "EP.02",
    title: "사라진 함께읽기 책갈피",
    room: "도서관",
    intro:
      "도서관 읽기 축제의 마지막 책갈피가 사라졌어요. 친구의 말을 듣고, 함께 읽을 길을 찾아 문을 열어요.",
    objects: {
      O01: "읽기 안내판",
      O02: "독서 게시판",
      O03: "반납함 옆 쪽지",
      O04: "독서대 암호판",
      O05: "보관 사물함",
      O06: "독서 도구함",
      O07: "책 나눔 놀이판",
      O08: "도서관 태블릿",
      O09: "도움 안내 지도",
      O10: "추천 도서 책장",
      O11: "창가 화분 받침",
      O12: "도서관 출구",
    } as Record<string, string>,
    replacements: [
      ["우정 열쇠가 사라졌어요!", "함께읽기 책갈피가 사라졌어요!"],
      ["가상 교실 방탈출 챌린지", "가상 도서관 방탈출 챌린지"],
      ["가상 교실 방탈출이에요", "가상 도서관 방탈출이에요"],
      [
        "교실의 장치를 풀면 다섯 개의 우정 조각을 얻을 수 있어요. 조각을 연결해 마지막 열쇠가 숨겨진 곳을 찾아요.",
        "도서관의 장치를 풀면 책갈피 조각 다섯 개를 얻어요. 책갈피의 지도를 완성해 마지막 열쇠를 찾아요.",
      ],
      ["좌우 버튼으로 교실을 둘러봐요.", "좌우 버튼으로 도서관을 둘러봐요."],
      [
        "함께 만들고 싶어. 만드는 방법을 먼저 알려 주면 좋겠어.",
        "함께 읽고 싶어. 읽을 부분을 먼저 알려 주면 좋겠어.",
      ],
      ["창가의 토끼", "창가의 독서 친구"],
      ["만드는 방법", "읽을 부분"],
      ["혼자만 만들고", "혼자만 읽고"],
      ["함께 만들고", "함께 읽고"],
      ["친구사랑 축제", "도서관 읽기 축제"],
      ["우정 공", "책 나눔 길"],
      ["공 굴리기", "책 전달하기"],
      ["공의 길", "책 전달 길"],
      ["공이 가는 중", "책을 전하는 중"],
      ["공놀이", "함께 읽기"],
      ["네 친구에게 공을", "네 친구에게 책을"],
      ["바구니 옆에서", "반납함 옆에서"],
      ["그림 책상 암호판", "독서대 암호판"],
      ["그림 책상을", "독서대를"],
      ["← 교실로", "← 도서관으로"],
      ["우정 조각", "책갈피 조각"],
    ] as [string, string][],
  },
} as const;
export type EpisodeId = keyof typeof EPISODES;
export function episode(id: string) {
  return EPISODES[id as EpisodeId] ?? EPISODES.classroom;
}
export function adaptEpisodeHtml(
  html: string,
  id: EpisodeId,
  names: readonly { id: string; name: string }[],
) {
  if (id === "classroom") return html;
  const pack = episode(id);
  const replacements: [string, string][] = [
    ["사라진 우정 열쇠", pack.title],
    ["EP.01", pack.label],
    ...names
      .filter((o) => pack.objects[o.id])
      .map((o) => [o.name, pack.objects[o.id]] as [string, string]),
    ...pack.replacements,
    ["교실을 살펴봐요", "도서관을 살펴봐요"],
    ["교실로 돌아가기", "도서관으로 돌아가기"],
    ["교실 뒤편", "도서관 뒤편"],
    ["교실 가운데", "도서관 가운데"],
  ];
  // Longest matches first; replacements are authored text, never user HTML.
  const pairs = replacements.sort((a, b) => b[0].length - a[0].length);
  const keys = pairs.map(([a]) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return html.replace(
    new RegExp(keys.join("|"), "g"),
    (text) => pairs.find(([a]) => a === text)![1],
  );
}
