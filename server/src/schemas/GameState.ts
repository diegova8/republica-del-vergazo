import { Schema, type, MapSchema } from '@colyseus/schema';
import { PLAYER_CONFIG, GAME_CONFIG } from '@melee/shared';
import type { PlayerActionState } from '@melee/shared';

export class Player extends Schema {
  @type('string') id: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = GAME_CONFIG.GROUND_Y - PLAYER_CONFIG.HEIGHT;
  @type('number') health: number = PLAYER_CONFIG.MAX_HEALTH;
  @type('number') maxHealth: number = PLAYER_CONFIG.MAX_HEALTH;
  @type('number') stamina: number = PLAYER_CONFIG.MAX_STAMINA;
  @type('number') maxStamina: number = PLAYER_CONFIG.MAX_STAMINA;
  @type('string') facing: 'left' | 'right' = 'right';
  @type('string') state: PlayerActionState = 'idle';
  @type('number') velocityX: number = 0;
  @type('number') velocityY: number = 0;

  // Server-side only (not synced)
  stateTimer: number = 0;
  currentFrame: number = 0;
  grounded: boolean = true;
  dashTimer: number = 0; // Remaining dash duration
  dashCooldown: number = 0; // Time until can dash again
  dashDirection: number = 1; // 1 = right, -1 = left
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type('string') phase: 'waiting' | 'countdown' | 'fighting' | 'round_end' | 'match_end' = 'waiting';
  @type('number') roundNumber: number = 1;
  @type('number') player1Wins: number = 0;
  @type('number') player2Wins: number = 0;
  @type('number') countdown: number = 3;
}
