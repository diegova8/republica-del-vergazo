// Player state
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  facing: 'left' | 'right';
  state: PlayerActionState;
  velocityX: number;
  velocityY: number;
}

export type PlayerActionState =
  | 'idle'
  | 'walking'
  | 'jumping'
  | 'dashing'
  | 'attacking_light'
  | 'attacking_heavy'
  | 'blocking'
  | 'hit_stun'
  | 'knocked_down'
  | 'dead';

// Input from client to server
export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  lightAttack: boolean;
  heavyAttack: boolean;
  block: boolean;
  dash: boolean;
  sequence: number; // For input reconciliation
}

// Attack data
export interface AttackData {
  type: 'light' | 'heavy';
  damage: number;
  knockbackX: number;
  knockbackY: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  staminaCost: number;
  hitbox: HitboxData;
}

export interface HitboxData {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

// Messages
export enum MessageType {
  PLAYER_INPUT = 'player_input',
  GAME_STATE = 'game_state',
  PLAYER_HIT = 'player_hit',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',
  MATCH_END = 'match_end',
}

export interface GameStateMessage {
  players: Record<string, PlayerState>;
  timestamp: number;
}
