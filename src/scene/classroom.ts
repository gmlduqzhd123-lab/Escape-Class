import * as THREE from "three";
import { OBJECTS } from "../content/data";
import { PUZZLES } from "../game/model";
import "./classroom.css";
import { bindSceneGestures } from "./gestures";
import { createFrameLoop } from "./frameLoop";
import { sceneQuality } from "./quality";
import type { ScenePose } from "../game/learning";
import { episode, type EpisodeId } from "../content/episodes";
import { buildRoom } from "./furniture";

export interface ClassroomState {
  objectiveId?: string;
  solvedPuzzleIds: string[];
  finalCombined: boolean;
  finalKeyObtained: boolean;
  active: boolean;
  reducedMotion: boolean;
  drawerOpen?: boolean;
  toolTaken?: boolean;
  exitUsed?: boolean;
}

export interface ClassroomScene {
  setState(state: ClassroomState): void;
  focusObject(id: string): void;
  resetView(): void;
  moveToPlace(place: string): void;
  operateObject(id: string): void;
  resize(): void;
  dispose(): void;
}

type Options = {
  cipherDigits?: number[];
  initialPose?: ScenePose | null;
  onPoseChange?: (pose: ScenePose) => void;
  episodeId?: EpisodeId;
  onInspect: (id: string) => void;
  onFailure: () => void;
  reducedMotion: boolean;
};
type Stop = { name: string; x: number; z: number; links: string[] };
type Landmark = {
  id: string;
  stop: string;
  anchor: THREE.Vector3;
  look: THREE.Vector3;
  group: THREE.Group;
  button: HTMLButtonElement;
};

// Every route stays on these connected aisles. Furniture is placed outside them.
const STOPS: Record<string, Stop> = {
  center: {
    name: "교실 가운데",
    x: 0,
    z: 2.8,
    links: ["middle", "back", "desk"],
  },
  middle: {
    name: "가운데 통로",
    x: 0,
    z: -0.9,
    links: ["center", "front", "basket", "tools", "tablet"],
  },
  front: {
    name: "칠판 앞",
    x: 0,
    z: -3.75,
    links: ["middle", "plant", "door"],
  },
  plant: { name: "창가", x: -3.65, z: -3.75, links: ["front"] },
  door: { name: "게시판·출구 앞", x: 3.65, z: -3.75, links: ["front"] },
  basket: { name: "바구니 옆", x: -3.5, z: -0.9, links: ["middle"] },
  tools: { name: "도구함 앞", x: 3.5, z: -0.9, links: ["middle", "lockers"] },
  lockers: { name: "사물함 앞", x: 3.5, z: 1.4, links: ["tools"] },
  tablet: { name: "태블릿 앞", x: 1.35, z: -0.9, links: ["middle"] },
  desk: { name: "그림 책상 앞", x: -2.9, z: 2.8, links: ["center"] },
  back: { name: "교실 뒤편", x: 0, z: 4.3, links: ["center", "books"] },
  books: { name: "책장 앞", x: -3.4, z: 4.3, links: ["back"] },
};

