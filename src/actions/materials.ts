import type { ViewContext } from "../ui/views";
import { createExperience, practiceCard } from "../game/learning";
import { defaultLessonPack, validateLessonPack } from "../game/advancement";
import {
  DEVICE_CHECKS,
  rolesDocument,
  lessonMaterialsDocument,
} from "../ui/learning";
import { download, openPrint, saveText } from "../ui/files";
import { adaptEpisodeHtml, type EpisodeId } from "../content/episodes";
import { OBJECTS } from "../content/data";

// Teacher-side actions: lesson files, printable materials and the device self-check.
// None of them touch the running game's progress.
export interface MaterialsHost {
  c: ViewContext;
  onPlay: () => boolean;
  render: () => void;
  openModal: (name: string) => void;
  go: (path: string) => void;
}
export function materialsAction(
  action: string,
  value: string,
  host: MaterialsHost,
): boolean {
  const { c } = host;
  // In a game, materials follow its lesson; elsewhere they follow the setup draft.
  // Varied codes are drawn once and kept for the next new game, so cards printed
  // ahead of the lesson match the game the class then plays.
  const lesson = () => {
    if (host.onPlay() && c.learning) return c.learning;
    const e = createExperience(c.lessonDraft, 0, c.draftSeed);
    if (e.options.variation) c.draftSeed = e.extras.seed;
    return e;
  };
  // Printed pages skip the screen's episode wording pass, so apply it here.
  const doc = (html: string, e: { options: { episode: EpisodeId } }) =>
    adaptEpisodeHtml(html, e.options.episode, OBJECTS);
  switch (action) {
    case "author-default":
      c.authorDraft = defaultLessonPack(
        c.authorDraft?.episode ?? c.lessonDraft?.episode ?? "classroom",
      );
      c.authorStatus = "선택한 이야기의 기본 문구를 불러왔어요.";
      host.render();
      return true;
    case "author-clear":
      c.authorDraft = null;
      c.lessonDraft!.authored = false;
      host.render();
      return true;
    case "author-export":
    case "author-apply": {
      try {
        const draft = validateLessonPack(
          c.authorDraft ??
            defaultLessonPack(c.lessonDraft?.episode ?? "classroom"),
        );
        c.authorDraft = draft;
        if (action === "author-export") {
          saveText(
            JSON.stringify(draft, null, 2),
            "교실탈출-수업설정.json",
            "application/json",
          );
          c.authorStatus =
            "수업 파일을 저장했어요. 학생 개인정보는 작성하지 않아요.";
          host.render();
        } else {
          c.lessonDraft = {
            ...c.lessonDraft!,
            episode: draft.episode,
            authored: true,
          };
          if (c.saved) host.openModal("new-confirm");
          else host.go("/setup");
        }
      } catch (error) {
        c.authorStatus =
          error instanceof Error ? error.message : "수업 파일을 확인해요.";
        host.render();
      }
      return true;
    }
    case "print-materials": {
      const e = lesson();
      openPrint(doc(lessonMaterialsDocument(e), e));
      return true;
    }
    case "print-roles": {
      const e = lesson();
      openPrint(doc(rolesDocument(e), e));
      return true;
    }
    case "download-roles": {
      const e = lesson();
      saveText(
        doc(rolesDocument(e), e),
        "모둠-역할-카드.html",
        "text/html;charset=utf-8",
      );
      return true;
    }
    case "print-pledge":
      if (c.learning && c.learning.pledge !== null)
        openPrint(doc(practiceCard(c.learning), c.learning));
      return true;
    case "download-pledge":
      if (c.learning && c.learning.pledge !== null)
        saveText(
          doc(practiceCard(c.learning), c.learning),
          "우리-모둠-실천-카드.html",
          "text/html;charset=utf-8",
        );
      return true;
    case "audit-check": {
      const n = Number(value),
        a = c.deviceAudit!;
      if (n >= 0 && n < DEVICE_CHECKS.length)
        a.checks = a.checks.includes(n)
          ? a.checks.filter((i) => i !== n)
          : [...a.checks, n];
      host.render();
      return true;
    }
    case "audit-download": {
      const a = c.deviceAudit!;
      download(
        {
          type: "self-reported-device-check",
          testDate: new Date().toLocaleDateString("sv-SE", {
            timeZone: "Asia/Seoul",
          }),
          status:
            a.touchSeen &&
            a.device !== "기기 선택" &&
            a.checks.length === DEVICE_CHECKS.length
              ? "SELF_REPORTED_PASS"
              : "NOT_RUN",
          ...a,
          items: DEVICE_CHECKS,
          viewport: { width: innerWidth, height: innerHeight },
        },
        "교실-탈출-실기기-점검.json",
      );
      return true;
    }
  }
  return false;
}
