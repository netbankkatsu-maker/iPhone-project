import Phaser from "phaser";
import { MAP_W, MAP_H, COLORS, EXTRACTION_RADIUS } from "./constants";

interface RoomDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DoorDef {
  x: number;
  y: number;
  isOpen: boolean;
  horizontal: boolean;
  visual: Phaser.GameObjects.Rectangle;
}

export interface HazardDef {
  x: number;
  y: number;
  type: "landmine" | "toxic_gas";
  radius: number;
  gameObject: Phaser.GameObjects.Arc;
}

export interface MapData {
  walls: Phaser.Physics.Arcade.StaticGroup;
  spawnPoint: Phaser.Math.Vector2;
  extractionPoint: Phaser.Math.Vector2;
  extractionZone: Phaser.GameObjects.Arc;
  enemySpawnPoints: Phaser.Math.Vector2[];
  lootPoints: Phaser.Math.Vector2[];
  hazards: HazardDef[];
  doors: DoorDef[];
}

export function generateMap(scene: Phaser.Scene): MapData {
  // Ground
  scene.add.rectangle(MAP_W / 2, MAP_H / 2, MAP_W, MAP_H, COLORS.ground);

  // Grid
  const gfx = scene.add.graphics({
    lineStyle: { width: 1, color: 0x3a3a5e, alpha: 0.2 },
  });
  for (let x = 0; x <= MAP_W; x += 100) gfx.lineBetween(x, 0, x, MAP_H);
  for (let y = 0; y <= MAP_H; y += 100) gfx.lineBetween(0, y, MAP_W, y);

  // Walls group
  const walls = scene.physics.add.staticGroup();

  // Border walls
  addWall(scene, walls, MAP_W / 2, 0, MAP_W, 20);
  addWall(scene, walls, MAP_W / 2, MAP_H, MAP_W, 20);
  addWall(scene, walls, 0, MAP_H / 2, 20, MAP_H);
  addWall(scene, walls, MAP_W, MAP_H / 2, 20, MAP_H);

  // Generate random rooms/structures
  const rooms: RoomDef[] = [];
  const attempts = 30;
  for (let i = 0; i < attempts; i++) {
    const rw = Phaser.Math.Between(100, 300);
    const rh = Phaser.Math.Between(100, 300);
    const rx = Phaser.Math.Between(200, MAP_W - 200);
    const ry = Phaser.Math.Between(200, MAP_H - 200);

    // Check overlap with existing rooms
    const overlaps = rooms.some(
      (r) =>
        rx - rw / 2 < r.x + r.w / 2 + 80 &&
        rx + rw / 2 > r.x - r.w / 2 - 80 &&
        ry - rh / 2 < r.y + r.h / 2 + 80 &&
        ry + rh / 2 > r.y - r.h / 2 - 80
    );
    if (overlaps) continue;

    rooms.push({ x: rx, y: ry, w: rw, h: rh });
    createRoom(scene, walls, rx, ry, rw, rh);
  }

  // Scatter standalone walls
  for (let i = 0; i < 20; i++) {
    const wx = Phaser.Math.Between(100, MAP_W - 100);
    const wy = Phaser.Math.Between(100, MAP_H - 100);
    const horizontal = Math.random() > 0.5;
    const ww = horizontal ? Phaser.Math.Between(80, 200) : 20;
    const wh = horizontal ? 20 : Phaser.Math.Between(80, 200);
    addWall(scene, walls, wx, wy, ww, wh);
  }

  // Spawn point (bottom-left area)
  const spawnPoint = new Phaser.Math.Vector2(
    Phaser.Math.Between(100, 400),
    Phaser.Math.Between(MAP_H - 400, MAP_H - 100)
  );

  // Extraction point (top-right area, far from spawn)
  const extractionPoint = new Phaser.Math.Vector2(
    Phaser.Math.Between(MAP_W - 500, MAP_W - 100),
    Phaser.Math.Between(100, 500)
  );

  // Extraction visual zone
  const extractionZone = scene.add.circle(
    extractionPoint.x,
    extractionPoint.y,
    EXTRACTION_RADIUS,
    COLORS.extraction,
    0.2
  );
  extractionZone.setStrokeStyle(2, COLORS.extraction, 0.6);

  // Extraction pulsing label
  const extLabel = scene.add
    .text(extractionPoint.x, extractionPoint.y - EXTRACTION_RADIUS - 10, "EXTRACT", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#00e5ff",
    })
    .setOrigin(0.5);
  scene.tweens.add({
    targets: [extractionZone, extLabel],
    alpha: { from: 0.3, to: 0.8 },
    duration: 800,
    yoyo: true,
    repeat: -1,
  });

  // Enemy spawn points
  const enemySpawnPoints: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 15; i++) {
    let ex: number, ey: number;
    do {
      ex = Phaser.Math.Between(200, MAP_W - 200);
      ey = Phaser.Math.Between(200, MAP_H - 200);
    } while (
      Phaser.Math.Distance.Between(ex, ey, spawnPoint.x, spawnPoint.y) < 400
    );
    enemySpawnPoints.push(new Phaser.Math.Vector2(ex, ey));
  }

  // Loot points (near rooms)
  const lootPoints: Phaser.Math.Vector2[] = rooms.map(
    (r) =>
      new Phaser.Math.Vector2(
        r.x + Phaser.Math.Between(-r.w / 3, r.w / 3),
        r.y + Phaser.Math.Between(-r.h / 3, r.h / 3)
      )
  );

  // Hazards (landmines & toxic gas)
  const hazards: HazardDef[] = [];
  for (let i = 0; i < 8; i++) {
    const hx = Phaser.Math.Between(200, MAP_W - 200);
    const hy = Phaser.Math.Between(200, MAP_H - 200);
    // Don't place near spawn
    if (Phaser.Math.Distance.Between(hx, hy, spawnPoint.x, spawnPoint.y) < 300) continue;

    const type = Math.random() > 0.5 ? "landmine" as const : "toxic_gas" as const;
    const radius = type === "landmine" ? 8 : Phaser.Math.Between(40, 70);

    let go: Phaser.GameObjects.Arc;
    if (type === "landmine") {
      go = scene.add.circle(hx, hy, radius, 0xff1744, 0.4);
      go.setStrokeStyle(1, 0xff1744, 0.6);
    } else {
      go = scene.add.circle(hx, hy, radius, 0x69f0ae, 0.06);
      go.setStrokeStyle(1, 0x69f0ae, 0.2);
      scene.tweens.add({
        targets: go,
        alpha: { from: 0.04, to: 0.12 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
      });
    }
    hazards.push({ x: hx, y: hy, type, radius, gameObject: go });
  }

  // Doors (interactable)
  const doors: DoorDef[] = [];
  for (const room of rooms) {
    const doorSide = Phaser.Math.Between(0, 3);
    let dx: number, dy: number;
    const isHorizontal = doorSide === 0 || doorSide === 1;
    if (doorSide === 0) { dx = room.x; dy = room.y - room.h / 2; }
    else if (doorSide === 1) { dx = room.x; dy = room.y + room.h / 2; }
    else if (doorSide === 2) { dx = room.x - room.w / 2; dy = room.y; }
    else { dx = room.x + room.w / 2; dy = room.y; }

    const doorVis = scene.add.rectangle(
      dx, dy,
      isHorizontal ? 36 : 12,
      isHorizontal ? 12 : 36,
      0x8d6e63, 0.7
    ).setDepth(5);

    doors.push({ x: dx, y: dy, isOpen: true, horizontal: isHorizontal, visual: doorVis });
  }

  return {
    walls,
    spawnPoint,
    extractionPoint,
    extractionZone,
    enemySpawnPoints,
    lootPoints,
    hazards,
    doors,
  };
}

