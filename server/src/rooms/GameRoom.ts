import { Room, Client } from '@colyseus/core';
import { GameState, Player } from '../schemas/GameState';
import {
  GAME_CONFIG,
  PLAYER_CONFIG,
  DASH_CONFIG,
  ATTACKS,
  PlayerInput,
  MessageType
} from '@melee/shared';

export class GameRoom extends Room<GameState> {
  private playerIds: string[] = [];
  private inputs: Map<string, PlayerInput> = new Map();
  private fixedTimeStep = 1000 / GAME_CONFIG.TICK_RATE;

  onCreate() {
    this.setState(new GameState());
    this.maxClients = GAME_CONFIG.MAX_PLAYERS;

    // Handle player inputs
    this.onMessage(MessageType.PLAYER_INPUT, (client, input: PlayerInput) => {
      this.inputs.set(client.sessionId, input);
    });

    // Game loop
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.fixedTimeStep);
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined`);

    const player = new Player();
    player.id = client.sessionId;
    
    // Spawn positions
    const playerIndex = this.playerIds.length;
    player.x = playerIndex === 0 ? 150 : GAME_CONFIG.ARENA_WIDTH - 150 - PLAYER_CONFIG.WIDTH;
    player.facing = playerIndex === 0 ? 'right' : 'left';

    this.state.players.set(client.sessionId, player);
    this.playerIds.push(client.sessionId);

    // Start game when 2 players join
    if (this.playerIds.length === 2) {
      this.startCountdown();
    }
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
    this.playerIds = this.playerIds.filter(id => id !== client.sessionId);
    this.inputs.delete(client.sessionId);

    // Reset game if player leaves
    if (this.state.phase === 'fighting') {
      this.state.phase = 'waiting';
    }
  }

  private startCountdown() {
    this.state.phase = 'countdown';
    this.state.countdown = 3;

    const countdownInterval = setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        clearInterval(countdownInterval);
        this.state.phase = 'fighting';
        this.broadcast(MessageType.ROUND_START, { round: this.state.roundNumber });
      }
    }, 1000);
  }

  private update(deltaTime: number) {
    if (this.state.phase !== 'fighting') return;

    const dt = deltaTime / 1000;

    this.state.players.forEach((player, sessionId) => {
      const input = this.inputs.get(sessionId) || this.getEmptyInput();
      this.updatePlayer(player, input, dt);
    });

    // Check for hits
    this.checkCombat();

    // Check for round end
    this.checkRoundEnd();
  }

  private updatePlayer(player: Player, input: PlayerInput, dt: number) {
    // Can't act during hit stun or when dead
    if (player.state === 'hit_stun' || player.state === 'dead') {
      player.stateTimer -= dt * 1000;
      if (player.stateTimer <= 0 && player.state === 'hit_stun') {
        player.state = 'idle';
      }
      this.applyPhysics(player, dt);
      return;
    }

    // Handle attacking states
    if (player.state.startsWith('attacking')) {
      player.currentFrame++;
      const attackType = player.state === 'attacking_light' ? 'light' : 'heavy';
      const attack = ATTACKS[attackType];
      const totalFrames = attack.startupFrames + attack.activeFrames + attack.recoveryFrames;

      if (player.currentFrame >= totalFrames) {
        player.state = 'idle';
        player.currentFrame = 0;
      }
      this.applyPhysics(player, dt);
      return;
    }

    // Handle dashing state
    if (player.state === 'dashing') {
      player.dashTimer -= dt * 1000;
      player.velocityX = player.dashDirection * DASH_CONFIG.SPEED;

      if (player.dashTimer <= 0) {
        player.state = 'idle';
        player.dashTimer = 0;
        player.velocityX = 0;
      }
      this.applyPhysics(player, dt);
      return;
    }

    // Update dash cooldown
    if (player.dashCooldown > 0) {
      player.dashCooldown -= dt * 1000;
    }

    // Regenerate stamina
    player.stamina = Math.min(player.maxStamina, player.stamina + PLAYER_CONFIG.STAMINA_REGEN * dt);

    // Handle movement
    let moveX = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    if (moveX !== 0) {
      player.velocityX = moveX * PLAYER_CONFIG.SPEED;
      player.facing = moveX > 0 ? 'right' : 'left';
      player.state = 'walking';
    } else {
      player.velocityX = 0;
      if (player.grounded) player.state = 'idle';
    }

    // Handle blocking
    if (input.block && player.grounded) {
      player.state = 'blocking';
      player.velocityX = 0;
    }

    // Handle jump
    if (input.jump && player.grounded) {
      player.velocityY = PLAYER_CONFIG.JUMP_FORCE;
      player.grounded = false;
      player.state = 'jumping';
    }

    // Handle attacks
    if (input.lightAttack && player.grounded && player.stamina >= ATTACKS.light.staminaCost) {
      player.state = 'attacking_light';
      player.stamina -= ATTACKS.light.staminaCost;
      player.currentFrame = 0;
      player.velocityX = 0;
    } else if (input.heavyAttack && player.grounded && player.stamina >= ATTACKS.heavy.staminaCost) {
      player.state = 'attacking_heavy';
      player.stamina -= ATTACKS.heavy.staminaCost;
      player.currentFrame = 0;
      player.velocityX = 0;
    }

    // Handle dash
    if (input.dash && player.dashCooldown <= 0 && player.stamina >= DASH_CONFIG.STAMINA_COST) {
      player.state = 'dashing';
      player.stamina -= DASH_CONFIG.STAMINA_COST;
      player.dashTimer = DASH_CONFIG.DURATION;
      player.dashCooldown = DASH_CONFIG.COOLDOWN;
      // Dash in facing direction, or input direction if pressing left/right
      if (input.left) {
        player.dashDirection = -1;
        player.facing = 'left';
      } else if (input.right) {
        player.dashDirection = 1;
        player.facing = 'right';
      } else {
        player.dashDirection = player.facing === 'right' ? 1 : -1;
      }
    }

    this.applyPhysics(player, dt);
  }

  private applyPhysics(player: Player, dt: number) {
    // Gravity
    if (!player.grounded) {
      player.velocityY += PLAYER_CONFIG.GRAVITY * dt;
    }

    // Apply velocity
    player.x += player.velocityX * dt;
    player.y += player.velocityY * dt;

    // Ground collision
    const groundY = GAME_CONFIG.GROUND_Y - PLAYER_CONFIG.HEIGHT;
    if (player.y >= groundY) {
      player.y = groundY;
      player.velocityY = 0;
      player.grounded = true;
      if (player.state === 'jumping') player.state = 'idle';
    }

    // Arena bounds
    player.x = Math.max(0, Math.min(GAME_CONFIG.ARENA_WIDTH - PLAYER_CONFIG.WIDTH, player.x));
  }

  private checkCombat() {
    const players = Array.from(this.state.players.values());
    if (players.length < 2) return;

    players.forEach((attacker) => {
      if (!attacker.state.startsWith('attacking')) return;

      const attackType = attacker.state === 'attacking_light' ? 'light' : 'heavy';
      const attack = ATTACKS[attackType];

      // Check if in active frames
      const isActive = attacker.currentFrame >= attack.startupFrames &&
                       attacker.currentFrame < attack.startupFrames + attack.activeFrames;
      if (!isActive) return;

      // Get hitbox position
      const hitbox = {
        x: attacker.facing === 'right' 
          ? attacker.x + attack.hitbox.offsetX 
          : attacker.x + PLAYER_CONFIG.WIDTH - attack.hitbox.offsetX - attack.hitbox.width,
        y: attacker.y + PLAYER_CONFIG.HEIGHT / 2 + attack.hitbox.offsetY,
        width: attack.hitbox.width,
        height: attack.hitbox.height,
      };

      players.forEach((defender) => {
        if (defender.id === attacker.id) return;
        if (defender.state === 'hit_stun' || defender.state === 'dead') return;
        if (this.isInvincible(defender)) return;

        // Simple AABB collision
        const defenderBox = {
          x: defender.x,
          y: defender.y,
          width: PLAYER_CONFIG.WIDTH,
          height: PLAYER_CONFIG.HEIGHT,
        };

        if (this.checkCollision(hitbox, defenderBox)) {
          this.applyHit(attacker, defender, attack);
        }
      });
    });
  }

  private checkCollision(a: {x: number, y: number, width: number, height: number},
                         b: {x: number, y: number, width: number, height: number}): boolean {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  private isInvincible(player: Player): boolean {
    if (player.state !== 'dashing') return false;
    // Calculate elapsed time in dash (DURATION - remaining)
    const elapsedInDash = DASH_CONFIG.DURATION - player.dashTimer;
    return elapsedInDash >= DASH_CONFIG.I_FRAME_START && elapsedInDash <= DASH_CONFIG.I_FRAME_END;
  }

  private applyHit(attacker: Player, defender: Player, attack: typeof ATTACKS.light) {
    // Check if blocking
    if (defender.state === 'blocking') {
      defender.stamina -= attack.staminaCost * 1.5; // Chip stamina damage
      this.broadcast(MessageType.PLAYER_HIT, { 
        defenderId: defender.id, 
        blocked: true,
        damage: 0 
      });
      return;
    }

    // Apply damage
    defender.health -= attack.damage;
    defender.state = 'hit_stun';
    defender.stateTimer = PLAYER_CONFIG.HIT_STUN_DURATION;

    // Apply knockback
    const knockbackDir = attacker.facing === 'right' ? 1 : -1;
    defender.velocityX = attack.knockbackX * knockbackDir;
    defender.velocityY = attack.knockbackY;
    defender.grounded = false;

    this.broadcast(MessageType.PLAYER_HIT, { 
      defenderId: defender.id, 
      blocked: false,
      damage: attack.damage 
    });

    // Reset attacker's attack frame to prevent multi-hit
    attacker.currentFrame = ATTACKS[attack.type].startupFrames + ATTACKS[attack.type].activeFrames;
  }

  private checkRoundEnd() {
    const players = Array.from(this.state.players.values());
    const deadPlayer = players.find(p => p.health <= 0);

    if (deadPlayer) {
      deadPlayer.state = 'dead';
      const winner = players.find(p => p.id !== deadPlayer.id);
      
      // Update wins
      const winnerIndex = this.playerIds.indexOf(winner!.id);
      if (winnerIndex === 0) {
        this.state.player1Wins++;
      } else {
        this.state.player2Wins++;
      }

      this.state.phase = 'round_end';
      this.broadcast(MessageType.ROUND_END, { 
        winnerId: winner?.id,
        player1Wins: this.state.player1Wins,
        player2Wins: this.state.player2Wins
      });

      // Check for match end or start new round
      setTimeout(() => {
        if (this.state.player1Wins >= GAME_CONFIG.ROUNDS_TO_WIN || 
            this.state.player2Wins >= GAME_CONFIG.ROUNDS_TO_WIN) {
          this.state.phase = 'match_end';
          this.broadcast(MessageType.MATCH_END, { 
            winnerId: winner?.id 
          });
        } else {
          this.resetRound();
        }
      }, 2000);
    }
  }

  private resetRound() {
    this.state.roundNumber++;
    
    let index = 0;
    this.state.players.forEach((player) => {
      player.health = PLAYER_CONFIG.MAX_HEALTH;
      player.stamina = PLAYER_CONFIG.MAX_STAMINA;
      player.state = 'idle';
      player.x = index === 0 ? 150 : GAME_CONFIG.ARENA_WIDTH - 150 - PLAYER_CONFIG.WIDTH;
      player.y = GAME_CONFIG.GROUND_Y - PLAYER_CONFIG.HEIGHT;
      player.velocityX = 0;
      player.velocityY = 0;
      player.facing = index === 0 ? 'right' : 'left';
      index++;
    });

    this.startCountdown();
  }

  private getEmptyInput(): PlayerInput {
    return {
      left: false,
      right: false,
      jump: false,
      lightAttack: false,
      heavyAttack: false,
      block: false,
      dash: false,
      sequence: 0,
    };
  }
}
