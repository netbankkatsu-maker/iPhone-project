import Phaser from "phaser";

/**
 * Generate all procedural textures – ZERO Sievert pixel-art style.
 * Call once in create() before spawning any game objects.
 */
export function generateTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);

  // ── Player (top-down pixel soldier) ──
  createPlayerTexture(g, scene, "player_alive", 0x4a6030, 0x5a7040);
  createPlayerTexture(g, scene, "player_hurt", 0x7a2020, 0x903030);
  createPlayerTexture(g, scene, "player_dead", 0x3a3a3a, 0x4a4a4a);

  // ── Enemies ──
  createBanditTexture(g, scene);
  createMutantTexture(g, scene);
  createHeavyTexture(g, scene);

  // ── Bullets ──
  createBulletTexture(g, scene, "bullet_player", 0xffdd44, 0xffee88);
  createBulletTexture(g, scene, "bullet_enemy", 0xff6644, 0xff9966);

  // ── Wall tile ──
  createWallTexture(g, scene);

  // ── Floor tiles ──
  createFloorTexture(g, scene);

  // ── Loot crate ──
  createCrateTexture(g, scene, "crate_loot", 20, 20, 0x6a5020, 0x8a6830);
  createCrateTexture(g, scene, "crate_drop", 16, 14, 0x804818, 0xa06020);

  // ── Gun visuals (for HUD / pickup) ──
  createGunTexture(g, scene, "gun_pistol", 16, 8, 0x555048);
  createGunTexture(g, scene, "gun_smg", 22, 8, 0x4a4a44);
  createGunTexture(g, scene, "gun_shotgun", 24, 10, 0x4a3528);
  createGunTexture(g, scene, "gun_rifle", 28, 7, 0x3a4030);

  // ── Muzzle flash ──
  createMuzzleFlash(g, scene);

  // ── Tree sprites ──
  createTreeTexture(g, scene);

  // ── Bush sprites ──
  createBushTexture(g, scene);

  // ── Grass patch ──
  createGrassPatchTexture(g, scene);

  g.destroy();
}

function createPlayerTexture(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  bodyColor: number,
  vestColor: number
) {
  const s = 32;
  const cx = s / 2;
  const cy = s / 2;
  g.clear();

  // === TRUE TOP-DOWN pixel art style ===

  // Drop shadow (subtle)
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx, cy + 1, 20, 20);

  // Feet/boots (below body, spread stance)
  g.fillStyle(0x2a2820);
  g.fillRect(cx - 6, cy + 5, 4, 5);   // left boot
  g.fillRect(cx + 2, cy + 5, 4, 5);   // right boot

  // Body/torso (oval from above)
  g.fillStyle(bodyColor);
  g.fillEllipse(cx, cy - 1, 16, 18);

  // Tactical vest plate
  g.fillStyle(vestColor);
  g.fillRect(cx - 6, cy - 7, 12, 12);
  // Vest pouches (MOLLE-style)
  g.fillStyle(darken(vestColor, 0.7));
  g.fillRect(cx - 6, cy - 2, 4, 3);
  g.fillRect(cx + 2, cy - 2, 4, 3);
  g.fillRect(cx - 2, cy - 2, 4, 3);

  // Arms
  g.fillStyle(darken(bodyColor, 0.8));
  g.fillRect(cx - 9, cy - 5, 4, 6);   // left arm
  g.fillRect(cx + 5, cy - 6, 4, 7);   // right arm (reaching to gun)

  // Gun (pointing up = forward)
  g.fillStyle(0x222220);
  g.fillRect(cx + 4, cy - 14, 3, 10);  // barrel
  g.fillStyle(0x333330);
  g.fillRect(cx + 3, cy - 6, 5, 4);    // receiver
  // Muzzle
  g.fillStyle(0x444440);
  g.fillRect(cx + 4, cy - 15, 3, 2);

  // Backpack (behind, at bottom)
  g.fillStyle(darken(bodyColor, 0.6));
  g.fillRect(cx - 4, cy + 2, 8, 5);
  g.lineStyle(1, darken(bodyColor, 0.4), 0.5);
  g.strokeRect(cx - 4, cy + 2, 8, 5);

  // Head (helmet from above)
  g.fillStyle(darken(vestColor, 0.65));
  g.fillCircle(cx, cy - 5, 6);
  // Helmet inner
  g.fillStyle(darken(vestColor, 0.8));
  g.fillCircle(cx, cy - 5, 4.5);
  // Helmet stripe/detail
  g.fillStyle(darken(vestColor, 0.5));
  g.fillRect(cx - 1, cy - 9, 2, 6);

  // NVG mount (small box on front)
  g.fillStyle(0x1a1a18);
  g.fillRect(cx - 2, cy - 10, 4, 2);

  g.generateTexture(key, s, s);
}

