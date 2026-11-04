import * as THREE from "three";
import { PUZZLES } from "../game/model";
import type { episode } from "../content/episodes";
import type { sceneQuality } from "./quality";
import type { ClassroomState } from "./classroom";
import {
  LOGICAL_H,
  LOGICAL_W,
  animalFace,
  paintPanel,
  text,
} from "./canvas-art";

// Everything the room is made of: the shell, lights and the twelve objects with
// their signs. classroom.ts keeps the camera, movement and labels; a new story
// changes what is built here, not how the room is explored.
export interface RoomContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  quality: ReturnType<typeof sceneQuality>;
  pack: ReturnType<typeof episode>;
  piece: string;
  cipherDigits?: number[];
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  clickableGroups: Map<string, THREE.Group>;
}
export function buildRoom(room: RoomContext) {
  const {
    scene,
    renderer,
    quality,
    pack,
    piece,
    cipherDigits,
    geometries,
    materials,
    textures,
    clickableGroups,
  } = room;
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
    size: number[],
  ) {
    // The board and notes are read up close in fullscreen, so phones get the same
    // 2048 cap as desktops (only the few large panels reach it).
    const max = Math.min(2048, renderer.capabilities.maxTextureSize);
    const result = new THREE.CanvasTexture(paintPanel(draw, size, max));
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
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
      map: texture(draw, size),
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
  const floorSeams: { size: number[]; at: number[] }[] = [];
  for (let x = -5.2; x <= 5.2; x += 0.65)
    floorSeams.push({ size: [0.012, 0.006, 11], at: [x, -0.015, 0] });
  for (let x = -4.9; x <= 5; x += 1.3)
    for (let z = -4.7; z < 5; z += 2.2)
      floorSeams.push({
        size: [0.65, 0.006, 0.012],
        at: [x, -0.014, z + (Math.round(x * 10) % 2 ? 0.5 : 0)],
      });
  // Reuse one box and one draw call for the many static wooden floor seams.
  const seamGeometry = new THREE.BoxGeometry(1, 1, 1);
  geometries.add(seamGeometry);
  const floorGrid = new THREE.InstancedMesh(
    seamGeometry,
    mat("#cfb081"),
    floorSeams.length,
  );
  floorSeams.forEach(({ size, at }, i) =>
    floorGrid.setMatrixAt(
      i,
      new THREE.Matrix4()
        .makeScale(...(size as [number, number, number]))
        .setPosition(...(at as [number, number, number])),
    ),
  );
  floorGrid.instanceMatrix.needsUpdate = true;
  floorGrid.receiveShadow = quality.shadows;
  scene.add(floorGrid);
  if (pack.shell === "gym") {
    for (const x of [-2.4, 2.4])
      box(scene, [0.065, 0.016, 6.5], [x, 0.017, 0], "#78956e");
    for (const z of [-3.25, 0, 3.25])
      box(scene, [4.8, 0.016, 0.065], [0, 0.017, z], "#78956e");
    const circle = mesh(
      new THREE.TorusGeometry(0.9, 0.018, 5, 40),
      mat("#78956e"),
    );
    circle.rotation.x = Math.PI / 2;
    circle.position.y = 0.03;
    for (const z of [-5.25, 5.25]) {
      const hoopX = 0;
      box(scene, [1.4, 0.85, 0.07], [hoopX, 3.25, z], palette.paper);
      const ring = mesh(
        new THREE.TorusGeometry(0.27, 0.035, 6, 20),
        mat("#ae8a50"),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(hoopX, 2.85, z + (z < 0 ? 0.3 : -0.3));
    }
    for (const z of [1.9, 3.1]) {
      box(scene, [0.7, 0.15, 1.3], [4.75, 0.55, z], palette.wood);
      box(scene, [0.15, 0.55, 1.1], [4.8, 0.26, z], palette.green);
    }
  }
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
      pack.shell === "gym"
        ? "모두 함께 뛰는 체육관"
        : pack.shell === "library"
          ? "함께 읽는 도서관"
          : "우리들의 우정 교실",
      w / 2,
      70,
      56,
      "#fff5d4",
    );
    text(
      ctx,
      `다섯 ${piece} 조각을 모아 지도를 완성해요`,
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
    text(
      ctx,
      `친구의 마음이 ${pack.room}을 여는 열쇠`,
      w / 2,
      345,
      24,
      "#ecdf9a",
    );
  });
  box(board, [4.6, 0.1, 0.27], [0, 1.07, 0.08], palette.darkWood);
  box(board, [0.28, 0.055, 0.11], [1.65, 1.14, 0.09], "#f3ebcd");

  const bulletin = makeObject("O02", [3.35, 0, -5.37]);
  box(bulletin, [2.15, 1.72, 0.13], [0, 2.05, 0], palette.darkWood);
  panel(bulletin, [1.95, 1.5], [0, 2.05, 0.08], (ctx, w, h) => {
    ctx.fillStyle = "#c6a477";
    ctx.fillRect(0, 0, w, h);
    text(
      ctx,
      pack.shell === "gym"
        ? "함께 뛰는 축제"
        : pack.shell === "library"
          ? "함께 읽는 축제"
          : "함께 만드는 축제",
      w / 2,
      50,
      37,
      palette.paper,
    );
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(145 + i * 235, 220);
      ctx.rotate((i - 1) * 0.075);
      ctx.fillStyle = ["#fff6cf", "#edf2df", "#f8e3d8"][i];
      ctx.fillRect(-92, -115, 184, 230);
      animalFace(ctx, 0, -28, 100, i);
      text(
        ctx,
        ["친구의 이야기", "함께해요!", "초대장"][i],
        0,
        69,
        23,
        palette.ink,
        166,
      );
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
    // The note is nearly square: face on top, words below, all at true proportions.
    animalFace(ctx, w / 2, 112, 165, 0);
    text(ctx, "함께", w / 2, 262, 66);
    text(
      ctx,
      pack.shell === "gym"
        ? "함께 뛰고 싶어"
        : pack.shell === "library"
          ? "읽고 싶어"
          : "만들고 싶어",
      w / 2,
      334,
      52,
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
          String((cipherDigits ?? [7, 2, 9, 4, 6, 1, 8, 3, 5])[r * 3 + c]),
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
      text(ctx, "친구의 물건은 허락을 받고", w / 2, h / 2, 130);
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
    if (pack.shell === "gym") {
      text(ctx, "모두에게 같은 기회", w / 2, 68, 35);
      [0, 1, 2, 3].forEach((friend, i) =>
        animalFace(ctx, 110 + i * 180, 205, 110, friend),
      );
      text(ctx, "두 팀에 한 번씩 참여해요", w / 2, 330, 33);
      return;
    }
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
    [pack.room, "복도", "교무실", "상담실"].forEach((word, i) => {
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
  let gymFlag: THREE.Mesh | undefined;
  cylinder(plant, 0.48, 0.48, 0.08, [0, 0.08, 0], "#af8758");
  cylinder(plant, 0.37, 0.25, 0.55, [0, 0.39, 0], "#c8926b");
  cylinder(plant, 0.4, 0.4, 0.1, [0, 0.68, 0], "#dcad7d");
  cylinder(plant, 0.035, 0.045, 1.1, [0, 1.1, 0], "#6a8051", 6);
  if (pack.shell === "gym") {
    box(plant, [0.055, 1.8, 0.055], [0, 1.5, 0], palette.wood);
    gymFlag = panel(plant, [0.85, 0.55], [0.43, 2.05, 0], (ctx, w, h) => {
      ctx.fillStyle = palette.green;
      ctx.fillRect(0, 0, w, h);
      text(ctx, "함께!", w / 2, h / 2, 110, palette.paper);
    });
    gymFlag.visible = false;
  }
  for (let i = 0; pack.shell !== "gym" && i < 7; i++) {
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
      text(ctx, `${piece} 조합판`, w / 2, 95, 65);
      text(ctx, "☆ ☆ ☆ ☆ ☆", w / 2, 245, 78, "#a08343");
    },
  );
  combination.rotation.y = -Math.PI / 2;
  let combinationMarker = "";
  function updateCombination(next: ClassroomState) {
    const marker = `${next.solvedPuzzleIds.join(",")}:${next.finalCombined}`;
    if (marker === combinationMarker) return;
    combinationMarker = marker;
    const map = (combination.material as THREE.MeshBasicMaterial)
      .map as THREE.CanvasTexture;
    const surface = map.image as HTMLCanvasElement;
    const ctx = surface.getContext("2d")!;
    ctx.fillStyle = "#fff6d7";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    text(ctx, `${piece} 조합판`, LOGICAL_W / 2, 90, 65);
    PUZZLES.forEach((id, i) => {
      const found = next.solvedPuzzleIds.includes(id);
      text(
        ctx,
        found ? "★" : "☆",
        130 + i * 126,
        210,
        95,
        found ? "#a08343" : "#aab49b",
      );
    });
    text(
      ctx,
      next.finalCombined
        ? "지도 완성!"
        : `조각 ${next.solvedPuzzleIds.length}/5`,
      LOGICAL_W / 2,
      320,
      55,
    );
    map.needsUpdate = true;
  }
  return {
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
  };
}
