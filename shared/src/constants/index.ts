import { AttackData } from '../types';

// Game settings
export const GAME_CONFIG = {
  TICK_RATE: 60, // Server updates per second
  ARENA_WIDTH: 800,
  ARENA_HEIGHT: 600,
  GROUND_Y: 500,
  MAX_PLAYERS: 2,
  ROUNDS_TO_WIN: 2,
} as const;

// Player settings
export const PLAYER_CONFIG = {
  WIDTH: 50,
  HEIGHT: 80,
  SPEED: 300,
  JUMP_FORCE: -500,
  GRAVITY: 1200,
  MAX_HEALTH: 100,
  MAX_STAMINA: 100,
  STAMINA_REGEN: 20, // Per second
  HIT_STUN_DURATION: 300, // ms
} as const;

// Dash settings
export const DASH_CONFIG = {
  SPEED: 600, // Pixels per second (2x normal speed)
  DURATION: 150, // ms - total dash time
  COOLDOWN: 500, // ms - time before can dash again
  I_FRAME_START: 30, // ms - when invincibility starts
  I_FRAME_END: 120, // ms - when invincibility ends
  STAMINA_COST: 15,
} as const;

// Attack definitions
export const ATTACKS: Record<'light' | 'heavy', AttackData> = {
  light: {
    type: 'light',
    damage: 10,
    knockbackX: 150,
    knockbackY: -100,
    startupFrames: 3,
    activeFrames: 4,
    recoveryFrames: 6,
    staminaCost: 10,
    hitbox: {
      offsetX: 40,
      offsetY: -20,
      width: 60,
      height: 50,
    },
  },
  heavy: {
    type: 'heavy',
    damage: 25,
    knockbackX: 300,
    knockbackY: -200,
    startupFrames: 8,
    activeFrames: 5,
    recoveryFrames: 15,
    staminaCost: 25,
    hitbox: {
      offsetX: 35,
      offsetY: -30,
      width: 80,
      height: 70,
    },
  },
} as const;

// Input buffer (for rollback netcode later)
export const INPUT_BUFFER_SIZE = 60;
