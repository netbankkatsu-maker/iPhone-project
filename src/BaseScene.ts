import Phaser from "phaser";
import { HUD_DEPTH } from "./constants";
import { Quest, createStartingQuests, updateQuestProgress } from "./Quest";

export interface PlayerStash {
  kills: number;
  totalExtracts: number;
  totalDeaths: number;
  money: number;
  xp: number;
  level: number;
  quests: Quest[];
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
  };
}

export class BaseScene extends Phaser.Scene {
  public stash: PlayerStash = createDefaultStash();
  private message: string = "";

  constructor() {
    super("BaseScene");
  }

  init(data?: { message?: string; stash?: PlayerStash }) {
    if (data?.stash) this.stash = data.stash;
    this.message = data?.message || "";
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const pad = 16;
    const cardW = w - pad * 2;

    // Background - dark gradient feel
    this.add.rectangle(w / 2, h / 2, w, h, 0x0f1410).setScrollFactor(0);
    // Subtle top accent bar
    this.add.rectangle(w / 2, 0, w, 3, 0x5c8a3c).setOrigin(0.5, 0).setScrollFactor(0);

    // ── Header area ──
    const headerY = 28;
    this.add.text(w / 2, headerY, "HIDEOUT", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#c8dca8",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0);

    // Money badge (top-right)
    const moneyBg = this.add.rectangle(w - pad - 40, headerY, 80, 24, 0x1a2418, 0.9).setScrollFactor(0);
    moneyBg.setStrokeStyle(1, 0x3a5a2a);
    this.add.text(w - pad - 40, headerY, `$ ${this.stash.money}`, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#b0d060",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0);

    // Level badge (top-left)
    const lvlBg = this.add.rectangle(pad + 30, headerY, 60, 24, 0x1a2418, 0.9).setScrollFactor(0);
    lvlBg.setStrokeStyle(1, 0x3a5a2a);
    this.add.text(pad + 30, headerY, `Lv.${this.stash.level}`, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#b0d060",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0);

    // XP bar
    const xpNeeded = this.stash.level * 100;
    const xpRatio = Math.min(1, this.stash.xp / xpNeeded);
    const xpY = headerY + 20;
    this.add.rectangle(w / 2, xpY, cardW, 4, 0x1a2418).setScrollFactor(0);
    if (xpRatio > 0) {
      this.add.rectangle(pad + (cardW * xpRatio) / 2, xpY, cardW * xpRatio, 4, 0x5c8a3c).setScrollFactor(0);
    }
    this.add.text(w / 2, xpY + 8, `XP ${this.stash.xp} / ${xpNeeded}`, {
      fontFamily: "monospace", fontSize: "8px", color: "#5a7a4a",
    }).setOrigin(0.5).setScrollFactor(0);

    // ── Message banner ──
    let nextY = xpY + 22;
    if (this.message) {
      const isDeath = this.message.includes("DIED");
      const msgBg = this.add.rectangle(w / 2, nextY + 10, cardW, 28, isDeath ? 0x2a1010 : 0x102a20, 0.9).setScrollFactor(0);
      msgBg.setStrokeStyle(1, isDeath ? 0x5a2020 : 0x2a5a3a);
      this.add.text(w / 2, nextY + 10, this.message, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: isDeath ? "#ff6060" : "#60d0a0",
        fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0);
      nextY += 30;
    }

    // ── Stats row ──
    nextY += 4;
    const stats = [
      { label: "RAIDS", val: `${this.stash.totalExtracts + this.stash.totalDeaths}` },
      { label: "EXTRACT", val: `${this.stash.totalExtracts}` },
      { label: "KILLS", val: `${this.stash.kills}` },
    ];
    const statW = Math.floor(cardW / stats.length);
    stats.forEach((s, i) => {
      const sx = pad + statW * i + statW / 2;
      this.add.text(sx, nextY, s.val, {
        fontFamily: "monospace", fontSize: "16px", color: "#e0dcc8", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0);
      this.add.text(sx, nextY + 16, s.label, {
        fontFamily: "monospace", fontSize: "8px", color: "#5a6a4a",
      }).setOrigin(0.5).setScrollFactor(0);
    });
    nextY += 36;

    // ── Card helper ──
    const drawCard = (x: number, y: number, cw: number, ch: number, title: string, titleColor: string) => {
      const bg = this.add.rectangle(x + cw / 2, y + ch / 2, cw, ch, 0x161c12, 0.95).setScrollFactor(0);
      bg.setStrokeStyle(1, 0x2a3a22);
      // Title bar
      this.add.rectangle(x + cw / 2, y + 14, cw - 2, 26, 0x1c2418, 0.9).setScrollFactor(0);
      this.add.text(x + 10, y + 14, title, {
        fontFamily: "monospace", fontSize: "12px", color: titleColor, fontStyle: "bold",
      }).setOrigin(0, 0.5).setScrollFactor(0);
      return y + 30;
    };

    // ── Tasks card ──
    const taskCardH = 14 + 28 + this.stash.quests.length * 32;
    let ty = drawCard(pad, nextY, cardW, taskCardH, "TASKS", "#8ab060");

    this.stash.quests.forEach((q, i) => {
      const done = q.completed;
      const iy = ty + 4 + i * 32;

      // Progress indicator
      const progBg = this.add.rectangle(pad + 20, iy + 10, cardW - 40, 26, done ? 0x1a2a14 : 0x181c16, 0.8).setScrollFactor(0);
      if (done) progBg.setStrokeStyle(1, 0x3a5a2a);

      // Status dot
      this.add.circle(pad + 18, iy + 10, 4, done ? 0x5c8a3c : 0x3a3a30).setScrollFactor(0);

      this.add.text(pad + 28, iy + 4, q.title, {
        fontFamily: "monospace", fontSize: "11px", color: done ? "#8ab060" : "#c8c0b0", fontStyle: "bold",
      }).setScrollFactor(0);
      this.add.text(pad + 28, iy + 16, q.description, {
        fontFamily: "monospace", fontSize: "8px", color: "#5a6a4a",
      }).setScrollFactor(0);

      // Progress badge
      const badge = done ? "DONE" : `${q.progress}/${q.target}`;
      const badgeColor = done ? "#5c8a3c" : "#b0a080";
      this.add.text(w - pad - 14, iy + 10, badge, {
        fontFamily: "monospace", fontSize: "10px", color: badgeColor, fontStyle: "bold",
      }).setOrigin(1, 0.5).setScrollFactor(0);
    });
    nextY += taskCardH + 8;

    // ── Trader card ──
    const shopItems = [
      { name: "Bandage x3", cost: 30 },
      { name: "Medkit", cost: 80 },
      { name: "Water x2", cost: 20 },
      { name: "Canned Food x2", cost: 25 },
    ];
    const shopCardH = 14 + 28 + shopItems.length * 38;
    let sy = drawCard(pad, nextY, cardW, shopCardH, "TRADER", "#d0a040");

    // Update money display ref
    const moneyText = this.add.text(w - pad - 14, nextY + 14, `$ ${this.stash.money}`, {
      fontFamily: "monospace", fontSize: "10px", color: "#b0d060",
    }).setOrigin(1, 0.5).setScrollFactor(0);

    shopItems.forEach((item, i) => {
      const canAfford = this.stash.money >= item.cost;
      const iy = sy + 6 + i * 38;

      // Item row bg (acts as button)
      const rowBg = this.add.rectangle(w / 2, iy + 14, cardW - 16, 32,
        canAfford ? 0x1c2418 : 0x181816, 0.9
      ).setScrollFactor(0).setInteractive();
      rowBg.setStrokeStyle(1, canAfford ? 0x2a4a22 : 0x222220);

      const nameT = this.add.text(pad + 18, iy + 8, item.name, {
        fontFamily: "monospace", fontSize: "12px",
        color: canAfford ? "#d8d0c0" : "#4a4a40", fontStyle: "bold",
      }).setScrollFactor(0);

      const costT = this.add.text(w - pad - 14, iy + 14, `$ ${item.cost}`, {
        fontFamily: "monospace", fontSize: "12px",
        color: canAfford ? "#b0d060" : "#3a3a30", fontStyle: "bold",
      }).setOrigin(1, 0.5).setScrollFactor(0);

      if (canAfford) {
        rowBg.on("pointerdown", () => {
          this.stash.money -= item.cost;
          rowBg.setFillStyle(0x1a2a14);
          rowBg.setStrokeStyle(1, 0x5c8a3c);
          nameT.setStyle({ color: "#5c8a3c" });
          costT.setText("BOUGHT");
          costT.setStyle({ color: "#5c8a3c" });
          rowBg.disableInteractive();
          moneyText.setText(`$ ${this.stash.money}`);
        });
      }
    });
    nextY += shopCardH + 12;

    // ── Deploy button ──
    const deployY = Math.max(nextY + 10, h * 0.82);
    const deployBg = this.add.rectangle(w / 2, deployY, cardW, 48, 0x5c8a3c, 1)
      .setScrollFactor(0).setInteractive();
    deployBg.setStrokeStyle(2, 0x8ab060);
    this.add.text(w / 2, deployY, "DEPLOY", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#0f1410",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);

    deployBg.on("pointerdown", () => {
      this.scene.start("RaidScene", { stash: this.stash });
    });

    // Hint
    this.add.text(w / 2, deployY + 32, "Left: Move  |  Right: Aim & Shoot", {
      fontFamily: "monospace", fontSize: "8px", color: "#3a4a30",
    }).setOrigin(0.5).setScrollFactor(0);
  }
}
