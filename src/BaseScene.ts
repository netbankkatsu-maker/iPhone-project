import Phaser from "phaser";
import { HUD_DEPTH } from "./constants";
import { Quest, createStartingQuests, updateQuestProgress } from "./Quest";
import { VirtualJoystick } from "./VirtualJoystick";

export interface PlayerStash {
  kills: number;
  totalExtracts: number;
  totalDeaths: number;
  money: number;
  xp: number;
  level: number;
  quests: Quest[];
  upgrades: { hp: number; stamina: number; stash: number };
}

export function createDefaultStash(): PlayerStash {
  return {
    kills: 0,
    totalExtracts: 0,
    totalDeaths: 0,
    money: 100,
    xp: 0,
    level: 1,
    quests: createStartingQuests(),
    upgrades: { hp: 0, stamina: 0, stash: 0 },
  };
}

const VILLAGE_W = 800;
const VILLAGE_H = 600;
const NPC_INTERACT_DIST = 60;

interface VillageNPC {
  sprite: Phaser.GameObjects.Sprite;
  type: "trader" | "gunsmith" | "upgrade";
  name: string;
  labelText: Phaser.GameObjects.Text;
}

export class BaseScene extends Phaser.Scene {
  public stash: PlayerStash = createDefaultStash();
  private message = "";

  private player!: Phaser.Physics.Arcade.Sprite;
  private moveStick!: VirtualJoystick;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private npcs: VillageNPC[] = [];

  private interactBtn!: Phaser.GameObjects.Container;
  private interactTarget: VillageNPC | null = null;

  private panelOpen = false;
  private panelObjects: Phaser.GameObjects.GameObject[] = [];
  private panelHitZones: { x: number; y: number; w: number; h: number; action: () => void }[] = [];
  private panelPointerHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  private hudMoney!: Phaser.GameObjects.Text;
  private hudLevel!: Phaser.GameObjects.Text;
  private msgBanner!: Phaser.GameObjects.Container;

  constructor() {
    super("BaseScene");
  }

  init(data?: { message?: string; stash?: PlayerStash }) {
    if (data?.stash) {
      this.stash = data.stash;
      if (!this.stash.upgrades) this.stash.upgrades = { hp: 0, stamina: 0, stash: 0 };
    }
    this.message = data?.message || "";
  }

