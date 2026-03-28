import Phaser from "phaser";
import { HUD_DEPTH, PLAYER_MAX_HP, COLORS, WeaponType, WEAPONS } from "./constants";
import { SurvivalStats } from "./Survival";

export class HUD {
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private ammoText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private extractionText: Phaser.GameObjects.Text;
  private reloadText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private killCountText: Phaser.GameObjects.Text;
  private interactHint: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  // Survival bars
  private hungerBar: Phaser.GameObjects.Rectangle;
  private hungerBarBg: Phaser.GameObjects.Rectangle;
  private thirstBar: Phaser.GameObjects.Rectangle;
  private thirstBarBg: Phaser.GameObjects.Rectangle;
  private staminaBar: Phaser.GameObjects.Rectangle;
  private staminaBarBg: Phaser.GameObjects.Rectangle;
  private radBar: Phaser.GameObjects.Rectangle;
  private radBarBg: Phaser.GameObjects.Rectangle;

  // Status effect icons
  private bleedIcon: Phaser.GameObjects.Text;
  private fractureIcon: Phaser.GameObjects.Text;
  private radIcon: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = scene.scale.width;

    const textStyle = {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ccccee",
    };

    // HP bar
    this.hpBarBg = scene.add
      .rectangle(w / 2, 14, 160, 10, 0x333333)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.hpBar = scene.add
      .rectangle(w / 2, 14, 160, 10, COLORS.hpBar)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);
    this.hpText = scene.add
      .text(w / 2, 14, "100/100", { ...textStyle, fontSize: "8px" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2);

    // Survival mini-bars (below HP bar)
    const barY = 26;
    const barW = 38;
    const barH = 4;
    const barGap = 42;
    const startX = w / 2 - (barGap * 1.5);

    // Hunger
    this.hungerBarBg = scene.add.rectangle(startX, barY, barW, barH, 0x333333).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.hungerBar = scene.add.rectangle(startX, barY, barW, barH, 0xff8f00).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    scene.add.text(startX, barY - 6, "HNG", { fontFamily: "monospace", fontSize: "6px", color: "#888888" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);

    // Thirst
    this.thirstBarBg = scene.add.rectangle(startX + barGap, barY, barW, barH, 0x333333).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.thirstBar = scene.add.rectangle(startX + barGap, barY, barW, barH, 0x29b6f6).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    scene.add.text(startX + barGap, barY - 6, "THR", { fontFamily: "monospace", fontSize: "6px", color: "#888888" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);

    // Stamina
    this.staminaBarBg = scene.add.rectangle(startX + barGap * 2, barY, barW, barH, 0x333333).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.staminaBar = scene.add.rectangle(startX + barGap * 2, barY, barW, barH, 0xffee58).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    scene.add.text(startX + barGap * 2, barY - 6, "STA", { fontFamily: "monospace", fontSize: "6px", color: "#888888" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);

    // Radiation
    this.radBarBg = scene.add.rectangle(startX + barGap * 3, barY, barW, barH, 0x333333).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.radBar = scene.add.rectangle(startX + barGap * 3, barY, barW, barH, 0x76ff03).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    scene.add.text(startX + barGap * 3, barY - 6, "RAD", { fontFamily: "monospace", fontSize: "6px", color: "#888888" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH);

    // Status effect indicators
    this.bleedIcon = scene.add.text(w / 2 - 30, 34, "BLEED", { fontFamily: "monospace", fontSize: "8px", color: "#ff1744" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH).setVisible(false);
    this.fractureIcon = scene.add.text(w / 2, 34, "FRACTURE", { fontFamily: "monospace", fontSize: "8px", color: "#ffab00" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH).setVisible(false);
    this.radIcon = scene.add.text(w / 2 + 35, 34, "IRRADIATED", { fontFamily: "monospace", fontSize: "8px", color: "#76ff03" }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH).setVisible(false);

    // Weapon & ammo (top-right)
    this.weaponText = scene.add
      .text(w - 10, 8, "Pistol", { ...textStyle, fontSize: "11px" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.ammoText = scene.add
      .text(w - 10, 22, "12/12", { ...textStyle, fontSize: "14px", color: "#ffffff" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    // Reload indicator
    this.reloadText = scene.add
      .text(w / 2, 48, "RELOADING...", {
        ...textStyle,
        fontSize: "14px",
        color: "#ffab40",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setVisible(false);

    // Extraction progress
    this.extractionText = scene.add
      .text(w / 2, scene.scale.height / 2 - 40, "EXTRACTING...", {
        ...textStyle,
        fontSize: "16px",
        color: "#00e5ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setVisible(false);

    // Status (death, extracted)
    this.statusText = scene.add
      .text(w / 2, scene.scale.height / 2, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 10)
      .setVisible(false);

    // Kill count (top-left)
    this.killCountText = scene.add
      .text(10, 8, "Kills: 0", textStyle)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    // Interact hint
    this.interactHint = scene.add
      .text(w / 2, scene.scale.height / 2 + 50, "", {
        ...textStyle,
        fontSize: "13px",
        color: "#ffc107",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setVisible(false);
  }

  updateHP(hp: number) {
    const ratio = Math.max(0, hp / PLAYER_MAX_HP);
    const w = this.scene.scale.width;
    this.hpBar.setSize(160 * ratio, 10);
    this.hpBar.setPosition(w / 2 - (160 * (1 - ratio)) / 2, 14);
    this.hpText.setText(`${Math.ceil(hp)}/${PLAYER_MAX_HP}`);
    this.hpText.setPosition(w / 2, 14);

    if (ratio < 0.3) {
      this.hpBar.setFillStyle(0xff3d00);
    } else if (ratio < 0.6) {
      this.hpBar.setFillStyle(0xffc107);
    } else {
      this.hpBar.setFillStyle(COLORS.hpBar);
    }
  }

  updateSurvival(stats: SurvivalStats) {
    const barW = 38;

    // Hunger
    const hRatio = stats.hunger / 100;
    this.hungerBar.setSize(barW * hRatio, 4);
    if (stats.hunger < 20) this.hungerBar.setFillStyle(0xff3d00);
    else this.hungerBar.setFillStyle(0xff8f00);

    // Thirst
    const tRatio = stats.thirst / 100;
    this.thirstBar.setSize(barW * tRatio, 4);
    if (stats.thirst < 20) this.thirstBar.setFillStyle(0xff3d00);
    else this.thirstBar.setFillStyle(0x29b6f6);

    // Stamina
    const sRatio = stats.stamina / 100;
    this.staminaBar.setSize(barW * sRatio, 4);

    // Radiation
    const rRatio = stats.effects.radiation / 100;
    this.radBar.setSize(barW * rRatio, 4);
    this.radBar.setVisible(stats.effects.radiation > 0);
    this.radBarBg.setVisible(true);

    // Effect icons
    this.bleedIcon.setVisible(stats.effects.bleeding);
    this.fractureIcon.setVisible(stats.effects.fracture);
    this.radIcon.setVisible(stats.effects.radiation > 50);
  }

  updateAmmo(current: number, max: number) {
    this.ammoText.setText(`${current}/${max}`);
    this.ammoText.setPosition(this.scene.scale.width - 10, 22);
  }

  updateWeapon(type: WeaponType) {
    this.weaponText.setText(WEAPONS[type].name);
    this.weaponText.setPosition(this.scene.scale.width - 10, 8);
  }

  showReloading(show: boolean) {
    this.reloadText.setVisible(show);
  }

  showExtracting(show: boolean, progress = 0) {
    this.extractionText.setVisible(show);
    if (show) {
      const pct = Math.floor(progress * 100);
      this.extractionText.setText(`EXTRACTING... ${pct}%`);
    }
  }

  showStatus(text: string, color = "#ffffff") {
    this.statusText.setText(text);
    this.statusText.setStyle({ color });
    this.statusText.setVisible(true);
    this.statusText.setPosition(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2
    );
  }

  hideStatus() {
    this.statusText.setVisible(false);
  }

  updateKills(kills: number) {
    this.killCountText.setText(`Kills: ${kills}`);
  }

  showInteractHint(text: string) {
    this.interactHint.setText(text);
    this.interactHint.setVisible(true);
    this.interactHint.setPosition(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2 + 50
    );
  }

  hideInteractHint() {
    this.interactHint.setVisible(false);
  }

  onResize() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.hpBarBg.setPosition(w / 2, 14);
    this.weaponText.setPosition(w - 10, 8);
    this.ammoText.setPosition(w - 10, 22);
    this.reloadText.setPosition(w / 2, 48);
    this.extractionText.setPosition(w / 2, h / 2 - 40);
    this.statusText.setPosition(w / 2, h / 2);
    this.interactHint.setPosition(w / 2, h / 2 + 50);
  }
}
