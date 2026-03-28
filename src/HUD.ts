import Phaser from "phaser";
import { HUD_DEPTH, PLAYER_MAX_HP, COLORS, WeaponType, WEAPONS } from "./constants";

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
      .rectangle(w / 2, 16, 200, 12, 0x333333)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.hpBar = scene.add
      .rectangle(w / 2, 16, 200, 12, COLORS.hpBar)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);
    this.hpText = scene.add
      .text(w / 2, 16, "100/100", { ...textStyle, fontSize: "10px" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2);

    // Weapon & ammo (top-right)
    this.weaponText = scene.add
      .text(w - 10, 8, "Pistol", { ...textStyle, fontSize: "11px" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.ammoText = scene.add
      .text(w - 10, 24, "12/12", { ...textStyle, fontSize: "14px", color: "#ffffff" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    // Reload indicator
    this.reloadText = scene.add
      .text(w / 2, 40, "RELOADING...", {
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

    // Status (death, extracted, etc.)
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
    this.hpBar.setSize(200 * ratio, 12);
    this.hpBar.setPosition(w / 2 - (200 * (1 - ratio)) / 2, 16);
    this.hpText.setText(`${Math.ceil(hp)}/${PLAYER_MAX_HP}`);
    this.hpText.setPosition(w / 2, 16);

    // Color change when low
    if (ratio < 0.3) {
      this.hpBar.setFillStyle(0xff3d00);
    } else if (ratio < 0.6) {
      this.hpBar.setFillStyle(0xffc107);
    } else {
      this.hpBar.setFillStyle(COLORS.hpBar);
    }
  }

  updateAmmo(current: number, max: number) {
    this.ammoText.setText(`${current}/${max}`);
    this.ammoText.setPosition(this.scene.scale.width - 10, 24);
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
    this.hpBarBg.setPosition(w / 2, 16);
    this.weaponText.setPosition(w - 10, 8);
    this.ammoText.setPosition(w - 10, 24);
    this.reloadText.setPosition(w / 2, 40);
    this.extractionText.setPosition(w / 2, h / 2 - 40);
    this.statusText.setPosition(w / 2, h / 2);
    this.interactHint.setPosition(w / 2, h / 2 + 50);
  }
}
