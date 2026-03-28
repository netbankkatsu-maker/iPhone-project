import Phaser from "phaser";
import { MAP_W, MAP_H, HUD_DEPTH } from "./constants";

const MM_SIZE = 80;
const MM_MARGIN = 8;

export class Minimap {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private playerDot: Phaser.GameObjects.Arc;
  private extractDot: Phaser.GameObjects.Arc;
  private enemyDots: Phaser.GameObjects.Arc[] = [];
  private scene: Phaser.Scene;
  private extractX: number;
  private extractY: number;

  constructor(
    scene: Phaser.Scene,
    extractionX: number,
    extractionY: number
  ) {
    this.scene = scene;
    this.extractX = extractionX;
    this.extractY = extractionY;

    const x = scene.scale.width - MM_SIZE - MM_MARGIN;
    const y = scene.scale.height - MM_SIZE - MM_MARGIN;

    this.container = scene.add.container(x, y)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 5);

    // Background
    this.bg = scene.add.rectangle(MM_SIZE / 2, MM_SIZE / 2, MM_SIZE, MM_SIZE, 0x111122, 0.7);
    this.bg.setStrokeStyle(1, 0x444466);
    this.container.add(this.bg);

    // Extraction marker
    this.extractDot = scene.add.circle(
      (extractionX / MAP_W) * MM_SIZE,
      (extractionY / MAP_H) * MM_SIZE,
      3,
      0x00e5ff
    );
    this.container.add(this.extractDot);

    // Player dot
    this.playerDot = scene.add.circle(0, 0, 2.5, 0x00e676);
    this.container.add(this.playerDot);
  }

  update(
    playerX: number,
    playerY: number,
    enemies: Phaser.GameObjects.Group
  ) {
    // Player position on minimap
    this.playerDot.setPosition(
      (playerX / MAP_W) * MM_SIZE,
      (playerY / MAP_H) * MM_SIZE
    );

    // Reposition container
    const x = this.scene.scale.width - MM_SIZE - MM_MARGIN;
    const y = this.scene.scale.height - MM_SIZE - MM_MARGIN;
    this.container.setPosition(x, y);

    // Clear old enemy dots
    for (const dot of this.enemyDots) dot.destroy();
    this.enemyDots = [];

    // Enemy dots (only nearby ones)
    for (const e of enemies.getChildren()) {
      const enemy = e as Phaser.GameObjects.Arc;
      const dist = Phaser.Math.Distance.Between(playerX, playerY, enemy.x, enemy.y);
      if (dist < 400) {
        const dot = this.scene.add.circle(
          (enemy.x / MAP_W) * MM_SIZE,
          (enemy.y / MAP_H) * MM_SIZE,
          1.5,
          0xff3d00
        );
        this.container.add(dot);
        this.enemyDots.push(dot);
      }
    }
  }
}