/** Darken a hex color by a multiplier (0-1) */
function darken(color: number, mult: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * mult);
  const gr = Math.floor(((color >> 8) & 0xff) * mult);
  const b = Math.floor((color & 0xff) * mult);
  return (r << 16) | (gr << 8) | b;
}

function createBanditTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 28;
  g.clear();

  // Shadow
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(s / 2, s / 2 + 1, 16, 16);

  // Feet
  g.fillStyle(0x2a2520);
  g.fillRect(s / 2 - 5, s / 2 + 4, 3, 4);
  g.fillRect(s / 2 + 2, s / 2 + 4, 3, 4);

  // Body (ragged jacket)
  g.fillStyle(0x5a4530);
  g.fillEllipse(s / 2, s / 2, 14, 16);

  // Jacket detail
  g.fillStyle(0x4a3820);
  g.fillRect(s / 2 - 5, s / 2 - 4, 10, 6);

  // Arms
  g.fillStyle(0x4a3828);
  g.fillRect(s / 2 - 8, s / 2 - 3, 3, 5);
  g.fillRect(s / 2 + 5, s / 2 - 4, 3, 6);

  // Head (balaclava)
  g.fillStyle(0x3a3530);
  g.fillCircle(s / 2, s / 2 - 5, 5);

  // Red bandana
  g.fillStyle(0x8a2020);
  g.fillRect(s / 2 - 4, s / 2 - 6, 8, 2);

  // Gun
  g.fillStyle(0x333330);
  g.fillRect(s / 2 + 4, s / 2 - 2, 8, 2);

  g.generateTexture("enemy_bandit", s, s);
}

function createMutantTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 34;
  g.clear();

  // Glow aura
  g.fillStyle(0x304010, 0.2);
  g.fillCircle(s / 2, s / 2, s / 2 - 1);

  // Shadow
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(s / 2, s / 2 + 1, 22, 22);

  // Body (bulky, irregular)
  g.fillStyle(0x354018);
  g.fillEllipse(s / 2, s / 2, 20, 22);

  // Mutant lumps / tumors
  g.fillStyle(0x405020);
  g.fillCircle(s / 2 - 5, s / 2 - 3, 4);
  g.fillCircle(s / 2 + 5, s / 2 + 1, 3);
  g.fillCircle(s / 2 + 2, s / 2 - 5, 3);

  // Head (small, hunched forward)
  g.fillStyle(0x445520);
  g.fillCircle(s / 2, s / 2 - 7, 4);

  // Glowing eyes
  g.fillStyle(0xaaee22);
  g.fillRect(s / 2 - 3, s / 2 - 8, 2, 2);
  g.fillRect(s / 2 + 1, s / 2 - 8, 2, 2);

  // Claws
  g.fillStyle(0x2a2a18);
  g.fillTriangle(s / 2 + 9, s / 2 - 2, s / 2 + 14, s / 2 - 5, s / 2 + 13, s / 2 + 1);
  g.fillTriangle(s / 2 - 9, s / 2 - 2, s / 2 - 14, s / 2 - 5, s / 2 - 13, s / 2 + 1);

  g.generateTexture("enemy_mutant", s, s);
}

function createHeavyTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 38;
  g.clear();

  // Shadow
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(s / 2, s / 2 + 1, 28, 28);

  // Boots
  g.fillStyle(0x1a1818);
  g.fillRect(s / 2 - 7, s / 2 + 6, 5, 5);
  g.fillRect(s / 2 + 2, s / 2 + 6, 5, 5);

  // Heavy armor body
  g.fillStyle(0x3a2a2a);
  g.fillEllipse(s / 2, s / 2, 26, 28);

  // Armor plates (front and back)
  g.fillStyle(0x4a3535);
  g.fillRect(s / 2 - 10, s / 2 - 8, 20, 14);
  g.lineStyle(1, 0x5a4040, 0.6);
  g.strokeRect(s / 2 - 10, s / 2 - 8, 20, 14);

  // Shoulder plates
  g.fillStyle(0x4a3838);
  g.fillRect(s / 2 - 13, s / 2 - 5, 5, 8);
  g.fillRect(s / 2 + 8, s / 2 - 5, 5, 8);
  g.lineStyle(1, 0x5a4545, 0.5);
  g.strokeRect(s / 2 - 13, s / 2 - 5, 5, 8);
  g.strokeRect(s / 2 + 8, s / 2 - 5, 5, 8);

  // Helmet (heavy, with visor)
  g.fillStyle(0x3a2828);
  g.fillCircle(s / 2, s / 2 - 6, 7);
  // Visor slit
  g.fillStyle(0x1a1010);
  g.fillRect(s / 2 - 5, s / 2 - 7, 10, 2);

  // Heavy gun (LMG style)
  g.fillStyle(0x2a2a22);
  g.fillRect(s / 2 + 6, s / 2 - 4, 14, 4);
  // Magazine box
  g.fillStyle(0x222220);
  g.fillRect(s / 2 + 8, s / 2, 6, 4);
  // Bipod hint
  g.fillStyle(0x333330);
  g.fillRect(s / 2 + 17, s / 2 - 3, 2, 6);

  g.generateTexture("enemy_heavy", s, s);
}

