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
import { PlayerStash } from "./BaseScene";

export class RaidScene extends Phaser.Scene {
  // Player
  private player!: Phaser.GameObjects.Arc;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerHP = PLAYER_MAX_HP;
  private playerAlive = true;
  private invincibleUntil = 0;

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

  // Loot containers
  private lootContainers!: Phaser.GameObjects.Group;

  // Weapon pickup visual
  private weaponPickups!: Phaser.GameObjects.Group;

  // Stash from base
  private stash: PlayerStash = { kills: 0, totalExtracts: 0, totalDeaths: 0 };

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
  }

  create() {
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // Generate map
    this.mapData = generateMap(this);

    // Groups
    this.bullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.enemies = this.add.group();
    this.lootContainers = this.add.group();
    this.weaponPickups = this.add.group();

    // Player
    this.player = this.add.circle(
      this.mapData.spawnPoint.x,
      this.mapData.spawnPoint.y,
      PLAYER_RADIUS,
      COLORS.playerAlive
    );
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCircle(PLAYER_RADIUS);
    this.playerBody.setCollideWorldBounds(true);

    // Aim indicator
    this.aimIndicator = this.add
      .line(0, 0, 0, 0, 30, 0, COLORS.playerAlive, 0.5)
      .setOrigin(0, 0.5)
      .setDepth(10);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor("#1a1a2e");

    // Collisions
    this.physics.add.collider(this.player, this.mapData.walls);

    // Spawn enemies
    this.spawnEnemies();

    // Spawn loot containers
    this.spawnLoot();

    // Spawn weapon pickups
    this.spawnWeaponPickups();

    // Enemy bullets hit player
    this.physics.add.overlap(
      this.player,
      this.enemyBullets,
      (_player, bullet) => {
        this.onPlayerHit(bullet as Phaser.GameObjects.Arc);
      }
    );

    // Melee enemies hit player
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      const data = (enemy as EnemySprite).getData("enemyData");
      if (!data || data.state === "dead") return;
      const cfg = ENEMY_TYPES[data.type as EnemyType];
      if (cfg.fireRate === 0) {
        // Melee attack
        this.takeDamage(cfg.damage * 0.02); // per-frame damage, balanced
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

    // Resize handler
    this.scale.on("resize", this.onResize, this);
  }

  private spawnEnemies() {
    const types: EnemyType[] = ["bandit", "bandit", "bandit", "mutant", "mutant", "heavy"];
    for (const pt of this.mapData.enemySpawnPoints) {
      const type = types[Phaser.Math.Between(0, types.length - 1)];
      spawnEnemy(this, pt.x, pt.y, type, this.enemies, this.mapData.walls);
    }

    // Enemy-enemy collisions
    this.physics.add.collider(this.enemies, this.enemies);
  }

  private spawnLoot() {
    for (const pt of this.mapData.lootPoints) {
      const box = this.add.rectangle(pt.x, pt.y, 16, 16, COLORS.lootContainer);
      box.setStrokeStyle(1, 0xffab00);
      this.physics.add.existing(box, true);
      box.setData("lootType", Math.random() > 0.5 ? "ammo" : "health");
      this.lootContainers.add(box);
    }
  }

  private spawnWeaponPickups() {
    const weaponTypes: WeaponType[] = ["smg", "shotgun", "rifle"];
    // Place weapons around map
    for (let i = 0; i < 5; i++) {
      const type = weaponTypes[Phaser.Math.Between(0, weaponTypes.length - 1)];
      const x = Phaser.Math.Between(200, MAP_W - 200);
      const y = Phaser.Math.Between(200, MAP_H - 200);
      const pickup = this.add.circle(x, y, 8, WEAPONS[type].color, 0.8);
      pickup.setStrokeStyle(2, 0xffffff, 0.5);
      this.physics.add.existing(pickup, true);
      pickup.setData("weaponType", type);
      this.weaponPickups.add(pickup);

      // Label
      this.add
        .text(x, y - 14, WEAPONS[type].name, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#cccccc",
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
  }

  update(_time: number, delta: number) {
    if (this.extracted) return;

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
      this.aimIndicator.setVisible(true);
      this.aimIndicator.setPosition(this.player.x, this.player.y);
      this.aimIndicator.setRotation(angle);
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

    // Auto reload when empty and not shooting
    if (this.ammo <= 0 && !this.isReloading) {
      this.reload();
    }

    // Update bullets lifetime
    for (const b of this.bullets.getChildren()) {
      const bullet = b as Phaser.GameObjects.Arc;
      const meta = bullet.getData("meta") as { born: number };
      if (this.time.now - meta.born > BULLET_LIFETIME) bullet.destroy();
    }
    for (const b of this.enemyBullets.getChildren()) {
      const bullet = b as Phaser.GameObjects.Arc;
      const meta = bullet.getData("meta") as { born: number };
      if (this.time.now - meta.born > BULLET_LIFETIME) bullet.destroy();
    }

    // Update enemies
    for (const e of this.enemies.getChildren()) {
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

    // Check loot pickup proximity
    this.checkLootPickup();

    // Check weapon pickup proximity
    this.checkWeaponPickup();

    // Extraction check
    this.checkExtraction(delta);

    // Update HUD
    this.hud.updateHP(this.playerHP);
    this.hud.updateKills(this.kills);
  }

  private shoot(dirX: number, dirY: number) {
    const weapon = WEAPONS[this.currentWeapon];
    const pellets = "pellets" in weapon ? weapon.pellets : 1;

    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * weapon.spread * 2;
      const angle = Math.atan2(dirY, dirX) + spread;
      const bx = this.player.x + Math.cos(angle) * 20;
      const by = this.player.y + Math.sin(angle) * 20;

      const bullet = this.add.circle(bx, by, BULLET_RADIUS, weapon.color);
      this.physics.add.existing(bullet);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setCircle(BULLET_RADIUS);
      body.setVelocity(
        Math.cos(angle) * weapon.bulletSpeed,
        Math.sin(angle) * weapon.bulletSpeed
      );

      bullet.setData("meta", { born: this.time.now, damage: weapon.damage });
      this.bullets.add(bullet);

      // Bullet-wall collision
      this.physics.add.collider(bullet, this.mapData.walls, () =>
        bullet.destroy()
      );

      // Bullet-enemy collision
      this.physics.add.overlap(bullet, this.enemies, (b, enemy) => {
        const meta = (b as Phaser.GameObjects.Arc).getData("meta") as {
          damage: number;
        };
        const killed = damageEnemy(this, enemy as EnemySprite, meta.damage);
        if (killed) this.kills++;
        (b as Phaser.GameObjects.Arc).destroy();
      });
    }

    this.ammo--;
    this.hud.updateAmmo(this.ammo, weapon.magSize);

    // Screen shake on shotgun
    if (this.currentWeapon === "shotgun") {
      this.cameras.main.shake(80, 0.003);
    }
  }

  private reload() {
    if (this.isReloading) return;
    const weapon = WEAPONS[this.currentWeapon];
    if (this.ammo >= weapon.magSize) return;

    this.isReloading = true;
    this.hud.showReloading(true);

    this.time.delayedCall(weapon.reloadTime, () => {
      this.ammo = weapon.magSize;
      this.isReloading = false;
      this.hud.showReloading(false);
      this.hud.updateAmmo(this.ammo, weapon.magSize);
    });
  }

  private onPlayerHit(bullet: Phaser.GameObjects.Arc) {
    if (!this.playerAlive) return;
    const meta = bullet.getData("meta") as { damage: number };
    bullet.destroy();
    this.takeDamage(meta.damage);
  }

  private takeDamage(amount: number) {
    if (this.time.now < this.invincibleUntil) return;

    this.playerHP -= amount;
    this.hud.updateHP(this.playerHP);

    // Flash
    this.player.setFillStyle(COLORS.playerHurt);
    this.time.delayedCall(100, () => {
      if (this.playerAlive) this.player.setFillStyle(COLORS.playerAlive);
    });

    // Screen flash
    this.cameras.main.flash(100, 255, 0, 0, false, undefined, this);

    if (this.playerHP <= 0) {
      this.die();
    }

    this.invincibleUntil = this.time.now + 100;
  }

  private die() {
    this.playerAlive = false;
    this.player.setFillStyle(0x555555);
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

  private checkLootPickup() {
    let nearLoot = false;
    for (const obj of this.lootContainers.getChildren()) {
      const box = obj as Phaser.GameObjects.Rectangle;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        box.x,
        box.y
      );
      if (dist < 30) {
        nearLoot = true;
        this.hud.showInteractHint("Walk over to pick up");

        if (dist < 18) {
          const lootType = box.getData("lootType") as string;
          if (lootType === "health") {
            this.playerHP = Math.min(PLAYER_MAX_HP, this.playerHP + 25);
            this.hud.updateHP(this.playerHP);
          } else {
            this.ammo = Math.min(
              WEAPONS[this.currentWeapon].magSize,
              this.ammo + Math.ceil(WEAPONS[this.currentWeapon].magSize / 2)
            );
            this.hud.updateAmmo(this.ammo, WEAPONS[this.currentWeapon].magSize);
          }
          box.destroy();
        }
      }
    }
    if (!nearLoot) this.hud.hideInteractHint();
  }

  private checkWeaponPickup() {
    for (const obj of this.weaponPickups.getChildren()) {
      const pickup = obj as Phaser.GameObjects.Arc;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        pickup.x,
        pickup.y
      );
      if (dist < 20) {
        const newWeapon = pickup.getData("weaponType") as WeaponType;
        this.currentWeapon = newWeapon;
        this.ammo = WEAPONS[newWeapon].magSize;
        this.isReloading = false;
        this.hud.showReloading(false);
        this.hud.updateWeapon(newWeapon);
        this.hud.updateAmmo(this.ammo, WEAPONS[newWeapon].magSize);
        pickup.destroy();
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

    this.stash.kills += this.kills;
    this.stash.totalExtracts++;

    this.hud.showStatus("EXTRACTED!\n\nLoot secured.", "#00e5ff");

    this.cameras.main.fadeOut(2000, 0, 0, 0);
    this.time.delayedCall(3000, () => {
      this.scene.start("BaseScene", {
        stash: this.stash,
        message: `EXTRACTED - ${this.kills} kills this raid.`,
      });
    });
  }
}
