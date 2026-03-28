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

    // Background
    this.add.rectangle(w / 2, h / 2, w, h, 0x1a1a2e).setScrollFactor(0);

    // Title
    this.add
      .text(w / 2, h * 0.06, "HIDEOUT", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#00e676",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Level & XP
    const xpNeeded = this.stash.level * 100;
    this.add
      .text(w / 2, h * 0.13, `Lv.${this.stash.level}  XP: ${this.stash.xp}/${xpNeeded}  Money: $${this.stash.money}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffc107",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Stats
    this.add
      .text(
        w / 2,
        h * 0.19,
        `Extracts: ${this.stash.totalExtracts}  |  Deaths: ${this.stash.totalDeaths}  |  Kills: ${this.stash.kills}`,
        { fontFamily: "monospace", fontSize: "9px", color: "#8888aa" }
      )
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Message
    if (this.message) {
      this.add
        .text(w / 2, h * 0.26, this.message, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: this.message.includes("DIED") ? "#ff5252" : "#00e5ff",
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
    }

    // Quests panel (left)
    const qx = 12;
    const qy = h * 0.34;
    this.add.text(qx, qy, "TASKS", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#00e676",
    }).setScrollFactor(0);

    this.stash.quests.forEach((q, i) => {
      const color = q.completed ? "#4caf50" : "#ccccdd";
      const status = q.completed ? "[DONE]" : `[${q.progress}/${q.target}]`;
      this.add.text(qx, qy + 16 + i * 22, `${status} ${q.title}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color,
      }).setScrollFactor(0);
      this.add.text(qx + 8, qy + 27 + i * 22, q.description, {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#666688",
      }).setScrollFactor(0);
    });

    // Shop (right side)
    const sx = w / 2 + 10;
    const sy = h * 0.34;
    this.add.text(sx, sy, "TRADER", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#ffc107",
    }).setScrollFactor(0);

    const shopItems = [
      { name: "Bandage x3", cost: 30 },
      { name: "Medkit", cost: 80 },
      { name: "Water x2", cost: 20 },
      { name: "Canned Food x2", cost: 25 },
    ];

    shopItems.forEach((item, i) => {
      const canAfford = this.stash.money >= item.cost;
      const btn = this.add.text(sx, sy + 16 + i * 20, `${item.name} - $${item.cost}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: canAfford ? "#ffffff" : "#555555",
        backgroundColor: canAfford ? "#333355" : "#222233",
        padding: { x: 4, y: 2 },
      }).setScrollFactor(0).setInteractive();

      if (canAfford) {
        btn.on("pointerdown", () => {
          this.stash.money -= item.cost;
          btn.setStyle({ color: "#4caf50" });
          btn.setText(`${item.name} - BOUGHT`);
          btn.disableInteractive();
        });
      }
    });

    // Deploy button
    const btnBg = this.add
      .rectangle(w / 2, h * 0.82, 180, 44, 0x00e676, 0.9)
      .setScrollFactor(0)
      .setInteractive();
    this.add
      .text(w / 2, h * 0.82, "DEPLOY", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#1a1a2e",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    btnBg.on("pointerdown", () => {
      this.scene.start("RaidScene", { stash: this.stash });
    });

    // Instructions
    this.add
      .text(w / 2, h * 0.93, "Left: Move | Right: Aim & Shoot | EXTRACT to survive", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#555577",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }
}
