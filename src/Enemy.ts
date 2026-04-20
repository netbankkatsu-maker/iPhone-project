import Phaser from "phaser";
import { ENEMY_TYPES, EnemyType, BULLET_LIFETIME, BULLET_RADIUS } from "./constants";

// Enemy sprite is now a Sprite (texture-based) instead of Arc
export type EnemySprite = Phaser.GameObjects.Sprite & {
  getData(key: "enemyData"): EnemyData;
};

export interface EnemyData {
  type: EnemyType;
  hp: number;
  maxHp: number;
  lastFireTime: number;
  state: "idle" | "patrol" | "alert" | "chase" | "attack" | "dead";
  patrolTarget: Phaser.Math.Vector2 | null;
  alertTimer: number;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
}

const TEXTURE_MAP: Record<EnemyType, string> = {
  bandit: "enemy_bandit",
  mutant: "enemy_mutant",
  heavy: "enemy_heavy",
  boss: "enemy_boss",
};

export function spawnEnemy(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: EnemyType,
  enemies: Phaser.GameObjects.Group,
  walls: Phaser.Physics.Arcade.StaticGroup
): EnemySprite {
  const cfg = ENEMY_TYPES[type];
  const texKey = TEXTURE_MAP[type];

  const enemy = scene.add.sprite(x, y, texKey) as EnemySprite;
  scene.physics.add.existing(enemy);
  const body = enemy.body as Phaser.Physics.Arcade.Body;
  body.setCircle(cfg.radius, enemy.width / 2 - cfg.radius, enemy.height / 2 - cfg.radius);
  body.setCollideWorldBounds(true);

  // HP bar background
  const hpBarBg = scene.add.rectangle(x, y - cfg.radius - 8, 30, 4, 0x333333);
  hpBarBg.setDepth(20);

  // HP bar
  const hpBar = scene.add.rectangle(x, y - cfg.radius - 8, 30, 4, 0xa04030);
  hpBar.setDepth(21);

  const data: EnemyData = {
    type,
    hp: cfg.hp,
    maxHp: cfg.hp,
    lastFireTime: 0,
    state: "patrol",
    patrolTarget: null,
    alertTimer: 0,
    hpBar,
    hpBarBg,
  };

  enemy.setData("enemyData", data);
  enemies.add(enemy);

  scene.physics.add.collider(enemy, walls);

  return enemy;
}

export function updateEnemy(
  scene: Phaser.Scene,
  enemy: EnemySprite,
  playerX: number,
  playerY: number,
  playerAlive: boolean,
  enemyBullets: Phaser.GameObjects.Group,
  walls: Phaser.Physics.Arcade.StaticGroup
) {
  if (!enemy.active) return;
  const data = enemy.getData("enemyData") as EnemyData;
  if (!data || data.state === "dead") return;

  const cfg = ENEMY_TYPES[data.type];
  if (!cfg) return;
  const body = enemy.body as Phaser.Physics.Arcade.Body;
  if (!body) return;
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Rotate enemy to face movement/player
  if (data.state === "chase" || data.state === "attack") {
    enemy.setRotation(Math.atan2(dy, dx) - Math.PI / 2);
  }

  // Update HP bar position
  if (data.hpBar.active && data.hpBarBg.active) {
    data.hpBar.setPosition(enemy.x, enemy.y - cfg.radius - 8);
    data.hpBarBg.setPosition(enemy.x, enemy.y - cfg.radius - 8);
    const hpRatio = data.hp / data.maxHp;
    data.hpBar.setSize(30 * hpRatio, 4);
    data.hpBar.setVisible(data.hp < data.maxHp);
    data.hpBarBg.setVisible(data.hp < data.maxHp);
  }

  if (!playerAlive) {
    body.setVelocity(0, 0);
    data.state = "idle";
    return;
  }

  // State machine
  if (dist < cfg.detectionRange) {
    data.state = dist < cfg.attackRange ? "attack" : "chase";
    data.alertTimer = 3000;
  } else if (data.alertTimer > 0) {
    data.alertTimer -= scene.game.loop.delta;
    data.state = "chase";
  } else {
    data.state = "patrol";
  }

  switch (data.state) {
    case "patrol": {
      if (
        !data.patrolTarget ||
        Phaser.Math.Distance.Between(
          enemy.x,
          enemy.y,
          data.patrolTarget.x,
          data.patrolTarget.y
        ) < 20
      ) {
        data.patrolTarget = new Phaser.Math.Vector2(
          enemy.x + Phaser.Math.Between(-200, 200),
          enemy.y + Phaser.Math.Between(-200, 200)
        );
      }
      const pa = Math.atan2(
        data.patrolTarget.y - enemy.y,
        data.patrolTarget.x - enemy.x
      );
      enemy.setRotation(pa - Math.PI / 2);
      body.setVelocity(
        Math.cos(pa) * cfg.speed * 0.4,
        Math.sin(pa) * cfg.speed * 0.4
      );
      break;
    }
    case "chase": {
      const angle = Math.atan2(dy, dx);
      body.setVelocity(
        Math.cos(angle) * cfg.speed,
        Math.sin(angle) * cfg.speed
      );
      break;
    }
    case "attack": {
      const angle = Math.atan2(dy, dx);

      // Melee enemy keeps chasing
      if (cfg.fireRate === 0) {
        body.setVelocity(
          Math.cos(angle) * cfg.speed,
          Math.sin(angle) * cfg.speed
        );
        break;
      }

      // Ranged enemy: slow approach + shoot
      body.setVelocity(
        Math.cos(angle) * cfg.speed * 0.3,
        Math.sin(angle) * cfg.speed * 0.3
      );

      const now = scene.time.now;
      if (now - data.lastFireTime > cfg.fireRate) {
        data.lastFireTime = now;
        enemyShoot(scene, enemy.x, enemy.y, angle, enemyBullets, walls);
      }
      break;
    }
    default:
      body.setVelocity(0, 0);
  }
}

function enemyShoot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  enemyBullets: Phaser.GameObjects.Group,
  _walls: Phaser.Physics.Arcade.StaticGroup
) {
  const speed = 350;
  const spread = (Math.random() - 0.5) * 0.15;
  const a = angle + spread;
  const bx = x + Math.cos(a) * 20;
  const by = y + Math.sin(a) * 20;

  const bullet = scene.add.sprite(bx, by, "bullet_enemy").setRotation(a);
  scene.physics.add.existing(bullet);
  const body = bullet.body as Phaser.Physics.Arcade.Body;
  body.setSize(6, 4);
  body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
  bullet.setData("meta", { born: scene.time.now, damage: 10 });
  enemyBullets.add(bullet);
}

export function damageEnemy(
  scene: Phaser.Scene,
  enemy: EnemySprite,
  damage: number
): boolean {
  if (!enemy.active) return false;
  const data = enemy.getData("enemyData") as EnemyData;
  if (!data || data.state === "dead") return false;

  data.hp -= damage;

  // Flash white on hit
  enemy.setTintFill(0xffffff);
  scene.time.delayedCall(80, () => {
    if (!enemy.active) return;
    enemy.clearTint();
  });

  if (data.hp <= 0) {
    data.state = "dead";
    if (data.hpBar.active) data.hpBar.destroy();
    if (data.hpBarBg.active) data.hpBarBg.destroy();
    enemy.destroy();
    return true;
  }

  data.alertTimer = 5000;
  return false;
}