function createBulletTexture(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  color: number,
  glowColor: number
) {
  const w = 8, h = 4;
  g.clear();

  // Tracer glow
  g.fillStyle(glowColor, 0.3);
  g.fillEllipse(w / 2 - 1, h / 2, 7, 4);

  // Bullet body
  g.fillStyle(color);
  g.fillEllipse(w / 2 + 1, h / 2, 5, 2);

  // Bright tip
  g.fillStyle(0xffffff, 0.7);
  g.fillRect(w - 2, h / 2 - 1, 2, 2);

  g.generateTexture(key, w, h);
}

function createWallTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 32;
  g.clear();

  // Base concrete (darker, grittier)
  g.fillStyle(0x3a3830);
  g.fillRect(0, 0, s, s);

  // Brick pattern
  const brickH = 8;
  const brickW = 16;
  for (let row = 0; row < s / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    // Mortar lines
    g.lineStyle(1, 0x2a2820, 0.8);
    g.lineBetween(0, row * brickH, s, row * brickH);
    for (let col = 0; col < s / brickW + 1; col++) {
      const x = col * brickW + offset;
      g.lineBetween(x, row * brickH, x, (row + 1) * brickH);
    }
    // Brick color variation
    for (let col = 0; col < s / brickW + 1; col++) {
      const bx = col * brickW + offset;
      const shade = Phaser.Math.Between(-10, 10);
      const r = Math.min(255, Math.max(0, 0x3a + shade));
      const gv = Math.min(255, Math.max(0, 0x38 + shade));
      const b = Math.min(255, Math.max(0, 0x30 + shade));
      g.fillStyle((r << 16) | (gv << 8) | b, 0.3);
      g.fillRect(bx + 1, row * brickH + 1, brickW - 2, brickH - 2);
    }
  }

  // Damage/cracks
  g.lineStyle(1, 0x222218, 0.3);
  g.lineBetween(5, 3, 12, 18);
  g.lineBetween(20, 10, 28, 25);

  g.generateTexture("wall_tile", s, s);
}

function createFloorTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 32;
  g.clear();

  // Concrete floor
  g.fillStyle(0x222018);
  g.fillRect(0, 0, s, s);

  // Subtle tile pattern
  g.lineStyle(1, 0x1a1810, 0.3);
  g.lineBetween(0, s / 2, s, s / 2);
  g.lineBetween(s / 2, 0, s / 2, s);

  // Dirt/stains
  g.fillStyle(0x2a2620, 0.4);
  g.fillCircle(10, 8, 4);
  g.fillCircle(24, 20, 5);
  g.fillStyle(0x1a1810, 0.3);
  g.fillCircle(6, 22, 3);

  g.generateTexture("floor_tile", s, s);
}

function createCrateTexture(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  color: number,
  lightColor: number
) {
  g.clear();

  // Shadow
  g.fillStyle(0x000000, 0.2);
  g.fillRect(2, 2, w - 1, h - 1);

  // Crate body
  g.fillStyle(color);
  g.fillRect(0, 0, w - 2, h - 2);

  // Lid highlight
  g.fillStyle(lightColor);
  g.fillRect(1, 1, w - 4, 2);

  // Wood grain
  g.lineStyle(1, darken(color, 0.7), 0.4);
  for (let y = 3; y < h - 3; y += 3) {
    g.lineBetween(1, y, w - 3, y);
  }

  // Cross planks
  g.lineStyle(1, darken(color, 0.6), 0.6);
  g.lineBetween(1, 1, w - 3, h - 3);
  g.lineBetween(w - 3, 1, 1, h - 3);

  // Border
  g.lineStyle(1, darken(color, 0.5));
  g.strokeRect(0, 0, w - 2, h - 2);

  // Metal corners
  g.fillStyle(0x606060, 0.6);
  g.fillRect(0, 0, 3, 3);
  g.fillRect(w - 5, 0, 3, 3);
  g.fillRect(0, h - 5, 3, 3);
  g.fillRect(w - 5, h - 5, 3, 3);

  g.generateTexture(key, w, h);
}

