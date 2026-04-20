// ─── Game Constants ──────────────────────────────────────────

// Player
export const PLAYER_SPEED = 200;
export const PLAYER_MAX_HP = 100;
export const PLAYER_RADIUS = 14;

// Weapons
export const WEAPONS = {
  pistol: {
    name: "Pistol",
    fireRate: 400,
    bulletSpeed: 500,
    damage: 15,
    spread: 0.05,
    magSize: 12,
    reloadTime: 1500,
    color: 0xd4a840,     // brass
    auto: false,
  },
  smg: {
    name: "SMG",
    fireRate: 100,
    bulletSpeed: 550,
    damage: 10,
    spread: 0.12,
    magSize: 30,
    reloadTime: 2000,
    color: 0xc8a030,     // darker brass
    auto: true,
  },
  shotgun: {
    name: "Shotgun",
    fireRate: 800,
    bulletSpeed: 450,
    damage: 8,
    spread: 0.25,
    magSize: 6,
    reloadTime: 2500,
    color: 0xb87020,     // copper
    auto: false,
    pellets: 5,
  },
  rifle: {
    name: "Rifle",
    fireRate: 600,
    bulletSpeed: 700,
    damage: 35,
    spread: 0.02,
    magSize: 5,
    reloadTime: 2200,
    color: 0xa09060,     // steel gray-gold
    auto: false,
  },
} as const;

export type WeaponType = keyof typeof WEAPONS;

// Bullets
export const BULLET_LIFETIME = 1200;
export const BULLET_RADIUS = 3;

// Enemies
export const ENEMY_TYPES = {
  bandit: {
    name: "Bandit",
    hp: 40,
    speed: 80,
    damage: 10,
    fireRate: 1200,
    detectionRange: 250,
    attackRange: 200,
    color: 0x8b5e3c,      // dirty brown (ragged clothing)
    radius: 12,
    loot: ["ammo", "bandage"],
  },
  mutant: {
    name: "Mutant",
    hp: 80,
    speed: 130,
    damage: 25,
    fireRate: 0, // melee only
    detectionRange: 200,
    attackRange: 30,
    color: 0x556b2f,       // dark olive green (irradiated)
    radius: 16,
    loot: ["meat", "mutant_part"],
  },
  heavy: {
    name: "Heavy",
    hp: 120,
    speed: 50,
    damage: 20,
    fireRate: 800,
    detectionRange: 300,
    attackRange: 280,
    color: 0x5a3a3a,       // dark maroon (heavy armor)
    radius: 18,
    loot: ["ammo", "medkit", "weapon_part"],
  },
  boss: {
    name: "Boss",
    hp: 300,
    speed: 60,
    damage: 35,
    fireRate: 600,
    detectionRange: 350,
    attackRange: 300,
    color: 0x8a2050,
    radius: 20,
    loot: ["medkit", "weapon_part", "weapon_part", "ammo"],
  },
} as const;

export type EnemyType = keyof typeof ENEMY_TYPES;

// Map
export const MAP_W = 6000;
export const MAP_H = 6000;
export const TILE_SIZE = 100;

// Colors – ZERO Sievert style (dark, desaturated, post-apocalyptic)
export const COLORS = {
  ground: 0x141810,       // very dark forest floor
  wall: 0x3a3830,         // concrete / stone
  playerAlive: 0x4a6030,  // dark olive
  playerHurt: 0x7a2020,   // dark blood red
  extraction: 0x308880,   // muted teal
  extractionGlow: 0x204840,
  hpBar: 0x4a7030,        // dark military green
  hpBarBg: 0x1a1a14,
  ammoText: 0xa09880,     // muted parchment
  lootContainer: 0x6a5020, // dark wood
  bullet: 0xffdd44,       // bright tracer
} as const;

// UI
export const JOYSTICK_RADIUS = 50;
export const JOYSTICK_DEAD_ZONE = 10;
export const HUD_DEPTH = 100;

// Extraction
export const EXTRACTION_TIME = 3000; // ms to extract
export const EXTRACTION_RADIUS = 40;
