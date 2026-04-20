import Phaser from "phaser";
import { MAP_W, MAP_H, COLORS, EXTRACTION_RADIUS } from "./constants";

interface RoomDef {
  x: number;
  y: number;
  w: number;
  h: number;
  zone?: string;
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

  const gfx = scene.add.graphics();

  // ── Biome zones (different terrain colors in different map areas) ──
  // Forest zone: top-left quadrant (dense trees, green tint)
  gfx.fillStyle(0x101a0a, 0.4);
  gfx.fillRect(0, 0, MAP_W / 2, MAP_H / 2);
  // Industrial zone: top-right (concrete, gray tint)
  gfx.fillStyle(0x14140f, 0.3);
  gfx.fillRect(MAP_W / 2, 0, MAP_W / 2, MAP_H / 2);
  // Swamp zone: bottom-right (dark, murky)
  gfx.fillStyle(0x0e1408, 0.3);
  gfx.fillRect(MAP_W / 2, MAP_H / 2, MAP_W / 2, MAP_H / 2);
  // Village zone: bottom-left (dirt, warmer)
  gfx.fillStyle(0x1a1810, 0.3);
  gfx.fillRect(0, MAP_H / 2, MAP_W / 2, MAP_H / 2);

  // ── Large dirt/earth patches ──
  for (let i = 0; i < 100; i++) {
    const dx = Phaser.Math.Between(50, MAP_W - 50);
    const dy = Phaser.Math.Between(50, MAP_H - 50);
    const dr = Phaser.Math.Between(40, 150);
    const shade = Phaser.Math.Between(0, 3);
    const dirtColors = [0x1a1e10, 0x181c0e, 0x1c200f, 0x151a0c];
    gfx.fillStyle(dirtColors[shade], Phaser.Math.FloatBetween(0.2, 0.5));
    gfx.fillEllipse(dx, dy, dr * 2, dr * 1.5);
  }