export function createClassroomScene(
  host: HTMLElement,
  options: Options,
): ClassroomScene {
  const scene = new THREE.Scene();
  const pack = episode(options.episodeId ?? "classroom");
  // The friendship pieces are renamed per episode (책갈피, 응원).
  const piece =
    pack.shell === "gym"
      ? "응원"
      : pack.shell === "library"
        ? "책갈피"
        : "우정";
  const stopName = (id: string) =>
    pack.shell === "classroom"
      ? STOPS[id].name
      : ((
          {
            center: `${pack.room} 가운데`,
            middle: "가운데 통로",
            front: `${pack.objects.O01} 앞`,
            plant: "창가",
            door: "출구 앞",
            basket: pack.shell === "gym" ? "벤치 옆" : "반납함 옆",
            tools: "도구함 앞",
            lockers: "사물함 앞",
            tablet: pack.shell === "gym" ? "계획판 앞" : "태블릿 앞",
            desk: pack.shell === "gym" ? "기록대 앞" : "독서대 앞",
            back: `${pack.room} 뒤편`,
            books: pack.shell === "gym" ? "응원 자료함 앞" : "책장 앞",
          } as Record<string, string>
        )[id] ?? STOPS[id].name);
  const sceneObjects = OBJECTS.map((o) => ({
    ...o,
    name: pack.objects[o.id] ?? o.name,
  }));
  scene.background = new THREE.Color("#f2eedf");
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 45);
  camera.position.set(0, 1.8, 2.8);
  camera.rotation.order = "YXZ";
  // Camera zoom (1x–2x) narrows the field of view; moving or inspecting resets it.
  const MAX_ZOOM = 2;
  let zoom = 1;
  let baseFov = 68;
  let yaw = 0;
  let pitch = -0.045;
  let currentStop = "center";
  if (options.initialPose && STOPS[options.initialPose.stop]) {
    currentStop = options.initialPose.stop;
    camera.position.set(STOPS[currentStop].x, 1.8, STOPS[currentStop].z);
    yaw = options.initialPose.yaw;
    pitch = options.initialPose.pitch;
  }
  let active = true;
  let reducedMotion = options.reducedMotion;
  let disposed = false;
  let moving = false;
  let state: ClassroomState = {
    solvedPuzzleIds: [],
    finalCombined: false,
    finalKeyObtained: false,
    active: true,
    reducedMotion,
  };
  const touchDevice = matchMedia("(any-pointer: coarse)").matches;
  const quality = sceneQuality(
    innerWidth,
    innerHeight,
    touchDevice,
    devicePixelRatio,
  );
  const renderer = new THREE.WebGLRenderer({
    antialias: quality.antialias,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor("#f2eedf");

  host.classList.add("classroom-3d");
  host.innerHTML = `<div class="classroom-3d-stage" role="group" aria-label="3D 교실 탐색">
    <div class="classroom-3d-location"><span aria-hidden="true">◎</span> <span class="classroom-location-name">교실 가운데</span></div>
    <div class="classroom-3d-labels"></div>
    <div class="classroom-3d-moving" aria-hidden="true" hidden>가까이 가고 있어요…</div>
    <div class="classroom-3d-zoom" role="group" aria-label="확대·축소">
      <button type="button" data-scene-control="zoom-in" aria-label="확대"><span aria-hidden="true">＋</span></button>
      <button type="button" data-scene-control="zoom-out" aria-label="축소" disabled><span aria-hidden="true">－</span></button>
    </div>
  </div>
  <div class="classroom-3d-controls" aria-label="교실 둘러보기">
    <button type="button" class="classroom-turn" data-scene-control="left" aria-label="왼쪽 보기"><span aria-hidden="true">←</span> 왼쪽 보기</button>
    <button type="button" class="classroom-center" data-scene-control="center" aria-label="교실 가운데로"><span aria-hidden="true">⌂</span> 가운데로</button>
    <button type="button" class="classroom-turn" data-scene-control="right" aria-label="오른쪽 보기">오른쪽 보기 <span aria-hidden="true">→</span></button>
  </div>
  <div class="classroom-3d-places" aria-label="이동할 곳">
    <button type="button" data-scene-place="front" aria-label="칠판 앞으로 이동">칠판 앞으로</button>
    <button type="button" data-scene-place="plant" aria-label="창가로 이동">창가로</button>
    <button type="button" data-scene-place="back" aria-label="교실 뒤편으로 이동">교실 뒤편으로</button>
  </div>
  <p class="classroom-3d-instruction" aria-live="polite">물건이나 이름표를 누르면 가까이 가서 살펴봐요.</p>`;
  if (pack.shell !== "classroom")
    host.innerHTML = host.innerHTML.replaceAll("교실", pack.room);
  if (pack.shell !== "classroom")
    host.innerHTML = host.innerHTML.replaceAll(
      "칠판 앞으로",
      `${pack.objects.O01} 앞으로`,
    );
  const stage = host.querySelector<HTMLElement>(".classroom-3d-stage")!;
  const labels = host.querySelector<HTMLElement>(".classroom-3d-labels")!;
  const instruction = host.querySelector<HTMLElement>(
    ".classroom-3d-instruction",
  )!;
  const location = host.querySelector<HTMLElement>(".classroom-location-name")!;
  location.textContent = stopName(currentStop);
  const movingLabel = host.querySelector<HTMLElement>(".classroom-3d-moving")!;
  const zoomIn = host.querySelector<HTMLButtonElement>(
    '[data-scene-control="zoom-in"]',
  )!;
  const zoomOut = host.querySelector<HTMLButtonElement>(
    '[data-scene-control="zoom-out"]',
  )!;
  stage.dataset.zoom = "1.00";
  const canvas = renderer.domElement;
  canvas.className = "classroom-3d-canvas";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const objects: Landmark[] = [];
  const deviceValues = { drawer: 0, lid: 0, door: 0 };
  const deviceTargets = { drawer: 0, lid: 0, door: 0 };
  const clickableGroups = new Map<string, THREE.Group>();
  const {
    basket,
    books,
    box,
    desk,
    door,
    doorLeaf,
    drawer,
    floorGrid,
    gymFlag,
    lamps,
    lid,
    lockers,
    mesh,
    panel,
    plant,
    screen,
    tablet,
    updateCombination,
  } = buildRoom({
    scene,
    renderer,
    quality,
    pack,
    piece,
    cipherDigits: options.cipherDigits,
    geometries,
    materials,
    textures,
    clickableGroups,
  });

  const anchors: Record<
    string,
    { stop: string; label: number[]; look: number[] }
  > = {
    O01: {
      stop: "front",
      label: [-0.7, 2.95, -5.14],
      look: [-0.7, 2.05, -5.2],
    },
    O02: { stop: "door", label: [3.35, 2.92, -5.12], look: [3.35, 2.05, -5.2] },
    O03: { stop: "basket", label: [-4.6, 1.7, -0.9], look: [-4.6, 1.15, -0.9] },
    O04: { stop: "desk", label: [-2.95, 1.42, 1.4], look: [-2.95, 0.95, 1.4] },
    O05: { stop: "lockers", label: [4.35, 2.28, 1.4], look: [4.6, 1.2, 1.4] },
    O06: { stop: "tools", label: [4.55, 1.9, -1.38], look: [4.78, 1.2, -1.38] },
    O07: { stop: "back", label: [-1.7, 0.44, 3.8], look: [-1.7, 0.15, 3.8] },
    O08: { stop: "tablet", label: [1.55, 1.85, 0.5], look: [1.55, 1.2, 0.5] },
    O09: { stop: "back", label: [2.4, 3.03, 5.18], look: [2.4, 2.0, 5.3] },
    O10: { stop: "books", label: [-4.3, 2.12, 4.35], look: [-4.65, 1.1, 4.35] },
    O11: { stop: "plant", label: [-4.7, 2.08, -3.8], look: [-4.7, 0.85, -3.8] },
    O12: { stop: "door", label: [5.13, 2.68, -3.65], look: [5.25, 1.5, -3.65] },
  };
  for (const object of sceneObjects) {
    const config = anchors[object.id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "classroom-object-label";
    button.dataset.sceneObject = object.id;
    button.dataset.focus = `inspect:${object.id}`;
    button.setAttribute("aria-label", `${object.name} 살펴보기`);
    button.innerHTML = `<span class="classroom-object-dot" aria-hidden="true">◎</span><span>${object.name}</span><small class="classroom-object-next" aria-hidden="true" hidden>다음</small>`;
    labels.append(button);
    button.addEventListener("click", () => focusObject(object.id));
    objects.push({
      id: object.id,
      stop: config.stop,
      anchor: new THREE.Vector3(...(config.label as [number, number, number])),
      look: new THREE.Vector3(...(config.look as [number, number, number])),
      group: clickableGroups.get(object.id)!,
      button,
    });
  }
  const moveMarkers: {
    id: string;
    point: THREE.Vector3;
    button: HTMLButtonElement;
    ring: THREE.Mesh;
  }[] = [];
  const stopLabels: Record<string, string> = {
    front: "칠판 앞",
    middle: "가운데 통로",
    center: "가운데",
    back: "교실 뒤편",
    plant: "창가",
    door: "게시판·출구",
    basket: "바구니 옆",
    tools: "도구함 앞",
    desk: "그림 책상 앞",
    books: "책장 앞",
  };
  for (const id of [
    "front",
    "middle",
    "center",
    "back",
    "plant",
    "door",
    "basket",
    "tools",
    "desk",
    "books",
  ]) {
    const stop = STOPS[id];
    const ring = mesh(
      new THREE.RingGeometry(0.2, 0.27, 24),
      new THREE.MeshBasicMaterial({
        color: "#54764e",
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(stop.x, 0.024, stop.z);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "classroom-move-label";
    button.setAttribute("aria-label", `${stopName(id)} 이동`);
    button.title = `${stopName(id)} 이동`;
    button.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="8" cy="8" rx="3" ry="5" transform="rotate(-18 8 8)"/><ellipse cx="16" cy="15" rx="3" ry="5" transform="rotate(18 16 15)"/></svg><span>${pack.shell === "classroom" ? stopLabels[id] : stopName(id)}<small>가기</small></span>`;
    labels.append(button);
    button.addEventListener("click", () => navigate(id));
    moveMarkers.push({
      id,
      point: new THREE.Vector3(stop.x, 0.1, stop.z),
      button,
      ring,
    });
  }

  type Tween = {
    started: number;
    duration: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    yawFrom: number;
    yawTo: number;
    pitchFrom: number;
    pitchTo: number;
    end: () => void;
  };
  let tween: Tween | null = null;
  let journey = 0;
  const normalizeAngle = (angle: number) =>
    Math.atan2(Math.sin(angle), Math.cos(angle));
  let labelsDirty = true;
  const frames = createFrameLoop({
    canDraw: () =>
      !disposed &&
      active &&
      !document.hidden &&
      host.isConnected &&
      stage.clientWidth > 0 &&
      stage.clientHeight > 0,
    animating: () =>
      !!tween ||
      moving ||
      (Object.keys(deviceValues) as (keyof typeof deviceValues)[]).some(
        (id) => Math.abs(deviceTargets[id] - deviceValues[id]) > 0.002,
      ),
    maxFps: quality.maxFps,
    idleFps: 4,
    draw: render,
    onFailure: () => {
      cancelJourney();
      options.onFailure();
    },
  });
  renderer.debug.onShaderError = () => frames.fail();
  function requestDraw() {
    labelsDirty = true;
    frames.request();
  }
  function render(now: number) {
    if (disposed || !active || !host.isConnected) return;
    if (renderer.getContext().isContextLost()) {
      frames.fail();
      return;
    }
    const updateLabels = labelsDirty || !!tween || moving;
    let deviceMoving = false;
    for (const id of ["drawer", "lid", "door"] as const) {
      const delta = deviceTargets[id] - deviceValues[id];
      if (Math.abs(delta) > 0.002) {
        deviceValues[id] += reducedMotion ? delta : delta * 0.18;
        deviceMoving = true;
      } else deviceValues[id] = deviceTargets[id];
    }
    drawer.position.z = deviceValues.drawer * 0.42;
    lid.rotation.x = -deviceValues.lid * 1.1;
    doorLeaf.rotation.y = -deviceValues.door * 1.2;
    if (deviceMoving) renderer.shadowMap.needsUpdate = true;
    if (tween) {
      const step = tween;
      const progress = Math.min(1, (now - step.started) / step.duration);
      const ease = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(step.from, step.to, ease);
      yaw = step.yawFrom + normalizeAngle(step.yawTo - step.yawFrom) * ease;
      pitch = step.pitchFrom + (step.pitchTo - step.pitchFrom) * ease;
      if (progress >= 1) {
        tween = null;
        step.end();
      }
    }
    if (disposed || !active || !host.isConnected) return;
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    if (updateLabels) {
      positionLabels();
      labelsDirty = false;
    }
    if (updateLabels && !tween && !moving) notifyPose();
  }
  function notifyPose() {
    options.onPoseChange?.({
      stop: currentStop,
      yaw: normalizeAngle(yaw),
      pitch,
    });
  }
  const projected = new THREE.Vector3();
  function screenPoint(point: THREE.Vector3) {
    projected.copy(point).project(camera);
    return {
      x: ((projected.x + 1) * stage.clientWidth) / 2,
      y: ((1 - projected.y) * stage.clientHeight) / 2,
      visible:
        projected.z > -1 &&
        projected.z < 1 &&
        Math.abs(projected.x) < 0.97 &&
        Math.abs(projected.y) < 0.93,
      floorVisible:
        projected.z > -1 &&
        projected.z < 1 &&
        Math.abs(projected.x) < 0.89 &&
        projected.y > -1.45 &&
        projected.y < 0.8,
    };
  }
  function positionLabels() {
    if (moving) {
      for (const object of objects) object.button.hidden = true;
      for (const marker of moveMarkers) marker.button.hidden = true;
      return;
    }
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    const width = stage.clientWidth;
    const stageRect = stage.getBoundingClientRect();
    // Labels never sit on the zoom buttons, even when clamped into that corner.
    for (const button of [zoomIn, zoomOut]) {
      const r = button.getBoundingClientRect();
      if (r.width)
        occupied.push({
          x: r.left + r.width / 2 - stageRect.left,
          y: r.top + r.height / 2 - stageRect.top,
          w: r.width,
          h: r.height,
        });
    }
    const labelTop =
      location.parentElement!.getBoundingClientRect().bottom -
      stageRect.top +
      30;
    const turnRect = host
      .querySelector(".classroom-3d-controls")!
      .getBoundingClientRect();
    const fillRoom = host.closest(".room-fill");
    const dockRect = fillRoom
      ?.querySelector(".explore-dock")
      ?.getBoundingClientRect();
    const selectedRect = fillRoom
      ?.querySelector(".explore-selected")
      ?.getBoundingClientRect();
    const labelBottom = dockRect
      ? Math.min(dockRect.top, selectedRect?.top ?? Infinity) -
        stageRect.top -
        10
      : turnRect.top >= stageRect.top && turnRect.bottom <= stageRect.bottom
        ? turnRect.top - stageRect.top - 8
        : stage.clientHeight;
    const candidates = objects
      .map((object) => {
        let point = screenPoint(object.anchor);
        // At a close stop, looking down at an object can put its raised name
        // anchor above a narrow screen. Keep its label on the visible object;
        // never pull an off-screen or behind-camera object into view.
        if (!point.visible && object.stop === currentStop) {
          const closeup = screenPoint(object.look);
          if (closeup.visible) {
            point = closeup;
            // The exit's fallback label must leave the collected stars readable.
            if (object.id === "O12") point = { ...point, y: point.y - 64 };
          }
        }
        return {
          object,
          point,
          distance: camera.position.distanceTo(object.anchor),
        };
      })
      .sort(
        (a, b) =>
          Number(b.object.id === state.objectiveId) -
            Number(a.object.id === state.objectiveId) ||
          a.distance - b.distance,
      );
    // Measure visible candidates together before positioning. Hidden labels
    // can change width when the next-object badge appears; measuring them
    // avoids narrow-screen clips without laying out off-screen objects.
    const labelButtons = [
      ...candidates
        .filter(({ point, distance }) => point.visible && distance > 0.4)
        .map(({ object }) => object.button),
      ...moveMarkers
        .filter((marker) => {
          const point = screenPoint(marker.point);
          return (
            point.floorVisible &&
            point.y >= 80 &&
            marker.id !== currentStop &&
            STOPS[currentStop].links.includes(marker.id) &&
            camera.position.distanceTo(marker.point) <= 7
          );
        })
        .map((marker) => marker.button),
    ];
    for (const button of labelButtons) button.hidden = false;
    const buttonWidths = new Map(
      labelButtons.map((button) => [button, button.offsetWidth]),
    );
    let shownLabels = 0;
    const labelLimit = fillRoom ? (width <= 1024 ? 3 : 4) : Infinity;
    for (const { object, point, distance } of candidates) {
      const buttonWidth = Math.min(
        buttonWidths.get(object.button) || 148,
        width - 20,
      );
      const x = Math.max(
        buttonWidth / 2 + 8,
        Math.min(width - buttonWidth / 2 - 8, point.x),
      );
      const y = Math.max(labelTop, Math.min(labelBottom - 28, point.y));
      const overlaps = occupied.some(
        (box) =>
          Math.abs(box.x - x) < (box.w + buttonWidth) / 2 + 8 &&
          Math.abs(box.y - y) < 54,
      );
      const visible =
        point.visible &&
        distance > 0.4 &&
        !overlaps &&
        !moving &&
        shownLabels < labelLimit;
      object.button.hidden = !visible;
      if (visible) {
        shownLabels++;
        object.button.style.left = `${x}px`;
        object.button.style.top = `${y}px`;
        occupied.push({ x, y, w: buttonWidth, h: 46 });
      }
    }
    for (const marker of moveMarkers) {
      const point = screenPoint(marker.point);
      const markerWidth = Math.min(
        buttonWidths.get(marker.button) || 96,
        width - 16,
      );
      const markerX = Math.max(
        markerWidth / 2 + 8,
        Math.min(width - markerWidth / 2 - 8, point.x),
      );
      const markerY = Math.min(stage.clientHeight - 32, point.y);
      const distance = camera.position.distanceTo(marker.point);
      const neighbor = STOPS[currentStop].links.includes(marker.id);
      const overlaps = occupied.some(
        (box) =>
          Math.abs(box.x - markerX) < (box.w + markerWidth) / 2 + 8 &&
          Math.abs(box.y - markerY) < 52,
      );
      marker.button.hidden =
        markerY + 27 > labelBottom ||
        !point.floorVisible ||
        point.y < 80 ||
        moving ||
        marker.id === currentStop ||
        !neighbor ||
        distance > 7 ||
        overlaps;
      marker.ring.visible = neighbor && marker.id !== currentStop;
      if (!marker.button.hidden) {
        marker.button.style.left = `${markerX}px`;
        marker.button.style.top = `${markerY}px`;
        occupied.push({ x: markerX, y: markerY, w: markerWidth, h: 52 });
      }
    }
  }
  function setMoving(value: boolean) {
    moving = value;
    movingLabel.hidden = !value;
    host.classList.toggle("classroom-is-moving", value);
    host
      .querySelectorAll<HTMLButtonElement>(
        "[data-scene-control], [data-scene-place]",
      )
      .forEach((button) => {
        button.disabled = value;
      });
    // Re-enabling everything would also unlock a zoom button at its limit.
    if (!value) syncZoomButtons();
  }
  function cancelJourney(restoreStop = false) {
    journey += 1;
    tween = null;
    setMoving(false);
    if (restoreStop) {
      // A modal may interrupt a walk halfway through an aisle. Return to its
      // last safe stop so the position, place name, and next route agree.
      camera.position.set(STOPS[currentStop].x, 1.8, STOPS[currentStop].z);
      notifyPose();
    }
    location.textContent = stopName(currentStop);
    instruction.textContent = "물건이나 이름표를 누르면 가까이 가서 살펴봐요.";
  }
  function route(from: string, to: string) {
    const queue: string[][] = [[from]];
    const visited = new Set<string>([from]);
    while (queue.length) {
      const path = queue.shift()!;
      const last = path[path.length - 1];
      if (last === to) return path;
      for (const next of STOPS[last].links)
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
    }
    return [from];
  }
  function animate(
    to: THREE.Vector3,
    toYaw: number,
    toPitch: number,
    duration: number,
    end: () => void,
  ) {
    if (reducedMotion) {
      camera.position.copy(to);
      yaw = toYaw;
      pitch = toPitch;
      end();
      requestDraw();
      return;
    }
    tween = {
      started: performance.now(),
      duration: Math.max(160, duration),
      from: camera.position.clone(),
      to,
      yawFrom: yaw,
      yawTo: toYaw,
      pitchFrom: pitch,
      pitchTo: toPitch,
      end,
    };
    requestDraw();
  }
  function navigate(
    id: string,
    object?: Landmark,
    reset = false,
    destinationLook?: THREE.Vector3,
    onArrival?: () => void,
  ) {
    if (!active || disposed || !STOPS[id]) return;
    cancelJourney();
    setZoom(1);
    const token = journey;
    const path = route(currentStop, id);
    setMoving(true);
    const destinationName = object
      ? sceneObjects.find((item) => item.id === object.id)!.name
      : stopName(id);
    movingLabel.textContent = object
      ? `${destinationName} 살펴보러 가요…`
      : `${destinationName}까지 가고 있어요…`;
    instruction.textContent = object
      ? `${destinationName}에 도착하면 바로 살펴봐요.`
      : `${destinationName}에 도착하면 주변을 둘러봐요.`;
    const finish = () => {
      if (token !== journey || !active || disposed) return;
      currentStop = id;
      location.textContent = stopName(id);
      const target = object?.look ?? destinationLook;
      const direction = target?.clone().sub(camera.position).normalize();
      const finalYaw = reset
        ? 0
        : direction
          ? Math.atan2(-direction.x, -direction.z)
          : yaw;
      const finalPitch = reset
        ? -0.045
        : direction
          ? Math.asin(direction.y)
          : -0.045;
      animate(camera.position.clone(), finalYaw, finalPitch, 330, () => {
        if (token !== journey || !active || disposed) return;
        setMoving(false);
        // Opening a panel immediately suspends drawing; save the arrival pose
        // before onInspect makes the scene inactive.
        notifyPose();
        instruction.textContent =
          "물건이나 이름표를 누르면 가까이 가서 살펴봐요.";
        requestDraw();
        if (object) options.onInspect(object.id);
        else onArrival?.();
      });
    };
    const travel = (index: number) => {
      if (token !== journey || !active || disposed) return;
      if (index >= path.length) {
        finish();
        return;
      }
      const stopId = path[index];
      const stop = STOPS[stopId];
      const to = new THREE.Vector3(stop.x, 1.8, stop.z);
      const distance = camera.position.distanceTo(to);
      if (distance < 0.01) {
        currentStop = stopId;
        location.textContent = stopName(currentStop);
        notifyPose();
        travel(index + 1);
        return;
      }
      animate(to, yaw, pitch, Math.min(820, distance * 150), () => {
        currentStop = stopId;
        location.textContent = stopName(currentStop);
        // A map or pause dialog can stop a walk at the next safe aisle stop.
        // Publish each reached stop before another leg starts, so the map and
        // continue use the same location that cancelJourney restores.
        notifyPose();
        travel(index + 1);
      });
    };
    travel(0);
  }
  function focusObject(id: string) {
    const object = objects.find((item) => item.id === id);
    if (!object || !active || disposed) return;
    cancelJourney();
    setZoom(1);
    const stop = STOPS[object.stop];
    currentStop = object.stop;
    camera.position.set(stop.x, 1.8, stop.z);
    location.textContent = stopName(currentStop);
    // Investigation opens in one step. Keep the player's viewing direction
    // instead of flying and turning the camera before replacing it with a panel.
    notifyPose();
    options.onInspect(object.id);
  }
  function zoomedFov() {
    const half = (baseFov * Math.PI) / 360;
    return (Math.atan(Math.tan(half) / zoom) * 360) / Math.PI;
  }
  function syncZoomButtons() {
    stage.dataset.zoom = zoom.toFixed(2);
    zoomIn.disabled = moving || zoom >= MAX_ZOOM - 0.001;
    zoomOut.disabled = moving || zoom <= 1.001;
  }
  function setZoom(next: number) {
    const value = Math.min(MAX_ZOOM, Math.max(1, next));
    if (Math.abs(value - zoom) < 0.001) return;
    zoom = value;
    syncZoomButtons();
    camera.fov = zoomedFov();
    camera.updateProjectionMatrix();
    positionLabels();
    requestDraw();
  }
  function resetView() {
    navigate("center", undefined, true);
  }
  function operateObject(id: string) {
    const object = objects.find((o) => o.id === id);
    if (!object) return;
    if (
      (id === "O04" && !state.drawerOpen) ||
      (id === "O06" && !state.drawerOpen) ||
      (id === "O12" && !state.finalKeyObtained)
    )
      return;
    navigate(object.stop, undefined, false, object.look, () => {
      const part = id === "O04" ? "drawer" : id === "O06" ? "lid" : "door";
      deviceTargets[part] = deviceTargets[part] > 0.5 ? 0 : 1;
      requestDraw();
    });
  }
  function turn(delta: number) {
    if (!active || moving || disposed) return;
    animate(camera.position.clone(), yaw + delta, -0.045, 360, () => {
      yaw = normalizeAngle(yaw);
    });
  }
  function moveToPlace(place: string) {
    if (place === "center") {
      resetView();
      return;
    }
    if (["front", "plant", "back"].includes(place)) {
      const nextObject = objects.find(
        (object) => object.id === state.objectiveId && object.stop === place,
      );
      const lookAt =
        nextObject?.look ??
        (place === "front"
          ? new THREE.Vector3(-0.7, 2.05, -5.2)
          : place === "plant"
            ? new THREE.Vector3(-4.7, 1.8, -3.8)
            : new THREE.Vector3(2.4, 2, 5.3));
      navigate(place, undefined, false, lookAt);
    }
  }
  const onControlClick = (event: Event) => {
    const place = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-scene-place]",
    )?.dataset.scenePlace;
    if (place) {
      moveToPlace(place);
      return;
    }
    const control = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-scene-control]",
    )?.dataset.sceneControl;
    if (control === "left") turn(Math.PI / 3);
    if (control === "right") turn(-Math.PI / 3);
    if (control === "center") resetView();
    if (control === "zoom-in" && active && !moving) setZoom(zoom * 1.25);
    if (control === "zoom-out" && active && !moving) setZoom(zoom / 1.25);
  };
  const onWheel = (event: WheelEvent) => {
    if (!active || moving || disposed) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    setZoom(zoom * Math.exp(-delta * 0.002));
  };
  stage.addEventListener("wheel", onWheel, { passive: false });
  host.addEventListener("click", onControlClick);
  const raycaster = new THREE.Raycaster();
  const gestures = bindSceneGestures(stage, {
    enabled: () => active && !moving && !disposed,
    onZoom: (factor) => setZoom(zoom * factor),
    onLook: (dx, dy, touch) => {
      tween = null;
      yaw -= dx * 0.006;
      if (!touch) pitch = Math.max(-0.6, Math.min(0.32, pitch - dy * 0.003));
      requestDraw();
    },
    onTap: (x, y) => {
      const rect = canvas.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
        return;
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          (-(y - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find(
          (result) =>
            result.object instanceof THREE.Mesh && result.object.visible,
        );
      if (hit) {
        let parent: THREE.Object3D | null = hit.object;
        while (parent && !parent.userData.objectId) parent = parent.parent;
        if (parent?.userData.objectId) focusObject(parent.userData.objectId);
      }
    },
  });
  const onContextLost = (event: Event) => {
    event.preventDefault();
    frames.fail();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  function resize() {
    if (disposed || !host.isConnected) return;
    const width = Math.round(stage.clientWidth),
      height = Math.round(stage.clientHeight);
    if (width < 1 || height < 1) return;
    try {
      const ratio = sceneQuality(
        width,
        height,
        touchDevice,
        devicePixelRatio,
      ).pixelRatio;
      // Assigning canvas.width/height clears WebGL, even at the same size.
      if (
        canvas.width !== Math.floor(width * ratio) ||
        canvas.height !== Math.floor(height * ratio) ||
        renderer.getPixelRatio() !== ratio
      )
        renderer.setDrawingBufferSize(width, height, ratio);
      camera.aspect = width / height;
      baseFov = width < 520 ? 78 : 68;
      camera.fov = zoomedFov();
      camera.updateProjectionMatrix();
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      camera.updateMatrixWorld();
      positionLabels();
      requestDraw();
    } catch {
      frames.fail();
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  const onVisibility = () => {
    if (document.hidden) {
      frames.stop();
    } else resize();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  document.addEventListener("fullscreenchange", resize);
  window.visualViewport?.addEventListener("resize", resize);
  function setState(next: ClassroomState) {
    if (gymFlag) gymFlag.visible = next.finalKeyObtained;
    if (state.drawerOpen !== next.drawerOpen)
      deviceTargets.drawer = next.drawerOpen ? 1 : 0;
    if (state.toolTaken !== next.toolTaken)
      deviceTargets.lid = next.toolTaken ? 1 : 0;
    if (state.exitUsed !== next.exitUsed)
      deviceTargets.door = next.exitUsed ? 1 : 0;
    lamps.forEach((material, i) => {
      const found = next.solvedPuzzleIds.includes(PUZZLES[i]);
      material.color.set(found ? "#e9cf72" : "#aab49b");
      material.emissiveIntensity = found ? 0.35 : 0;
    });
    state = next;
    updateCombination(next);
    reducedMotion = next.reducedMotion;
    const wasActive = active;
    active = next.active;
    if (!active) {
      cancelJourney(true);
      gestures.cancel();
      frames.stop();
    }
    if (active && !wasActive) resize();
    const solved: Record<string, boolean> = {
      O02: state.solvedPuzzleIds.includes("P1"),
      O04: state.solvedPuzzleIds.includes("P2"),
      O07: state.solvedPuzzleIds.includes("P3"),
      O08: state.solvedPuzzleIds.includes("P4"),
      O09: state.solvedPuzzleIds.includes("P5"),
      O12: state.finalCombined,
      O11: state.finalKeyObtained,
    };
    for (const object of objects) {
      const next = object.id === state.objectiveId;
      object.button.classList.toggle("classroom-object-objective", next);
      object.button.querySelector<HTMLElement>(
        ".classroom-object-next",
      )!.hidden = !next;
      object.button.classList.toggle(
        "classroom-object-solved",
        !!solved[object.id],
      );
      object.button.querySelector(".classroom-object-dot")!.textContent =
        solved[object.id] ? "✓" : "◎";
    }
    requestDraw();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    cancelJourney();
    gestures.cancel();
    frames.dispose();
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", resize);
    window.removeEventListener("orientationchange", resize);
    document.removeEventListener("fullscreenchange", resize);
    window.visualViewport?.removeEventListener("resize", resize);
    host.removeEventListener("click", onControlClick);
    stage.removeEventListener("wheel", onWheel);
    gestures.dispose();
    floorGrid.dispose();
    canvas.removeEventListener("webglcontextlost", onContextLost);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const item of textures) item.dispose();
    renderer.forceContextLoss();
    renderer.dispose();
    scene.clear();
    host.replaceChildren();
  }
  resize();
  return {
    setState,
    focusObject,
    resetView,
    moveToPlace,
    operateObject,
    resize,
    dispose,
  };
}
