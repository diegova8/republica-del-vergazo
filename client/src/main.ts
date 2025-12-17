import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { GAME_CONFIG } from '@melee/shared';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.ARENA_WIDTH,
  height: GAME_CONFIG.ARENA_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // We handle gravity server-side
      debug: true, // Set to false in production
    },
  },
  scene: [GameScene],
};

new Phaser.Game(config);
