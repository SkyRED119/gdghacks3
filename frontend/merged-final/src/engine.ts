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
    range: number; // pixels of extra reach
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

export interface RemotePlayer {
    x: number;
    y: number;
    color: string;
    hp: number;
    maxHp: number;
}

// Medkit station — a fixed shop spot you walk to and press F to buy
export interface MedkitStation extends Rect {
    price: number;
    healAmount: number;
}

export interface GameState {
    player: Player;
    otherPlayers: Record<string, RemotePlayer>;
    worldItems: Weapon[];
    medkitStation: MedkitStation;
    currency: number;
    equippedWeapon: Weapon | null;
    keys: Record<string, boolean>;
    enemies: Record<string, any>;
    // Edge-tracking for F key (so it triggers once per press, not every frame)
    fWasDown: boolean;
    // Brief on-screen feedback after an F-action
    feedback: { text: string; until: number } | null;
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

    if (inputX !== 0 || inputY !== 0) {
        const length = Math.sqrt(inputX * inputX + inputY * inputY);
        player.vx += (inputX / length) * player.accel;
        player.vy += (inputY / length) * player.accel;
    }

    player.vx *= player.friction;
    player.vy *= player.friction;

    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > player.maxSpeed) {
        const ratio = player.maxSpeed / speed;
        player.vx *= ratio;
        player.vy *= ratio;
    }

    player.x += player.vx;
    player.y += player.vy;

    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.height, player.y));
}

/**
 * Set on-screen feedback text for ~1.4s.
 */
function setFeedback(state: GameState, text: string) {
    state.feedback = { text, until: Date.now() + 1400 };
}

/**
 * Handle F-key edge press: pickup / drop / swap a weapon, OR purchase a medkit
 * if the player is overlapping the medkit station.
 *
 * Rules:
 *   • Standing on medkit station + F  →  spend `price` currency, restore `healAmount` HP
 *     (only if currency >= price AND hp < maxHp)
 *   • Standing on a weapon (worldItem) + F:
 *       - holding nothing  →  pick it up (free, no currency cost)
 *       - already holding  →  swap: drop current weapon at picked-up's old spot,
 *                              equip the new one
 *   • Holding a weapon, not on any weapon + F  →  drop it at player's position
 */
function handleFKey(state: GameState) {
    const { player, worldItems, medkitStation, equippedWeapon } = state;

    // (1) Medkit purchase
    if (rectIntersect(player, medkitStation)) {
        if (player.hp >= player.maxHp) {
            setFeedback(state, 'HP is full');
            return;
        }
        if (state.currency < medkitStation.price) {
            setFeedback(state, `Need ${medkitStation.price} scrolls`);
            return;
        }
        state.currency -= medkitStation.price;
        player.hp = Math.min(player.maxHp, player.hp + medkitStation.healAmount);
        setFeedback(state, `+${medkitStation.healAmount} HP`);
        return;
    }

    // (2) Weapon pickup / swap (find the first overlapping weapon)
    const idx = worldItems.findIndex(item => rectIntersect(player, item));

    if (idx !== -1) {
        const groundWeapon = worldItems[idx];
        if (equippedWeapon) {
            // Swap: replace ground weapon with current, equip ground weapon
            const dropped: Weapon = {
                ...equippedWeapon,
                x: groundWeapon.x,
                y: groundWeapon.y,
            };
            worldItems[idx] = dropped;
            state.equippedWeapon = { ...groundWeapon };
            setFeedback(state, `Swapped: ${groundWeapon.name}`);
        } else {
            // Pick up
            state.equippedWeapon = { ...groundWeapon };
            worldItems.splice(idx, 1);
            setFeedback(state, `Picked up ${groundWeapon.name}`);
        }
        return;
    }

    // (3) Drop in place (player holding a weapon, not on any other weapon)
    if (equippedWeapon) {
        const dropped: Weapon = {
            ...equippedWeapon,
            x: player.x + (player.width - equippedWeapon.width) / 2,
            y: player.y + (player.height - equippedWeapon.height) / 2,
        };
        worldItems.push(dropped);
        state.equippedWeapon = null;
        setFeedback(state, `Dropped ${dropped.name}`);
    }
}

/**
 * Handles per-frame interactions: F-key (pickup/drop/swap/medkit) and combat.
 * Returns a hit descriptor when the player attacks an enemy, otherwise null.
 */
export function processInteractions(state: GameState): { hit: boolean, damage: number, enemyId?: string } | null {
    const { player, enemies, keys, equippedWeapon } = state;
    const now = Date.now();

    // F-key edge detection (fires once per press, not every frame)
    const fDown = !!(keys['KeyF']);
    if (fDown && !state.fWasDown) {
        handleFKey(state);
    }
    state.fWasDown = fDown;

    // Combat (Space)
    if (equippedWeapon && (keys['Space'] || keys['KeySpace'])) {
        const cooldownMs = 1000 / equippedWeapon.speed;
        if (now - player.lastAttack > cooldownMs) {
            const reach = (player.width / 2) + equippedWeapon.range;
            for (const id in enemies) {
                if (getDistance(player, enemies[id]) < reach) {
                    player.lastAttack = now;
                    return { hit: true, damage: equippedWeapon.damage, enemyId: id };
                }
            }
        }
    }
    return null;
}

// --- 5. Drawing Functions ---

export function drawGrid(ctx: CanvasRenderingContext2D, gridColor = '#ddd', borderColor = '#000') {
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += GRID_SIZE) {
        ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += GRID_SIZE) {
        ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y);
    }
    ctx.stroke();
    ctx.strokeStyle = borderColor;
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
