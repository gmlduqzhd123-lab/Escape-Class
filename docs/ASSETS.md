# 자산 출처와 라이선스

모든 런타임 자산은 배포 파일에 포함됩니다. 외부 CDN·광고·분석·웹폰트 서비스에서 자산을 불러오지 않습니다.

| 자산                                  | 제작·원본                                                   | 권한·라이선스                             |
| ------------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `public/assets/classroom.svg`         | 이 프로젝트에서 직접 작성한 교실 벡터 그림                  | CC0-1.0                                   |
| `public/assets/library.svg`           | 교실 그림의 물건 배치를 그대로 두고 직접 작성한 도서관 그림 | CC0-1.0                                   |
| `public/assets/gym.svg`               | 교실 그림의 물건 배치를 그대로 두고 직접 작성한 체육관 그림 | CC0-1.0                                   |
| `public/assets/key.svg`               | 직접 작성한 열쇠 아이콘                                     | CC0-1.0                                   |
| `src/ui/helpers.ts`의 동물·아이콘 SVG | 직접 작성한 토끼·곰·여우·다람쥐 및 선 아이콘                | CC0-1.0                                   |
| `public/assets/chime.wav`             | 사인파 659.25Hz와 987.77Hz를 합성한 약 0.42초 효과음        | CC0-1.0; 기본 소리 끄기                   |
| `src/assets/classroom-font.woff2`     | Google Fonts Noto Sans KR 가변 글꼴의 한글·앱 문자 부분집합 | SIL Open Font License 1.1                 |
| 이야기·퍼즐·문장·힌트                 | 사용자 제공 사양을 구현 데이터로 구성                       | 사용자 제공 콘텐츠; 외부 저작물 수집 없음 |

글꼴 원본은 [Google Fonts의 Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr)이며 저작권은 `(c) 2014-2021 Adobe`입니다. 원본의 [OFL 안내](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt)를 `public/licenses/NotoSansKR-OFL.txt`에 함께 포함했습니다.

글꼴은 FontTools로 WOFF2 변환·부분집합화했으며, 수정본 내부 글꼴 이름은 **Classroom Hangul**입니다. 원본의 저작권·라이선스 정보를 유지했습니다. 가변 두께 100~900과 한글 완성형 U+AC00~U+D7A3, ASCII 및 앱에 쓰는 기타 문자를 포함합니다. 포함되지 않은 문자는 운영체제 글꼴을 대체로 사용합니다.

직접 제작한 그림·아이콘·효과음은 [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)으로 제공합니다. 글꼴과 사용자 제공 교육 콘텐츠에는 이 CC0 선언이 적용되지 않습니다.
