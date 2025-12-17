import Phaser from 'phaser';
import { PLAYER_CONFIG, GAME_CONFIG } from '@melee/shared';
import { PALETTE, EffectsManager } from '../effects/EffectsManager';

// Pixel size for our 8-bit style
const PX = 4;

export class PlayerEntity {
  private scene: Phaser.Scene;
  private serverState: any;
  private effects: EffectsManager;

  // Container for all player graphics
  private container: Phaser.GameObjects.Container;
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private shadowGraphics: Phaser.GameObjects.Graphics;

  // Animation state
  private animFrame: number = 0;
  private animTimer: number = 0;
  private lastState: string = 'idle';
  private lastX: number = 0;
  private lastY: number = 0;
  private wasGrounded: boolean = true;

  // Colors for this player
  private colors: { main: number; light: number; dark: number; skin: number };

  // Hit effect
  private hitTween?: Phaser.Tweens.Tween;
  private isFlashing: boolean = false;

  constructor(scene: Phaser.Scene, serverState: any, isLocal: boolean, effects: EffectsManager) {
    this.scene = scene;
    this.serverState = serverState;
    this.effects = effects;

    // Set color palette based on player
    this.colors = isLocal
      ? { main: PALETTE.P1_MAIN, light: PALETTE.P1_LIGHT, dark: PALETTE.P1_DARK, skin: PALETTE.P1_SKIN }
      : { main: PALETTE.P2_MAIN, light: PALETTE.P2_LIGHT, dark: PALETTE.P2_DARK, skin: PALETTE.P2_SKIN };

    // Create shadow
    this.shadowGraphics = scene.add.graphics();
    this.shadowGraphics.setDepth(1);

    // Create container at player position
    this.container = scene.add.container(
      serverState.x + PLAYER_CONFIG.WIDTH / 2,
      serverState.y + PLAYER_CONFIG.HEIGHT / 2
    );
    this.container.setDepth(10);

    // Create graphics for the body
    this.bodyGraphics = scene.add.graphics();
    this.container.add(this.bodyGraphics);

    // Store initial position
    this.lastX = serverState.x;
    this.lastY = serverState.y;

    // Draw initial state
    this.drawCharacter('idle', 0);

    // Listen to state changes
    this.setupStateListeners();
  }

  private setupStateListeners() {
    this.serverState.listen('x', (value: number) => {
      const dx = value - this.lastX;
      this.container.x = value + PLAYER_CONFIG.WIDTH / 2;

      // Spawn dust when moving on ground
      if (Math.abs(dx) > 2 && this.serverState.state === 'walking') {
        if (Math.random() > 0.7) {
          this.effects.spawnDust(
            this.container.x,
            GAME_CONFIG.GROUND_Y,
            dx > 0 ? -1 : 1
          );
        }
      }

      this.lastX = value;
    });

    this.serverState.listen('y', (value: number) => {
      const prevY = this.lastY;
      this.container.y = value + PLAYER_CONFIG.HEIGHT / 2;

      // Check for landing
      const isNowGrounded = value >= GAME_CONFIG.GROUND_Y - PLAYER_CONFIG.HEIGHT - 5;
      if (isNowGrounded && !this.wasGrounded && prevY < value) {
        // Just landed!
        this.effects.spawnDust(this.container.x, GAME_CONFIG.GROUND_Y, 0);
        this.effects.shakeScreen(0.003, 50);
      }
      this.wasGrounded = isNowGrounded;
      this.lastY = value;
    });

    this.serverState.listen('state', (value: string) => {
      this.handleStateChange(value);
    });

    this.serverState.listen('facing', (value: string) => {
      this.container.scaleX = value === 'right' ? 1 : -1;
    });
  }

  private handleStateChange(newState: string) {
    // Spawn effects on state transitions
    if (newState !== this.lastState) {
      // Attack swoosh
      if (newState === 'attacking_light' || newState === 'attacking_heavy') {
        const dir = this.container.scaleX;
        this.effects.spawnAttackSwoosh(
          this.container.x + dir * 30,
          this.container.y - 10,
          dir,
          newState === 'attacking_heavy'
        );
      }

      // Dash trail
      if (newState === 'dashing') {
        this.spawnDashTrail();
      }

      // Reset animation on state change
      if (newState !== this.lastState) {
        this.animFrame = 0;
        this.animTimer = 0;
      }

      this.lastState = newState;
    }

    // Redraw character
    if (!this.isFlashing) {
      this.drawCharacter(newState, this.animFrame);
    }
  }

