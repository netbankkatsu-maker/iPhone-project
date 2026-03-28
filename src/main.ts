import Phaser from "phaser";

// ─── Constants ───────────────────────────────────────────────
const PLAYER_SPEED = 200;
const BULLET_SPEED = 600;
const BULLET_LIFETIME = 1000;
const JOYSTICK_RADIUS = 50;
const JOYSTICK_DEAD_ZONE = 10;
const MAP_W = 2000;
const MAP_H = 2000;
const WALL_COLOR = 0x5a5a7a;
const GROUND_COLOR = 0x2a2a3e;

// ─── Virtual Joystick ────────────────────────────────────────
class VirtualJoystick {
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
      .setDepth(100);

    this.thumb = scene.add
      .circle(x, y, JOYSTICK_RADIUS * 0.45, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(101);

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
}

// ─── Game Scene ──────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private bullets!: Phaser.GameObjects.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private moveStick!: VirtualJoystick;
  private aimStick!: VirtualJoystick;
  private lastShotTime = 0;
  private fireRate = 150; // ms between shots
  private aimIndicator!: Phaser.GameObjects.Line;

  constructor() {
    super("GameScene");
  }

  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // Ground
    this.add.rectangle(MAP_W / 2, MAP_H / 2, MAP_W, MAP_H, GROUND_COLOR);

    // Grid lines for spatial awareness
    const gfx = this.add.graphics({ lineStyle: { width: 1, color: 0x3a3a5e, alpha: 0.3 } });
    for (let x = 0; x <= MAP_W; x += 100) {
      gfx.lineBetween(x, 0, x, MAP_H);
    }
    for (let y = 0; y <= MAP_H; y += 100) {
      gfx.lineBetween(0, y, MAP_W, y);
    }

    // Walls (static obstacles)
    this.walls = this.physics.add.staticGroup();
    const wallData = [
      // Border walls
      { x: MAP_W / 2, y: 0, w: MAP_W, h: 20 },
      { x: MAP_W / 2, y: MAP_H, w: MAP_W, h: 20 },
      { x: 0, y: MAP_H / 2, w: 20, h: MAP_H },
      { x: MAP_W, y: MAP_H / 2, w: 20, h: MAP_H },
      // Interior walls / obstacles
      { x: 400, y: 400, w: 200, h: 30 },
      { x: 800, y: 300, w: 30, h: 200 },
      { x: 600, y: 700, w: 150, h: 30 },
      { x: 1200, y: 500, w: 30, h: 300 },
      { x: 1000, y: 900, w: 250, h: 30 },
      { x: 300, y: 1100, w: 30, h: 200 },
      { x: 1500, y: 400, w: 200, h: 30 },
      { x: 1700, y: 800, w: 30, h: 250 },
      { x: 500, y: 1500, w: 300, h: 30 },
      { x: 1300, y: 1300, w: 30, h: 200 },
      { x: 900, y: 1600, w: 200, h: 30 },
      { x: 1600, y: 1500, w: 30, h: 300 },
      { x: 200, y: 1800, w: 250, h: 30 },
      { x: 1100, y: 1800, w: 30, h: 150 },
    ];

    for (const w of wallData) {
      const rect = this.add.rectangle(w.x, w.y, w.w, w.h, WALL_COLOR);
      this.walls.add(rect);
      (rect.body as Phaser.Physics.Arcade.StaticBody).setSize(w.w, w.h);
      (rect.body as Phaser.Physics.Arcade.StaticBody).setOffset(
        -(w.w / 2),
        -(w.h / 2)
      );
    }

    // Player
    this.player = this.add.circle(MAP_W / 2, MAP_H / 2, 14, 0x00e676);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCircle(14);
    this.playerBody.setCollideWorldBounds(true);

    // Aim indicator line
    this.aimIndicator = this.add
      .line(0, 0, 0, 0, 30, 0, 0x00e676, 0.5)
      .setOrigin(0, 0.5)
      .setDepth(10);

    // Bullets group
    this.bullets = this.add.group();

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor("#1a1a2e");

    // Collisions
    this.physics.add.collider(this.player, this.walls);

    // Joysticks
    const w = this.scale.width;
    const h = this.scale.height;
    this.moveStick = new VirtualJoystick(this, w * 0.15, h * 0.7, "left");
    this.aimStick = new VirtualJoystick(this, w * 0.85, h * 0.7, "right");

    // HUD text
    this.add
      .text(w / 2, 20, "SURVIVAL SHOOTER", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#aaaacc",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Handle resize
    this.scale.on("resize", this.onResize, this);
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const w = gameSize.width;
    const h = gameSize.height;
    this.moveStick.reposition(w * 0.15, h * 0.7);
    this.aimStick.reposition(w * 0.85, h * 0.7);
  }

  update(_time: number, _delta: number) {
    // Movement
    const mx = this.moveStick.vector.x;
    const my = this.moveStick.vector.y;
    this.playerBody.setVelocity(mx * PLAYER_SPEED, my * PLAYER_SPEED);

    // Aim indicator
    const ax = this.aimStick.vector.x;
    const ay = this.aimStick.vector.y;
    if (ax !== 0 || ay !== 0) {
      const angle = Math.atan2(ay, ax);
      this.aimIndicator.setVisible(true);
      this.aimIndicator.setPosition(this.player.x, this.player.y);
      this.aimIndicator.setRotation(angle);
    } else {
      this.aimIndicator.setVisible(false);
    }

    // Shooting
    if (this.aimStick.active && (ax !== 0 || ay !== 0)) {
      const now = this.time.now;
      if (now - this.lastShotTime > this.fireRate) {
        this.shoot(ax, ay);
        this.lastShotTime = now;
      }
    }

    // Update bullets
    for (const b of this.bullets.getChildren()) {
      const bullet = b as Phaser.GameObjects.Arc;
      const data = bullet.getData("meta") as { born: number };
      if (this.time.now - data.born > BULLET_LIFETIME) {
        bullet.destroy();
      }
    }
  }

  private shoot(dirX: number, dirY: number) {
    const angle = Math.atan2(dirY, dirX);
    const offsetDist = 20;
    const bx = this.player.x + Math.cos(angle) * offsetDist;
    const by = this.player.y + Math.sin(angle) * offsetDist;

    const bullet = this.add.circle(bx, by, 4, 0xffeb3b);
    this.physics.add.existing(bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setCircle(4);
    body.setVelocity(
      Math.cos(angle) * BULLET_SPEED,
      Math.sin(angle) * BULLET_SPEED
    );

    bullet.setData("meta", { born: this.time.now });
    this.bullets.add(bullet);

    // Bullet-wall collision
    this.physics.add.collider(bullet, this.walls, () => {
      bullet.destroy();
    });
  }
}

// ─── Phaser Config & Boot ────────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: document.body,
    width: "100%",
    height: "100%",
  },
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [GameScene],
  input: {
    activePointers: 3,
  },
};

new Phaser.Game(config);

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/iPhone-project/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
