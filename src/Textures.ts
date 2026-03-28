import Phaser from "phaser";

/**
 * Generate all procedural textures at scene startup.
 * Call once in create() before spawning any game objects.
 */
export function generateTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);

  // ── Player (top-down soldier) ──
  createPlayerTexture(g, scene, "player_alive", 0x5a7a3a, 0x7a9e5a);
  createPlayerTexture(g, scene, "player_hurt", 0x8a3030, 0xc04040);
  createPlayerTexture(g, scene, "player_dead", 0x444444, 0x666666);

  // ── Enemies ──
  createBanditTexture(g, scene);
  createMutantTexture(g, scene);
  createHeavyTexture(g, scene);

  // ── Bullets ──
  createBulletTexture(g, scene, "bullet_player", 0xd4a840, 0xffe080);
  createBulletTexture(g, scene, "bullet_enemy", 0xc06040, 0xff8060);

  // ── Wall tile ──
  createWallTexture(g, scene);

  // ── Loot crate ──
  createCrateTexture(g, scene, "crate_loot", 20, 20, 0x8a6828, 0xb08030);
  createCrateTexture(g, scene, "crate_drop", 16, 14, 0xa05810, 0xd07820);

  // ── Gun visuals (for HUD / pickup) ──
  createGunTexture(g, scene, "gun_pistol", 16, 8, 0x6a6050);
  createGunTexture(g, scene, "gun_smg", 22, 8, 0x5a5a50);
  createGunTexture(g, scene, "gun_shotgun", 24, 10, 0x5a4030);
  createGunTexture(g, scene, "gun_rifle", 28, 7, 0x4a5040);

  g.destroy();
}

function createPlayerTexture(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  bodyColor: number,
  headColor: number
) {
  const s = 32; // texture size
  g.clear();

  // Body (oval torso)
  g.fillStyle(bodyColor);
  g.fillEllipse(s / 2, s / 2 + 2, 18, 22);

  // Shoulders
  g.fillStyle(bodyColor);
  g.fillRect(s / 2 - 12, s / 2 - 2, 24, 8);

  // Head
  g.fillStyle(headColor);
  g.fillCircle(s / 2, s / 2 - 6, 6);

  // Helmet band
  g.fillStyle(0x3a4a2a);
  g.fillRect(s / 2 - 6, s / 2 - 8, 12, 3);

  // Gun (right side, pointing right)
  g.fillStyle(0x4a4a40);
  g.fillRect(s / 2 + 4, s / 2 - 1, 12, 4);
  g.fillStyle(0x3a3a30);
  g.fillRect(s / 2 + 14, s / 2 - 2, 3, 6); // muzzle

  // Backpack strap hint
  g.fillStyle(0x3a4a2a);
  g.fillRect(s / 2 - 3, s / 2 + 4, 6, 8);

  g.generateTexture(key, s, s);
}

function createBanditTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 28;
  g.clear();

  // Body
  g.fillStyle(0x6a4a30);
  g.fillEllipse(s / 2, s / 2 + 2, 16, 20);

  // Jacket
  g.fillStyle(0x5a4020);
  g.fillRect(s / 2 - 9, s / 2 - 2, 18, 6);

  // Head
  g.fillStyle(0x8b6e50);
  g.fillCircle(s / 2, s / 2 - 5, 5);

  // Bandana/mask
  g.fillStyle(0xc03030);
  g.fillRect(s / 2 - 4, s / 2 - 5, 8, 3);

  // Gun
  g.fillStyle(0x4a4a40);
  g.fillRect(s / 2 + 3, s / 2 - 1, 10, 3);

  g.generateTexture("enemy_bandit", s, s);
}

function createMutantTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 36;
  g.clear();

  // Glow aura
  g.fillStyle(0x405020, 0.3);
  g.fillCircle(s / 2, s / 2, s / 2 - 1);

  // Body (bulky, irregular)
  g.fillStyle(0x405020);
  g.fillEllipse(s / 2, s / 2 + 1, 22, 26);

  // Mutant lumps
  g.fillStyle(0x506028);
  g.fillCircle(s / 2 - 5, s / 2 - 4, 5);
  g.fillCircle(s / 2 + 6, s / 2 + 2, 4);

  // Head (small, hunched)
  g.fillStyle(0x556b2f);
  g.fillCircle(s / 2, s / 2 - 8, 5);

  // Glowing eyes
  g.fillStyle(0xccff44);
  g.fillCircle(s / 2 - 2, s / 2 - 9, 1.5);
  g.fillCircle(s / 2 + 2, s / 2 - 9, 1.5);

  // Claws
  g.fillStyle(0x3a3a20);
  g.fillTriangle(s / 2 + 10, s / 2 - 2, s / 2 + 14, s / 2 - 6, s / 2 + 14, s / 2 + 2);
  g.fillTriangle(s / 2 - 10, s / 2 - 2, s / 2 - 14, s / 2 - 6, s / 2 - 14, s / 2 + 2);

  g.generateTexture("enemy_mutant", s, s);
}

function createHeavyTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 40;
  g.clear();

  // Heavy armor body
  g.fillStyle(0x3a2828);
  g.fillEllipse(s / 2, s / 2 + 2, 28, 30);

  // Armor plates
  g.fillStyle(0x4a3030);
  g.fillRect(s / 2 - 12, s / 2 - 6, 24, 14);
  g.lineStyle(1, 0x5a4040);
  g.strokeRect(s / 2 - 12, s / 2 - 6, 24, 14);

  // Shoulder guards
  g.fillStyle(0x4a3535);
  g.fillEllipse(s / 2 - 11, s / 2 - 2, 8, 10);
  g.fillEllipse(s / 2 + 11, s / 2 - 2, 8, 10);

  // Helmet
  g.fillStyle(0x4a3535);
  g.fillCircle(s / 2, s / 2 - 8, 7);
  g.fillStyle(0x2a1818);
  g.fillRect(s / 2 - 5, s / 2 - 9, 10, 3); // visor

  // Heavy gun
  g.fillStyle(0x3a3a30);
  g.fillRect(s / 2 + 6, s / 2 - 3, 16, 6);
  g.fillStyle(0x2a2a20);
  g.fillRect(s / 2 + 6, s / 2 + 2, 12, 3); // magazine

  g.generateTexture("enemy_heavy", s, s);
}

function createBulletTexture(
  g: Phaser.GameObjects.Graphics,
  scene: Phaser.Scene,
  key: string,
  color: number,
  glowColor: number
) {
  const w = 10, h = 6;
  g.clear();

  // Glow trail
  g.fillStyle(glowColor, 0.3);
  g.fillEllipse(w / 2 - 1, h / 2, 8, 5);

  // Bullet body
  g.fillStyle(color);
  g.fillEllipse(w / 2 + 1, h / 2, 6, 3);

  // Bright tip
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(w / 2 + 3, h / 2, 1);

  g.generateTexture(key, w, h);
}

function createWallTexture(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 32;
  g.clear();

  // Base concrete
  g.fillStyle(0x4a4a3a);
  g.fillRect(0, 0, s, s);

  // Brick pattern
  const brickH = 8;
  const brickW = 16;
  for (let row = 0; row < s / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    g.lineStyle(1, 0x3a3a2a, 0.6);
    // Horizontal line
    g.lineBetween(0, row * brickH, s, row * brickH);
    // Vertical lines (staggered)
    for (let col = 0; col < s / brickW + 1; col++) {
      const x = col * brickW + offset;
      g.lineBetween(x, row * brickH, x, (row + 1) * brickH);
    }
  }

  // Surface variation
  g.fillStyle(0x555545, 0.15);
  g.fillRect(2, 2, 10, 6);
  g.fillRect(18, 10, 8, 6);
  g.fillStyle(0x3a3a2a, 0.2);
  g.fillRect(8, 18, 12, 6);

  g.generateTexture("wall_tile", s, s);
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

  // Crate body
  g.fillStyle(color);
  g.fillRect(1, 1, w - 2, h - 2);

  // Lid highlight
  g.fillStyle(lightColor);
  g.fillRect(2, 2, w - 4, 3);

  // Cross planks
  g.lineStyle(1, 0x604018, 0.7);
  g.lineBetween(2, 2, w - 2, h - 2);
  g.lineBetween(w - 2, 2, 2, h - 2);

  // Border
  g.lineStyle(1.5, 0x604018);
  g.strokeRect(1, 1, w - 2, h - 2);

  // Metal corners
  g.fillStyle(0x808080, 0.5);
  g.fillRect(1, 1, 3, 3);
  g.fillRect(w - 4, 1, 3, 3);
  g.fillRect(1, h - 4, 3, 3);
  g.fillRect(w - 4, h - 4, 3, 3);

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
  g.fillStyle(0x3a3a30);
  g.fillRect(w - 6, h / 2 - 1.5, 6, 3);

  // Grip
  g.fillStyle(0x3a2a20);
  g.fillRect(4, h / 2, 4, h / 2 - 1);

  // Trigger guard
  g.lineStyle(0.5, 0x555550);
  g.strokeRect(1, h / 2 - 2, w - 4, 4);

  g.generateTexture(key, w, h);
}
