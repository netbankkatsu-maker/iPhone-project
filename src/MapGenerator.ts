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
  // ── Ground base layer ──
  scene.add.rectangle(MAP_W / 2, MAP_H / 2, MAP_W, MAP_H, 0x141810);

  // ── Natural ground textures ──
  const gfx = scene.add.graphics();

  // Large dirt/earth patches (varied terrain)
  for (let i = 0; i < 40; i++) {
    const dx = Phaser.Math.Between(50, MAP_W - 50);
    const dy = Phaser.Math.Between(50, MAP_H - 50);
    const dr = Phaser.Math.Between(40, 120);
    const shade = Phaser.Math.Between(0, 3);
    const dirtColors = [0x1a1e10, 0x181c0e, 0x1c200f, 0x151a0c];
    gfx.fillStyle(dirtColors[shade], Phaser.Math.FloatBetween(0.3, 0.6));
    gfx.fillEllipse(dx, dy, dr * 2, dr * 1.5);
  }

  // Dirt paths (lighter trails connecting areas)
  for (let i = 0; i < 8; i++) {
    const sx = Phaser.Math.Between(100, MAP_W - 100);
    const sy = Phaser.Math.Between(100, MAP_H - 100);
    const ex = sx + Phaser.Math.Between(-600, 600);
    const ey = sy + Phaser.Math.Between(-600, 600);
    const segments = 10;
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const px = sx + (ex - sx) * t + Phaser.Math.Between(-30, 30);
      const py = sy + (ey - sy) * t + Phaser.Math.Between(-30, 30);
      gfx.fillStyle(0x1e2214, Phaser.Math.FloatBetween(0.2, 0.4));
      gfx.fillEllipse(px, py, Phaser.Math.Between(20, 50), Phaser.Math.Between(15, 35));
    }
  }

  // Grass patches (using texture if available)
  if (scene.textures.exists("grass_patch")) {
    for (let i = 0; i < 80; i++) {
      const gx = Phaser.Math.Between(30, MAP_W - 30);
      const gy = Phaser.Math.Between(30, MAP_H - 30);
      scene.add.image(gx, gy, "grass_patch")
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.7))
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
        .setDepth(0);
    }
  }

  // Scattered small debris
  for (let i = 0; i < 50; i++) {
    const dx = Phaser.Math.Between(50, MAP_W - 50);
    const dy = Phaser.Math.Between(50, MAP_H - 50);
    gfx.fillStyle(0x2a2820, Phaser.Math.FloatBetween(0.1, 0.25));
    gfx.fillCircle(dx, dy, Phaser.Math.Between(1, 3));
  }

  // ── Trees scattered across map ──
  if (scene.textures.exists("tree")) {
    for (let i = 0; i < 60; i++) {
      const tx = Phaser.Math.Between(60, MAP_W - 60);
      const ty = Phaser.Math.Between(60, MAP_H - 60);
      const tree = scene.add.image(tx, ty, "tree")
        .setDepth(8)
        .setAlpha(Phaser.Math.FloatBetween(0.7, 1.0));
      // Slight size variation
      const sc = Phaser.Math.FloatBetween(0.8, 1.3);
      tree.setScale(sc);
    }
  }

  // ── Bushes ──
  if (scene.textures.exists("bush")) {
    for (let i = 0; i < 40; i++) {
      const bx = Phaser.Math.Between(40, MAP_W - 40);
      const by = Phaser.Math.Between(40, MAP_H - 40);
      scene.add.image(bx, by, "bush")
        .setDepth(7)
        .setAlpha(Phaser.Math.FloatBetween(0.5, 0.9))
        .setScale(Phaser.Math.FloatBetween(0.7, 1.2));
    }
  }

  // Walls group
  const walls = scene.physics.add.staticGroup();

  // Border walls
  addWall(scene, walls, MAP_W / 2, 0, MAP_W, 20);
  addWall(scene, walls, MAP_W / 2, MAP_H, MAP_W, 20);
  addWall(scene, walls, 0, MAP_H / 2, 20, MAP_H);
  addWall(scene, walls, MAP_W, MAP_H / 2, 20, MAP_H);

  // Generate random buildings/structures
  const rooms: RoomDef[] = [];
  const attempts = 30;
  for (let i = 0; i < attempts; i++) {
    const rw = Phaser.Math.Between(100, 300);
    const rh = Phaser.Math.Between(100, 300);
    const rx = Phaser.Math.Between(200, MAP_W - 200);
    const ry = Phaser.Math.Between(200, MAP_H - 200);

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

  // Scatter standalone walls (ruined walls, barriers)
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

  // Extraction visual zone (subtler, more tactical)
  const extractionZone = scene.add.circle(
    extractionPoint.x,
    extractionPoint.y,
    EXTRACTION_RADIUS,
    COLORS.extraction,
    0.15
  );
  extractionZone.setStrokeStyle(1.5, COLORS.extraction, 0.4);

  // Extraction marker (small, not flashy)
  const extLabel = scene.add
    .text(extractionPoint.x, extractionPoint.y - EXTRACTION_RADIUS - 8, "EXTRACT", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#40a090",
    })
    .setOrigin(0.5);
  scene.tweens.add({
    targets: [extractionZone, extLabel],
    alpha: { from: 0.2, to: 0.6 },
    duration: 1200,
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
    if (Phaser.Math.Distance.Between(hx, hy, spawnPoint.x, spawnPoint.y) < 300) continue;

    const type = Math.random() > 0.5 ? "landmine" as const : "toxic_gas" as const;
    const radius = type === "landmine" ? 8 : Phaser.Math.Between(40, 70);

    let go: Phaser.GameObjects.Arc;
    if (type === "landmine") {
      go = scene.add.circle(hx, hy, radius, 0x5a4020, 0.25);
      go.setStrokeStyle(1, 0x6a4a20, 0.3);
    } else {
      go = scene.add.circle(hx, hy, radius, 0x304010, 0.06);
      go.setStrokeStyle(1, 0x4a6020, 0.12);
      scene.tweens.add({
        targets: go,
        alpha: { from: 0.03, to: 0.09 },
        duration: 2500,
        yoyo: true,
        repeat: -1,
      });
    }
    hazards.push({ x: hx, y: hy, type, radius, gameObject: go });
  }

  // Doors
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
      isHorizontal ? 36 : 10,
      isHorizontal ? 10 : 36,
      0x4a3828, 0.7
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

  // Interior floor (concrete/wood - using tile texture if available)
  if (scene.textures.exists("floor_tile")) {
    const floor = scene.add.tileSprite(cx, cy, w - wallThick * 2, h - wallThick * 2, "floor_tile");
    floor.setDepth(0);
    floor.setAlpha(0.8);
  } else {
    scene.add
      .rectangle(cx, cy, w - wallThick * 2, h - wallThick * 2, 0x1e1c16, 0.7)
      .setDepth(0);
  }

  // Interior details - random furniture/debris
  const numDebris = Phaser.Math.Between(0, 3);
  for (let i = 0; i < numDebris; i++) {
    const fx = cx + Phaser.Math.Between(-w / 3, w / 3);
    const fy = cy + Phaser.Math.Between(-h / 3, h / 3);
    const fgfx = scene.add.graphics();
    fgfx.fillStyle(0x2a2520, Phaser.Math.FloatBetween(0.3, 0.5));
    const fw = Phaser.Math.Between(8, 20);
    const fh = Phaser.Math.Between(8, 16);
    fgfx.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
    fgfx.setDepth(1);
  }
}

function addWall(
  scene: Phaser.Scene,
  walls: Phaser.Physics.Arcade.StaticGroup,
  x: number,
  y: number,
  w: number,
  h: number
) {
  let wallObj: Phaser.GameObjects.GameObject;
  if (scene.textures.exists("wall_tile")) {
    const tile = scene.add.tileSprite(x, y, w, h, "wall_tile");
    tile.setDepth(2);
    wallObj = tile;
  } else {
    wallObj = scene.add.rectangle(x, y, w, h, COLORS.wall);
  }
  walls.add(wallObj);
  const body = (wallObj as any).body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(w, h);
  body.updateFromGameObject();
}
