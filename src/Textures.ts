import Phaser from "phaser";

export function generateTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);

  createPlayerTex(g, scene, "player_alive", 0x508050, 0x306030, 0x708070);
  createPlayerTex(g, scene, "player_hurt", 0xa03030, 0x802020, 0xc05050);
  createPlayerTex(g, scene, "player_dead", 0x606060, 0x404040, 0x808080);

  createBanditTex(g, scene);
  createMutantTex(g, scene);
  createHeavyTex(g, scene);
  createBossTex(g, scene);

  createBulletTex(g, scene, "bullet_player", 0xe0d060, 0xffee88);
  createBulletTex(g, scene, "bullet_enemy", 0xc05030, 0xff8060);

  createWallTex(g, scene);
  createFloorTex(g, scene);

  createCrateTex(g, scene, "crate_loot", 14, 14, 0x805030, 0xa07040);
  createCrateTex(g, scene, "crate_drop", 10, 10, 0x906020, 0xb08030);

  createGunTex(g, scene, "gun_pistol", 10, 6, 0x606060);
  createGunTex(g, scene, "gun_smg", 14, 6, 0x505050);
  createGunTex(g, scene, "gun_shotgun", 16, 8, 0x604020);
  createGunTex(g, scene, "gun_rifle", 18, 6, 0x405030);

  createMuzzleFlashTex(g, scene);
  createTreeTex(g, scene);
  createBushTex(g, scene);
  createGrassTex(g, scene);
  createNPCTex(g, scene);
  createStashTex(g, scene);

  g.destroy();
}

function darken(c: number, m: number): number {
  return (
    (Math.floor(((c >> 16) & 0xff) * m) << 16) |
    (Math.floor(((c >> 8) & 0xff) * m) << 8) |
    Math.floor((c & 0xff) * m)
  );
}

// px helper: draw a 2x2 pixel block
function px(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1) {
  g.fillStyle(c, a);
  g.fillRect(x, y, 2, 2);
}

function createPlayerTex(
  g: Phaser.GameObjects.Graphics, scene: Phaser.Scene,
  key: string, body: number, dark: number, light: number
) {
  const s = 16;
  g.clear();
  // Shadow
  px(g, 4, 12, 0x000000, 0.2); px(g, 6, 12, 0x000000, 0.2);
  px(g, 8, 12, 0x000000, 0.2); px(g, 10, 12, 0x000000, 0.2);
  // Boots
  px(g, 4, 10, 0x303028); px(g, 10, 10, 0x303028);
  // Body
  px(g, 4, 6, body); px(g, 6, 6, body); px(g, 8, 6, body); px(g, 10, 6, body);
  px(g, 4, 8, body); px(g, 6, 8, dark); px(g, 8, 8, dark); px(g, 10, 8, body);
  // Vest
  px(g, 6, 6, light); px(g, 8, 6, light);
  // Arms
  px(g, 2, 6, dark); px(g, 12, 6, dark);
  // Head (helmet)
  px(g, 4, 2, dark); px(g, 6, 2, light); px(g, 8, 2, light); px(g, 10, 2, dark);
  px(g, 6, 4, body); px(g, 8, 4, body);
  // NVG
  px(g, 6, 0, 0x202020); px(g, 8, 0, 0x202020);
  // Gun
  px(g, 12, 2, 0x404040); px(g, 12, 4, 0x404040); px(g, 12, 0, 0x505050);
  // Backpack
  px(g, 6, 10, dark); px(g, 8, 10, dark);
  g.generateTexture(key, s, s);
}

function createBanditTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 14; g.clear();
  // Body
  px(g, 4, 4, 0x604020); px(g, 6, 4, 0x604020); px(g, 8, 4, 0x604020);
  px(g, 4, 6, 0x503018); px(g, 6, 6, 0x503018); px(g, 8, 6, 0x503018);
  px(g, 4, 8, 0x604020); px(g, 8, 8, 0x604020);
  // Head + bandana
  px(g, 4, 2, 0x403020); px(g, 6, 2, 0xa03030); px(g, 8, 2, 0x403020);
  // Gun
  px(g, 10, 4, 0x404040); px(g, 10, 2, 0x404040);
  // Boots
  px(g, 4, 10, 0x302818); px(g, 8, 10, 0x302818);
  g.generateTexture("enemy_bandit", s, s);
}

function createMutantTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 16; g.clear();
  // Glow
  px(g, 4, 4, 0x304010, 0.3); px(g, 10, 8, 0x304010, 0.3);
  // Body (bulky)
  px(g, 4, 4, 0x354018); px(g, 6, 4, 0x354018); px(g, 8, 4, 0x354018); px(g, 10, 4, 0x354018);
  px(g, 4, 6, 0x405020); px(g, 6, 6, 0x354018); px(g, 8, 6, 0x354018); px(g, 10, 6, 0x405020);
  px(g, 4, 8, 0x354018); px(g, 6, 8, 0x354018); px(g, 8, 8, 0x354018); px(g, 10, 8, 0x354018);
  // Lumps
  px(g, 2, 6, 0x506028); px(g, 12, 6, 0x506028);
  // Head
  px(g, 6, 2, 0x445520); px(g, 8, 2, 0x445520);
  // Eyes
  px(g, 6, 2, 0xaaee22); px(g, 8, 2, 0xaaee22);
  // Claws
  px(g, 0, 4, 0x2a2a18); px(g, 14, 4, 0x2a2a18);
  g.generateTexture("enemy_mutant", s, s);
}

function createHeavyTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 18; g.clear();
  // Armor body
  for (let y = 4; y <= 12; y += 2)
    for (let x = 4; x <= 12; x += 2) px(g, x, y, 0x3a2828);
  // Plates
  px(g, 6, 4, 0x4a3535); px(g, 8, 4, 0x4a3535); px(g, 10, 4, 0x4a3535);
  px(g, 6, 6, 0x4a3535); px(g, 8, 6, 0x4a3535); px(g, 10, 6, 0x4a3535);
  // Shoulders
  px(g, 2, 6, 0x4a3838); px(g, 14, 6, 0x4a3838);
  // Helmet
  px(g, 6, 0, 0x3a2828); px(g, 8, 0, 0x3a2828); px(g, 10, 0, 0x3a2828);
  px(g, 6, 2, 0x1a1010); px(g, 8, 2, 0x1a1010); px(g, 10, 2, 0x1a1010);
  // Heavy gun
  px(g, 12, 4, 0x2a2a22); px(g, 14, 4, 0x2a2a22); px(g, 16, 4, 0x2a2a22);
  px(g, 12, 8, 0x222220);
  // Boots
  px(g, 4, 14, 0x1a1818); px(g, 10, 14, 0x1a1818);
  g.generateTexture("enemy_heavy", s, s);
}

function createBossTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 24; g.clear();
  // Shadow
  for (let x = 4; x <= 18; x += 2) px(g, x, 20, 0x000000, 0.25);
  // Large armored body
  for (let y = 6; y <= 16; y += 2)
    for (let x = 4; x <= 18; x += 2) px(g, x, y, 0x5a2040);
  // Skull emblem on chest
  px(g, 10, 8, 0xc0c0c0); px(g, 12, 8, 0xc0c0c0);
  px(g, 10, 10, 0xa0a0a0); px(g, 12, 10, 0xa0a0a0);
  px(g, 8, 10, 0xc0c0c0); px(g, 14, 10, 0xc0c0c0);
  // Heavy plates
  for (let x = 4; x <= 18; x += 2) { px(g, x, 6, 0x7a3060); px(g, x, 16, 0x7a3060); }
  // Shoulder pads
  px(g, 0, 8, 0x8a2050); px(g, 2, 8, 0x8a2050);
  px(g, 20, 8, 0x8a2050); px(g, 22, 8, 0x8a2050);
  px(g, 0, 10, 0x6a1838); px(g, 2, 10, 0x6a1838);
  px(g, 20, 10, 0x6a1838); px(g, 22, 10, 0x6a1838);
  // Helmet
  px(g, 8, 2, 0x5a2040); px(g, 10, 2, 0x5a2040); px(g, 12, 2, 0x5a2040); px(g, 14, 2, 0x5a2040);
  px(g, 8, 4, 0x5a2040); px(g, 10, 4, 0x5a2040); px(g, 12, 4, 0x5a2040); px(g, 14, 4, 0x5a2040);
  // Red visor
  px(g, 8, 4, 0xd02020); px(g, 10, 4, 0xd02020); px(g, 12, 4, 0xd02020); px(g, 14, 4, 0xd02020);
  // Crown/horn
  px(g, 8, 0, 0x401028); px(g, 14, 0, 0x401028);
  // Dual guns
  px(g, 2, 4, 0x303030); px(g, 2, 6, 0x303030);
  px(g, 20, 4, 0x303030); px(g, 20, 6, 0x303030);
  // Boots
  px(g, 6, 18, 0x301020); px(g, 8, 18, 0x301020);
  px(g, 14, 18, 0x301020); px(g, 16, 18, 0x301020);
  g.generateTexture("enemy_boss", s, s);
}

