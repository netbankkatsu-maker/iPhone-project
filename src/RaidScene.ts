import Phaser from "phaser";
import {
  PLAYER_SPEED,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  WEAPONS,
  WeaponType,
  BULLET_LIFETIME,
  BULLET_RADIUS,
  MAP_W,
  MAP_H,
  COLORS,
  EXTRACTION_TIME,
  EXTRACTION_RADIUS,
  ENEMY_TYPES,
  EnemyType,
  HUD_DEPTH,
} from "./constants";
import { VirtualJoystick } from "./VirtualJoystick";
import { HUD } from "./HUD";
import { generateMap, MapData } from "./MapGenerator";
import {
  EnemySprite,
  spawnEnemy,
  updateEnemy,
  damageEnemy,
} from "./Enemy";
import { PlayerStash, createDefaultStash } from "./BaseScene";
import {
  GridInventory,
  InventoryUI,
  InvItem,
  ITEM_DEFS,
} from "./Inventory";
import {
  SurvivalStats,
  createSurvivalStats,
  updateSurvival,
  applyItem,
  onDamageTaken,
  addRadiation,
} from "./Survival";
import { FogOfWar } from "./FogOfWar";
import { Minimap } from "./Minimap";
import { AudioManager } from "./Audio";
import { updateQuestProgress } from "./Quest";
import { generateTextures } from "./Textures";

export class RaidScene extends Phaser.Scene {
  // Player
  private player!: Phaser.GameObjects.Sprite;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerHP = PLAYER_MAX_HP;
  private playerAlive = true;
  private invincibleUntil = 0;
  private armorValue = 0;

  // Weapons
  private currentWeapon: WeaponType = "pistol";
  private ammo: number = WEAPONS.pistol.magSize;
  private isReloading = false;

  // Combat
  private bullets!: Phaser.GameObjects.Group;
  private enemyBullets!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private lastShotTime = 0;
  private kills = 0;

  // Map
  private mapData!: MapData;

  // Extraction
  private extractionProgress = 0;
  private isExtracting = false;
  private extracted = false;

  // Input
  private moveStick!: VirtualJoystick;
  private aimStick!: VirtualJoystick;

  // HUD
  private hud!: HUD;

  // Aim indicator
  private aimIndicator!: Phaser.GameObjects.Line;

  // Loot containers (world objects)
  private lootContainers!: Phaser.GameObjects.Group;

  // Weapon pickup visual
  private weaponPickups!: Phaser.GameObjects.Group;

  // Inventory
  private inventory!: GridInventory;
  private inventoryUI!: InventoryUI;
  private invButton!: Phaser.GameObjects.Text;
  private nearbyLootContainer: Phaser.GameObjects.Rectangle | null = null;
  private lootButtonBg!: Phaser.GameObjects.Rectangle;
  private lootButtonLabel!: Phaser.GameObjects.Text;

  // Survival
  private survival!: SurvivalStats;
  private radZones: { x: number; y: number; radius: number }[] = [];

  // Fog of War
  private fog!: FogOfWar;

  // Minimap
  private minimap!: Minimap;

  // Audio
  private audio!: AudioManager;

  // Kill feed
  private killFeed: Phaser.GameObjects.Text[] = [];

  // Stash from base
  private stash: PlayerStash = createDefaultStash();

  constructor() {
    super("RaidScene");
  }

  init(data?: { stash?: PlayerStash }) {
    if (data?.stash) this.stash = data.stash;
    this.playerHP = PLAYER_MAX_HP;
    this.playerAlive = true;
    this.kills = 0;
    this.currentWeapon = "pistol";
    this.ammo = WEAPONS.pistol.magSize;
    this.isReloading = false;
    this.extractionProgress = 0;
    this.isExtracting = false;
    this.extracted = false;
    this.lastShotTime = 0;
    this.invincibleUntil = 0;
    this.armorValue = 0;
    this.nearbyLootContainer = null;
    this.radZones = [];
  }

