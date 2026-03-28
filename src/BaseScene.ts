import Phaser from "phaser";
import { HUD_DEPTH, COLORS } from "./constants";

export interface PlayerStash {
  kills: number;
  totalExtracts: number;
  totalDeaths: number;
}

export class BaseScene extends Phaser.Scene {
  public stash: PlayerStash = { kills: 0, totalExtracts: 0, totalDeaths: 0 };
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
      .text(w / 2, h * 0.12, "HIDEOUT", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#00e676",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Stats
    this.add
      .text(
        w / 2,
        h * 0.25,
        `Extracts: ${this.stash.totalExtracts}  |  Deaths: ${this.stash.totalDeaths}  |  Total Kills: ${this.stash.kills}`,
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#8888aa",
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Message from last raid
    if (this.message) {
      this.add
        .text(w / 2, h * 0.35, this.message, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: this.message.includes("DEAD") ? "#ff5252" : "#00e5ff",
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
    }

    // Deploy button
    const btnBg = this.add
      .rectangle(w / 2, h * 0.55, 200, 50, 0x00e676, 0.9)
      .setScrollFactor(0)
      .setInteractive();
    this.add
      .text(w / 2, h * 0.55, "DEPLOY", {
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
      .text(
        w / 2,
        h * 0.75,
        "Left stick: Move\nRight stick: Aim & Shoot\nReach EXTRACT to survive",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#666688",
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0);
  }
}