function createGunTexture(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  color: number
) {
  g.clear();

  // Gun body
  g.fillStyle(color);
  g.fillRoundedRect(1, h / 2 - 2, w - 4, 4, 1);

  // Barrel
  g.fillStyle(0x2a2a22);
  g.fillRect(w - 6, h / 2 - 1.5, 6, 3);

  // Grip
  g.fillStyle(0x2a2018);
  g.fillRect(4, h / 2, 4, h / 2 - 1);

  // Outline
  g.lineStyle(0.5, 0x444440);
  g.strokeRect(1, h / 2 - 2, w - 4, 4);

  g.generateTexture(key, w, h);
}

function createMuzzleFlash(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 16;
  g.clear();

  // Bright center
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(s / 2, s / 2, 2);

  // Hot core
  g.fillStyle(0xffee44, 0.7);
  g.fillCircle(s / 2, s / 2, 4);

  // Outer flash
  g.fillStyle(0xffaa22, 0.4);
  g.fillCircle(s / 2, s / 2, 6);

  // Rays
  g.fillStyle(0xff8800, 0.3);
  g.fillRect(s / 2 - 1, 0, 2, s);
  g.fillRect(0, s / 2 - 1, s, 2);

  g.generateTexture("muzzle_flash", s, s);
}

function createTreeTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 40;
  g.clear();

  // Tree shadow (on ground)
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(s / 2 + 2, s / 2 + 2, 30, 30);

  // Foliage (layered circles for organic look)
  g.fillStyle(0x1a3010);
  g.fillCircle(s / 2 - 3, s / 2 + 2, 11);
  g.fillCircle(s / 2 + 4, s / 2 - 1, 10);
  g.fillCircle(s / 2 - 1, s / 2 - 4, 9);

  // Lighter foliage highlights
  g.fillStyle(0x254018);
  g.fillCircle(s / 2 - 2, s / 2 - 3, 7);
  g.fillCircle(s / 2 + 3, s / 2 + 1, 6);

  // Top highlight
  g.fillStyle(0x305020, 0.6);
  g.fillCircle(s / 2, s / 2 - 5, 5);

  // Trunk (barely visible from above)
  g.fillStyle(0x2a2018);
  g.fillCircle(s / 2, s / 2 + 1, 3);

  g.generateTexture("tree", s, s);
}

function createBushTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 20;
  g.clear();

  // Shadow
  g.fillStyle(0x000000, 0.1);
  g.fillEllipse(s / 2 + 1, s / 2 + 1, 16, 12);

  // Bush body
  g.fillStyle(0x1a3510);
  g.fillEllipse(s / 2, s / 2, 14, 10);

  // Lighter spots
  g.fillStyle(0x254518, 0.7);
  g.fillCircle(s / 2 - 2, s / 2 - 1, 4);
  g.fillCircle(s / 2 + 3, s / 2, 3);

  g.generateTexture("bush", s, s);
}

function createGrassPatchTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 64;
  g.clear();

  // Base dirt
  g.fillStyle(0x1a1e10, 0);
  g.fillRect(0, 0, s, s);

  // Grass blades (pixel-style)
  for (let i = 0; i < 20; i++) {
    const gx = Phaser.Math.Between(2, s - 2);
    const gy = Phaser.Math.Between(2, s - 2);
    const shade = Phaser.Math.Between(0, 2);
    const colors = [0x1a3010, 0x203818, 0x253a14];
    g.fillStyle(colors[shade], Phaser.Math.FloatBetween(0.3, 0.6));
    g.fillRect(gx, gy, 2, Phaser.Math.Between(3, 6));
  }

  // Small stones
  for (let i = 0; i < 3; i++) {
    const sx = Phaser.Math.Between(4, s - 4);
    const sy = Phaser.Math.Between(4, s - 4);
    g.fillStyle(0x3a3830, Phaser.Math.FloatBetween(0.2, 0.4));
    g.fillCircle(sx, sy, Phaser.Math.Between(1, 2));
  }

  g.generateTexture("grass_patch", s, s);
}