  private spawnDashTrail() {
    // Create multiple afterimages during dash
    const interval = this.scene.time.addEvent({
      delay: 30,
      callback: () => {
        if (this.serverState.state === 'dashing') {
          this.effects.spawnDashTrail(
            this.container.x,
            this.container.y,
            PLAYER_CONFIG.WIDTH,
            PLAYER_CONFIG.HEIGHT,
            this.colors.main
          );
        } else {
          interval.destroy();
        }
      },
      repeat: 5,
    });
  }

  private drawCharacter(state: string, frame: number) {
    const g = this.bodyGraphics;
    g.clear();

    // Character dimensions in pixels
    const w = Math.floor(PLAYER_CONFIG.WIDTH / PX);
    const h = Math.floor(PLAYER_CONFIG.HEIGHT / PX);
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);

    // Offset to center the character
    const ox = -halfW * PX;
    const oy = -halfH * PX;

    // Get colors based on state
    let mainColor = this.colors.main;
    let lightColor = this.colors.light;
    let darkColor = this.colors.dark;
    let skinColor = this.colors.skin;
    let alpha = 1;

    switch (state) {
      case 'attacking_light':
      case 'attacking_heavy':
        lightColor = 0xfef08a;
        break;
      case 'blocking':
        mainColor = 0x64748b;
        lightColor = 0x94a3b8;
        darkColor = 0x475569;
        break;
      case 'hit_stun':
        mainColor = 0xfb923c;
        lightColor = 0xfdba74;
        darkColor = 0xea580c;
        break;
      case 'dashing':
        alpha = 0.7;
        lightColor = 0x7dd3fc;
        break;
      case 'dead':
        mainColor = 0x4b5563;
        lightColor = 0x6b7280;
        darkColor = 0x374151;
        skinColor = 0x9ca3af;
        break;
    }

    // Draw the pixel art character
    this.drawPixelFighter(g, ox, oy, w, h, mainColor, lightColor, darkColor, skinColor, state, frame, alpha);

