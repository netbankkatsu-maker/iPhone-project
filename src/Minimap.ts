import Phaser from "phaser";
import { MAP_W, MAP_H, HUD_DEPTH } from "./constants";

const MM_SIZE = 80;
const MM_MARGIN = 8;
const MAX_ENEMY_DOTS = 20;

export class Minimap {
  private container: Phaser.GameObjects.Container;
  private playerDot: Phaser.GameObjects.Arc;
  private enemyDots: Phaser.GameObjects.Arc[] = [];
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    extractionX: number,
    extractionY: number
  ) {
    this.scene = scene;

    const x = scene.scale.width - MM_SIZE - MM_MARGIN;
    const y = scene.scale.height - MM_SIZE - MM_MARGIN;

    this.container = scene.add.container(x, y)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 5);

    // Background
    const bg = scene.add.rectangle(MM_SIZE / 2, MM_SIZE / 2, MM_SIZE, MM_SIZE, 0x151a10, 0.75);
    bg.setStrokeStyle(1, 0x3a3a2a);
    this.container.add(bg);

    // Extraction marker
    const extractDot = scene.add.circle(
      (extractionX / MAP_W) * MM_SIZE,
      (extractionY / MAP_H) * MM_SIZE,
      3,
      0x40b0a0
    );
    this.container.add(extractDot);

    // Pre-create enemy dot pool
    for (let i = 0; i < MAX_ENEMY_DOTS; i++) {
      const dot = scene.add.circle(0, 0, 1.5, 0xc05030).setVisible(false);
      this.container.add(dot);
      this.enemyDots.push(dot);
    }

    // Player dot (on top)
    this.playerDot = scene.add.circle(0, 0, 2.5, 0x7a9e5a);
    this.container.add(this.playerDot);
  }

  update(
    playerX: number,
    playerY: number,
    enemies: Phaser.GameObjects.Group
  ) {
    // Player position
    this.playerDot.setPosition(
      (playerX / MAP_W) * MM_SIZE,
      (playerY / MAP_H) * MM_SIZE
    );

    // Reposition container
    const x = this.scene.scale.width - MM_SIZE - MM_MARGIN;
    const y = this.scene.scale.height - MM_SIZE - MM_MARGIN;
    this.container.setPosition(x, y);

    // Update enemy dots from pool
    let dotIdx = 0;
    for (const e of enemies.getChildren()) {
      if (dotIdx >= MAX_ENEMY_DOTS) break;
      if (!e.active) continue;
      const enemy = e as Phaser.GameObjects.Arc;
      const dist = Phaser.Math.Distance.Between(playerX, playerY, enemy.x, enemy.y);
      if (dist < 400) {
        const dot = this.enemyDots[dotIdx];
        dot.setPosition(
          (enemy.x / MAP_W) * MM_SIZE,
          (enemy.y / MAP_H) * MM_SIZE
        );
        dot.setVisible(true);
        dotIdx++;
      }
    }
    // Hide unused dots
    for (let i = dotIdx; i < MAX_ENEMY_DOTS; i++) {
      this.enemyDots[i].setVisible(false);
    }
  }

  destroy() {
    this.container.destroy(true);
  }
}