function createBulletTex(
  g: Phaser.GameObjects.Graphics, scene: Phaser.Scene,
  key: string, color: number, glow: number
) {
  g.clear();
  px(g, 0, 0, glow, 0.4);
  px(g, 2, 0, color);
  g.generateTexture(key, 4, 2);
}

function createWallTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 16; g.clear();
  // Base
  g.fillStyle(0x404038); g.fillRect(0, 0, s, s);
  // Bricks (2-pixel blocks)
  for (let row = 0; row < 4; row++) {
    const off = (row % 2) * 4;
    g.fillStyle(0x353530);
    g.fillRect(0, row * 4, s, 1); // mortar line
    for (let col = 0; col < 3; col++) {
      const bx = col * 6 + off;
      const shade = [0x3a3a32, 0x424238, 0x3e3e35][col % 3];
      g.fillStyle(shade);
      g.fillRect(bx, row * 4 + 1, 5, 3);
    }
  }
  g.generateTexture("wall_tile", s, s);
}

function createFloorTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 16; g.clear();
  g.fillStyle(0x1e1c14); g.fillRect(0, 0, s, s);
  // Tile lines
  g.fillStyle(0x181610); g.fillRect(0, 8, s, 1); g.fillRect(8, 0, 1, s);
  // Dirt
  px(g, 2, 4, 0x262218, 0.5);
  px(g, 10, 12, 0x262218, 0.5);
  g.generateTexture("floor_tile", s, s);
}

function createCrateTex(
  g: Phaser.GameObjects.Graphics, scene: Phaser.Scene,
  key: string, w: number, h: number, c1: number, c2: number
) {
  g.clear();
  g.fillStyle(0x000000, 0.2); g.fillRect(1, 1, w, h);
  g.fillStyle(c1); g.fillRect(0, 0, w - 1, h - 1);
  g.fillStyle(c2); g.fillRect(1, 1, w - 3, 2);
  // Cross
  g.fillStyle(darken(c1, 0.6)); g.fillRect(0, h / 2 - 1, w - 1, 2);
  g.fillStyle(darken(c1, 0.6)); g.fillRect(w / 2 - 1, 0, 2, h - 1);
  // Corners
  g.fillStyle(0x808080, 0.5);
  g.fillRect(0, 0, 2, 2); g.fillRect(w - 3, 0, 2, 2);
  g.fillRect(0, h - 3, 2, 2); g.fillRect(w - 3, h - 3, 2, 2);
  g.generateTexture(key, w, h);
}

function createGunTex(
  g: Phaser.GameObjects.Graphics, scene: Phaser.Scene,
  key: string, w: number, h: number, c: number
) {
  g.clear();
  g.fillStyle(c); g.fillRect(0, h / 2 - 1, w - 2, 2);
  g.fillStyle(0x303028); g.fillRect(w - 4, h / 2 - 1, 4, 2);
  g.fillStyle(0x2a2018); g.fillRect(2, h / 2, 2, h / 2 - 1);
  g.generateTexture(key, w, h);
}

function createMuzzleFlashTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 8; g.clear();
  px(g, 2, 2, 0xffffff, 0.9);
  px(g, 4, 2, 0xffffff, 0.9);
  px(g, 2, 4, 0xffee44, 0.7);
  px(g, 4, 4, 0xffee44, 0.7);
  px(g, 0, 2, 0xff8800, 0.4);
  px(g, 6, 2, 0xff8800, 0.4);
  px(g, 2, 0, 0xff8800, 0.4);
  px(g, 2, 6, 0xff8800, 0.4);
  g.generateTexture("muzzle_flash", s, s);
}

function createTreeTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 16; g.clear();
  // Shadow
  px(g, 4, 12, 0x000000, 0.15); px(g, 6, 12, 0x000000, 0.15);
  px(g, 8, 12, 0x000000, 0.15); px(g, 10, 12, 0x000000, 0.15);
  // Trunk
  px(g, 6, 10, 0x402818); px(g, 8, 10, 0x402818);
  // Foliage (layered pixel blocks)
  px(g, 4, 4, 0x1a3010); px(g, 6, 4, 0x254018); px(g, 8, 4, 0x254018); px(g, 10, 4, 0x1a3010);
  px(g, 2, 6, 0x1a3010); px(g, 4, 6, 0x305020); px(g, 6, 6, 0x305020); px(g, 8, 6, 0x305020); px(g, 10, 6, 0x305020); px(g, 12, 6, 0x1a3010);
  px(g, 4, 8, 0x1a3010); px(g, 6, 8, 0x254018); px(g, 8, 8, 0x254018); px(g, 10, 8, 0x1a3010);
  // Top highlight
  px(g, 6, 2, 0x305020); px(g, 8, 2, 0x305020);
  g.generateTexture("tree", s, s);
}

function createBushTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 8; g.clear();
  px(g, 0, 2, 0x1a3510); px(g, 2, 2, 0x254518); px(g, 4, 2, 0x254518); px(g, 6, 2, 0x1a3510);
  px(g, 2, 4, 0x1a3510); px(g, 4, 4, 0x1a3510);
  px(g, 2, 0, 0x203c14);
  g.generateTexture("bush", s, s);
}

function createGrassTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 32; g.clear();
  // Scattered grass blades as pixel blocks
  const spots = [
    [2, 6], [8, 2], [14, 10], [20, 4], [26, 8],
    [4, 18], [12, 22], [18, 16], [24, 26], [28, 14],
    [6, 28], [16, 30], [22, 20], [10, 14], [30, 24],
  ];
  for (const [sx, sy] of spots) {
    const c = [0x1a3010, 0x203818, 0x253a14][Phaser.Math.Between(0, 2)];
    g.fillStyle(c, Phaser.Math.FloatBetween(0.3, 0.6));
    g.fillRect(sx, sy, 2, Phaser.Math.Between(2, 4));
  }
  // Small stones
  g.fillStyle(0x3a3830, 0.3); g.fillRect(10, 8, 2, 2);
  g.fillStyle(0x3a3830, 0.2); g.fillRect(24, 18, 2, 2);
  g.generateTexture("grass_patch", s, s);
}

function createNPCTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 14; g.clear();
  // Body (blue jacket)
  px(g, 4, 4, 0x3050a0); px(g, 6, 4, 0x3050a0); px(g, 8, 4, 0x3050a0);
  px(g, 4, 6, 0x2840a0); px(g, 6, 6, 0x5070c0); px(g, 8, 6, 0x2840a0);
  px(g, 4, 8, 0x3050a0); px(g, 8, 8, 0x3050a0);
  // Head (friendly, no mask)
  px(g, 4, 2, 0xd0a080); px(g, 6, 2, 0xd0a080); px(g, 8, 2, 0xd0a080);
  // Hat
  px(g, 4, 0, 0x3050a0); px(g, 6, 0, 0x3050a0); px(g, 8, 0, 0x3050a0);
  // Arms
  px(g, 2, 6, 0x2840a0); px(g, 10, 6, 0x2840a0);
  // Boots
  px(g, 4, 10, 0x303028); px(g, 8, 10, 0x303028);
  g.generateTexture("npc_trader", s, s);
}

function createStashTex(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene) {
  const s = 10; g.clear();
  // Hidden stash (partially buried box)
  g.fillStyle(0x605020, 0.6); g.fillRect(1, 2, 8, 6);
  g.fillStyle(0x706028, 0.5); g.fillRect(2, 3, 6, 2);
  // Dirt covering
  g.fillStyle(0x1a1e10, 0.4); g.fillRect(0, 0, 10, 3);
  g.fillStyle(0x1a1e10, 0.3); g.fillRect(0, 7, 10, 3);
  g.generateTexture("stash_hidden", s, s);
}
