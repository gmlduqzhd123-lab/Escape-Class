// Each story is a vocabulary (terms) plus a short list of sentences that have no
// classroom counterpart. adaptEpisodeHtml() builds the shared swaps from the terms,
// so a new story needs its terms and objects, not a copy of every sentence.
export type EpisodeTerms = {
  gone: string; // the opening cry: "우정 열쇠가 사라졌어요!"
  festival: string;
  rabbit: string; // who waits at the window
  wish: string; // the rabbit's own words on the note
  need: string; // what the rabbit asks for ("만드는 방법")
  alone: string; // "혼자만 만들고"
  piece: string; // the five "우정" pieces
  routeBoard: string; // the floor board's name ("우정 공")
  route: string; // "공의 길"
  routeStart: string; // "공 굴리기"
  routeRunning: string; // "공이 가는 중"
  carry: string; // what is passed along the route ("공")
  goal: string; // "골대"
  play: string; // "공놀이"
  basketSide: string; // where the note is ("바구니 옆")
  desk: string; // the cipher desk ("그림 책상")
  keyStand: string; // where the key hides ("창가 둥근 화분 받침")
  banner: string; // the home screen's English strip
  escaped: string; // the escape toast
};
export const EPISODES = {
  classroom: {
    id: "classroom",
    shell: "classroom",
    coopSequence: ["별", "하트", "원"],
    coopDigits: { 별: "4", 하트: "2", 원: "6" } as Record<string, string>,
    label: "EP.01",
    title: "사라진 우정 열쇠",
    room: "교실",
    picture: "나무 책상과 햇살이 비치는 교실. 물건을 눌러 살펴볼 수 있어요.",
    intro:
      "친구사랑 축제의 마지막 활동! 함께 장치를 풀고 사라진 열쇠를 찾아요.",
    objects: {} as Record<string, string>,
    // Story-specific words on the 3D signs, map labels and the friend talk.
    codeShift: 0,
    places: {
      center: "교실 가운데",
      front: "칠판 앞",
      door: "게시판·출구 앞",
      basket: "바구니 옆",
      tablet: "태블릿 앞",
      desk: "그림 책상 앞",
      back: "교실 뒤편",
      books: "책장 앞",
    } as Record<string, string>,
    signs: {
      board: "우리들의 우정 교실",
      festival: "함께 만드는 축제",
      note: "만들고 싶어",
    },
    talk: {
      situation: "토끼가 만드는 방법을 몰라 창가에서 기다리고 있어요.",
      yes: "좋아! 함께하고 싶었어. 먼저 하는 방법을 알려 줄래?",
      need: "만드는 방법을 먼저 알려 주면 좋겠어.",
    },
    terms: {
      gone: "우정 열쇠가 사라졌어요!",
      festival: "친구사랑 축제",
      rabbit: "창가의 토끼",
      wish: "함께 만들고 싶어. 만드는 방법을 먼저 알려 주면 좋겠어.",
      need: "만드는 방법",
      alone: "혼자만 만들고",
      piece: "우정",
      routeBoard: "우정 공",
      route: "공의 길",
      routeStart: "공 굴리기",
      routeRunning: "공이 가는 중",
      carry: "공",
      goal: "골대",
      play: "공놀이",
      basketSide: "바구니 옆",
      desk: "그림 책상",
      keyStand: "창가 둥근 화분 받침",
      banner: "FRIENDSHIP CLASSROOM <small>01",
      escaped: "우리의 우정으로 교실 탈출 성공!",
    },
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
    picture:
      "낮은 책장과 둥근 읽기 깔개가 있는 도서관. 물건을 눌러 살펴볼 수 있어요.",
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
    codeShift: 0,
    places: {
      basket: "반납함 옆",
      tablet: "태블릿 앞",
      desk: "독서대 앞",
      books: "책장 앞",
    } as Record<string, string>,
    signs: {
      board: "함께 읽는 도서관",
      festival: "함께 읽는 축제",
      note: "읽고 싶어",
    },
    talk: {
      situation: "토끼가 읽을 부분을 몰라 책 옆에서 기다리고 있어요.",
      yes: "좋아! 함께하고 싶었어. 먼저 하는 방법을 알려 줄래?",
      need: "내가 읽을 부분을 알려 주면 좋겠어.",
    },
    terms: {
      gone: "함께읽기 책갈피가 사라졌어요!",
      festival: "도서관 읽기 축제",
      rabbit: "창가의 독서 친구",
      wish: "함께 읽고 싶어. 읽을 부분을 먼저 알려 주면 좋겠어.",
      need: "읽을 부분",
      alone: "혼자만 읽고",
      piece: "책갈피",
      routeBoard: "책 나눔 길",
      route: "책 전달 길",
      routeStart: "책 전달하기",
      routeRunning: "책을 전하는 중",
      carry: "책",
      goal: "도착점",
      play: "함께 읽기",
      basketSide: "반납함 옆",
      desk: "독서대",
      keyStand: "창가 화분 받침",
      banner: "READING LIBRARY <small>02",
      escaped: "우리의 마음으로 도서관 탈출 성공!",
    },
    replacements: [
      [
        "교실의 장치를 풀면 다섯 개의 우정 조각을 얻을 수 있어요. 조각을 연결해 마지막 열쇠가 숨겨진 곳을 찾아요.",
        "도서관의 장치를 풀면 책갈피 조각 다섯 개를 얻어요. 책갈피의 지도를 완성해 마지막 열쇠를 찾아요.",
      ],
      ["좌우 버튼으로 교실을 둘러봐요.", "좌우 버튼으로 도서관을 둘러봐요."],
      ["함께 만들고", "함께 읽고"],
      ["놀이 방법을 알려 줄게", "읽는 방법을 알려 줄게"],
    ] as [string, string][],
  },
  gym: {
    id: "gym",
    shell: "gym",
    label: "EP.03",
    title: "사라진 응원 깃발",
    room: "체육관",
    picture:
      "코트 선과 이어달리기 트랙이 있는 체육관. 물건을 눌러 살펴볼 수 있어요.",
    intro:
      "체육관의 응원 깃발이 사라졌어요. 차례를 나누고 공정한 팀을 만들어 함께 응원해요.",
    coopSequence: ["하트", "원", "별"],
    coopDigits: { 별: "3", 하트: "5", 원: "8" } as Record<string, string>,
    objects: {
      O01: "응원 안내판",
      O02: "차례 게시판",
      O03: "벤치 옆 쪽지",
      O04: "기록대 암호판",
      O05: "운동 사물함",
      O06: "공용 운동 도구함",
      O07: "모두의 이어달리기",
      O08: "공정한 팀 계획판",
      O09: "안전 도움 지도",
      O10: "응원 자료함",
      O11: "둥근 깃발 받침",
      O12: "체육관 출구",
    } as Record<string, string>,
    codeShift: 8,
    places: {
      basket: "벤치 옆",
      tablet: "계획판 앞",
      desk: "기록대 앞",
      books: "응원 자료함 앞",
    } as Record<string, string>,
    signs: {
      board: "모두 함께 뛰는 체육관",
      festival: "함께 뛰는 축제",
      note: "함께 뛰고 싶어",
    },
    talk: {
      situation: "토끼가 체육관 벤치에서 자기 차례를 기다리고 있어요.",
      yes: "좋아! 나도 한 번씩 뛰고 싶어.",
      need: "내 차례가 언제인지 알려 주면 좋겠어.",
    },
    terms: {
      gone: "응원 깃발이 사라졌어요!",
      festival: "함께 뛰는 운동 축제",
      rabbit: "차례를 기다리는 토끼",
      wish: "나도 함께 뛰고 싶어. 내 차례를 알려 주면 좋겠어.",
      need: "자기 차례",
      alone: "혼자만 뛰고",
      piece: "응원",
      routeBoard: "모두의 이어달리기",
      route: "모두가 뛰는 길",
      routeStart: "이어달리기 시작",
      routeRunning: "이어달리기 중",
      carry: "바통",
      goal: "도착점",
      play: "이어달리기",
      basketSide: "벤치 옆",
      desk: "기록대",
      keyStand: "둥근 깃발 받침",
      banner: "FAIR PLAY GYM <small>03",
      escaped: "우리의 응원으로 체육관 탈출 성공!",
    },
    replacements: [
      ["안내 그림", "차례표 그림"],
      [
        "사진은 멈추고, 도움은 어른에게 이어 줘요.",
        "네 친구가 한 번씩 참여하는 공정한 팀을 골라요.",
      ],
      ["도움 연결망", "공정한 팀"],
      [
        "토끼가 창가 책상에 앉아 있어요.",
        "토끼가 벤치에서 자기 차례를 기다려요.",
      ],
      ["모두에게 닿는 우정 공", "모두가 함께 뛰는 이어달리기"],
      [
        "교실 태블릿이 켜졌어요. 두 연결망을 살펴봐요.",
        "팀 계획판이 열렸어요. 네 친구가 공평하게 참여하는 팀을 골라요.",
      ],
      ["창가 / 둥근 / 화분 / 받침 / 아래", "창가 / 둥근 / 깃발 / 받침 / 아래"],
      ["화분", "깃발"],
      // Gym has no photo puzzle; its pledge and reflection follow fair teams instead.
      [
        "사진을 보내기 전에 친구에게 확인할게요.",
        "팀을 나눌 때 모두에게 같은 기회를 줄게요.",
      ],
      [
        "사진을 보내기 전에 확인할래요.",
        "팀을 나눌 때 모두에게 기회를 줄래요.",
      ],
      ["네 친구를 모두 만나는 공의 길", "네 친구가 모두 뛰는 길"],
      [
        "가상 친구의 사진 전달망과 도움 요청망을 따로 조절할 수 있어요.",
        "네 친구가 공평하게 참여하는 팀 계획을 고를 수 있어요.",
      ],
    ] as [string, string][],
  },
  cafeteria: {
    id: "cafeteria",
    shell: "cafeteria",
    label: "EP.04",
    title: "사라진 나눔 숟가락",
    room: "급식실",
    picture: "긴 식탁과 배식대가 있는 급식실. 물건을 눌러 살펴볼 수 있어요.",
    intro:
      "급식실 나눔 축제의 나눔 숟가락이 사라졌어요. 줄을 함께 서고 자리를 나누며 모두 같이 먹을 방법을 찾아요.",
    coopSequence: ["별", "원", "하트"],
    coopDigits: { 별: "5", 하트: "1", 원: "7" } as Record<string, string>,
    objects: {
      O01: "오늘의 식단표",
      O02: "감사 게시판",
      O03: "배식대 옆 쪽지",
      O04: "수저통 암호판",
      O05: "개인 보관함",
      O06: "공용 정리함",
      O07: "모두의 줄서기 판",
      O08: "급식실 태블릿",
      O09: "도움 안내 지도",
      O10: "식판 선반",
      O11: "창가 화분 받침",
      O12: "급식실 출구",
    } as Record<string, string>,
    codeShift: 5,
    places: {
      front: "식단표 앞",
      basket: "배식대 옆",
      tablet: "태블릿 앞",
      desk: "수저통 앞",
      books: "식판 선반 앞",
    } as Record<string, string>,
    signs: {
      board: "함께 먹는 급식실",
      festival: "함께 나누는 축제",
      note: "같이 앉고 싶어",
    },
    talk: {
      situation: "토끼가 식판을 들고 앉을 자리를 찾고 있어요.",
      yes: "좋아! 같이 앉고 싶었어. 자리를 조금 나눠 줄래?",
      need: "내가 앉을 자리가 있는지 알려 주면 좋겠어.",
    },
    terms: {
      gone: "나눔 숟가락이 사라졌어요!",
      festival: "급식실 나눔 축제",
      rabbit: "식판을 든 토끼",
      wish: "나도 같이 앉고 싶어. 앉을 자리를 먼저 알려 주면 좋겠어.",
      need: "앉을 자리",
      alone: "혼자만 먹고",
      piece: "나눔",
      routeBoard: "모두의 줄서기",
      route: "줄서기 길",
      routeStart: "줄서기 시작",
      routeRunning: "줄을 서는 중",
      carry: "식판",
      goal: "배식대",
      play: "같이 먹기",
      basketSide: "배식대 옆",
      desk: "수저통",
      keyStand: "창가 화분 받침",
      banner: "SHARING CAFETERIA <small>04",
      escaped: "우리의 나눔으로 급식실 탈출 성공!",
    },
    replacements: [
      ["안내 그림", "자리 안내 그림"],
      ["창가 둥근 화분 받침", "창가 화분 받침"],
      [
        "토끼가 창가 책상에 앉아 있어요.",
        "토끼가 식판을 들고 창가 자리를 찾고 있어요.",
      ],
      ["모두에게 닿는 우정 공", "모두가 함께 서는 줄"],
      ["놀이 방법을 알려 줄게", "앉는 방법을 알려 줄게"],
    ] as [string, string][],
  },
} as const;
export type EpisodeId = keyof typeof EPISODES;
export function episode(id: string) {
  return EPISODES[id as EpisodeId] ?? EPISODES.classroom;
}
// Korean object/topic particles follow the final consonant of the word before them.
export function josa(word: string, withFinal: string, without: string) {
  const code = word.charCodeAt(word.length - 1);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return hangul && (code - 0xac00) % 28 ? withFinal : without;
}
function sharedRules(pack: {
  room: string;
  title: string;
  label: string;
  shell: string;
  picture: string;
  objects: Record<string, string>;
  terms: EpisodeTerms;
}): [string, string][] {
  const { room, terms: t } = pack;
  return [
    ["사라진 우정 열쇠", pack.title],
    ["EP.01", pack.label],
    ["우정 열쇠가 사라졌어요!", t.gone],
    ["친구사랑 축제", t.festival],
    ["창가의 토끼", t.rabbit],
    ["함께 만들고 싶어. 만드는 방법을 먼저 알려 주면 좋겠어.", t.wish],
    ["만드는 방법을", `${t.need}${josa(t.need, "을", "를")}`],
    ["만드는 방법", t.need],
    ["혼자만 만들고", t.alone],
    ["우정 조각", `${t.piece} 조각`],
    ["우리의 우정으로 교실 탈출 성공!", t.escaped],
    ["FRIENDSHIP CLASSROOM <small>01", t.banner],
    ["우정 공", t.routeBoard],
    ["공의 길", t.route],
    ["공 굴리기를", `${t.routeStart}${josa(t.routeStart, "을", "를")}`],
    ["공 굴리기", t.routeStart],
    ["공이 가는 중", t.routeRunning],
    ["골대로", `${t.goal}${josa(t.goal, "으로", "로")}`],
    ["골대", t.goal],
    ["공놀이", t.play],
    [
      "아직 공을 받지 못한 친구",
      `아직 ${t.carry}${josa(t.carry, "을", "를")} 받지 못한 친구`,
    ],
    ["네 친구에게 공을", `네 친구에게 ${t.carry}${josa(t.carry, "을", "를")}`],
    ["공 옆 칸", `${t.carry} 옆 칸`],
    ["공용 준비물 바구니 옆 쪽지", pack.objects.O03],
    ["공용 준비물 바구니 옆에", `${t.basketSide}에`],
    ["바구니 옆에서", `${t.basketSide}에서`],
    ["그림 책상 암호판", `${t.desk} 암호판`],
    ["그림 책상을", `${t.desk}${josa(t.desk, "을", "를")}`],
    ["그림 책상 서랍이 열렸어요", `${pack.objects.O04} 서랍이 열렸어요`],
    ["창가 둥근 화분 받침", t.keyStand],
    // Every "교실" that names the room, with the particle the room needs.
    ["가상 교실 방탈출 챌린지", `가상 ${room} 방탈출 챌린지`],
    ["가상 교실 방탈출이에요", `가상 ${room} 방탈출이에요`],
    ["가상 교실의", `가상 ${room}의`],
    ["가상 교실 활동", `가상 ${room} 활동`],
    ["진짜 교실 문은", `진짜 ${room} 문은`],
    ["실제 교실 문을", `실제 ${room} 문을`],
    ["교실을 살펴봐요", `${room}${josa(room, "을", "를")} 살펴봐요`],
    ["교실로 돌아가기", `${room}${josa(room, "으로", "로")} 돌아가기`],
    ["← 교실로", `← ${room}${josa(room, "으로", "로")}`],
    ["지금 교실에 있어요.", `지금 ${room}에 있어요.`],
    ["교실에 도착했어요.", `${room}에 도착했어요.`],
    ["교실에서 다른 단서 찾기", `${room}에서 다른 단서 찾기`],
    ["교실의 장치에서", `${room}의 장치에서`],
    ["교실의 문", `${room}의 문`],
    ["교실 속 물건", `${room} 속 물건`],
    ["교실 탐색", `${room} 탐색`],
    ["교실 뒤편", `${room} 뒤편`],
    ["교실 → 복도", `${room} → 복도`],
    ["교실 물건 목록", `${room} 물건 목록`],
    ["교실 가운데", `${room} 가운데`],
    ["입체 교실로", `입체 ${room}${josa(room, "으로", "로")}`],
    ["그림 교실로", `그림 ${room}${josa(room, "으로", "로")}`],
    ["입체 교실", `입체 ${room}`],
    ["그림 교실", `그림 ${room}`],
    // Each episode has its own picture-mode drawing on the same object layout.
    ["assets/classroom.svg", `assets/${pack.shell}.svg`],
    [
      "나무 책상과 햇살이 비치는 교실. 물건을 눌러 살펴볼 수 있어요.",
      pack.picture,
    ],
  ];
}
export function adaptEpisodeHtml(
  html: string,
  id: EpisodeId,
  names: readonly { id: string; name: string }[],
) {
  if (id === "classroom") return html;
  const pack = episode(id);
  const replacements: [string, string][] = [
    ...names
      .filter((o) => pack.objects[o.id])
      .map((o) => [o.name, pack.objects[o.id]] as [string, string]),
    ...pack.replacements,
    ...sharedRules(pack),
  ];
  // Longest matches first; a story's own sentence wins over a shared rule of the
  // same length. Replacements are authored text, never user HTML.
  const pairs = replacements.sort((a, b) => b[0].length - a[0].length);
  const keys = [...new Set(pairs.map(([a]) => a))].map((a) =>
    a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  return html.replace(
    new RegExp(keys.join("|"), "g"),
    (text) => pairs.find(([a]) => a === text)![1],
  );
}
