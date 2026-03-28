import Phaser from "phaser";
import { JOYSTICK_RADIUS, JOYSTICK_DEAD_ZONE, HUD_DEPTH } from "./constants";

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private origin: Phaser.Math.Vector2;
  public vector: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  public active = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private side: "left" | "right"
  ) {
    this.scene = scene;
    this.origin = new Phaser.Math.Vector2(x, y);

    this.base = scene.add
      .circle(x, y, JOYSTICK_RADIUS, 0xffffff, 0.15)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.thumb = scene.add
      .circle(x, y, JOYSTICK_RADIUS * 0.45, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
  }

  private inZone(px: number): boolean {
    const half = this.scene.scale.width / 2;
    return this.side === "left" ? px < half : px >= half;
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.pointerId !== null) return;
    if (!this.inZone(pointer.x)) return;
    this.pointerId = pointer.id;
    this.origin.set(pointer.x, pointer.y);
    this.base.setPosition(pointer.x, pointer.y);
    this.thumb.setPosition(pointer.x, pointer.y);
    this.active = true;
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.origin.x;
    const dy = pointer.y - this.origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);

    if (dist < JOYSTICK_DEAD_ZONE) {
      this.vector.set(0, 0);
      this.thumb.setPosition(this.origin.x, this.origin.y);
      return;
    }

    const angle = Math.atan2(dy, dx);
    this.vector.set(Math.cos(angle), Math.sin(angle));
    this.thumb.setPosition(
      this.origin.x + Math.cos(angle) * clamped,
      this.origin.y + Math.sin(angle) * clamped
    );
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.active = false;
    this.vector.set(0, 0);
    this.thumb.setPosition(this.origin.x, this.origin.y);
  }

  reposition(x: number, y: number) {
    if (this.pointerId === null) {
      this.origin.set(x, y);
      this.base.setPosition(x, y);
      this.thumb.setPosition(x, y);
    }
  }

  setVisible(visible: boolean) {
    this.base.setVisible(visible);
    this.thumb.setVisible(visible);
  }
}
