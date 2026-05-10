export {};

// --- 1. Types & Interfaces ---
export interface Vector2 { x: number; y: number; }
export interface Rect extends Vector2 { width: number; height: number; }

export interface Weapon extends Rect {
    id: number;
    name: string;
    price: number;
    damage: number;
    speed: number;
    color: string;
    range: number; // New property: pixels of extra reach
}

export interface Player extends Rect {
    vx: number;
    vy: number;
    accel: number;
    friction: number;
    maxSpeed: number;
    color: string;
    lastAttack: number;
    hp: number;
    maxHp: number;
}

export interface Dummy extends Rect {
    hp: number;
    maxHp: number;
    isDead: boolean;
    respawnTimer: number;
}

export interface RemotePlayer {
    x: number;
    y: number;
    color: string;
    hp: number;      
    maxHp: number;
}

export interface GameState {
    player: Player;
    otherPlayers: Record<string, RemotePlayer>;
    dummy: Dummy;
    worldItems: Weapon[];
    currency: number;
    equippedWeapon: Weapon | null;
    keys: Record<string, boolean>;
    enemies: Record<string, any>;
}

// --- 2. Constants ---
export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 2000;
export const GRID_SIZE = 50;

// --- 3. Helper Functions ---
export function rectIntersect(r1: Rect, r2: Rect): boolean {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
}

export function getDistance(r1: Rect, r2: Rect): number {
    // Fallback to 30 if width/height are missing
    const w1 = r1.width || 40;
    const h1 = r1.height || 40;
    const w2 = r2.width || 30;
    const h2 = r2.height || 30;

    const c1 = { x: r1.x + w1 / 2, y: r1.y + h1 / 2 };
    const c2 = { x: r2.x + w2 / 2, y: r2.y + h2 / 2 };
    
    return Math.hypot(c1.x - c2.x, c1.y - c2.y);
}

// --- 4. Core Logic Functions ---

/**
 * Handles physics: Acceleration, Friction, Velocity, and Boundaries
 */
export function updatePlayerPhysics(player: Player, keys: Record<string, boolean>) {
    let inputX = 0;
    let inputY = 0;

    if (keys['ArrowUp'] || keys['KeyW']) inputY -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) inputY += 1;
    if (keys['ArrowLeft'] || keys['KeyA']) inputX -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) inputX += 1;

    // Apply Acceleration
    if (inputX !== 0 || inputY !== 0) {
        const length = Math.sqrt(inputX * inputX + inputY * inputY);
        player.vx += (inputX / length) * player.accel;
        player.vy += (inputY / length) * player.accel;
    }

    // Apply Friction
    player.vx *= player.friction;
    player.vy *= player.friction;

    // Cap Speed
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > player.maxSpeed) {
        const ratio = player.maxSpeed / speed;
        player.vx *= ratio;
        player.vy *= ratio;
    }

    // Update Position
    player.x += player.vx;
    player.y += player.vy;

    // World Boundaries
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.height, player.y));
}

/**
 * Handles interactions: Buying, Selling, and Combat
 */
export function processInteractions(state: GameState, resellStation: Rect): { hit: boolean, damage: number, enemyId?: string } | null {    
    // 1. Destructure everything we need at the very start
    const { player, enemies, dummy, worldItems, keys, equippedWeapon, currency } = state;
    const now = Date.now();

    // 2. Buying Logic (Iterate backwards to safely splice)
    for (let i = worldItems.length - 1; i >= 0; i--) {
        const item = worldItems[i];
        if (rectIntersect(player, item)) {
            if (currency >= item.price && !equippedWeapon) {
                state.currency -= item.price;
                state.equippedWeapon = item;
                worldItems.splice(i, 1);
                console.log(`Bought ${item.name}`);
            }
        }
    }

    // 3. Reselling Logic
    if (equippedWeapon && rectIntersect(player, resellStation)) {
        state.currency += equippedWeapon.price;
        state.equippedWeapon = null;
    }

    if (equippedWeapon && (keys['Space'] || keys['KeySpace'])) {
        const cooldownMs = 1000 / equippedWeapon.speed;
        if (now - player.lastAttack > cooldownMs) {
            
            // Total reach = player size + weapon range
            const reach = (player.width / 2) + equippedWeapon.range;

            // Check Hoard Enemies
            for (const id in enemies) {
                if (getDistance(player, enemies[id]) < reach) {
                    player.lastAttack = now;
                    return { hit: true, damage: equippedWeapon.damage, enemyId: id };
                }
            }

            // Check Dummy
            if (getDistance(player, dummy) < reach) {
                player.lastAttack = now;
                return { hit: true, damage: equippedWeapon.damage };
            }
        }
    }
    return null;
}

// --- 5. Drawing Functions ---

export function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += GRID_SIZE) {
        ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += GRID_SIZE) {
        ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

export function drawCooldownBar(ctx: CanvasRenderingContext2D, player: Player, weapon: Weapon) {
    const progress = Math.min((Date.now() - player.lastAttack) / (1000 / weapon.speed), 1);
    ctx.fillStyle = '#555';
    ctx.fillRect(player.x, player.y - 15, player.width, 5);
    ctx.fillStyle = progress === 1 ? '#f1c40f' : '#fff';
    ctx.fillRect(player.x, player.y - 15, player.width * progress, 5);
}