  create() {
    this.panelOpen = false;
    this.panelObjects = [];
    this.panelHitZones = [];
    this.npcs = [];

    const sw = this.scale.width;
    const sh = this.scale.height;

    this.physics.world.setBounds(0, 0, VILLAGE_W, VILLAGE_H);

    // ── Ground ──
    this.add.rectangle(VILLAGE_W / 2, VILLAGE_H / 2, VILLAGE_W, VILLAGE_H, 0x1a2010);
    // Dirt paths
    this.add.rectangle(VILLAGE_W / 2, VILLAGE_H / 2, 60, VILLAGE_H, 0x1e2414, 0.6);
    this.add.rectangle(VILLAGE_W / 2, VILLAGE_H / 2, VILLAGE_W, 50, 0x1e2414, 0.6);
    // Grass patches
    for (let i = 0; i < 30; i++) {
      this.add.sprite(
        Phaser.Math.Between(20, VILLAGE_W - 20),
        Phaser.Math.Between(20, VILLAGE_H - 20),
        "grass_patch"
      ).setAlpha(0.4);
    }

    // ── Buildings (collision walls) ──
    this.walls = this.physics.add.staticGroup();
    this.createBuilding(80, 50, 160, 110, "TRADER", 0x3a3830);
    this.createBuilding(560, 50, 160, 110, "GUNSMITH", 0x383838);
    this.createBuilding(80, 400, 160, 110, "UPGRADES", 0x38362a);
    this.createBuilding(560, 420, 160, 100, "GATE", 0x2a3828);

    // Campfire (center)
    const fire = this.add.circle(VILLAGE_W / 2, VILLAGE_H / 2, 8, 0xc06020, 0.8);
    this.tweens.add({ targets: fire, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.add.circle(VILLAGE_W / 2, VILLAGE_H / 2, 12, 0x402010, 0.3);

    // ── NPCs ──
    this.createNPC(160, 180, "trader", "npc_trader", "Trader");
    this.createNPC(640, 180, "gunsmith", "npc_gunsmith", "Gunsmith");
    this.createNPC(160, 380, "upgrade", "npc_upgrade", "Mechanic");

    // ── Deploy zone (near gate building) ──
    const deployZone = this.add.circle(640, 540, 30, 0x308880, 0.25);
    this.tweens.add({ targets: deployZone, alpha: 0.1, duration: 1200, yoyo: true, repeat: -1 });
    this.add.text(640, 560, "DEPLOY", {
      fontFamily: "monospace", fontSize: "8px", color: "#308880",
    }).setOrigin(0.5);

    // ── Player ──
    this.player = this.physics.add.sprite(VILLAGE_W / 2, VILLAGE_H / 2 + 40, "player_alive");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, this.walls);

    // ── Camera ──
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, VILLAGE_W, VILLAGE_H);
    this.cameras.main.setBackgroundColor(0x0a0e06);

    // ── Joystick (left half only) ──
    this.moveStick = new VirtualJoystick(this, sw * 0.15, sh * 0.72, "left");

    // ── HUD (screen-fixed) ──
    this.createHUD();

    // ── Interact button (hidden by default) ──
    this.createInteractButton();

    // ── Message banner ──
    if (this.message) {
      this.showMessageBanner(this.message);
    }
  }

