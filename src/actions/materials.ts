import type { ViewContext } from "../ui/views";
import { createExperience, practiceCard } from "../game/learning";
import { defaultLessonPack, validateLessonPack } from "../game/advancement";
import {
  DEVICE_CHECKS,
  rolesDocument,
  lessonMaterialsDocument,
} from "../ui/learning";
import { download, openPrint, saveText } from "../ui/files";

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
  const lesson = () =>
    host.onPlay() && c.learning ? c.learning : createExperience(c.lessonDraft);
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
    case "print-materials":
      openPrint(lessonMaterialsDocument(lesson()));
      return true;
    case "print-roles":
      openPrint(rolesDocument(lesson()));
      return true;
    case "download-roles":
      saveText(
        rolesDocument(lesson()),
        "모둠-역할-카드.html",
        "text/html;charset=utf-8",
      );
      return true;
    case "print-pledge":
      if (c.learning && c.learning.pledge !== null)
        openPrint(practiceCard(c.learning));
      return true;
    case "download-pledge":
      if (c.learning && c.learning.pledge !== null)
        saveText(
          practiceCard(c.learning),
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
