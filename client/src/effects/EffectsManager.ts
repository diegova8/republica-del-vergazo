import Phaser from 'phaser';

// 8-bit color palette
export const PALETTE = {
  // Player 1 (Blue warrior)
  P1_MAIN: 0x3b82f6,
  P1_LIGHT: 0x60a5fa,
  P1_DARK: 0x1d4ed8,
  P1_SKIN: 0xfcd9b6,

  // Player 2 (Red warrior)
  P2_MAIN: 0xef4444,
  P2_LIGHT: 0xf87171,
  P2_DARK: 0xb91c1c,
  P2_SKIN: 0xfcd9b6,

  // Effects
  HIT_SPARK: 0xffffff,
  HIT_SPARK_ALT: 0xfef08a,
  BLOCK_SPARK: 0x94a3b8,
  DUST: 0xd4d4d8,
  DASH_TRAIL: 0x38bdf8,

  // UI
  HEALTH_FULL: 0x22c55e,
  HEALTH_MID: 0xeab308,
  HEALTH_LOW: 0xef4444,
  STAMINA: 0x3b82f6,
  UI_BG: 0x1e1e2e,
  UI_BORDER: 0xf8fafc,

  // Arena
  GROUND: 0x374151,
  GROUND_TOP: 0x4b5563,
  SKY_TOP: 0x0f172a,
  SKY_BOTTOM: 0x1e293b,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  gravity: number;
  type: 'square' | 'line' | 'spark';
  rotation?: number;
  rotationSpeed?: number;
}

export class EffectsManager {
  private scene: Phaser.Scene;
  private particles: Particle[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private screenFlash: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);

    // Screen flash overlay
    this.screenFlash = scene.add.rectangle(400, 300, 800, 600, 0xffffff, 0);
    this.screenFlash.setDepth(200);
  }

  update() {
    this.graphics.clear();

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;

      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        p.rotation += p.rotationSpeed;
      }

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Calculate alpha based on life
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));

      // Draw particle
      this.graphics.fillStyle(p.color, alpha);

      switch (p.type) {
        case 'square':
          const size = p.size * (p.life / p.maxLife);
          this.graphics.fillRect(p.x - size/2, p.y - size/2, size, size);
          break;
        case 'spark':
          // Draw a small cross/spark shape
          const s = p.size * (0.5 + 0.5 * (p.life / p.maxLife));
          this.graphics.fillRect(p.x - s/2, p.y - 1, s, 2);
          this.graphics.fillRect(p.x - 1, p.y - s/2, 2, s);
          break;
        case 'line':
          this.graphics.lineStyle(2, p.color, alpha);
          const len = p.size;
          const angle = p.rotation || Math.atan2(p.vy, p.vx);
          this.graphics.lineBetween(
            p.x, p.y,
            p.x - Math.cos(angle) * len,
            p.y - Math.sin(angle) * len
          );
          break;
      }
    }
  }

  // Hit spark effect - burst of white/yellow particles
  spawnHitSparks(x: number, y: number, direction: number, blocked: boolean = false) {
    const count = blocked ? 6 : 12;
    const baseColor = blocked ? PALETTE.BLOCK_SPARK : PALETTE.HIT_SPARK;
    const altColor = blocked ? 0x64748b : PALETTE.HIT_SPARK_ALT;

    for (let i = 0; i < count; i++) {
      const angle = (direction > 0 ? Math.PI : 0) + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 3 + Math.random() * 6;

      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 15 + Math.floor(Math.random() * 10),
        maxLife: 25,
        size: blocked ? 4 : 6 + Math.random() * 4,
        color: Math.random() > 0.5 ? baseColor : altColor,
        gravity: 0.3,
        type: Math.random() > 0.5 ? 'spark' : 'square',
      });
    }

    // Screen flash on hit
    if (!blocked) {
      this.flashScreen(0xffffff, 0.3, 50);
    }
  }

  // Dust cloud for landing/movement
  spawnDust(x: number, y: number, direction: number = 0) {
    const count = 4;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: (Math.random() - 0.5) * 2 + direction * 1.5,
        vy: -Math.random() * 2,
        life: 20 + Math.floor(Math.random() * 10),
        maxLife: 30,
        size: 4 + Math.random() * 4,
        color: PALETTE.DUST,
        gravity: 0.05,
        type: 'square',
      });
    }
  }

  // Dash trail - afterimages
  spawnDashTrail(x: number, y: number, width: number, height: number, color: number) {
    // Create a fading rectangle trail
    const trail = this.scene.add.rectangle(x, y, width, height, color, 0.5);
    trail.setDepth(5);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 150,
      onComplete: () => trail.destroy(),
    });

    // Also spawn some speed lines
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * width,
        y: y + (Math.random() - 0.5) * height * 0.5,
        vx: -Math.sign(this.scene.tweens ? 1 : -1) * (2 + Math.random() * 3),
        vy: (Math.random() - 0.5) * 1,
        life: 8,
        maxLife: 8,
        size: 15 + Math.random() * 10,
        color: PALETTE.DASH_TRAIL,
        gravity: 0,
        type: 'line',
        rotation: 0,
      });
    }
  }

  // Attack swoosh effect
  spawnAttackSwoosh(x: number, y: number, direction: number, isHeavy: boolean) {
    const count = isHeavy ? 8 : 5;
    const spread = isHeavy ? 0.6 : 0.4;

    for (let i = 0; i < count; i++) {
      const baseAngle = direction > 0 ? 0 : Math.PI;
      const angle = baseAngle + (Math.random() - 0.5) * Math.PI * spread;
      const speed = 4 + Math.random() * 4;

      this.particles.push({
        x,
        y: y - 10 + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 6,
        maxLife: 6,
        size: isHeavy ? 20 : 12,
        color: 0xffffff,
        gravity: 0,
        type: 'line',
        rotation: angle,
      });
    }
  }

  // Screen flash
  flashScreen(color: number, intensity: number, duration: number) {
    this.screenFlash.setFillStyle(color);
    this.screenFlash.setAlpha(intensity);

    this.scene.tweens.add({
      targets: this.screenFlash,
      alpha: 0,
      duration,
      ease: 'Power2',
    });
  }

  // Heavy screen shake
  shakeScreen(intensity: number = 0.01, duration: number = 100) {
    this.scene.cameras.main.shake(duration, intensity);
  }

  // Freeze frame effect (hitstop)
  freezeFrame(duration: number) {
    this.scene.time.timeScale = 0;
    this.scene.time.delayedCall(duration, () => {
      this.scene.time.timeScale = 1;
    });
  }
}
