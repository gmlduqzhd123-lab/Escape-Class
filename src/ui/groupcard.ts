import type { ViewContext } from "./views";
import { button as b } from "./helpers";
import { MAX_GROUP } from "../tools/classboard";

/** Group number picker and save button, on the result and progress screens. */
export function groupCardSection(
  c: ViewContext,
  heading: string,
  note: string,
) {
  return `<section class="surface no-print group-card"><h2>${heading}</h2><p>${note}</p><div class="group-picker" role="group" aria-label="모둠 번호">${Array.from(
    { length: MAX_GROUP },
    (_, i) =>
      b(
        `${i + 1}모둠`,
        "group-number",
        String(i + 1),
        `aria-pressed="${c.groupNumber === i + 1}"`,
      ),
  ).join(
    "",
  )}</div>${b("모둠 기록 카드 저장", "group-card", "", `class="primary" ${c.groupNumber ? "" : "disabled"}`)}</section>`;
}
