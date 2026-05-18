import Phaser from "phaser";
import {
  PLAYER_SPEED, PLAYER_MAX_HP, PLAYER_RADIUS,
  WEAPONS, WeaponType, BULLET_LIFETIME, BULLET_RADIUS,
  MAP_W, MAP_H, COLORS, EXTRACTION_TIME, EXTRACTION_RADIUS,
  EnemyType, HUD_DEPTH,
} from "./constants";
import { VirtualJoystick } from "./VirtualJoystick";
import { HUD } from "./HUD";
import { generateMap, MapData } from "./MapGenerator";
import { EnemySprite, spawnEnemy, updateEnemy, damageEnemy } from "./Enemy";
import { PlayerStash, createDefaultStash } from "./BaseScene";
import { GridInventory, InventoryUI, InvItem, ITEM_DEFS } from "./Inventory";
import { SurvivalStats, createSurvivalStats, updateSurvival, applyItem, onDamageTaken } from "./Survival";
import { FogOfWar } from "./FogOfWar";
import { Minimap } from "./Minimap";
import { AudioManager } from "./Audio";
import { generateTextures } from "./Textures";
import { NetworkManager, NetMessage } from "./Network";

const SYNC_RATE = 50;

export class MultiRaidScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerHP = PLAYER_MAX_HP;
  private playerAlive = true;
  private armorValue = 0;

  private partner!: Phaser.GameObjects.Sprite;
  private partnerAlive = true;
  private partnerTarget = { x: 0, y: 0 };

  private currentWeapon: WeaponType = "pistol";
  private ammo: number = WEAPONS.pistol.magSize;
  private isReloading = false;

  private bullets!: Phaser.GameObjects.Group;
  private enemyBullets!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private lastShotTime = 0;
  private kills = 0;

  private mapData!: MapData;

  private extractionProgress = 0;
  private isExtracting = false;
  private extracted = false;

  private moveStick!: VirtualJoystick;
  private aimStick!: VirtualJoystick;
  private hud!: HUD;
  private aimIndicator!: Phaser.GameObjects.Line;
  private partnerIndicator!: Phaser.GameObjects.Arc;

  private inventory!: GridInventory;
  private inventoryUI!: InventoryUI;

  private survival!: SurvivalStats;
  private fog!: FogOfWar;
  private minimap!: Minimap;
  private audio!: AudioManager;

  private stash: PlayerStash = createDefaultStash();
  private net!: NetworkManager;
  private isHost = false;
  private lastSyncTime = 0;
  private mapSeed = 0;
  private gameReady = false;
  private enemyIdCounter = 0;

  constructor() {
    super("MultiRaidScene");
  }

  init(data?: { stash?: PlayerStash; net?: NetworkManager; isHost?: boolean }) {
    if (data?.stash) this.stash = data.stash;
    if (data?.net) this.net = data.net;
    this.isHost = data?.isHost ?? false;
    this.playerHP = PLAYER_MAX_HP;
    this.playerAlive = true;
    this.kills = 0;
    this.currentWeapon = "pistol";
    this.ammo = WEAPONS.pistol.magSize;
    this.isReloading = false;
    this.extractionProgress = 0;
    this.isExtracting = false;
    this.extracted = false;
    this.partnerAlive = true;
    this.gameReady = false;
    this.enemyIdCounter = 0;
  }

  create() {
    generateTextures(this);

    this.net.setOnMessage((msg: NetMessage) => this.handleNetMessage(msg));
    this.net.setOnDisconnected(() => this.onPartnerDisconnect());

    if (this.isHost) {
      this.mapSeed = Date.now();
      this.net.send({ type: "map_seed", data: this.mapSeed });
      this.setupGame();
    } else {
      this.add.text(this.scale.width / 2, this.scale.height / 2, "Syncing...", {
        fontFamily: "monospace", fontSize: "14px", color: "#8ab060",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 99);
    }
  }

  private setupGame() {
    this.mapData = generateMap(this);
    this.gameReady = true;

    this.cameras.main.setBackgroundColor(COLORS.ground);

    this.bullets = this.physics.add.group({ maxSize: 50 });
    this.enemyBullets = this.physics.add.group({ maxSize: 30 });
    this.enemies = this.physics.add.group({ maxSize: 40 });

    const spawnX = this.mapData.spawnPoint.x;
    const spawnY = this.mapData.spawnPoint.y;
    this.player = this.add.sprite(spawnX, spawnY, "player_alive");
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCircle(PLAYER_RADIUS);
    this.playerBody.setCollideWorldBounds(true);

    this.partner = this.add.sprite(spawnX + 30, spawnY, "player_alive").setTint(0x6090c0);
    this.physics.add.existing(this.partner);
    (this.partner.body as Phaser.Physics.Arcade.Body).setCircle(PLAYER_RADIUS);
    this.partnerTarget = { x: spawnX + 30, y: spawnY };

    this.partnerIndicator = this.add.circle(0, 0, 5, 0x6090c0)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 3).setVisible(false);

    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);

    const w = this.scale.width;
    const h = this.scale.height;
    this.moveStick = new VirtualJoystick(this, w * 0.15, h * 0.7, "left");
    this.aimStick = new VirtualJoystick(this, w * 0.85, h * 0.7, "right");

    this.hud = new HUD(this);
    this.aimIndicator = this.add.line(0, 0, 0, 0, 40, 0, 0x90a070, 0.5).setDepth(50).setLineWidth(1);
    this.survival = createSurvivalStats();

    this.inventory = new GridInventory(8, 5);
    this.inventory.autoAdd("pistol", 1);
    this.inventory.autoAdd("bandage", 2);
    this.inventory.autoAdd("ammo_pistol", 24);
    this.inventoryUI = new InventoryUI(this, this.inventory);
    this.inventoryUI.onEquip((slot, item) => this.onEquipChange(slot, item));

    this.add.text(w - 10, h - 50, "BAG", {
      fontFamily: "monospace", fontSize: "12px", color: "#a0b080",
      backgroundColor: "#1a2418", padding: { x: 8, y: 6 },
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(HUD_DEPTH + 5).setInteractive()
      .on("pointerdown", () => this.inventoryUI.toggle());

    const extractionPoints = this.mapData.extractions.map(e => ({
      x: e.point.x, y: e.point.y
    }));
    this.fog = new FogOfWar(this);
    this.minimap = new Minimap(this, extractionPoints);
    this.audio = new AudioManager();

    // Wall collisions
    this.physics.add.collider(this.player, this.mapData.walls);
    this.physics.add.collider(this.partner, this.mapData.walls);

    // Spawn enemies (host only)
    if (this.isHost) {
      this.spawnInitialEnemies();
    }

    // CO-OP label
    this.add.text(w / 2, 50, "CO-OP RAID", {
      fontFamily: "monospace", fontSize: "12px", color: "#6090c0", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);

    this.net.send({ type: "game_ready", data: null });
  }

  update(time: number, delta: number) {
    if (!this.gameReady || !this.player || !this.playerAlive) return;
    if (this.inventoryUI.getIsOpen()) return;
    if (this.extracted) return;

    const speed = PLAYER_SPEED;
    this.playerBody.setVelocity(
      this.moveStick.vector.x * speed,
      this.moveStick.vector.y * speed
    );

    if (this.aimStick.active && this.aimStick.vector.lengthSq() > 0) {
      const angle = Math.atan2(this.aimStick.vector.y, this.aimStick.vector.x);
      this.aimIndicator.setTo(
        this.player.x, this.player.y,
        this.player.x + Math.cos(angle) * 50,
        this.player.y + Math.sin(angle) * 50
      ).setVisible(true);
      this.tryShoot(angle, time);
    } else {
      this.aimIndicator.setVisible(false);
    }

    // Smooth partner interpolation
    this.partner.x += (this.partnerTarget.x - this.partner.x) * 0.15;
    this.partner.y += (this.partnerTarget.y - this.partner.y) * 0.15;
    this.updatePartnerIndicator();

    // Enemies (host)
    if (this.isHost) {
      this.updateEnemies(time, delta);
    }

    this.checkBulletCollisions();
    this.checkExtraction(delta);

    updateSurvival(this.survival, delta, false, false);
    this.hud.updateSurvival(this.survival);
    this.fog.update(this.player.x, this.player.y);
    this.minimap.update(this.player.x, this.player.y, this.enemies);
    this.hud.updateHP(this.playerHP);
    this.hud.updateAmmo(this.ammo, WEAPONS[this.currentWeapon].magSize);

    // Network sync
    if (time - this.lastSyncTime > SYNC_RATE) {
      this.lastSyncTime = time;
      this.net.send({
        type: "pos",
        data: { x: this.player.x, y: this.player.y, hp: this.playerHP, alive: this.playerAlive },
      });
    }
  }

  // ── Network ──

  private handleNetMessage(msg: NetMessage) {
    switch (msg.type) {
      case "map_seed":
        if (!this.isHost) {
          this.mapSeed = msg.data as number;
          this.setupGame();
        }
        break;
      case "pos": {
        const pos = msg.data as { x: number; y: number; hp: number; alive: boolean };
        this.partnerTarget.x = pos.x;
        this.partnerTarget.y = pos.y;
        this.partnerAlive = pos.alive;
        if (!pos.alive && this.partner?.active) this.partner.setTexture("player_dead");
        break;
      }
      case "shoot": {
        const shot = msg.data as { x: number; y: number; angle: number };
        this.spawnBulletAt(shot.x, shot.y, shot.angle);
        break;
      }
      case "enemy_sync": {
        if (!this.isHost) {
          this.syncEnemiesFromHost(msg.data as { id: number; x: number; y: number; active: boolean }[]);
        }
        break;
      }
      case "enemy_killed": {
        const kd = msg.data as { id: number };
        for (const e of this.enemies.getChildren()) {
          if ((e as EnemySprite).getData("netId") === kd.id) {
            e.setActive(false);
            (e as Phaser.GameObjects.Sprite).setVisible(false);
            break;
          }
        }
        break;
      }
      case "spawn_enemy": {
        if (!this.isHost) {
          const s = msg.data as { x: number; y: number; type: EnemyType; id: number };
          const enemy = spawnEnemy(this, s.x, s.y, s.type, this.enemies, this.mapData.walls);
          if (enemy) enemy.setData("netId", s.id);
        }
        break;
      }
      case "extracted":
        this.hud.showInteractHint("Partner extracted!");
        this.time.delayedCall(2000, () => this.hud.hideInteractHint());
        break;
      case "game_ready":
        break;
    }
  }

  private onPartnerDisconnect() {
    this.hud.showStatus("PARTNER\nDISCONNECTED", "#c04040");
    this.time.delayedCall(3000, () => {
      this.net.destroy();
      this.scene.start("BaseScene", { stash: this.stash });
    });
  }

  // ── Shooting ──

  private tryShoot(angle: number, time: number) {
    const weapon = WEAPONS[this.currentWeapon];
    if (time - this.lastShotTime < weapon.fireRate) return;
    if (this.isReloading) return;
    if (this.ammo <= 0) { this.reload(); return; }

    this.lastShotTime = time;
    this.ammo--;
    this.hud.updateAmmo(this.ammo, weapon.magSize);

    const pellets = (weapon as unknown as { pellets?: number }).pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = angle + (Math.random() - 0.5) * weapon.spread * 2;
      this.spawnBulletAt(this.player.x, this.player.y, spread);
    }

    this.net.send({ type: "shoot", data: { x: this.player.x, y: this.player.y, angle } });
    this.audio.playShoot();
  }

  private spawnBulletAt(x: number, y: number, angle: number) {
    const weapon = WEAPONS[this.currentWeapon];
    const bullet = this.bullets.create(x, y, "bullet_player") as Phaser.GameObjects.Sprite;
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setCircle(BULLET_RADIUS);
    body.setVelocity(Math.cos(angle) * weapon.bulletSpeed, Math.sin(angle) * weapon.bulletSpeed);
    bullet.setData("damage", weapon.damage);

    this.time.delayedCall(BULLET_LIFETIME, () => {
      if (bullet.active) { bullet.setActive(false).setVisible(false); bullet.destroy(); }
    });
  }

  private reload() {
    if (this.isReloading) return;
    this.isReloading = true;
    this.hud.showReloading(true);
    this.time.delayedCall(WEAPONS[this.currentWeapon].reloadTime, () => {
      this.ammo = WEAPONS[this.currentWeapon].magSize;
      this.isReloading = false;
      this.hud.showReloading(false);
      this.hud.updateAmmo(this.ammo, WEAPONS[this.currentWeapon].magSize);
    });
  }

  // ── Enemies ──

  private spawnInitialEnemies() {
    const types: EnemyType[] = ["bandit", "bandit", "bandit", "mutant", "heavy"];
    for (let i = 0; i < 15; i++) {
      const type = types[i % types.length];
      const x = Phaser.Math.Between(200, MAP_W - 200);
      const y = Phaser.Math.Between(200, MAP_H - 200);
      const id = this.enemyIdCounter++;
      const enemy = spawnEnemy(this, x, y, type, this.enemies, this.mapData.walls);
      if (enemy) enemy.setData("netId", id);
      this.net.send({ type: "spawn_enemy", data: { x, y, type, id } });
    }

    this.time.addEvent({
      delay: 8000, loop: true,
      callback: () => {
        if (this.enemies.countActive() < 20) {
          const type = (["bandit", "mutant", "heavy"] as EnemyType[])[Phaser.Math.Between(0, 2)];
          const x = Phaser.Math.Between(200, MAP_W - 200);
          const y = Phaser.Math.Between(200, MAP_H - 200);
          const id = this.enemyIdCounter++;
          const enemy = spawnEnemy(this, x, y, type, this.enemies, this.mapData.walls);
          if (enemy) enemy.setData("netId", id);
          this.net.send({ type: "spawn_enemy", data: { x, y, type, id } });
        }
      },
    });
  }

  private updateEnemies(time: number, delta: number) {
    for (const e of this.enemies.getChildren()) {
      if (!e.active) continue;
      const enemy = e as EnemySprite;
      const d1 = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const d2 = this.partnerAlive ?
        Phaser.Math.Distance.Between(enemy.x, enemy.y, this.partner.x, this.partner.y) : Infinity;

      const tx = d1 < d2 ? this.player.x : this.partner.x;
      const ty = d1 < d2 ? this.player.y : this.partner.y;
      updateEnemy(this, enemy, tx, ty, true, this.enemyBullets, this.mapData.walls);
    }

    if (time % 200 < delta) {
      const syncData: { id: number; x: number; y: number; active: boolean }[] = [];
      for (const e of this.enemies.getChildren()) {
        const enemy = e as EnemySprite;
        syncData.push({ id: enemy.getData("netId"), x: enemy.x, y: enemy.y, active: enemy.active });
      }
      this.net.send({ type: "enemy_sync", data: syncData });
    }
  }

  private syncEnemiesFromHost(data: { id: number; x: number; y: number; active: boolean }[]) {
    for (const ed of data) {
      for (const e of this.enemies.getChildren()) {
        const enemy = e as EnemySprite;
        if (enemy.getData("netId") === ed.id) {
          if (!ed.active) { enemy.setActive(false).setVisible(false); }
          else { enemy.x = Phaser.Math.Linear(enemy.x, ed.x, 0.3); enemy.y = Phaser.Math.Linear(enemy.y, ed.y, 0.3); }
          break;
        }
      }
    }
  }

  // ── Collisions ──

  private checkBulletCollisions() {
    this.physics.overlap(this.bullets, this.enemies, (bulletObj, enemyObj) => {
      const bullet = bulletObj as Phaser.GameObjects.Sprite;
      const enemy = enemyObj as EnemySprite;
      if (!bullet.active || !enemy.active) return;

      const dmg = bullet.getData("damage") || 10;
      const killed = damageEnemy(this, enemy, dmg);
      bullet.setActive(false).setVisible(false); bullet.destroy();

      if (killed) {
        this.kills++;
        this.hud.updateKills(this.kills);
        this.audio.playHit();
        if (this.isHost) {
          this.net.send({ type: "enemy_killed", data: { id: enemy.getData("netId") } });
        }
      }
    });

    this.physics.overlap(this.enemyBullets, this.player, (_p, bulletObj) => {
      const bullet = bulletObj as Phaser.GameObjects.Sprite;
      if (!bullet.active) return;
      this.takeDamage(bullet.getData("damage") || 10);
      bullet.setActive(false).setVisible(false); bullet.destroy();
    });
  }

  private takeDamage(amount: number) {
    const reduced = Math.max(1, amount - this.armorValue);
    this.playerHP -= reduced;
    onDamageTaken(this.survival, reduced);
    this.hud.updateHP(this.playerHP);

    if (this.playerHP <= 0) {
      this.playerAlive = false;
      this.player.setTexture("player_dead");
      this.playerBody.setVelocity(0, 0);
      this.stash.totalDeaths++;
      this.hud.showStatus("YOU DIED\nTap to return", "#ff4040");

      this.time.delayedCall(2000, () => {
        this.input.once("pointerdown", () => {
          this.net.destroy();
          this.scene.start("BaseScene", { stash: this.stash, message: "YOU DIED" });
        });
      });
    }
  }

  // ── Extraction ──

  private checkExtraction(delta: number) {
    let nearExtraction = false;
    for (const ext of this.mapData.extractions) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, ext.point.x, ext.point.y);
      if (dist < EXTRACTION_RADIUS) { nearExtraction = true; break; }
    }

    if (nearExtraction && this.moveStick.vector.lengthSq() < 0.01) {
      this.isExtracting = true;
      this.extractionProgress += delta;
      this.hud.showExtracting(true, this.extractionProgress / EXTRACTION_TIME, EXTRACTION_TIME);
      if (this.extractionProgress >= EXTRACTION_TIME) this.onExtracted();
    } else if (this.isExtracting) {
      this.isExtracting = false;
      this.extractionProgress = 0;
      this.hud.showExtracting(false);
    }
  }

  private onExtracted() {
    this.extracted = true;
    this.playerBody.setVelocity(0, 0);
    this.net.send({ type: "extracted", data: null });

    this.stash.kills += this.kills;
    this.stash.totalExtracts++;
    const earnedMoney = 50 + this.kills * 20;
    this.stash.money += earnedMoney;
    this.stash.xp += 30 + this.kills * 10;

    this.hud.showStatus(`EXTRACTED!\nKills: ${this.kills}\n+$${earnedMoney}`, "#40d0a0");

    this.time.delayedCall(3000, () => {
      this.net.destroy();
      this.scene.start("BaseScene", {
        stash: this.stash,
        message: `Co-op: ${this.kills} kills, +$${earnedMoney}`,
      });
    });
  }

  // ── Partner indicator ──

  private updatePartnerIndicator() {
    if (!this.partnerAlive) { this.partnerIndicator.setVisible(false); return; }
    const cam = this.cameras.main;
    const sx = this.partner.x - cam.scrollX;
    const sy = this.partner.y - cam.scrollY;

    if (sx < 0 || sx > cam.width || sy < 0 || sy > cam.height) {
      const angle = Math.atan2(sy - cam.height / 2, sx - cam.width / 2);
      const ex = Math.max(20, Math.min(cam.width - 20, cam.width / 2 + Math.cos(angle) * (cam.width / 2 - 20)));
      const ey = Math.max(20, Math.min(cam.height - 20, cam.height / 2 + Math.sin(angle) * (cam.height / 2 - 20)));
      this.partnerIndicator.setPosition(ex, ey).setVisible(true);
    } else {
      this.partnerIndicator.setVisible(false);
    }
  }

  // ── Equipment ──

  private onEquipChange(slot: string, item: InvItem | null) {
    if (slot === "use_medical" && item) {
      const def = ITEM_DEFS[item.defId];
      if (def.healAmount) {
        this.playerHP = Math.min(PLAYER_MAX_HP, this.playerHP + def.healAmount);
        this.hud.updateHP(this.playerHP);
        applyItem(this.survival, item.defId);
      }
    } else if ((slot === "weapon1" || slot === "weapon2") && item) {
      const def = ITEM_DEFS[item.defId];
      if (def.weaponType) {
        this.currentWeapon = def.weaponType;
        this.ammo = WEAPONS[def.weaponType].magSize;
        this.hud.updateWeapon(def.weaponType);
        this.hud.updateAmmo(this.ammo, WEAPONS[def.weaponType].magSize);
      }
    } else if (slot === "armor" && item) {
      this.armorValue = ITEM_DEFS[item.defId].armorValue || 0;
    }
  }
}