  create() {
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // Generate procedural textures
    generateTextures(this);

    // Generate map
    this.mapData = generateMap(this);

    // Groups
    this.bullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.enemies = this.add.group();
    this.lootContainers = this.add.group();
    this.weaponPickups = this.add.group();

    // Player (sprite with generated texture)
    this.player = this.add.sprite(
      this.mapData.spawnPoint.x,
      this.mapData.spawnPoint.y,
      "player_alive"
    );
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCircle(PLAYER_RADIUS, 4, 4);
    this.playerBody.setCollideWorldBounds(true);

    // Aim indicator
    this.aimIndicator = this.add
      .line(0, 0, 0, 0, 30, 0, COLORS.playerAlive, 0.5)
      .setOrigin(0, 0.5)
      .setDepth(10);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor("#1a1f14");

    // Fog of War
    this.fog = new FogOfWar(this);

    // Minimap
    this.minimap = new Minimap(this, this.mapData.extractionPoint.x, this.mapData.extractionPoint.y);

    // Audio
    this.audio = new AudioManager();

    // Collisions
    this.physics.add.collider(this.player, this.mapData.walls);

    // Spawn enemies
    this.spawnEnemies();

    // Spawn loot containers with real inventories
    this.spawnLoot();

    // Spawn weapon pickups
    this.spawnWeaponPickups();

    // Group-level colliders (instead of per-bullet)
    this.physics.add.collider(this.bullets, this.mapData.walls, (bullet) => {
      (bullet as Phaser.GameObjects.Sprite).destroy();
    });
    this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
      if (!(bullet as Phaser.GameObjects.Sprite).active) return;
      if (!(enemy as Phaser.GameObjects.Sprite).active) return;
      const meta = (bullet as Phaser.GameObjects.Sprite).getData("meta") as { damage: number };
      if (!meta) return;

      // Capture enemy data BEFORE damageEnemy destroys it
      const enemySprite = enemy as EnemySprite;
      const ex = enemySprite.x;
      const ey = enemySprite.y;
      const enemyData = enemySprite.getData("enemyData");

      this.audio.playHit();
      const killed = damageEnemy(this, enemySprite, meta.damage);
      if (killed) {
        this.kills++;
        this.dropEnemyLootAt(ex, ey, enemyData);
        this.showKillFeedFor(enemyData);
      }
      (bullet as Phaser.GameObjects.Sprite).destroy();
    });

    // Enemy bullets hit player
    this.physics.add.collider(this.enemyBullets, this.mapData.walls, (bullet) => {
      (bullet as Phaser.GameObjects.Sprite).destroy();
    });
    this.physics.add.overlap(
      this.player,
      this.enemyBullets,
      (_player, bullet) => {
        if (!(bullet as Phaser.GameObjects.Sprite).active) return;
        this.onPlayerHit(bullet as Phaser.GameObjects.Sprite);
      }
    );

    // Melee enemies hit player
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      if (!this.playerAlive) return;
      const data = (enemy as EnemySprite).getData("enemyData");
      if (!data || data.state === "dead") return;
      const cfg = ENEMY_TYPES[data.type as EnemyType];
      if (cfg.fireRate === 0) {
        this.takeDamage(cfg.damage * 0.02);
      }
    });

    // Joysticks
    const w = this.scale.width;
    const h = this.scale.height;
    this.moveStick = new VirtualJoystick(this, w * 0.15, h * 0.7, "left");
    this.aimStick = new VirtualJoystick(this, w * 0.85, h * 0.7, "right");

    // HUD
    this.hud = new HUD(this);
    this.hud.updateWeapon(this.currentWeapon);
    this.hud.updateAmmo(this.ammo, WEAPONS[this.currentWeapon].magSize);

    // Survival system
    this.survival = createSurvivalStats();
    this.spawnRadZones();

    // Inventory system
    this.inventory = new GridInventory(5, 4);
    // Start with pistol and some ammo
    this.inventory.autoAdd("pistol", 1);
    this.inventory.autoAdd("ammo_pistol", 24);
    this.inventory.autoAdd("bandage", 2);

    this.inventoryUI = new InventoryUI(this, this.inventory);
    this.inventoryUI.onEquip((slot, item) => {
      this.handleEquipChange(slot, item);
    });
    // Equip starting pistol
    const startPistol = this.inventory.hasItem("pistol");
    if (startPistol) {
      this.inventory.removeItem(startPistol);
      this.inventoryUI.equipItem("weapon1", startPistol);
    }

    // Inventory button (visual only, input via screen coords)
    this.invButton = this.add
      .text(10, 24, "[BAG]", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#b8b0a0",
        backgroundColor: "#2a3020",
        padding: { x: 6, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    // Loot button (visual only, appears near loot containers)
    this.lootButtonBg = this.add.rectangle(w / 2, h * 0.6, 80, 36, 0xb08030, 0.9)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2)
      .setVisible(false);
    this.lootButtonBg.setStrokeStyle(2, 0xd4a840);
    this.lootButtonLabel = this.add.text(w / 2, h * 0.6, "LOOT", {
      fontFamily: "monospace", fontSize: "15px", color: "#ffffff",
    }).setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 3)
      .setVisible(false);

    // Screen-coordinate input handler for BAG + LOOT buttons
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.playerAlive || this.extracted) return;
      // Don't handle if inventory is open (inventory has its own handler)
      if (this.inventoryUI.getIsOpen()) return;
      const px = pointer.x;
      const py = pointer.y;

      // BAG button hit test (top-left area)
      if (px >= 10 && px <= 70 && py >= 24 && py <= 44) {
        this.inventoryUI.open();
        return;
      }

      // LOOT button hit test (center screen)
      if (this.lootButtonBg.visible && this.nearbyLootContainer?.active) {
        const lbx = this.lootButtonBg.x;
        const lby = this.lootButtonBg.y;
        if (px >= lbx - 40 && px <= lbx + 40 && py >= lby - 18 && py <= lby + 18) {
          const lootInv = this.nearbyLootContainer.getData("lootInventory") as GridInventory;
          this.inventoryUI.open(lootInv);
          return;
        }
      }
    });

    // Resize handler
    this.scale.on("resize", this.onResize, this);

    // Scene cleanup on shutdown
    this.events.on("shutdown", this.cleanup, this);
  }

  private cleanup() {
    this.scale.off("resize", this.onResize, this);
    this.moveStick?.destroy();
    this.aimStick?.destroy();
    this.minimap?.destroy();
    if (this.inventoryUI?.getIsOpen()) this.inventoryUI.close();
    this.tweens.killAll();
    for (const t of this.killFeed) { if (t.active) t.destroy(); }
    this.killFeed = [];
  }

  private handleEquipChange(slot: string, item: InvItem | null) {
    if (slot === "use_medical" && item) {
      const healed = applyItem(this.survival, item.defId);
      if (healed > 0) {
        this.playerHP = Math.min(PLAYER_MAX_HP, this.playerHP + healed);
        this.hud.updateHP(this.playerHP);
      }
      return;
    }

    if (slot === "armor") {
      this.armorValue = item ? (ITEM_DEFS[item.defId].armorValue || 0) : 0;
      return;
    }

    if ((slot === "weapon1" || slot === "weapon2") && item) {
      const def = ITEM_DEFS[item.defId];
      if (def.weaponType) {
        this.currentWeapon = def.weaponType;
        this.ammo = WEAPONS[def.weaponType].magSize;
        this.isReloading = false;
        this.hud.showReloading(false);
        this.hud.updateWeapon(def.weaponType);
        this.hud.updateAmmo(this.ammo, WEAPONS[def.weaponType].magSize);
      }
    }
  }

  private spawnEnemies() {
    const types: EnemyType[] = ["bandit", "bandit", "bandit", "mutant", "mutant", "heavy"];
    for (const pt of this.mapData.enemySpawnPoints) {
      const type = types[Phaser.Math.Between(0, types.length - 1)];
      spawnEnemy(this, pt.x, pt.y, type, this.enemies, this.mapData.walls);
    }
    this.physics.add.collider(this.enemies, this.enemies);
  }

  private spawnLoot() {
    for (const pt of this.mapData.lootPoints) {
      const box = this.add.sprite(pt.x, pt.y, "crate_loot");
      this.physics.add.existing(box, true);

      // Each loot container has its own grid inventory
      const lootInv = new GridInventory(4, 3);
      // Random loot fills
      const lootTable = ["ammo_pistol", "ammo_rifle", "ammo_shotgun", "bandage", "medkit", "painkiller", "canned_food", "water", "scrap_metal"];
      const numItems = Phaser.Math.Between(1, 4);
      for (let i = 0; i < numItems; i++) {
        const itemId = lootTable[Phaser.Math.Between(0, lootTable.length - 1)];
        const def = ITEM_DEFS[itemId];
        const qty = def.stackable ? Phaser.Math.Between(1, Math.ceil(def.maxStack / 3)) : 1;
        lootInv.autoAdd(itemId, qty);
      }
      // Rare chance for weapon
      if (Math.random() < 0.15) {
        const weapons = ["smg", "shotgun", "rifle"];
        lootInv.autoAdd(weapons[Phaser.Math.Between(0, 2)], 1);
      }
      // Rare chance for armor
      if (Math.random() < 0.1) {
        lootInv.autoAdd(Math.random() > 0.5 ? "armor_light" : "armor_heavy", 1);
      }

      box.setData("lootInventory", lootInv);
      this.lootContainers.add(box);
    }
  }

  private spawnWeaponPickups() {
    // Weapon pickups are now inside loot containers, but keep a few on the ground
    const weaponTypes: WeaponType[] = ["smg", "shotgun", "rifle"];
    for (let i = 0; i < 3; i++) {
      const type = weaponTypes[Phaser.Math.Between(0, weaponTypes.length - 1)];
      const x = Phaser.Math.Between(200, MAP_W - 200);
      const y = Phaser.Math.Between(200, MAP_H - 200);
      const gunTexKey = `gun_${type}`;
      const pickup = this.textures.exists(gunTexKey)
        ? this.add.sprite(x, y, gunTexKey)
        : this.add.circle(x, y, 8, WEAPONS[type].color, 0.8);
      this.physics.add.existing(pickup, true);
      pickup.setData("weaponType", type);
      this.weaponPickups.add(pickup);

      this.add
        .text(x, y - 14, WEAPONS[type].name, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#e0d8c8",
          backgroundColor: "#00000066",
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5);
    }
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const w = gameSize.width;
    const h = gameSize.height;
    this.moveStick.reposition(w * 0.15, h * 0.7);
    this.aimStick.reposition(w * 0.85, h * 0.7);
    this.hud.onResize();
    this.lootButtonBg.setPosition(w / 2, h * 0.6);
    this.lootButtonLabel.setPosition(w / 2, h * 0.6);
  }

  update(_time: number, delta: number) {
    if (this.extracted) return;

    // Pause gameplay when inventory is open
    if (this.inventoryUI.getIsOpen()) {
      this.playerBody.setVelocity(0, 0);
      return;
    }

    if (!this.playerAlive) {
      this.playerBody.setVelocity(0, 0);
      return;
    }

    // Movement
    const mx = this.moveStick.vector.x;
    const my = this.moveStick.vector.y;
    this.playerBody.setVelocity(mx * PLAYER_SPEED, my * PLAYER_SPEED);

    // Aim
    const ax = this.aimStick.vector.x;
    const ay = this.aimStick.vector.y;
    if (ax !== 0 || ay !== 0) {
      const angle = Math.atan2(ay, ax);
      this.player.setRotation(angle - Math.PI / 2);
      this.aimIndicator.setVisible(true);
      this.aimIndicator.setPosition(this.player.x, this.player.y);
      this.aimIndicator.setRotation(angle);
    } else if (mx !== 0 || my !== 0) {
      this.player.setRotation(Math.atan2(my, mx) - Math.PI / 2);
      this.aimIndicator.setVisible(false);
    } else {
      this.aimIndicator.setVisible(false);
    }

    // Shooting
    if (this.aimStick.active && (ax !== 0 || ay !== 0) && !this.isReloading) {
      const weapon = WEAPONS[this.currentWeapon];
      const now = this.time.now;
      if (now - this.lastShotTime > weapon.fireRate) {
        if (this.ammo > 0) {
          this.shoot(ax, ay);
          this.lastShotTime = now;
        } else {
          this.reload();
        }
      }
    }

    // Auto reload when empty
    if (this.ammo <= 0 && !this.isReloading) {
      this.reload();
    }

    // Update bullets lifetime
    for (const b of [...this.bullets.getChildren()]) {
      if (!b.active) continue;
      const meta = (b as Phaser.GameObjects.Sprite).getData("meta") as { born: number } | null;
      if (!meta || this.time.now - meta.born > BULLET_LIFETIME) b.destroy();
    }
    for (const b of [...this.enemyBullets.getChildren()]) {
      if (!b.active) continue;
      const meta = (b as Phaser.GameObjects.Sprite).getData("meta") as { born: number } | null;
      if (!meta || this.time.now - meta.born > BULLET_LIFETIME) b.destroy();
    }

    // Update enemies
    for (const e of [...this.enemies.getChildren()]) {
      if (!e.active) continue;
      updateEnemy(
        this,
        e as EnemySprite,
        this.player.x,
        this.player.y,
        this.playerAlive,
        this.enemyBullets,
        this.mapData.walls
      );
    }

    // Check loot proximity
    this.checkLootProximity();

    // Check weapon pickup
    this.checkWeaponPickup();

    // Survival update
    const deltaSec = delta / 1000;
    const isMoving = mx !== 0 || my !== 0;
    const { hpDrain, speedMult } = updateSurvival(this.survival, deltaSec, isMoving, false);
    if (hpDrain > 0) {
      this.playerHP -= hpDrain;
      if (this.playerHP <= 0) this.die();
    }
    // Apply speed modifier from survival effects
    if (speedMult < 1) {
      this.playerBody.setVelocity(
        this.playerBody.velocity.x * speedMult,
        this.playerBody.velocity.y * speedMult
      );
    }

    // Radiation zone check
    this.checkRadZones(deltaSec);

    // Environment hazards
    this.checkHazards();

    // Fog of War
    this.fog.update(this.player.x, this.player.y);

    // Extraction check
    this.checkExtraction(delta);

    // Update HUD
    this.hud.updateHP(this.playerHP);
    this.hud.updateKills(this.kills);
    this.hud.updateSurvival(this.survival);

    // Update minimap
    this.minimap.update(this.player.x, this.player.y, this.enemies);
  }

  private shoot(dirX: number, dirY: number) {
    const weapon = WEAPONS[this.currentWeapon];
    const pellets = "pellets" in weapon ? weapon.pellets : 1;

    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * weapon.spread * 2;
      const angle = Math.atan2(dirY, dirX) + spread;
      const bx = this.player.x + Math.cos(angle) * 20;
      const by = this.player.y + Math.sin(angle) * 20;

      const bullet = this.add.sprite(bx, by, "bullet_player").setRotation(angle);
      this.physics.add.existing(bullet);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setSize(6, 4);
      body.setVelocity(
        Math.cos(angle) * weapon.bulletSpeed,
        Math.sin(angle) * weapon.bulletSpeed
      );

      bullet.setData("meta", { born: this.time.now, damage: weapon.damage });
      this.bullets.add(bullet);
    }

    this.ammo--;
    this.hud.updateAmmo(this.ammo, weapon.magSize);

    // Audio
    this.audio.playShoot(this.currentWeapon);

    if (this.currentWeapon === "shotgun") {
      this.cameras.main.shake(80, 0.003);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dropEnemyLootAt(x: number, y: number, data: any) {
    const box = this.add.sprite(x, y, "crate_drop");
    this.physics.add.existing(box, true);

    const lootInv = new GridInventory(3, 2);
    if (data) {
      const cfg = ENEMY_TYPES[data.type as EnemyType];
      if (cfg) {
        for (const lootId of cfg.loot) {
          const mapped = mapLootId(lootId);
          if (mapped) {
            const def = ITEM_DEFS[mapped];
            if (def) {
              const qty = def.stackable ? Phaser.Math.Between(1, Math.ceil(def.maxStack / 4)) : 1;
              lootInv.autoAdd(mapped, qty);
            }
          }
        }
      }
    }
    box.setData("lootInventory", lootInv);
    this.lootContainers.add(box);
  }

  private reload() {
    if (this.isReloading || !this.playerAlive) return;
    const weapon = WEAPONS[this.currentWeapon];
    if (this.ammo >= weapon.magSize) return;

    this.isReloading = true;
    this.hud.showReloading(true);

    this.time.delayedCall(weapon.reloadTime, () => {
      if (!this.playerAlive || !this.scene.isActive()) return;
      this.ammo = weapon.magSize;
      this.isReloading = false;
      this.hud.showReloading(false);
      this.hud.updateAmmo(this.ammo, weapon.magSize);
    });
  }

  private onPlayerHit(bullet: Phaser.GameObjects.Sprite) {
    if (!this.playerAlive || !bullet.active) return;
    const meta = bullet.getData("meta") as { damage: number } | null;
    bullet.destroy();
    if (meta) this.takeDamage(meta.damage);
  }

  private takeDamage(amount: number) {
    if (this.time.now < this.invincibleUntil) return;

    // Armor reduces damage
    const reduced = Math.max(1, amount - this.armorValue * 0.3);
    this.playerHP -= reduced;
    this.hud.updateHP(this.playerHP);

    // Survival status effects from damage
    onDamageTaken(this.survival, reduced);

    this.audio.playDamage();
    this.player.setTexture("player_hurt");
    this.time.delayedCall(100, () => {
      if (this.playerAlive) this.player.setTexture("player_alive");
    });

    this.cameras.main.flash(100, 255, 0, 0, false, undefined, this);

    if (this.playerHP <= 0) {
      this.die();
    }

    this.invincibleUntil = this.time.now + 100;
  }

  private die() {
    if (!this.playerAlive) return;
    this.playerAlive = false;
    this.playerBody.setVelocity(0, 0);
    this.playerBody.setImmovable(true);
    this.player.setTexture("player_dead");
    this.player.setAlpha(0.5);
    this.hud.showStatus("YOU DIED\n\nAll loot lost.", "#ff5252");

    this.stash.totalDeaths++;

    this.time.delayedCall(3000, () => {
      this.scene.start("BaseScene", {
        stash: this.stash,
        message: "YOU DIED - All loot was lost.",
      });
    });
  }

  private checkLootProximity() {
    this.nearbyLootContainer = null;
    let nearLoot = false;

    for (const obj of this.lootContainers.getChildren()) {
      const box = obj as Phaser.GameObjects.Rectangle;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        box.x,
        box.y
      );
      if (dist < 35) {
        nearLoot = true;
        this.nearbyLootContainer = box;
        break;
      }
    }
    this.lootButtonBg.setVisible(nearLoot);
    this.lootButtonLabel.setVisible(nearLoot);
    if (!nearLoot) this.hud.hideInteractHint();
  }

  private checkWeaponPickup() {
    for (const obj of this.weaponPickups.getChildren()) {
      const pickup = obj as Phaser.GameObjects.Sprite;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        pickup.x,
        pickup.y
      );
      if (dist < 20) {
        const wType = pickup.getData("weaponType") as WeaponType;
        // Add to inventory instead of auto-equip
        if (this.inventory.autoAdd(wType, 1)) {
          this.audio.playPickup();
          pickup.destroy();
        }
      }
    }
  }

  private checkExtraction(delta: number) {
    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.mapData.extractionPoint.x,
      this.mapData.extractionPoint.y
    );

    if (dist < EXTRACTION_RADIUS) {
      this.isExtracting = true;
      this.extractionProgress += delta;
      this.hud.showExtracting(true, this.extractionProgress / EXTRACTION_TIME);

      if (this.extractionProgress >= EXTRACTION_TIME) {
        this.extract();
      }
    } else {
      if (this.isExtracting) {
        this.extractionProgress = Math.max(0, this.extractionProgress - delta * 2);
        if (this.extractionProgress <= 0) {
          this.isExtracting = false;
          this.hud.showExtracting(false);
        } else {
          this.hud.showExtracting(
            true,
            this.extractionProgress / EXTRACTION_TIME
          );
        }
      }
    }
  }

  private extract() {
    this.extracted = true;
    this.playerBody.setVelocity(0, 0);
    this.audio.playExtract();

    this.stash.kills += this.kills;
    this.stash.totalExtracts++;

    // Quest progress
    updateQuestProgress(this.stash.quests, "extract", 1);
    updateQuestProgress(this.stash.quests, "kill", this.kills);

    // XP and money
    const earnedXp = this.kills * 10 + 20;
    const earnedMoney = this.kills * 30 + 50;
    this.stash.xp += earnedXp;
    this.stash.money += earnedMoney;

    // Level up
    const xpNeeded = this.stash.level * 100;
    while (this.stash.xp >= xpNeeded) {
      this.stash.xp -= xpNeeded;
      this.stash.level++;
    }

    // Quest rewards
    for (const q of this.stash.quests) {
      if (q.completed && q.reward.money > 0) {
        this.stash.money += q.reward.money;
        this.stash.xp += q.reward.xp;
        q.reward.money = 0;
        q.reward.xp = 0;
      }
    }

    this.hud.showStatus(`EXTRACTED!\n\n+${earnedXp}XP  +$${earnedMoney}`, "#00e5ff");

    this.cameras.main.fadeOut(2000, 0, 0, 0);
    this.time.delayedCall(3000, () => {
      this.scene.start("BaseScene", {
        stash: this.stash,
        message: `EXTRACTED - ${this.kills} kills, loot secured.`,
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private showKillFeedFor(data: any) {
    if (!data) return;
    const cfg = ENEMY_TYPES[data.type as EnemyType];
    if (!cfg) return;
    const w = this.scale.width;

    // Shift existing entries down
    for (const t of this.killFeed) {
      t.y += 14;
      if (t.y > 120) { t.destroy(); }
    }
    this.killFeed = this.killFeed.filter((t) => t.active);

    const text = this.add
      .text(w - 10, 44, `Killed ${cfg.name}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ff8a80",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.killFeed.push(text);

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: () => text.destroy(),
    });
  }

  private checkHazards() {
    for (const h of this.mapData.hazards) {
      if (!h.gameObject.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        h.x,
        h.y
      );

      if (h.type === "landmine" && dist < 20) {
        // Explode
        this.takeDamage(40);
        this.cameras.main.shake(200, 0.01);
        this.audio.playExplosion();
        h.gameObject.destroy();
        // Explosion visual
        const explosion = this.add.circle(h.x, h.y, 30, 0xff6600, 0.6);
        this.tweens.add({
          targets: explosion,
          alpha: 0,
          scale: 2,
          duration: 300,
          onComplete: () => explosion.destroy(),
        });
      } else if (h.type === "toxic_gas" && dist < h.radius) {
        // Slow poison
        addRadiation(this.survival, 3 * (this.game.loop.delta / 1000));
        this.takeDamage(0.5 * (this.game.loop.delta / 1000));
      }
    }
  }

  private spawnRadZones() {
    for (let i = 0; i < 4; i++) {
      const rx = Phaser.Math.Between(300, MAP_W - 300);
      const ry = Phaser.Math.Between(300, MAP_H - 300);
      const rr = Phaser.Math.Between(60, 120);
      this.radZones.push({ x: rx, y: ry, radius: rr });

      // Visual
      const zone = this.add.circle(rx, ry, rr, 0x76ff03, 0.08);
      zone.setStrokeStyle(1, 0x76ff03, 0.3);
      this.add
        .text(rx, ry - rr - 6, "RADIATION", {
          fontFamily: "monospace",
          fontSize: "7px",
          color: "#76ff03",
        })
        .setOrigin(0.5)
        .setAlpha(0.6);

      this.tweens.add({
        targets: zone,
        alpha: { from: 0.05, to: 0.15 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private checkRadZones(deltaSec: number) {
    for (const rz of this.radZones) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        rz.x,
        rz.y
      );
      if (dist < rz.radius) {
        addRadiation(this.survival, 8 * deltaSec);
      }
    }
  }
}

function mapLootId(lootId: string): string | null {
  const map: Record<string, string> = {
    ammo: "ammo_pistol",
    bandage: "bandage",
    medkit: "medkit",
    meat: "canned_food",
    mutant_part: "scrap_metal",
    weapon_part: "scrap_metal",
  };
  return map[lootId] || null;
}