  // ── Dirt roads/paths connecting areas ──
  // Main road (horizontal, across map center)
  for (let x = 0; x < MAP_W; x += 30) {
    const y = MAP_H / 2 + Phaser.Math.Between(-40, 40);
    gfx.fillStyle(0x1e2214, Phaser.Math.FloatBetween(0.3, 0.5));
    gfx.fillEllipse(x, y, Phaser.Math.Between(40, 70), Phaser.Math.Between(25, 45));
  }
  // Main road (vertical)
  for (let y = 0; y < MAP_H; y += 30) {
    const x = MAP_W / 2 + Phaser.Math.Between(-40, 40);
    gfx.fillStyle(0x1e2214, Phaser.Math.FloatBetween(0.3, 0.5));
    gfx.fillEllipse(x, y, Phaser.Math.Between(25, 45), Phaser.Math.Between(40, 70));
  }
  // Random winding trails
  for (let i = 0; i < 15; i++) {
    const sx = Phaser.Math.Between(100, MAP_W - 100);
    const sy = Phaser.Math.Between(100, MAP_H - 100);
    const ex = sx + Phaser.Math.Between(-1200, 1200);
    const ey = sy + Phaser.Math.Between(-1200, 1200);
    const segments = 16;
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const px = sx + (ex - sx) * t + Phaser.Math.Between(-40, 40);
      const py = sy + (ey - sy) * t + Phaser.Math.Between(-40, 40);
      gfx.fillStyle(0x1e2214, Phaser.Math.FloatBetween(0.15, 0.35));
      gfx.fillEllipse(px, py, Phaser.Math.Between(20, 60), Phaser.Math.Between(15, 40));
    }
  }

  // ── Grass patches ──
  if (scene.textures.exists("grass_patch")) {
    for (let i = 0; i < 200; i++) {
      const gx = Phaser.Math.Between(30, MAP_W - 30);
      const gy = Phaser.Math.Between(30, MAP_H - 30);
      scene.add.image(gx, gy, "grass_patch")
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.7))
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
        .setDepth(0);
    }
  }

  // ── Small debris ──
  for (let i = 0; i < 120; i++) {
    const dx = Phaser.Math.Between(50, MAP_W - 50);
    const dy = Phaser.Math.Between(50, MAP_H - 50);
    gfx.fillStyle(0x2a2820, Phaser.Math.FloatBetween(0.1, 0.25));
    gfx.fillCircle(dx, dy, Phaser.Math.Between(1, 3));
  }

  // ── Water puddles (swamp zone mainly) ──
  for (let i = 0; i < 12; i++) {
    const wx = Phaser.Math.Between(MAP_W / 2 + 200, MAP_W - 200);
    const wy = Phaser.Math.Between(MAP_H / 2 + 200, MAP_H - 200);
    const wr = Phaser.Math.Between(30, 80);
    gfx.fillStyle(0x0a1820, 0.4);
    gfx.fillEllipse(wx, wy, wr * 2, wr * 1.5);
    gfx.lineStyle(1, 0x0a2030, 0.3);
    gfx.strokeEllipse(wx, wy, wr * 2, wr * 1.5);
  }

  // ── Trees (denser in forest zone) ──
  if (scene.textures.exists("tree")) {
    // Dense forest zone (top-left)
    for (let i = 0; i < 100; i++) {
      const tx = Phaser.Math.Between(60, MAP_W / 2 - 60);
      const ty = Phaser.Math.Between(60, MAP_H / 2 - 60);
      scene.add.image(tx, ty, "tree")
        .setDepth(8)
        .setAlpha(Phaser.Math.FloatBetween(0.7, 1.0))
        .setScale(Phaser.Math.FloatBetween(0.8, 1.4));
    }
    // Scattered trees elsewhere
    for (let i = 0; i < 60; i++) {
      const tx = Phaser.Math.Between(60, MAP_W - 60);
      const ty = Phaser.Math.Between(60, MAP_H - 60);
      scene.add.image(tx, ty, "tree")
        .setDepth(8)
        .setAlpha(Phaser.Math.FloatBetween(0.6, 0.9))
        .setScale(Phaser.Math.FloatBetween(0.7, 1.2));
    }
  }

  // ── Bushes ──
  if (scene.textures.exists("bush")) {
    for (let i = 0; i < 100; i++) {
      const bx = Phaser.Math.Between(40, MAP_W - 40);
      const by = Phaser.Math.Between(40, MAP_H - 40);
      scene.add.image(bx, by, "bush")
        .setDepth(7)
        .setAlpha(Phaser.Math.FloatBetween(0.4, 0.9))
        .setScale(Phaser.Math.FloatBetween(0.6, 1.3));
    }
  }

  // ── Walls group ──
  const walls = scene.physics.add.staticGroup();

  // Border walls
  addWall(scene, walls, MAP_W / 2, 0, MAP_W, 20);
  addWall(scene, walls, MAP_W / 2, MAP_H, MAP_W, 20);
  addWall(scene, walls, 0, MAP_H / 2, 20, MAP_H);
  addWall(scene, walls, MAP_W, MAP_H / 2, 20, MAP_H);

  // ── Generate buildings ──
  const rooms: RoomDef[] = [];
  const attempts = 70;
  for (let i = 0; i < attempts; i++) {
    const rw = Phaser.Math.Between(100, 350);
    const rh = Phaser.Math.Between(100, 350);
    const rx = Phaser.Math.Between(300, MAP_W - 300);
    const ry = Phaser.Math.Between(300, MAP_H - 300);

    const overlaps = rooms.some(
      (r) =>
        rx - rw / 2 < r.x + r.w / 2 + 80 &&
        rx + rw / 2 > r.x - r.w / 2 - 80 &&
        ry - rh / 2 < r.y + r.h / 2 + 80 &&
        ry + rh / 2 > r.y - r.h / 2 - 80
    );
    if (overlaps) continue;

    // Determine zone
    let zone = "village";
    if (rx < MAP_W / 2 && ry < MAP_H / 2) zone = "forest";
    else if (rx >= MAP_W / 2 && ry < MAP_H / 2) zone = "industrial";
    else if (rx >= MAP_W / 2 && ry >= MAP_H / 2) zone = "swamp";

    rooms.push({ x: rx, y: ry, w: rw, h: rh, zone });
    createRoom(scene, walls, rx, ry, rw, rh, zone);
  }

  // ── Compound structures (groups of connected walls) ──
  for (let c = 0; c < 5; c++) {
    const cx = Phaser.Math.Between(600, MAP_W - 600);
    const cy = Phaser.Math.Between(600, MAP_H - 600);
    // L-shaped or T-shaped wall clusters
    const len1 = Phaser.Math.Between(120, 300);
    const len2 = Phaser.Math.Between(80, 200);
    addWall(scene, walls, cx, cy, len1, 16);
    addWall(scene, walls, cx + len1 / 2, cy + len2 / 2, 16, len2);
    if (Math.random() > 0.5) {
      addWall(scene, walls, cx - len1 / 2, cy - len2 / 3, 16, len2 * 0.6);
    }
  }

  // ── Standalone walls/barriers ──
  for (let i = 0; i < 40; i++) {
    const wx = Phaser.Math.Between(100, MAP_W - 100);
    const wy = Phaser.Math.Between(100, MAP_H - 100);
    const horizontal = Math.random() > 0.5;
    const ww = horizontal ? Phaser.Math.Between(60, 250) : 16;
    const wh = horizontal ? 16 : Phaser.Math.Between(60, 250);
    addWall(scene, walls, wx, wy, ww, wh);
  }

  // ── Spawn point (bottom-left safe area) ──
  const spawnPoint = new Phaser.Math.Vector2(
    Phaser.Math.Between(100, 500),
    Phaser.Math.Between(MAP_H - 500, MAP_H - 100)
  );

  // ── Extraction point (top-right, far from spawn) ──
  const extractionPoint = new Phaser.Math.Vector2(
    Phaser.Math.Between(MAP_W - 700, MAP_W - 100),
    Phaser.Math.Between(100, 700)
  );

  // Extraction visual
  const extractionZone = scene.add.circle(
    extractionPoint.x,
    extractionPoint.y,
    EXTRACTION_RADIUS,
    COLORS.extraction,
    0.15
  );
  extractionZone.setStrokeStyle(1.5, COLORS.extraction, 0.4);

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

  // ── Enemy spawn points (spread across entire map) ──
  const enemySpawnPoints: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 30; i++) {
    let ex: number, ey: number;
    do {
      ex = Phaser.Math.Between(300, MAP_W - 300);
      ey = Phaser.Math.Between(300, MAP_H - 300);
    } while (
      Phaser.Math.Distance.Between(ex, ey, spawnPoint.x, spawnPoint.y) < 500
    );
    enemySpawnPoints.push(new Phaser.Math.Vector2(ex, ey));
  }

  // ── Loot points ──
  // Inside buildings
  const lootPoints: Phaser.Math.Vector2[] = rooms.map(
    (r) =>
      new Phaser.Math.Vector2(
        r.x + Phaser.Math.Between(-r.w / 3, r.w / 3),
        r.y + Phaser.Math.Between(-r.h / 3, r.h / 3)
      )
  );
  // Extra loot scattered in wilderness
  for (let i = 0; i < 15; i++) {
    lootPoints.push(new Phaser.Math.Vector2(
      Phaser.Math.Between(200, MAP_W - 200),
      Phaser.Math.Between(200, MAP_H - 200)
    ));
  }

  // ── Hazards ──
  const hazards: HazardDef[] = [];
  for (let i = 0; i < 18; i++) {
    const hx = Phaser.Math.Between(300, MAP_W - 300);
    const hy = Phaser.Math.Between(300, MAP_H - 300);
    if (Phaser.Math.Distance.Between(hx, hy, spawnPoint.x, spawnPoint.y) < 400) continue;

    const type = Math.random() > 0.5 ? "landmine" as const : "toxic_gas" as const;
    const radius = type === "landmine" ? 8 : Phaser.Math.Between(40, 90);

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

  // ── Doors ──
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

  // ── POI markers (points of interest on minimap) ──
  // Abandoned vehicles scattered around
  for (let i = 0; i < 8; i++) {
    const vx = Phaser.Math.Between(400, MAP_W - 400);
    const vy = Phaser.Math.Between(400, MAP_H - 400);
    const vgfx = scene.add.graphics().setDepth(1);
    // Vehicle body
    vgfx.fillStyle(0x2a2520, 0.6);
    const vw = Phaser.Math.Between(30, 50);
    const vh = Phaser.Math.Between(20, 30);
    vgfx.fillRect(vx - vw / 2, vy - vh / 2, vw, vh);
    // Wheels
    vgfx.fillStyle(0x1a1a18, 0.7);
    vgfx.fillCircle(vx - vw / 3, vy - vh / 2, 4);
    vgfx.fillCircle(vx + vw / 3, vy - vh / 2, 4);
    vgfx.fillCircle(vx - vw / 3, vy + vh / 2, 4);
    vgfx.fillCircle(vx + vw / 3, vy + vh / 2, 4);
    // Rust patches
    vgfx.fillStyle(0x3a2820, 0.3);
    vgfx.fillCircle(vx + 5, vy, 6);
  }

  // Barrels / canisters
  for (let i = 0; i < 15; i++) {
    const bx = Phaser.Math.Between(200, MAP_W - 200);
    const by = Phaser.Math.Between(200, MAP_H - 200);
    const bgfx = scene.add.graphics().setDepth(1);
    bgfx.fillStyle(0x3a4030, 0.5);
    bgfx.fillCircle(bx, by, 8);
    bgfx.lineStyle(1, 0x2a3020, 0.5);
    bgfx.strokeCircle(bx, by, 8);
    // Lid
    bgfx.fillStyle(0x4a5040, 0.4);
    bgfx.fillCircle(bx, by, 4);
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
  h: number,
  zone: string
) {
  const wallThick = 16;
  const doorWidth = 40;

  // Some buildings have 2 doors
  const numDoors = Math.random() > 0.6 ? 2 : 1;
  const doorSides = new Set<number>();
  while (doorSides.size < numDoors) {
    doorSides.add(Phaser.Math.Between(0, 3));
  }

  // Top wall
  if (doorSides.has(0)) {
    const half = (w - doorWidth) / 2;
    addWall(scene, walls, cx - doorWidth / 2 - half / 2, cy - h / 2, half, wallThick);
    addWall(scene, walls, cx + doorWidth / 2 + half / 2, cy - h / 2, half, wallThick);
  } else {
    addWall(scene, walls, cx, cy - h / 2, w, wallThick);
  }

  // Bottom wall
  if (doorSides.has(1)) {
    const half = (w - doorWidth) / 2;
    addWall(scene, walls, cx - doorWidth / 2 - half / 2, cy + h / 2, half, wallThick);
    addWall(scene, walls, cx + doorWidth / 2 + half / 2, cy + h / 2, half, wallThick);
  } else {
    addWall(scene, walls, cx, cy + h / 2, w, wallThick);
  }

  // Left wall
  if (doorSides.has(2)) {
    const half = (h - doorWidth) / 2;
    addWall(scene, walls, cx - w / 2, cy - doorWidth / 2 - half / 2, wallThick, half);
    addWall(scene, walls, cx - w / 2, cy + doorWidth / 2 + half / 2, wallThick, half);
  } else {
    addWall(scene, walls, cx - w / 2, cy, wallThick, h);
  }

  // Right wall
  if (doorSides.has(3)) {
    const half = (h - doorWidth) / 2;
    addWall(scene, walls, cx + w / 2, cy - doorWidth / 2 - half / 2, wallThick, half);
    addWall(scene, walls, cx + w / 2, cy + doorWidth / 2 + half / 2, wallThick, half);
  } else {
    addWall(scene, walls, cx + w / 2, cy, wallThick, h);
  }

  // Interior floor
  const floorColor = zone === "industrial" ? 0x1c1c18 : zone === "swamp" ? 0x141a10 : 0x1e1c16;
  if (scene.textures.exists("floor_tile")) {
    const floor = scene.add.tileSprite(cx, cy, w - wallThick * 2, h - wallThick * 2, "floor_tile");
    floor.setDepth(0).setAlpha(0.8);
  } else {
    scene.add.rectangle(cx, cy, w - wallThick * 2, h - wallThick * 2, floorColor, 0.7).setDepth(0);
  }

  // Interior partition wall (larger rooms get subdivided)
  if (w > 200 && h > 200 && Math.random() > 0.4) {
    const partH = Math.random() > 0.5;
    if (partH) {
      const pw = Phaser.Math.Between(w / 3, w / 2);
      addWall(scene, walls, cx + Phaser.Math.Between(-w / 6, w / 6), cy, pw, 12);
    } else {
      const ph = Phaser.Math.Between(h / 3, h / 2);
      addWall(scene, walls, cx, cy + Phaser.Math.Between(-h / 6, h / 6), 12, ph);
    }
  }

  // Interior debris/furniture
  const numDebris = Phaser.Math.Between(1, 4);
  for (let i = 0; i < numDebris; i++) {
    const fx = cx + Phaser.Math.Between(-w / 3, w / 3);
    const fy = cy + Phaser.Math.Between(-h / 3, h / 3);
    const fgfx = scene.add.graphics().setDepth(1);
    const furnitureType = Phaser.Math.Between(0, 2);
    if (furnitureType === 0) {
      // Table
      fgfx.fillStyle(0x2a2218, Phaser.Math.FloatBetween(0.3, 0.5));
      fgfx.fillRect(fx - 10, fy - 6, 20, 12);
      fgfx.lineStyle(1, 0x1a1810, 0.3);
      fgfx.strokeRect(fx - 10, fy - 6, 20, 12);
    } else if (furnitureType === 1) {
      // Shelf/cabinet
      fgfx.fillStyle(0x302820, Phaser.Math.FloatBetween(0.3, 0.5));
      fgfx.fillRect(fx - 14, fy - 4, 28, 8);
      fgfx.lineStyle(1, 0x201a10, 0.4);
      fgfx.lineBetween(fx - 14, fy, fx + 14, fy);
    } else {
      // Debris pile
      fgfx.fillStyle(0x222018, Phaser.Math.FloatBetween(0.2, 0.4));
      for (let d = 0; d < 3; d++) {
        fgfx.fillRect(
          fx + Phaser.Math.Between(-8, 4),
          fy + Phaser.Math.Between(-6, 4),
          Phaser.Math.Between(4, 10),
          Phaser.Math.Between(3, 8)
        );
      }
    }
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
