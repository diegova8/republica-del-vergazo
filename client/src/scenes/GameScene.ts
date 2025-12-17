import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { GAME_CONFIG, MessageType, PlayerInput } from '@melee/shared';
import { PlayerEntity } from '../entities/PlayerEntity';
import { EffectsManager, PALETTE } from '../effects/EffectsManager';

export class GameScene extends Phaser.Scene {
  private client!: Colyseus.Client;
  private room?: Colyseus.Room;
  private players: Map<string, PlayerEntity> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKeys!: {
    light: Phaser.Input.Keyboard.Key;
    heavy: Phaser.Input.Keyboard.Key;
    block: Phaser.Input.Keyboard.Key;
    dash: Phaser.Input.Keyboard.Key;
  };
  public localPlayerId?: string;
  private inputSequence = 0;

  // Effects
  private effects!: EffectsManager;

  // UI elements
  private statusText!: Phaser.GameObjects.Text;
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private countdownText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // We use procedural graphics, no assets needed
  }

  create() {
    // Set background color
    this.cameras.main.setBackgroundColor(PALETTE.SKY_TOP);

    // Initialize effects manager
    this.effects = new EffectsManager(this);

    // Draw arena
    this.drawArena();

    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKeys = {
      light: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      heavy: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      block: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      dash: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };

    // Create UI
    this.createUI();

    // Connect to server
    this.connectToServer();
  }

  private drawArena() {
    const graphics = this.add.graphics();
    graphics.setDepth(0);

    // Sky gradient (fake it with rectangles)
    const gradientSteps = 10;
    const stepHeight = GAME_CONFIG.GROUND_Y / gradientSteps;
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / gradientSteps;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(PALETTE.SKY_TOP),
        Phaser.Display.Color.IntegerToColor(PALETTE.SKY_BOTTOM),
        100,
        t * 100
      );
      graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      graphics.fillRect(0, i * stepHeight, GAME_CONFIG.ARENA_WIDTH, stepHeight + 1);
    }

    // Background elements - distant city silhouette
    graphics.fillStyle(0x1e293b);
    this.drawCitySilhouette(graphics, 0.3);
    graphics.fillStyle(0x334155);
    this.drawCitySilhouette(graphics, 0.5);

    // Ground platform
    graphics.fillStyle(PALETTE.GROUND);
    graphics.fillRect(0, GAME_CONFIG.GROUND_Y, GAME_CONFIG.ARENA_WIDTH, 100);

    // Ground top edge (lighter)
    graphics.fillStyle(PALETTE.GROUND_TOP);
    graphics.fillRect(0, GAME_CONFIG.GROUND_Y, GAME_CONFIG.ARENA_WIDTH, 4);

    // Ground texture (pixel grid pattern)
    graphics.fillStyle(0x4b5563);
    for (let x = 0; x < GAME_CONFIG.ARENA_WIDTH; x += 16) {
      for (let y = GAME_CONFIG.GROUND_Y + 8; y < GAME_CONFIG.GROUND_Y + 100; y += 16) {
        if ((x / 16 + y / 16) % 2 === 0) {
          graphics.fillRect(x, y, 8, 8);
        }
      }
    }

    // Arena border lines
    graphics.lineStyle(2, 0x64748b);
    graphics.lineBetween(0, GAME_CONFIG.GROUND_Y, GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.GROUND_Y);

    // Side boundaries (subtle)
    graphics.lineStyle(1, 0x475569);
    graphics.lineBetween(20, GAME_CONFIG.GROUND_Y - 200, 20, GAME_CONFIG.GROUND_Y);
    graphics.lineBetween(
      GAME_CONFIG.ARENA_WIDTH - 20,
      GAME_CONFIG.GROUND_Y - 200,
      GAME_CONFIG.ARENA_WIDTH - 20,
      GAME_CONFIG.GROUND_Y
    );
  }

  private drawCitySilhouette(graphics: Phaser.GameObjects.Graphics, scale: number) {
    const baseY = GAME_CONFIG.GROUND_Y;
    const heights = [60, 100, 45, 120, 70, 90, 55, 110, 65, 85, 40, 95];

    let x = 0;
    for (const h of heights) {
      const buildingWidth = 50 + Math.random() * 30;
      const buildingHeight = h * scale;
      graphics.fillRect(x, baseY - buildingHeight, buildingWidth, buildingHeight);

      // Windows (small dots)
      const windowSize = 2;
      for (let wy = baseY - buildingHeight + 8; wy < baseY - 4; wy += 12) {
        for (let wx = x + 6; wx < x + buildingWidth - 6; wx += 10) {
          if (Math.random() > 0.3) {
            graphics.fillStyle(0xfef08a, 0.3);
            graphics.fillRect(wx, wy, windowSize, windowSize);
          }
        }
      }
      graphics.fillStyle(scale < 0.4 ? 0x1e293b : 0x334155);

      x += buildingWidth + 5;
      if (x > GAME_CONFIG.ARENA_WIDTH) break;
    }
  }

  private createUI() {
    // UI Graphics layer
    this.uiGraphics = this.add.graphics();
    this.uiGraphics.setDepth(150);

    // Status text (center) - retro pixel font style
    this.statusText = this.add
      .text(GAME_CONFIG.ARENA_WIDTH / 2, 80, 'CONNECTING...', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#f8fafc',
        stroke: '#0f172a',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Big countdown text
    this.countdownText = this.add
      .text(GAME_CONFIG.ARENA_WIDTH / 2, GAME_CONFIG.ARENA_HEIGHT / 2 - 50, '', {
        fontSize: '64px',
        fontFamily: 'monospace',
        color: '#fef08a',
        stroke: '#0f172a',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(160);

    // Controls hint
    this.add
      .text(
        10,
        GAME_CONFIG.ARENA_HEIGHT - 25,
        '[ARROWS] Move  [Z] Light  [X] Heavy  [C] Block  [SHIFT] Dash',
        {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#64748b',
        }
      )
      .setDepth(150);

    // VS text in center
    this.add
      .text(GAME_CONFIG.ARENA_WIDTH / 2, 30, 'VS', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#475569',
        stroke: '#0f172a',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(150);
  }

  private async connectToServer() {
    try {
      // Auto-detect WebSocket URL based on current host
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const serverUrl = isLocal
        ? 'ws://localhost:3001'
        : `${protocol}//${window.location.host}`;
      this.client = new Colyseus.Client(serverUrl);

      this.statusText.setText('SEARCHING...');
      this.room = await this.client.joinOrCreate('game');
      this.localPlayerId = this.room.sessionId;

      console.log('Joined room:', this.room.id);
      this.setupRoomListeners();
    } catch (error) {
      console.error('Connection error:', error);
      this.statusText.setText('CONNECTION FAILED');
    }
  }

  private setupRoomListeners() {
    if (!this.room) return;

    // Player added
    this.room.state.players.onAdd((player: any, sessionId: string) => {
      console.log('Player added:', sessionId);
      const isLocal = sessionId === this.localPlayerId;
      const entity = new PlayerEntity(this, player, isLocal, this.effects);
      this.players.set(sessionId, entity);
    });

    // Player removed
    this.room.state.players.onRemove((_: any, sessionId: string) => {
      console.log('Player removed:', sessionId);
      const entity = this.players.get(sessionId);
      if (entity) {
        entity.destroy();
        this.players.delete(sessionId);
      }
    });

    // Game phase changes
    this.room.state.listen('phase', (phase: string) => {
      this.handlePhaseChange(phase);
    });

    this.room.state.listen('countdown', (count: number) => {
      if (this.room?.state.phase === 'countdown') {
        if (count > 0) {
          this.countdownText.setText(count.toString());
          this.countdownText.setScale(1.5);
          this.tweens.add({
            targets: this.countdownText,
            scale: 1,
            duration: 300,
            ease: 'Back.out',
          });
        } else {
          this.countdownText.setText('FIGHT!');
          this.countdownText.setStyle({ color: '#ef4444' });
          this.effects.flashScreen(0xfef08a, 0.4, 200);
          this.effects.shakeScreen(0.01, 200);
          this.time.delayedCall(500, () => {
            this.countdownText.setText('');
            this.countdownText.setStyle({ color: '#fef08a' });
          });
        }
      }
    });

    // Game messages
    this.room.onMessage(MessageType.PLAYER_HIT, (data) => {
      this.handlePlayerHit(data);
    });

    this.room.onMessage(MessageType.ROUND_END, (data) => {
      const isWinner = data.winnerId === this.localPlayerId;
      this.countdownText.setText(isWinner ? 'K.O.!' : 'DEFEAT');
      this.countdownText.setStyle({ color: isWinner ? '#22c55e' : '#ef4444' });

      this.statusText.setText(`ROUND ${this.room?.state.roundNumber}\n${data.player1Wins} - ${data.player2Wins}`);

      if (!isWinner) {
        this.effects.shakeScreen(0.02, 500);
      }
    });

    this.room.onMessage(MessageType.MATCH_END, (data) => {
      const isWinner = data.winnerId === this.localPlayerId;
      this.countdownText.setText(isWinner ? 'VICTORY!' : 'GAME OVER');
      this.countdownText.setStyle({ color: isWinner ? '#fef08a' : '#ef4444' });

      if (isWinner) {
        this.effects.flashScreen(0xfef08a, 0.5, 500);
      }
    });
  }

  private handlePhaseChange(phase: string) {
    switch (phase) {
      case 'waiting':
        this.statusText.setText('WAITING FOR OPPONENT...');
        this.countdownText.setText('');
        break;
      case 'countdown':
        this.statusText.setText('');
        break;
      case 'fighting':
        this.statusText.setText('');
        this.countdownText.setText('');
        break;
      case 'round_end':
        // Handled by ROUND_END message
        break;
      case 'match_end':
        // Handled by MATCH_END message
        break;
    }
  }

  private handlePlayerHit(data: { defenderId: string; blocked: boolean; damage: number }) {
    const entity = this.players.get(data.defenderId);
    if (entity) {
      entity.showHitEffect(data.blocked);
    }
  }

  update() {
    // Update effects
    this.effects.update();

    // Update health bars UI
    this.updateHealthBars();

    if (!this.room || this.room.state.phase !== 'fighting') return;

    // Gather input
    const input: PlayerInput = {
      left: this.cursors.left?.isDown ?? false,
      right: this.cursors.right?.isDown ?? false,
      jump: this.cursors.up?.isDown ?? false,
      lightAttack: Phaser.Input.Keyboard.JustDown(this.attackKeys.light),
      heavyAttack: Phaser.Input.Keyboard.JustDown(this.attackKeys.heavy),
      block: this.attackKeys.block.isDown,
      dash: Phaser.Input.Keyboard.JustDown(this.attackKeys.dash),
      sequence: this.inputSequence++,
    };

    // Send input to server
    this.room.send(MessageType.PLAYER_INPUT, input);

    // Update player entities
    this.players.forEach((entity) => entity.update());
  }

  private updateHealthBars() {
    this.uiGraphics.clear();

    const barWidth = 280;
    const barHeight = 16;
    const barY = 15;
    const staminaHeight = 6;
    const padding = 20;

    let playerIndex = 0;
    this.room?.state.players.forEach((player: any) => {
      const isLeft = playerIndex === 0;
      const barX = isLeft ? padding : GAME_CONFIG.ARENA_WIDTH - barWidth - padding;

      // Health bar background
      this.uiGraphics.fillStyle(0x0f172a);
      this.uiGraphics.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

      // Health bar border
      this.uiGraphics.lineStyle(2, 0x64748b);
      this.uiGraphics.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

      // Health fill
      const healthPercent = player.health / player.maxHealth;
      let healthColor = PALETTE.HEALTH_FULL;
      if (healthPercent <= 0.3) {
        healthColor = PALETTE.HEALTH_LOW;
      } else if (healthPercent <= 0.6) {
        healthColor = PALETTE.HEALTH_MID;
      }

      // Health bar fills from center outward or from sides
      if (isLeft) {
        this.uiGraphics.fillStyle(healthColor);
        this.uiGraphics.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      } else {
        this.uiGraphics.fillStyle(healthColor);
        const healthWidth = barWidth * healthPercent;
        this.uiGraphics.fillRect(barX + barWidth - healthWidth, barY, healthWidth, barHeight);
      }

      // Health segments (pixel style)
      this.uiGraphics.fillStyle(0x0f172a, 0.3);
      for (let i = 1; i < 10; i++) {
        this.uiGraphics.fillRect(barX + (barWidth / 10) * i - 1, barY, 2, barHeight);
      }

      // Stamina bar below
      const staminaY = barY + barHeight + 6;
      this.uiGraphics.fillStyle(0x0f172a);
      this.uiGraphics.fillRect(barX, staminaY, barWidth, staminaHeight);

      const staminaPercent = player.stamina / player.maxStamina;
      this.uiGraphics.fillStyle(PALETTE.STAMINA);
      if (isLeft) {
        this.uiGraphics.fillRect(barX, staminaY, barWidth * staminaPercent, staminaHeight);
      } else {
        const staminaWidth = barWidth * staminaPercent;
        this.uiGraphics.fillRect(barX + barWidth - staminaWidth, staminaY, staminaWidth, staminaHeight);
      }

      // Player label
      const labelX = isLeft ? barX - 2 : barX + barWidth + 2;

      // Draw label background
      this.uiGraphics.fillStyle(playerIndex === 0 ? PALETTE.P1_MAIN : PALETTE.P2_MAIN);
      if (isLeft) {
        this.uiGraphics.fillRect(labelX - 25, barY - 2, 24, barHeight + staminaHeight + 10);
      } else {
        this.uiGraphics.fillRect(labelX + 1, barY - 2, 24, barHeight + staminaHeight + 10);
      }

      playerIndex++;
    });
  }
}