function createRoom(
  scene: Phaser.Scene,
  walls: Phaser.Physics.Arcade.StaticGroup,
  cx: number,
  cy: number,
  w: number,
  h: number
) {
  const wallThick = 16;
  const doorWidth = 40;

  // Pick which walls get doors
  const doorSide = Phaser.Math.Between(0, 3);

  // Top wall
  if (doorSide === 0) {
    const half = (w - doorWidth) / 2;
    addWall(scene, walls, cx - doorWidth / 2 - half / 2, cy - h / 2, half, wallThick);
    addWall(scene, walls, cx + doorWidth / 2 + half / 2, cy - h / 2, half, wallThick);
  } else {
    addWall(scene, walls, cx, cy - h / 2, w, wallThick);
  }

  // Bottom wall
  if (doorSide === 1) {
    const half = (w - doorWidth) / 2;
    addWall(scene, walls, cx - doorWidth / 2 - half / 2, cy + h / 2, half, wallThick);
    addWall(scene, walls, cx + doorWidth / 2 + half / 2, cy + h / 2, half, wallThick);
  } else {
    addWall(scene, walls, cx, cy + h / 2, w, wallThick);
  }

  // Left wall
  if (doorSide === 2) {
    const half = (h - doorWidth) / 2;
    addWall(scene, walls, cx - w / 2, cy - doorWidth / 2 - half / 2, wallThick, half);
    addWall(scene, walls, cx - w / 2, cy + doorWidth / 2 + half / 2, wallThick, half);
  } else {
    addWall(scene, walls, cx - w / 2, cy, wallThick, h);
  }

  // Right wall
  if (doorSide === 3) {
    const half = (h - doorWidth) / 2;
    addWall(scene, walls, cx + w / 2, cy - doorWidth / 2 - half / 2, wallThick, half);
    addWall(scene, walls, cx + w / 2, cy + doorWidth / 2 + half / 2, wallThick, half);
  } else {
    addWall(scene, walls, cx + w / 2, cy, wallThick, h);
  }

  // Floor tint
  scene.add
    .rectangle(cx, cy, w - wallThick * 2, h - wallThick * 2, 0x222238, 0.5)
    .setDepth(0);
}

function addWall(
  scene: Phaser.Scene,
  walls: Phaser.Physics.Arcade.StaticGroup,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const rect = scene.add.rectangle(x, y, w, h, COLORS.wall);
  walls.add(rect);
  const body = rect.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(w, h);
  body.setOffset(-(w / 2), -(h / 2));
}
