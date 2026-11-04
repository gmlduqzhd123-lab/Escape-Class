import type { ViewContext } from "../ui/views";
import type { ClassroomScene } from "../scene/classroom";
import { active } from "../game/model";
import { customObjectNames } from "../ui/advancement";
import { digit } from "../game/advancement";
import { objective } from "../ui/experience";

// The 3D room's life cycle: lazy loading with a fallback to the picture view,
// pausing behind dialogs, keeping its state in step with the game, and queued
// moves that wait until the room is ready. main.ts owns the app shell and asks
// this module to mount, sync or dispose the scene.
export interface SceneMountHost {
  c: ViewContext;
  route: () => string;
  portrait: () => boolean;
  render: () => void;
  say: (message: string) => void;
  persist: () => void;
  saveBlocked: () => boolean;
  inspect: (objectId: string) => void;
}
export function createSceneMount(host: SceneMountHost) {
  const { c } = host;
  let classroom: ClassroomScene | null = null;
  let sceneHost: HTMLElement | null = null;
  let sceneLoading = false;
  let sceneGeneration = 0;
  let sceneLoadTimer: ReturnType<typeof setTimeout> | undefined;
  let poseTimer: ReturnType<typeof setTimeout>;
  let pendingSceneOperation: string | null = null;
  let pendingScenePlace: string | null = null;
  function runPending() {
    if (!classroom || c.objectId || c.modal) return;
    if (pendingScenePlace) {
      const place = pendingScenePlace;
      pendingScenePlace = null;
      classroom.moveToPlace(place);
    }
    if (!pendingSceneOperation) return;
    const id = pendingSceneOperation;
    pendingSceneOperation = null;
    classroom.operateObject(id);
  }
  function dispose() {
    clearTimeout(poseTimer);
    clearTimeout(sceneLoadTimer);
    sceneLoadTimer = undefined;
    pendingSceneOperation = null;
    pendingScenePlace = null;
    sceneGeneration++;
    classroom?.dispose();
    classroom = null;
    sceneHost = null;
    sceneLoading = false;
  }
  function sync() {
    const s = c.state;
    if (s)
      classroom?.setState({
        objectiveId: objective(s)[1],
        solvedPuzzleIds: s.solvedPuzzleIds,
        finalCombined: s.finalCombined,
        finalKeyObtained: s.finalKeyObtained,
        drawerOpen: s.solvedPuzzleIds.includes("P1"),
        toolTaken: s.inventory.some((id) => id.endsWith("lens")),
        exitUsed: s.exitUsed,
        active:
          active(s) &&
          host.route() === "/play" &&
          !c.objectId &&
          !c.modal &&
          !host.portrait() &&
          c.sceneMode === "3d" &&
          !document.hidden,
        reducedMotion: s.settings.reducedMotion,
      });
  }
  function fail() {
    dispose();
    c.sceneMode = "2d";
    c.sceneFailed = true;
    host.render();
    host.say("입체 화면 대신 그림 교실로 이어갈게요. 모은 단서는 그대로예요.");
  }
  function mount() {
    const slot = document.getElementById("classroom-scene");
    if (!slot || c.sceneMode !== "3d") {
      clearTimeout(sceneLoadTimer);
      sceneLoadTimer = undefined;
      sync();
      return;
    }
    // Keep the existing canvas attached behind dialogs. Rendering can be paused
    // without replacing the room with a loading placeholder.
    if (sceneHost && sceneHost !== slot) slot.replaceWith(sceneHost);
    else sceneHost = slot;
    if (
      host.portrait() ||
      c.modal ||
      !c.state ||
      !active(c.state) ||
      document.hidden
    ) {
      clearTimeout(sceneLoadTimer);
      sceneLoadTimer = undefined;
      sync();
      return;
    }
    if (classroom) {
      sync();
      classroom.resize();
      runPending();
      return;
    }
    if (!sceneLoadTimer) {
      const generation = sceneGeneration;
      sceneLoadTimer = setTimeout(() => {
        sceneLoadTimer = undefined;
        if (generation === sceneGeneration && !classroom) fail();
      }, 12000);
    }
    if (sceneLoading) return;
    sceneLoading = true;
    const generation = sceneGeneration;
    void import("../scene/classroom")
      .then(async ({ createClassroomScene }) => {
        // Canvas text must use the same loaded Korean font as the interface.
        await document.fonts.load("700 32px Classroom").catch(() => {});
        if (generation !== sceneGeneration || !sceneHost) return;
        if (
          host.portrait() ||
          c.modal ||
          !c.state ||
          !active(c.state) ||
          !sceneHost.isConnected ||
          document.hidden
        ) {
          sceneLoading = false;
          clearTimeout(sceneLoadTimer);
          sceneLoadTimer = undefined;
          return;
        }
        classroom = createClassroomScene(sceneHost, {
          cipherDigits: [7, 2, 9, 4, 6, 1, 8, 3, 5].map((n) =>
            digit(c.learning, n),
          ),
          episodeId: c.learning?.options.episode ?? "classroom",
          objectNames: customObjectNames(c.learning?.extras.custom),
          initialPose: c.learning?.view.pose ?? null,
          onPoseChange: (pose) => {
            if (
              !c.learning ||
              JSON.stringify(c.learning.view.pose) === JSON.stringify(pose)
            )
              return;
            c.learning.view.pose = pose;
            clearTimeout(poseTimer);
            poseTimer = setTimeout(() => {
              if (c.state && host.route() === "/play" && !host.saveBlocked())
                host.persist();
            }, 600);
          },
          onInspect: (id) => {
            host.inspect(id);
          },
          onFailure: () => {
            queueMicrotask(fail);
          },
          reducedMotion: c.state?.settings.reducedMotion ?? false,
        });
        sceneLoading = false;
        clearTimeout(sceneLoadTimer);
        sceneLoadTimer = undefined;
        sync();
        classroom.resize();
        runPending();
      })
      .catch(() => {
        if (generation === sceneGeneration) fail();
      });
  }
  return {
    mount,
    dispose,
    sync,
    fail,
    runPending,
    get current() {
      return classroom;
    },
    get host() {
      return sceneHost;
    },
    setPendingPlace(place: string) {
      pendingScenePlace = place;
    },
    setPendingOperation(objectId: string) {
      pendingSceneOperation = objectId;
    },
  };
}
