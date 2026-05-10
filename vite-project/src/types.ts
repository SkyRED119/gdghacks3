export interface GameState {
    player: {
        x: number; y: number; width: number; height: number;
        vx: number; vy: number; accel: number; friction: number; maxSpeed: number;
        lastAttack: number;
    };
    dummy: { x: number; y: number; width: number; height: number; hp: number; maxHp: number; isDead: boolean; respawnTimer: number; };
    currency: number;
    worldWidth: number;
    worldHeight: number;
    keys: Record<string, boolean>;
}