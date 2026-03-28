import Phaser from "phaser";
import { MAP_W, MAP_H } from "./constants";

const FOG_RES = 4; // Pixel scale factor for fog texture (lower = cheaper)
const VIEW_RADIUS = 180;

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
    this.fogTexture.setAlpha(0.85);

    // Fill with black (fog)
    this.fogTexture.fill(0x0a0a1e);

    // Erase brush (circle gradient)
    this.brush = scene.add.graphics();
    this.brush.setVisible(false);
    this.drawBrush();
  }

  private drawBrush() {
    const r = Math.ceil(VIEW_RADIUS / FOG_RES);
    this.brush.clear();
    // Multiple circles for gradient fade
    for (let i = r; i > 0; i -= 2) {
      const alpha = 1 - (i / r) * 0.5;
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