    // Update shadow
    this.drawShadow();
  }

  private drawPixelFighter(
    g: Phaser.GameObjects.Graphics,
    ox: number,
    oy: number,
    _w: number,
    _h: number,
    main: number,
    light: number,
    dark: number,
    skin: number,
    state: string,
    _frame: number,
    alpha: number
  ) {
    // Helper to draw a pixel
    const px = (x: number, y: number, color: number) => {
      g.fillStyle(color, alpha);
      g.fillRect(ox + x * PX, oy + y * PX, PX, PX);
    };

    // Animation offsets
    let headBob = 0;
    let armOffset = 0;
    let legOffset = 0;

    if (state === 'walking') {
      headBob = Math.sin(this.animTimer * 0.3) > 0 ? -1 : 0;
      legOffset = Math.floor(Math.sin(this.animTimer * 0.3) * 2);
    } else if (state === 'jumping') {
      armOffset = -2;
    } else if (state === 'attacking_light') {
      armOffset = 4;
    } else if (state === 'attacking_heavy') {
      armOffset = 6;
    } else if (state === 'blocking') {
      armOffset = -1;
    } else if (state === 'hit_stun') {
      headBob = -1;
    }

    // === HEAD (4x4 pixels) ===
    const headY = 1 + headBob;
    const headX = 4;
    // Hair/helmet
    for (let i = 0; i < 4; i++) {
      px(headX + i, headY, dark);
    }
    // Face
    for (let i = 0; i < 4; i++) {
      px(headX + i, headY + 1, skin);
    }
    px(headX, headY + 1, dark); // Side of head
    px(headX + 3, headY + 1, dark);
    // Eyes
    px(headX + 1, headY + 1, 0x1e293b);
    px(headX + 2, headY + 1, 0x1e293b);
    // Lower face
    px(headX, headY + 2, dark);
    px(headX + 1, headY + 2, skin);
    px(headX + 2, headY + 2, skin);
    px(headX + 3, headY + 2, dark);
    // Chin
    px(headX + 1, headY + 3, skin);
    px(headX + 2, headY + 3, skin);

    // === BODY (6x6 pixels) ===
    const bodyY = 5;
    const bodyX = 3;
    // Shoulders
    px(bodyX, bodyY, light);
    px(bodyX + 5, bodyY, light);
    for (let i = 1; i < 5; i++) {
      px(bodyX + i, bodyY, main);
    }
    // Torso
    for (let y = 1; y < 4; y++) {
      px(bodyX, bodyY + y, dark);
      for (let i = 1; i < 5; i++) {
        px(bodyX + i, bodyY + y, main);
      }
      px(bodyX + 5, bodyY + y, dark);
    }
    // Belt
    for (let i = 0; i < 6; i++) {
      px(bodyX + i, bodyY + 4, dark);
    }
    // Detail - chest emblem
    px(bodyX + 2, bodyY + 1, light);
    px(bodyX + 3, bodyY + 1, light);
    px(bodyX + 2, bodyY + 2, light);
    px(bodyX + 3, bodyY + 2, light);

    // === ARMS ===
    const armY = 6;
    // Left arm (fixed, slightly behind)
    px(bodyX - 1, armY, skin);
    px(bodyX - 1, armY + 1, main);
    px(bodyX - 1, armY + 2, skin);

    // Right arm (animated for attacks)
    const rightArmX = bodyX + 6 + Math.max(0, armOffset);
    px(rightArmX, armY, skin);
    if (armOffset > 0) {
      // Extended arm for attack
      for (let i = 1; i <= armOffset; i++) {
        px(bodyX + 5 + i, armY + 1, skin);
      }
      // Fist
      px(rightArmX, armY + 1, skin);
      px(rightArmX + 1, armY + 1, 0xfef08a); // Attack glow
    } else {
      px(rightArmX, armY + 1, main);
      px(rightArmX, armY + 2, skin);
    }

    // === LEGS (2x5 each) ===
    const legY = 10;
    // Left leg
    const leftLegX = 4 + Math.min(0, legOffset);
    for (let y = 0; y < 4; y++) {
      px(leftLegX, legY + y, dark);
      px(leftLegX + 1, legY + y, main);
    }
    // Left foot
    px(leftLegX, legY + 4, 0x1e293b);
    px(leftLegX + 1, legY + 4, 0x1e293b);
    px(leftLegX - 1, legY + 4, 0x1e293b);

    // Right leg
    const rightLegX = 6 + Math.max(0, legOffset);
    for (let y = 0; y < 4; y++) {
      px(rightLegX, legY + y, main);
      px(rightLegX + 1, legY + y, dark);
    }
    // Right foot
    px(rightLegX, legY + 4, 0x1e293b);
    px(rightLegX + 1, legY + 4, 0x1e293b);
    px(rightLegX + 2, legY + 4, 0x1e293b);

    // === BLOCKING SHIELD ===
    if (state === 'blocking') {
      const shieldX = bodyX + 6;
      const shieldY = 4;
      // Shield
      for (let y = 0; y < 7; y++) {
        px(shieldX, shieldY + y, 0x94a3b8);
        px(shieldX + 1, shieldY + y, 0xf1f5f9);
        if (y > 0 && y < 6) {
          px(shieldX + 2, shieldY + y, 0x94a3b8);
        }
      }
    }
  }

  private drawShadow() {
    this.shadowGraphics.clear();

    // Calculate shadow position (on ground)
    const shadowY = GAME_CONFIG.GROUND_Y;
    const heightAboveGround = shadowY - (this.container.y + PLAYER_CONFIG.HEIGHT / 2);
    const shadowScale = Math.max(0.3, 1 - heightAboveGround / 200);

    this.shadowGraphics.fillStyle(0x000000, 0.3 * shadowScale);
    this.shadowGraphics.fillEllipse(
      this.container.x,
      shadowY - 2,
      PLAYER_CONFIG.WIDTH * shadowScale,
      8 * shadowScale
    );
  }

  showHitEffect(blocked: boolean) {
    // Cancel existing tween
    if (this.hitTween) {
      this.hitTween.stop();
    }

    // Spawn particles
    const hitX = this.container.x;
    const hitY = this.container.y - PLAYER_CONFIG.HEIGHT / 4;
    const dir = this.container.scaleX;
    this.effects.spawnHitSparks(hitX, hitY, -dir, blocked);

    // Flash white
    this.isFlashing = true;
    this.bodyGraphics.clear();
    this.drawFlashCharacter();

    // Screen shake for unblocked hits
    if (!blocked) {
      this.effects.shakeScreen(0.015, 150);
    }

    // Return to normal after flash
    this.hitTween = this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0.5, to: 1 },
      duration: 80,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.isFlashing = false;
        this.drawCharacter(this.serverState.state, this.animFrame);
      },
    });
  }

  private drawFlashCharacter() {
    const g = this.bodyGraphics;
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(
      -PLAYER_CONFIG.WIDTH / 2,
      -PLAYER_CONFIG.HEIGHT / 2,
      PLAYER_CONFIG.WIDTH,
      PLAYER_CONFIG.HEIGHT
    );
  }

  update() {
    // Update animation timer
    this.animTimer++;
    if (this.animTimer % 8 === 0) {
      this.animFrame = (this.animFrame + 1) % 4;
      if (!this.isFlashing) {
        this.drawCharacter(this.serverState.state, this.animFrame);
      }
    }
  }

  getX(): number {
    return this.container.x;
  }

  getY(): number {
    return this.container.y;
  }

  destroy() {
    this.container.destroy();
    this.shadowGraphics.destroy();
  }
}
