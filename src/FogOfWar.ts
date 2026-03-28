import Phaser from "phaser";
import { MAP_W, MAP_H } from "./constants";

const FOG_RES = 4; // Pixel scale factor for fog texture (lower = cheaper)
const VIEW_RADIUS = 160; // Slightly tighter view for tension

export class FogOfWar {
  private fogTexture: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create fog layer covering entire map
    const tw = Math.ceil(MAP_W / FOG_RES);
    const th = Math.ceil(MAP_H / FOG_RES);
    this.fogTexture = scene.add.renderTexture(0, 0, tw, th);
    this.fogTexture.setOrigin(0, 0);
    this.fogTexture.setScale(FOG_RES);
    this.fogTexture.setDepth(50);
    this.fogTexture.setAlpha(0.92); // Darker fog

    // Fill with very dark color (near black, slight green tint)
    this.fogTexture.fill(0x060a04);

    // Erase brush (circle gradient)
    this.brush = scene.add.graphics();
    this.brush.setVisible(false);
    this.drawBrush();
  }

  private drawBrush() {
    const r = Math.ceil(VIEW_RADIUS / FOG_RES);
    this.brush.clear();
    // Soft gradient falloff for realistic vision
    for (let i = r; i > 0; i -= 1) {
      const t = i / r;
      // Sharper falloff at edges
      const alpha = t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4) * 0.7;
      this.brush.fillStyle(0xffffff, alpha);
      this.brush.fillCircle(r, r, i);
    }
  }

  update(playerX: number, playerY: number) {
    const r = Math.ceil(VIEW_RADIUS / FOG_RES);
    const px = Math.floor(playerX / FOG_RES) - r;
    const py = Math.floor(playerY / FOG_RES) - r;
    this.fogTexture.erase(this.brush, px, py);
  }
}
