import * as THREE from "three";
import { OBJECTS } from "../content/data";
import "./classroom.css";
import { bindSceneGestures } from "./gestures";
import type { ScenePose } from "../game/learning";
import { episode, type EpisodeId } from "../content/episodes";

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
  operateObject(id: string): void;
  resize(): void;
  dispose(): void;
}

type Options = {
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
  const sceneObjects = OBJECTS.map((o) => ({
    ...o,
    name: pack.objects[o.id] ?? o.name,
  }));
  scene.background = new THREE.Color("#f2eedf");
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 45);
  camera.position.set(0, 1.8, 2.8);
  camera.rotation.order = "YXZ";
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
  let frame = 0;
  let moving = false;
  let state: ClassroomState = {
    solvedPuzzleIds: [],
    finalCombined: false,
    finalKeyObtained: false,
    active: true,
    reducedMotion,
  };
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor("#f2eedf");

  host.classList.add("classroom-3d");
  host.innerHTML = `<div class="classroom-3d-stage" role="group" aria-label="3D 교실 탐색">
    <div class="classroom-3d-location"><span aria-hidden="true">◎</span> <span class="classroom-location-name">교실 가운데</span></div>
    <div class="classroom-3d-labels"></div>
    <div class="classroom-3d-moving" aria-hidden="true" hidden>가까이 가고 있어요…</div>
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
  if (pack.shell === "library")
    host.innerHTML = host.innerHTML.replaceAll("교실", "도서관");
  const stage = host.querySelector<HTMLElement>(".classroom-3d-stage")!;
  const labels = host.querySelector<HTMLElement>(".classroom-3d-labels")!;
  const instruction = host.querySelector<HTMLElement>(
    ".classroom-3d-instruction",
  )!;
  const location = host.querySelector<HTMLElement>(".classroom-location-name")!;
  location.textContent = STOPS[currentStop].name.replace("교실", pack.room);
  const movingLabel = host.querySelector<HTMLElement>(".classroom-3d-moving")!;
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
  const palette = {
    cream: "#f7f3e7",
    sage: "#dce7d8",
    green: "#31584b",
    wood: "#c89f6d",
    darkWood: "#987649",
    paper: "#fffdf0",
    yellow: "#f4cc64",
    ink: "#385148",
  };
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string) => {
    if (!materialCache.has(color)) {
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
      });
      materialCache.set(color, material);
      materials.add(material);
    }
    return materialCache.get(color)!;
  };
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D = scene,
  ) {
    geometries.add(geometry);
    materials.add(material);
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(
    parent: THREE.Object3D,
    size: number[],
    at: number[],
    color: string,
  ) {
    const item = mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      mat(color),
      parent,
    );
    item.position.set(at[0], at[1], at[2]);
    return item;
  }
  function cylinder(
    parent: THREE.Object3D,
    top: number,
    bottom: number,
    height: number,
    at: number[],
    color: string,
    segments = 16,
  ) {
    const item = mesh(
      new THREE.CylinderGeometry(top, bottom, height, segments),
      mat(color),
      parent,
    );
    item.position.set(at[0], at[1], at[2]);
    return item;
  }
  function texture(
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    w = 768,
    h = 384,
  ) {
    const surface = document.createElement("canvas");
    surface.width = w;
    surface.height = h;
    const ctx = surface.getContext("2d")!;
    draw(ctx, w, h);
    const result = new THREE.CanvasTexture(surface);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    textures.add(result);
    return result;
  }
  function panel(
    parent: THREE.Object3D,
    size: number[],
    at: number[],
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  ) {
    const mapped = new THREE.MeshBasicMaterial({
      map: texture(draw),
      side: THREE.DoubleSide,
    });
    const item = mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      mapped,
      parent,
    );
    item.position.set(at[0], at[1], at[2]);
    item.castShadow = false;
    return item;
  }
  function text(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    size: number,
    color = palette.ink,
  ) {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px Classroom, "Malgun Gothic", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, x, y);
  }
  function animalFace(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: number,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    const color = ["#f3e5d5", "#c79665", "#df8855", "#b68f6c"][type % 4];
    ctx.fillStyle = color;
    ctx.strokeStyle = "#695447";
    ctx.lineWidth = 3;
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        sign * 25,
        -30,
        type === 0 ? 10 : 17,
        type === 0 ? 34 : 17,
        sign * 0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 7, 44, 39, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff5df";
    ctx.beginPath();
    ctx.ellipse(0, 23, 25, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#554337";
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sign * 15, 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-6, 19);
    ctx.lineTo(0, 25);
    ctx.lineTo(6, 19);
    ctx.stroke();
    ctx.fillStyle = "#e8a29a";
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sign * 28, 19, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function makeObject(id: string, position: number[]) {
    const group = new THREE.Group();
    group.position.set(position[0], position[1], position[2]);
    group.userData.objectId = id;
    scene.add(group);
    clickableGroups.set(id, group);
    return group;
  }
  function outline(group: THREE.Group, size: number[], at: number[]) {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const edges = new THREE.EdgesGeometry(geometry);
    geometry.dispose();
    geometries.add(edges);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: "#aa8959",
      transparent: true,
      opacity: 0.6,
    });
    materials.add(lineMaterial);
    const lines = new THREE.LineSegments(edges, lineMaterial);
    lines.position.set(at[0], at[1], at[2]);
    group.add(lines);
  }
  function table(
    parent: THREE.Object3D,
    x: number,
    z: number,
    width = 1.55,
    depth = 1.05,
  ) {
    box(parent, [width, 0.12, depth], [x, 0.9, z], palette.wood);
    box(parent, [width - 0.12, 0.2, depth - 0.12], [x, 0.73, z], "#d5b783");
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        box(
          parent,
          [0.09, 0.71, 0.09],
          [x + sx * (width / 2 - 0.13), 0.355, z + sz * (depth / 2 - 0.13)],
          palette.green,
        );
  }

  // Sunlit shell and quiet, low-poly furniture share the original illustration palette.
  const ambient = new THREE.HemisphereLight("#fff9e7", "#afc3ae", 2.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff0c7", 2.2);
  sun.position.set(-3, 7, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  box(scene, [11.2, 0.16, 11.2], [0, -0.1, 0], "#dfc397");
  for (let x = -5.2; x <= 5.2; x += 0.65)
    box(scene, [0.012, 0.006, 11], [x, -0.015, 0], "#cfb081");
  for (let x = -4.9; x <= 5; x += 1.3)
    for (let z = -4.7; z < 5; z += 2.2)
      box(
        scene,
        [0.65, 0.006, 0.012],
        [x, -0.014, z + (Math.round(x * 10) % 2 ? 0.5 : 0)],
        "#cfb081",
      );
  box(scene, [11.2, 3.8, 0.16], [0, 1.85, -5.6], palette.cream);
  box(scene, [11.2, 3.8, 0.16], [0, 1.85, 5.6], palette.cream);
  box(scene, [0.16, 3.8, 11.2], [-5.6, 1.85, 0], palette.cream);
  box(scene, [0.16, 3.8, 11.2], [5.6, 1.85, 0], palette.cream);
  for (const z of [-5.49, 5.49]) {
    box(scene, [11, 0.9, 0.06], [0, 0.45, z], "#e1e9d9");
    box(scene, [11, 0.07, 0.1], [0, 0.94, z], palette.wood);
  }
  for (const x of [-5.49, 5.49]) {
    box(scene, [0.06, 0.9, 11], [x, 0.45, 0], "#e1e9d9");
    box(scene, [0.1, 0.07, 11], [x, 0.94, 0], palette.wood);
  }
  for (const z of [-2.2, 1.1]) {
    box(scene, [0.09, 1.85, 2.5], [-5.46, 2.25, z], "#b5d8d4");
    for (const y of [1.3, 2.25, 3.2])
      box(scene, [0.14, 0.08, 2.65], [-5.36, y, z], palette.paper);
    for (const dz of [-1.3, 0, 1.3])
      box(scene, [0.14, 1.95, 0.08], [-5.36, 2.25, z + dz], palette.paper);
    box(scene, [0.45, 0.1, 2.85], [-5.23, 1.26, z], palette.wood);
    box(scene, [0.12, 2.15, 0.28], [-5.15, 2.25, z - 1.42], "#e5d19a");
    box(scene, [0.12, 2.15, 0.28], [-5.15, 2.25, z + 1.42], "#e5d19a");
  }
  // Pale patches suggest window light without a costly post-processing pass.
  const lightPatchMaterial = new THREE.MeshBasicMaterial({
    color: "#fff4c8",
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  for (const z of [-1.8, 1.4]) {
    const patch = mesh(new THREE.PlaneGeometry(2.4, 2.1), lightPatchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = -0.24;
    patch.position.set(-3.7, 0.004, z);
  }

  const board = makeObject("O01", [-0.7, 0, -5.38]);
  box(board, [4.55, 1.85, 0.14], [0, 2.05, 0], palette.darkWood);
  panel(board, [4.3, 1.6], [0, 2.05, 0.081], (ctx, w, h) => {
    ctx.fillStyle = palette.green;
    ctx.fillRect(0, 0, w, h);
    text(
      ctx,
      pack.shell === "library" ? "함께 읽는 도서관" : "우리들의 우정 교실",
      w / 2,
      70,
      56,
      "#fff5d4",
    );
    text(
      ctx,
      "다섯 우정 조각을 모아 지도를 완성해요",
      w / 2,
      142,
      27,
      "#e0ead6",
    );
    ["듣기", "존중", "함께하기", "배려", "도움"].forEach((word, i) => {
      ctx.fillStyle = "#5d7b63";
      ctx.beginPath();
      ctx.arc(110 + i * 137, 245, 49, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, word, 110 + i * 137, 245, 25, "#fff9e7");
    });
    text(ctx, "친구의 마음이 교실을 여는 열쇠", w / 2, 345, 24, "#ecdf9a");
  });
  box(board, [4.6, 0.1, 0.27], [0, 1.07, 0.08], palette.darkWood);
  box(board, [0.28, 0.055, 0.11], [1.65, 1.14, 0.09], "#f3ebcd");

  const bulletin = makeObject("O02", [3.35, 0, -5.37]);
  box(bulletin, [2.15, 1.72, 0.13], [0, 2.05, 0], palette.darkWood);
  panel(bulletin, [1.95, 1.5], [0, 2.05, 0.08], (ctx, w, h) => {
    ctx.fillStyle = "#c6a477";
    ctx.fillRect(0, 0, w, h);
    text(ctx, "함께 만드는 축제", w / 2, 50, 37, palette.paper);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(145 + i * 235, 220);
      ctx.rotate((i - 1) * 0.075);
      ctx.fillStyle = ["#fff6cf", "#edf2df", "#f8e3d8"][i];
      ctx.fillRect(-92, -115, 184, 230);
      animalFace(ctx, 0, -28, 100, i);
      text(ctx, ["친구의 이야기", "함께해요!", "초대장"][i], 0, 69, 23);
      ctx.fillStyle = "#e99873";
      ctx.beginPath();
      ctx.arc(0, -108, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  outline(bulletin, [2.17, 1.74, 0.15], [0, 2.05, 0]);

  const basket = makeObject("O03", [-4.63, 0, -0.9]);
  table(basket, 0, 0, 1.25, 0.95);
  box(basket, [0.65, 0.4, 0.5], [-0.13, 1.16, 0], "#b78e5f");
  for (let y = 1.02; y <= 1.36; y += 0.09)
    box(basket, [0.68, 0.035, 0.53], [-0.13, y, 0], "#d4b781");
  for (let i = 0; i < 5; i++) {
    const pencil = cylinder(
      basket,
      0.025,
      0.025,
      0.5,
      [-0.3 + i * 0.09, 1.42, 0],
      [palette.yellow, palette.green, "#b77355"][i % 3],
      6,
    );
    pencil.rotation.z = (i - 2) * 0.12;
  }
  const note = panel(basket, [0.44, 0.46], [0.38, 1.18, 0.3], (ctx, w, h) => {
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, w, h);
    animalFace(ctx, 200, 200, 260, 0);
    text(ctx, "함께", 530, 165, 80);
    text(
      ctx,
      pack.shell === "library" ? "읽고 싶어" : "만들고 싶어",
      530,
      265,
      56,
    );
  });
  note.rotation.y = Math.PI / 2 - 0.35;

  const desk = makeObject("O04", [-2.95, 0, 1.4]);
  table(desk, 0, 0, 1.7, 1.1);
  box(desk, [0.64, 0.05, 0.56], [0.2, 1.0, 0.05], palette.paper);
  const cipher = panel(desk, [0.57, 0.5], [0.2, 1.029, 0.05], (ctx, w, h) => {
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        ctx.strokeStyle = "#9eb291";
        ctx.lineWidth = 5;
        ctx.strokeRect(c * 256 + 10, r * 128 + 5, 236, 118);
        text(
          ctx,
          String([7, 2, 9, 4, 6, 1, 8, 3, 5][r * 3 + c]),
          c * 256 + 128,
          r * 128 + 64,
          75,
        );
      }
  });
  cipher.rotation.x = -Math.PI / 2;
  const drawer = new THREE.Group();
  desk.add(drawer);
  box(drawer, [1.35, 0.18, 0.3], [0, 0.71, 0.47], "#c6a06c");
  box(drawer, [0.25, 0.045, 0.045], [0, 0.73, 0.64], palette.darkWood);
  const chair = new THREE.Group();
  desk.add(chair);
  chair.position.set(0, 0, -0.95);
  box(chair, [0.72, 0.09, 0.65], [0, 0.48, 0], "#9eae82");
  box(chair, [0.72, 0.55, 0.09], [0, 0.83, -0.28], "#9eae82");
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(
        chair,
        [0.065, 0.48, 0.065],
        [sx * 0.26, 0.24, sz * 0.24],
        palette.green,
      );
  table(scene, -2.95, -2.2, 1.7, 1.1);
  box(scene, [0.5, 0.05, 0.42], [-2.95, 0.99, -2.2], "#b7c5a1");

  const lockers = makeObject("O05", [4.9, 0, 1.4]);
  box(lockers, [0.86, 1.8, 2.2], [0, 0.9, 0], palette.wood);
  for (let z = 0; z < 3; z++)
    for (let y = 0; y < 2; y++) {
      box(
        lockers,
        [0.06, 0.78, 0.63],
        [-0.46, 0.47 + y * 0.85, -0.72 + z * 0.72],
        (z + y) % 2 ? "#dce5cb" : "#ecdfb3",
      );
      box(
        lockers,
        [0.07, 0.08, 0.11],
        [-0.51, 0.47 + y * 0.85, -0.5 + z * 0.72],
        palette.darkWood,
      );
    }
  const nameCards = panel(
    lockers,
    [1.75, 0.37],
    [-0.51, 1.97, 0],
    (ctx, w, h) => {
      ctx.fillStyle = "#f7f2de";
      ctx.fillRect(0, 0, w, h);
      text(ctx, "친구의 물건은 허락을 받고", w / 2, h / 2, 49);
    },
  );
  nameCards.rotation.y = -Math.PI / 2;

  const toolbox = makeObject("O06", [4.78, 0, -1.38]);
  table(toolbox, 0, 0, 1.1, 1.35);
  box(toolbox, [0.8, 0.4, 0.9], [0, 1.17, 0], "#789574");
  const lid = new THREE.Group();
  toolbox.add(lid);
  lid.position.set(0, 1.4, -0.48);
  box(lid, [0.85, 0.07, 0.96], [0, 0, 0.48], "#91ac83");
  const toolLabel = panel(
    toolbox,
    [0.72, 0.28],
    [-0.415, 1.18, 0],
    (ctx, w, h) => {
      ctx.fillStyle = palette.paper;
      ctx.fillRect(0, 0, w, h);
      text(ctx, "함께 쓰는 도구", w / 2, h / 2, 77);
    },
  );
  toolLabel.rotation.y = -Math.PI / 2;
  const lens = mesh(
    new THREE.TorusGeometry(0.18, 0.035, 6, 20),
    mat(palette.yellow),
    toolbox,
  );
  lens.position.set(-0.08, 1.49, 0.16);
  lens.rotation.x = -Math.PI / 2;
  box(toolbox, [0.07, 0.04, 0.24], [-0.08, 1.49, 0.43], palette.yellow);

  const floorGame = makeObject("O07", [-1.7, 0, 3.8]);
  const rug = panel(floorGame, [2.0, 1.65], [0, 0.018, 0], (ctx, w, h) => {
    ctx.fillStyle = "#e7ead2";
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#f8f1d5" : "#d8e2c7";
        ctx.fillRect((c * w) / 5 + 3, (r * h) / 5 + 3, w / 5 - 6, h / 5 - 6);
      }
    [
      [0, 0],
      [2, 0],
      [2, 4],
      [4, 4],
    ].forEach(([c, r], i) =>
      animalFace(ctx, ((c + 0.5) * w) / 5, ((r + 0.55) * h) / 5, 64, i),
    );
  });
  rug.rotation.x = -Math.PI / 2;
  const ball = mesh(
    new THREE.SphereGeometry(0.14, 12, 8),
    mat("#edb74c"),
    floorGame,
  );
  ball.position.set(-0.8, 0.15, 0.1);

  const tablet = makeObject("O08", [1.55, 0, 0.5]);
  table(tablet, 0, 0, 1.65, 1.05);
  const device = new THREE.Group();
  tablet.add(device);
  device.position.set(0, 1.1, -0.07);
  device.rotation.x = -0.4;
  box(device, [0.85, 0.62, 0.06], [0, 0.15, 0], palette.green);
  const screen = panel(device, [0.72, 0.5], [0, 0.15, -0.035], (ctx, w, h) => {
    ctx.fillStyle = "#dfebd7";
    ctx.fillRect(0, 0, w, h);
    text(ctx, "친구에게 보내기 전에", w / 2, 68, 35);
    animalFace(ctx, 180, 205, 145, 0);
    animalFace(ctx, 580, 205, 145, 1);
    text(ctx, "…", w / 2, 210, 110);
    text(ctx, "멈추고 생각해요", w / 2, 330, 33);
  });
  screen.rotation.y = Math.PI;

  const help = makeObject("O09", [2.4, 0, 5.38]);
  box(help, [2.8, 1.95, 0.15], [0, 2, 0], palette.wood);
  const helpPanel = panel(help, [2.58, 1.73], [0, 2, -0.083], (ctx, w, h) => {
    ctx.fillStyle = "#f9f5e4";
    ctx.fillRect(0, 0, w, h);
    text(ctx, "도움이 필요할 때", w / 2, 50, 43);
    ctx.strokeStyle = "#89a37d";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(110, 220);
    ctx.lineTo(650, 220);
    ctx.stroke();
    ["교실", "복도", "교무실", "상담실"].forEach((word, i) => {
      ctx.fillStyle = ["#edd694", "#d6e2c5", "#d6e2c5", "#e9c6a8"][i];
      ctx.fillRect(50 + i * 180, 153, 128, 128);
      text(ctx, word, 114 + i * 180, 217, 31);
    });
    text(ctx, "혼자 참지 않아도 괜찮아요", w / 2, 335, 29);
  });
  helpPanel.rotation.y = Math.PI;

  const books = makeObject("O10", [-4.65, 0, 4.35]);
  box(books, [1.4, 1.85, 0.6], [0, 0.925, 0], "#bf9967");
  for (const y of [0.13, 0.67, 1.21, 1.78])
    box(books, [1.5, 0.08, 0.66], [0, y, 0.02], palette.darkWood);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 7; i++) {
      const book = box(
        books,
        [0.12 + (i % 2) * 0.02, 0.3 + (i % 3) * 0.05, 0.35],
        [-0.57 + i * 0.18, 0.32 + row * 0.54, 0.17],
        ["#96a97d", "#e1c68e", "#bb7d61", "#a8c2b7"][i % 4],
      );
      if (i === 6) book.rotation.z = -0.13;
    }
  // Shelf faces the aisle, leaving the rear corridor clear.
  books.rotation.y = Math.PI / 2;
  const plant = makeObject("O11", [-4.7, 0, -3.8]);
  cylinder(plant, 0.48, 0.48, 0.08, [0, 0.08, 0], "#af8758");
  cylinder(plant, 0.37, 0.25, 0.55, [0, 0.39, 0], "#c8926b");
  cylinder(plant, 0.4, 0.4, 0.1, [0, 0.68, 0], "#dcad7d");
  cylinder(plant, 0.035, 0.045, 1.1, [0, 1.1, 0], "#6a8051", 6);
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      mat(i % 2 ? "#6c8e58" : "#8ba169"),
      plant,
    );
    const angle = i * 2.4;
    leaf.position.set(
      Math.sin(angle) * 0.25,
      1.0 + i * 0.11,
      Math.cos(angle) * 0.25,
    );
    leaf.scale.set(0.55, 1.1, 0.65);
    leaf.rotation.z = Math.sin(angle) * 0.75;
  }

  const door = makeObject("O12", [5.39, 0, -3.65]);
  box(door, [0.18, 2.95, 1.65], [0, 1.475, 0], palette.darkWood);
  box(door, [0.2, 2.75, 1.43], [-0.07, 1.4, 0], "#bbccae");
  box(door, [0.22, 0.82, 0.93], [-0.1, 2, 0], "#d5e5dc");
  cylinder(
    door,
    0.045,
    0.045,
    0.28,
    [-0.23, 1.14, 0.48],
    palette.yellow,
    10,
  ).rotation.z = Math.PI / 2;
  const doorParts = [...door.children];
  const doorLeaf = new THREE.Group();
  doorLeaf.position.z = -0.825;
  door.add(doorLeaf);
  for (const part of doorParts) {
    doorLeaf.add(part);
    part.position.z += 0.825;
  }
  const lamps: THREE.MeshStandardMaterial[] = [];
  // Keep the lights above the exit sign so the large object label cannot hide them.
  box(door, [0.08, 0.24, 1.5], [-0.17, 3.48, 0], palette.green);
  for (let i = 0; i < 5; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: "#aab49b",
      emissive: "#6f9b3e",
      emissiveIntensity: 0,
    });
    lamps.push(material);
    const lamp = mesh(new THREE.SphereGeometry(0.08, 10, 8), material, door);
    lamp.position.set(-0.25, 3.48, -0.48 + i * 0.24);
  }
  if (pack.shell === "library") {
    for (const x of [-2.2, -0.65]) {
      const shelf = new THREE.Group();
      scene.add(shelf);
      box(shelf, [1.25, 2.3, 0.3], [x, 1.15, 5.25], palette.wood);
      for (let row = 0; row < 3; row++)
        for (let book = 0; book < 7; book++)
          box(
            shelf,
            [0.12, 0.48, 0.16],
            [x - 0.47 + book * 0.15, 0.42 + row * 0.67, 5.01],
            ["#7e9d83", "#e1c875", "#cb9c88"][book % 3],
          );
    }
  }
  const exitSign = panel(door, [1.16, 0.34], [-0.16, 3.15, 0], (ctx, w, h) => {
    ctx.fillStyle = palette.green;
    ctx.fillRect(0, 0, w, h);
    text(ctx, "출구  →", w / 2, h / 2, 105, palette.paper);
  });
  exitSign.rotation.y = -Math.PI / 2;
  const combination = panel(
    door,
    [0.65, 0.5],
    [-0.18, 1.46, -0.28],
    (ctx, w, h) => {
      ctx.fillStyle = "#fff6d7";
      ctx.fillRect(0, 0, w, h);
      text(ctx, "우정 조합판", w / 2, 95, 65);
      text(ctx, "☆ ☆ ☆ ☆ ☆", w / 2, 245, 78, "#a08343");
    },
  );
  combination.rotation.y = -Math.PI / 2;

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
    button.setAttribute("aria-label", `${stop.name} 이동`);
    button.title = `${stop.name} 이동`;
    button.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="8" cy="8" rx="3" ry="5" transform="rotate(-18 8 8)"/><ellipse cx="16" cy="15" rx="3" ry="5" transform="rotate(18 16 15)"/></svg><span>${stopLabels[id]}<small>가기</small></span>`;
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
  function requestDraw() {
    if (!disposed && active && !frame) frame = requestAnimationFrame(render);
  }
  function render(now: number) {
    frame = 0;
    if (disposed || !active || !host.isConnected) return;
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
    positionLabels();
    if (tween || deviceMoving) requestDraw();
    if (!tween && !moving)
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
    const labelTop =
      location.parentElement!.getBoundingClientRect().bottom -
      stageRect.top +
      30;
    const turnRect = host
      .querySelector(".classroom-3d-controls")!
      .getBoundingClientRect();
    const labelBottom =
      turnRect.top >= stageRect.top && turnRect.bottom <= stageRect.bottom
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
          if (closeup.visible) point = closeup;
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
      const visible = point.visible && distance > 0.4 && !overlaps && !moving;
      object.button.hidden = !visible;
      if (visible) {
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
  }
  function cancelJourney(restoreStop = false) {
    journey += 1;
    tween = null;
    setMoving(false);
    if (restoreStop) {
      // A modal may interrupt a walk halfway through an aisle. Return to its
      // last safe stop so the position, place name, and next route agree.
      camera.position.set(STOPS[currentStop].x, 1.8, STOPS[currentStop].z);
    }
    location.textContent = STOPS[currentStop].name.replace("교실", pack.room);
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
    const token = journey;
    const path = route(currentStop, id);
    setMoving(true);
    const destinationName = object
      ? sceneObjects.find((item) => item.id === object.id)!.name
      : STOPS[id].name;
    movingLabel.textContent = object
      ? `${destinationName} 살펴보러 가요…`
      : `${destinationName}까지 가고 있어요…`;
    instruction.textContent = object
      ? `${destinationName}에 도착하면 바로 살펴봐요.`
      : `${destinationName}에 도착하면 주변을 둘러봐요.`;
    const finish = () => {
      if (token !== journey || !active || disposed) return;
      currentStop = id;
      location.textContent = STOPS[id].name.replace("교실", pack.room);
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
        options.onPoseChange?.({
          stop: currentStop,
          yaw: normalizeAngle(yaw),
          pitch,
        });
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
        travel(index + 1);
        return;
      }
      animate(to, yaw, pitch, Math.min(820, distance * 150), () => {
        currentStop = stopId;
        travel(index + 1);
      });
    };
    travel(0);
  }
  function focusObject(id: string) {
    const object = objects.find((item) => item.id === id);
    if (object) navigate(object.stop, object);
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
  const onControlClick = (event: Event) => {
    const place = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-scene-place]",
    )?.dataset.scenePlace;
    if (place) {
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
      return;
    }
    const control = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-scene-control]",
    )?.dataset.sceneControl;
    if (control === "left") turn(Math.PI / 3);
    if (control === "right") turn(-Math.PI / 3);
    if (control === "center") resetView();
  };
  host.addEventListener("click", onControlClick);
  const raycaster = new THREE.Raycaster();
  const gestures = bindSceneGestures(stage, {
    enabled: () => active && !moving && !disposed,
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
    cancelJourney();
    if (!disposed) options.onFailure();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  function resize() {
    if (disposed || !host.isConnected) return;
    const width = stage.clientWidth,
      height = stage.clientHeight;
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 520 ? 78 : 68;
    camera.updateProjectionMatrix();
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    camera.updateMatrixWorld();
    positionLabels();
    requestDraw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  const onVisibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else requestDraw();
  };
  document.addEventListener("visibilitychange", onVisibility);
  function setState(next: ClassroomState) {
    if (state.drawerOpen !== next.drawerOpen)
      deviceTargets.drawer = next.drawerOpen ? 1 : 0;
    if (state.toolTaken !== next.toolTaken)
      deviceTargets.lid = next.toolTaken ? 1 : 0;
    if (state.exitUsed !== next.exitUsed)
      deviceTargets.door = next.exitUsed ? 1 : 0;
    lamps.forEach((material, i) => {
      const found = !!next.solvedPuzzleIds[i];
      material.color.set(found ? "#e9cf72" : "#aab49b");
      material.emissiveIntensity = found ? 0.35 : 0;
    });
    state = next;
    reducedMotion = next.reducedMotion;
    const wasActive = active;
    active = next.active;
    if (!active) {
      cancelJourney(true);
      gestures.cancel();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
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
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    host.removeEventListener("click", onControlClick);
    gestures.dispose();
    canvas.removeEventListener("webglcontextlost", onContextLost);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const item of textures) item.dispose();
    renderer.dispose();
    scene.clear();
    host.replaceChildren();
  }
  resize();
  return { setState, focusObject, resetView, operateObject, resize, dispose };
}