  update() {
    if (this.panelOpen) {
      this.player.setVelocity(0, 0);
      this.interactBtn.setVisible(false);
      return;
    }

    // Movement
    const speed = 150;
    this.player.setVelocity(
      this.moveStick.vector.x * speed,
      this.moveStick.vector.y * speed
    );

    // NPC proximity check
    this.interactTarget = null;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        npc.sprite.x, npc.sprite.y
      );
      if (dist < NPC_INTERACT_DIST) {
        this.interactTarget = npc;
        break;
      }
    }

    // Deploy zone check
    const deployDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, 640, 540);
    if (deployDist < 40 && !this.interactTarget) {
      this.interactBtn.setVisible(true);
      (this.interactBtn.getAt(1) as Phaser.GameObjects.Text).setText("DEPLOY");
      return;
    }

    this.interactBtn.setVisible(!!this.interactTarget);
    if (this.interactTarget) {
      (this.interactBtn.getAt(1) as Phaser.GameObjects.Text).setText(`TALK`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Village construction helpers
  // ────────────────────────────────────────────────────────────

  private createBuilding(x: number, y: number, w: number, h: number, label: string, color: number) {
    // Visual
    const bld = this.add.rectangle(x + w / 2, y + h / 2, w, h, color, 0.9);
    bld.setStrokeStyle(2, 0x555548);

    // Label
    this.add.text(x + w / 2, y + 12, label, {
      fontFamily: "monospace", fontSize: "8px", color: "#6a7a5a",
    }).setOrigin(0.5);

    // Physics walls (4 sides with door gap on bottom)
    const t = 10;
    // Top
    this.addWall(x + w / 2, y + t / 2, w, t);
    // Left
    this.addWall(x + t / 2, y + h / 2, t, h);
    // Right
    this.addWall(x + w - t / 2, y + h / 2, t, h);
    // Bottom left
    this.addWall(x + w / 4 - 5, y + h - t / 2, w / 2 - 20, t);
    // Bottom right
    this.addWall(x + w * 3 / 4 + 5, y + h - t / 2, w / 2 - 20, t);
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const wall = this.add.rectangle(x, y, w, h, 0x000000, 0).setOrigin(0.5);
    this.physics.add.existing(wall, true);
    this.walls.add(wall);
  }

  private createNPC(x: number, y: number, type: "trader" | "gunsmith" | "upgrade", texture: string, name: string) {
    const sprite = this.add.sprite(x, y, texture).setDepth(9);
    sprite.setScale(2);

    const labelText = this.add.text(x, y - 20, name, {
      fontFamily: "monospace", fontSize: "8px", color: "#a0b080",
    }).setOrigin(0.5).setDepth(9);

    this.npcs.push({ sprite, type, name, labelText });
  }

  // ────────────────────────────────────────────────────────────
  // HUD
  // ────────────────────────────────────────────────────────────

  private createHUD() {
    const sw = this.scale.width;
    const d = HUD_DEPTH + 20;

    // Top bar bg
    this.add.rectangle(sw / 2, 16, sw, 32, 0x0a0e06, 0.85)
      .setScrollFactor(0).setDepth(d);
    this.add.rectangle(sw / 2, 32, sw, 1, 0x2a3a22, 0.5)
      .setScrollFactor(0).setDepth(d);

    this.add.text(sw / 2, 16, "HIDEOUT", {
      fontFamily: "monospace", fontSize: "14px", color: "#8ab060", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1);

    this.hudMoney = this.add.text(sw - 10, 16, `$ ${this.stash.money}`, {
      fontFamily: "monospace", fontSize: "12px", color: "#b0d060", fontStyle: "bold",
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(d + 1);

    this.hudLevel = this.add.text(10, 16, `Lv.${this.stash.level}`, {
      fontFamily: "monospace", fontSize: "11px", color: "#b0d060",
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);

    // Stats line
    const kills = this.stash.kills;
    const extracts = this.stash.totalExtracts;
    this.add.text(sw / 2, 42, `Kills: ${kills}  |  Extracts: ${extracts}`, {
      fontFamily: "monospace", fontSize: "8px", color: "#5a6a4a",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(d);
  }

  private createInteractButton() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const bx = sw * 0.82;
    const by = sh * 0.72;

    this.interactBtn = this.add.container(bx, by).setScrollFactor(0).setDepth(HUD_DEPTH + 30).setVisible(false);
    const bg = this.add.rectangle(0, 0, 80, 44, 0x5c8a3c, 0.9).setStrokeStyle(2, 0x8ab060);
    const txt = this.add.text(0, 0, "TALK", {
      fontFamily: "monospace", fontSize: "14px", color: "#0f1410", fontStyle: "bold",
    }).setOrigin(0.5);
    this.interactBtn.add([bg, txt]);

    // Input via screen-coord pointer
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.panelOpen) return;
      if (!this.interactBtn.visible) return;
      const dx = pointer.x - bx;
      const dy = pointer.y - by;
      if (Math.abs(dx) < 45 && Math.abs(dy) < 28) {
        this.onInteract();
      }
    });
  }

  private onInteract() {
    // Deploy zone
    const deployDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, 640, 540);
    if (deployDist < 40 && !this.interactTarget) {
      this.scene.start("RaidScene", { stash: this.stash });
      return;
    }

    if (!this.interactTarget) return;
    const type = this.interactTarget.type;
    if (type === "trader") this.openTraderPanel();
    else if (type === "gunsmith") this.openGunsmithPanel();
    else if (type === "upgrade") this.openUpgradePanel();
  }

  // ────────────────────────────────────────────────────────────
  // Panel system (modal overlays)
  // ────────────────────────────────────────────────────────────

  private openPanel(title: string, titleColor: string) {
    this.panelOpen = true;
    this.panelObjects = [];
    this.panelHitZones = [];
    if (this.panelPointerHandler) {
      this.input.off("pointerdown", this.panelPointerHandler);
    }

    const sw = this.scale.width;
    const sh = this.scale.height;

    // Backdrop
    this.pui(this.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0a0e06, 0.92));

    // Header
    this.pui(this.add.rectangle(sw / 2, 22, sw, 44, 0x1a2018, 0.98), HUD_DEPTH + 51);
    this.pui(this.add.text(14, 22, title, {
      fontFamily: "monospace", fontSize: "18px", color: titleColor, fontStyle: "bold",
    }).setOrigin(0, 0.5), HUD_DEPTH + 52);

    // Money
    this.pui(this.add.text(sw - 14, 22, `$ ${this.stash.money}`, {
      fontFamily: "monospace", fontSize: "13px", color: "#b0d060", fontStyle: "bold",
    }).setOrigin(1, 0.5), HUD_DEPTH + 52);

    // Close button
    const closeCx = sw - 36;
    this.pui(this.add.rectangle(closeCx, 22, 50, 32, 0x8b3030, 0.9).setStrokeStyle(1, 0xc04040), HUD_DEPTH + 52);
    this.pui(this.add.text(closeCx, 22, "X", {
      fontFamily: "monospace", fontSize: "16px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5), HUD_DEPTH + 53);
    this.addPanelHit(closeCx, 22, 50, 32, () => this.closePanel());

    // Set up pointer handler
    this.panelPointerHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.panelOpen) return;
      for (let i = this.panelHitZones.length - 1; i >= 0; i--) {
        const z = this.panelHitZones[i];
        if (pointer.x >= z.x - z.w / 2 && pointer.x <= z.x + z.w / 2 &&
            pointer.y >= z.y - z.h / 2 && pointer.y <= z.y + z.h / 2) {
          z.action();
          return;
        }
      }
    };
    this.input.on("pointerdown", this.panelPointerHandler);

    return 52;
  }

  private closePanel() {
    this.panelOpen = false;
    for (const obj of this.panelObjects) { if (obj?.active) obj.destroy(); }
    this.panelObjects = [];
    this.panelHitZones = [];
    if (this.panelPointerHandler) {
      this.input.off("pointerdown", this.panelPointerHandler);
      this.panelPointerHandler = null;
    }
    this.hudMoney.setText(`$ ${this.stash.money}`);
  }

  private pui<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => T; setDepth: (d: number) => T }>(obj: T, depth = HUD_DEPTH + 50): T {
    obj.setScrollFactor(0).setDepth(depth);
    this.panelObjects.push(obj);
    return obj;
  }

  private addPanelHit(cx: number, cy: number, w: number, h: number, action: () => void) {
    this.panelHitZones.push({ x: cx, y: cy, w, h, action });
  }

  // ── Trader Panel ──
  private openTraderPanel() {
    let y = this.openPanel("TRADER", "#d0a040");
    const sw = this.scale.width;
    const pad = 14;

    this.pui(this.add.text(pad, y + 4, "Buy supplies for your next raid", {
      fontFamily: "monospace", fontSize: "9px", color: "#6a7a5a",
    }), HUD_DEPTH + 51);
    y += 22;

    const items = [
      { name: "Bandage x3", cost: 30, icon: "item_bandage" },
      { name: "Medkit", cost: 80, icon: "item_medkit" },
      { name: "Painkiller x2", cost: 40, icon: "item_painkiller" },
      { name: "Water x2", cost: 20, icon: "item_water" },
      { name: "Canned Food x2", cost: 25, icon: "item_canned_food" },
      { name: "9mm Ammo x30", cost: 50, icon: "item_ammo_pistol" },
      { name: "7.62 Ammo x20", cost: 70, icon: "item_ammo_rifle" },
      { name: "12ga Shells x12", cost: 60, icon: "item_ammo_shotgun" },
    ];

    for (const item of items) {
      this.drawShopRow(pad, y, sw, item.name, item.cost, item.icon);
      y += 42;
    }
  }

  // ── Gunsmith Panel ──
  private openGunsmithPanel() {
    let y = this.openPanel("GUNSMITH", "#9090b0");
    const sw = this.scale.width;
    const pad = 14;

    this.pui(this.add.text(pad, y + 4, "Weapons & gear", {
      fontFamily: "monospace", fontSize: "9px", color: "#6a7a5a",
    }), HUD_DEPTH + 51);
    y += 22;

    const items = [
      { name: "Pistol", cost: 120, icon: "item_pistol" },
      { name: "SMG", cost: 350, icon: "item_smg" },
      { name: "Shotgun", cost: 280, icon: "item_shotgun" },
      { name: "Rifle", cost: 500, icon: "item_rifle" },
      { name: "Light Armor", cost: 200, icon: "item_armor_light" },
      { name: "Heavy Armor", cost: 450, icon: "item_armor_heavy" },
    ];

    for (const item of items) {
      this.drawShopRow(pad, y, sw, item.name, item.cost, item.icon);
      y += 42;
    }
  }

  // ── Upgrade Panel ──
  private openUpgradePanel() {
    let y = this.openPanel("UPGRADES", "#c09040");
    const sw = this.scale.width;
    const pad = 14;

    this.pui(this.add.text(pad, y + 4, "Improve your capabilities", {
      fontFamily: "monospace", fontSize: "9px", color: "#6a7a5a",
    }), HUD_DEPTH + 51);
    y += 22;

    const upg = this.stash.upgrades;
    const upgrades = [
      { key: "hp", label: "MAX HP", desc: `+10 HP per level (current: +${upg.hp * 10})`, level: upg.hp, cost: (upg.hp + 1) * 150 },
      { key: "stamina", label: "STAMINA", desc: `+15 stamina per level (current: +${upg.stamina * 15})`, level: upg.stamina, cost: (upg.stamina + 1) * 120 },
      { key: "stash", label: "STASH SIZE", desc: `+2 columns per level (current: +${upg.stash * 2})`, level: upg.stash, cost: (upg.stash + 1) * 200 },
    ];

    for (const u of upgrades) {
      const canAfford = this.stash.money >= u.cost;
      const maxed = u.level >= 5;

      const rowY = y + 18;
      this.pui(this.add.rectangle(sw / 2, rowY, sw - pad * 2, 50, canAfford && !maxed ? 0x1c2418 : 0x161816, 0.9)
        .setStrokeStyle(1, canAfford && !maxed ? 0x3a5a2a : 0x222220), HUD_DEPTH + 51);

      // Level pips
      for (let i = 0; i < 5; i++) {
        const pipX = pad + 10 + i * 14;
        this.pui(this.add.rectangle(pipX, rowY - 10, 10, 6,
          i < u.level ? 0x5c8a3c : 0x2a2a22
        ), HUD_DEPTH + 52);
      }

      this.pui(this.add.text(pad + 10, rowY, u.label, {
        fontFamily: "monospace", fontSize: "13px", color: "#e0dcc8", fontStyle: "bold",
      }), HUD_DEPTH + 52);

      this.pui(this.add.text(pad + 10, rowY + 12, u.desc, {
        fontFamily: "monospace", fontSize: "7px", color: "#5a6a4a",
      }), HUD_DEPTH + 52);

      const costStr = maxed ? "MAX" : `$ ${u.cost}`;
      this.pui(this.add.text(sw - pad - 10, rowY, costStr, {
        fontFamily: "monospace", fontSize: "12px",
        color: maxed ? "#5c8a3c" : (canAfford ? "#b0d060" : "#4a4a40"), fontStyle: "bold",
      }).setOrigin(1, 0.5), HUD_DEPTH + 52);

      if (canAfford && !maxed) {
        const capturedKey = u.key as keyof typeof this.stash.upgrades;
        const capturedCost = u.cost;
        this.addPanelHit(sw / 2, rowY, sw - pad * 2, 50, () => {
          this.stash.money -= capturedCost;
          (this.stash.upgrades as Record<string, number>)[capturedKey]++;
          this.closePanel();
          this.openUpgradePanel();
        });
      }

      y += 58;
    }

    // Quest section
    y += 10;
    this.pui(this.add.rectangle(sw / 2, y, sw - pad * 2, 1, 0x3a4a30, 0.5), HUD_DEPTH + 51);
    this.pui(this.add.text(pad, y + 6, "TASKS", {
      fontFamily: "monospace", fontSize: "12px", color: "#8ab060", fontStyle: "bold",
    }), HUD_DEPTH + 52);
    y += 24;

    for (const q of this.stash.quests) {
      const done = q.completed;
      this.pui(this.add.rectangle(sw / 2, y + 10, sw - pad * 2, 30,
        done ? 0x1a2a14 : 0x161816, 0.8
      ).setStrokeStyle(1, done ? 0x3a5a2a : 0x222220), HUD_DEPTH + 51);

      this.pui(this.add.circle(pad + 10, y + 10, 4, done ? 0x5c8a3c : 0x3a3a30), HUD_DEPTH + 52);
      this.pui(this.add.text(pad + 20, y + 4, q.title, {
        fontFamily: "monospace", fontSize: "10px", color: done ? "#8ab060" : "#c8c0b0", fontStyle: "bold",
      }), HUD_DEPTH + 52);
      this.pui(this.add.text(sw - pad - 10, y + 10, done ? "DONE" : `${q.progress}/${q.target}`, {
        fontFamily: "monospace", fontSize: "9px", color: done ? "#5c8a3c" : "#b0a080", fontStyle: "bold",
      }).setOrigin(1, 0.5), HUD_DEPTH + 52);

      y += 36;
    }
  }

  // ── Shop row helper ──
  private drawShopRow(pad: number, y: number, sw: number, name: string, cost: number, icon: string) {
    const canAfford = this.stash.money >= cost;
    const rowY = y + 16;

    this.pui(this.add.rectangle(sw / 2, rowY, sw - pad * 2, 36,
      canAfford ? 0x1c2418 : 0x161816, 0.9
    ).setStrokeStyle(1, canAfford ? 0x2a4a22 : 0x222220), HUD_DEPTH + 51);

    // Item icon
    if (this.textures.exists(icon)) {
      this.pui(this.add.sprite(pad + 20, rowY, icon).setScale(1.8), HUD_DEPTH + 52);
    }

    this.pui(this.add.text(pad + 38, rowY, name, {
      fontFamily: "monospace", fontSize: "12px",
      color: canAfford ? "#e0dcc8" : "#4a4a40", fontStyle: "bold",
    }).setOrigin(0, 0.5), HUD_DEPTH + 52);

    this.pui(this.add.text(sw - pad - 10, rowY, `$ ${cost}`, {
      fontFamily: "monospace", fontSize: "12px",
      color: canAfford ? "#b0d060" : "#3a3a30", fontStyle: "bold",
    }).setOrigin(1, 0.5), HUD_DEPTH + 52);

    if (canAfford) {
      this.addPanelHit(sw / 2, rowY, sw - pad * 2, 36, () => {
        this.stash.money -= cost;
        this.closePanel();
        if (this.interactTarget?.type === "trader") this.openTraderPanel();
        else if (this.interactTarget?.type === "gunsmith") this.openGunsmithPanel();
      });
    }
  }

  // ── Message banner ──
  private showMessageBanner(msg: string) {
    const sw = this.scale.width;
    const isDeath = msg.includes("DIED");

    const bg = this.add.rectangle(sw / 2, 60, sw - 20, 28, isDeath ? 0x2a1010 : 0x102a20, 0.9)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 25).setStrokeStyle(1, isDeath ? 0x5a2020 : 0x2a5a3a);
    const txt = this.add.text(sw / 2, 60, msg, {
      fontFamily: "monospace", fontSize: "10px",
      color: isDeath ? "#ff6060" : "#60d0a0", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 26);

    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: [bg, txt], alpha: 0, duration: 500, onComplete: () => { bg.destroy(); txt.destroy(); } });
    });
  }
}
