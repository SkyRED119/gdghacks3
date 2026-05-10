// --- 1. Interfaces & Types ---
interface Vector2 {
    x: number;
    y: number;
}

interface Rect extends Vector2 {
    width: number;
    height: number;
}

interface Weapon extends Rect {
    id: number;
    name: string;
    price: number;
    damage: number;
    speed: number;
    color: string;
}

interface Player extends Rect {
    vx: number;
    vy: number;
    accel: number;
    friction: number;
    maxSpeed: number;
    color: string;
    lastAttack: number;
}

interface Dummy extends Rect {
    hp: number;
    maxHp: number;
    lastHit: number;
    isDead: boolean;
    respawnTimer: number;
}

interface Station extends Rect {
    color: string;
}

// --- 2. Constants & Setup ---
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const GRID_SIZE = 50;

// Proper casting for the Canvas API
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

const player: Player = {
    x: 50,
    y: 50,
    width: 40,
    height: 40,
    vx: 0,
    vy: 0,
    accel: 0.8,
    friction: 0.85, // Fixed the '0.' from the snippet to a working value
    maxSpeed: 6,
    color: '#3498db',
    lastAttack: 0
};

const keys: Record<string, boolean> = {};
let currency: number = 100;
let equippedWeapon: Weapon | null = null;

const shopStation: Station = { x: 500, y: 50, width: 80, height: 80, color: '#f1c40f' };
const resellStation: Station = { x: 500, y: 300, width: 80, height: 80, color: '#e74c3c' };
const dummy: Dummy = {
    x: 100, 
    y: 300, 
    width: 40, 
    height: 40, 
    hp: 100, 
    maxHp: 100, 
    lastHit: 0,
    isDead: false,
    respawnTimer: 0
};

const camera: Vector2 = { x: 0, y: 0 };

const worldItems: Weapon[] = [
    { id: 1, name: 'Dagger', x: 200, y: 100, width: 20, height: 20, price: 20, damage: 10, speed: 1.5, color: '#95a5a6' },
    { id: 2, name: 'Sword', x: 300, y: 100, width: 20, height: 20, price: 50, damage: 25, speed: 1.0, color: '#ecf0f1' },
    { id: 3, name: 'Hammer', x: 400, y: 100, width: 20, height: 20, price: 100, damage: 60, speed: 0.5, color: '#7f8c8d' }
];

// --- 3. Event Listeners ---
window.addEventListener('keydown', (e: KeyboardEvent) => keys[e.code] = true);
window.addEventListener('keyup', (e: KeyboardEvent) => keys[e.code] = false);

// --- 4. Logic Functions ---
function drawGrid(): void {
    ctx.beginPath();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;

    for (let x = 0; x <= WORLD_WIDTH; x += GRID_SIZE) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += GRID_SIZE) {
        ctx.moveTo(0, y);
        ctx.lineTo(WORLD_WIDTH, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function rectIntersect(rect1: Rect, rect2: Rect): boolean {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function update(): void {
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

    const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (currentSpeed > player.maxSpeed) {
        const ratio = player.maxSpeed / currentSpeed;
        player.vx *= ratio;
        player.vy *= ratio;
    }

    player.x += player.vx;
    player.y += player.vy;

    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.height, player.y));
}

function handleInteractions(): void {
    // 1. Buying
    worldItems.forEach((item, index) => {
        if (rectIntersect(player, item)) {
            if (currency >= item.price && !equippedWeapon) {
                currency -= item.price;
                equippedWeapon = item;
                worldItems.splice(index, 1);
            }
        }
    });

    // 2. Reselling
    if (equippedWeapon && rectIntersect(player, resellStation)) {
        currency += equippedWeapon.price;
        equippedWeapon = null;
    }

    const now = Date.now();

    // 3. Combat Logic
    if (!dummy.isDead) {
        if (keys['Space'] && equippedWeapon && rectIntersect(player, dummy)) {
            const cooldownMs = 1000 / equippedWeapon.speed;
            if (now - player.lastAttack > cooldownMs) {
                dummy.hp -= equippedWeapon.damage;
                player.lastAttack = now;

                if (dummy.hp <= 0) {
                    dummy.hp = 0;
                    dummy.isDead = true;
                    dummy.respawnTimer = now + 3000;
                }
            }
        }
        
        if (dummy.hp < dummy.maxHp && dummy.hp > 0) {
            dummy.hp += 0.1;
        }
    } else {
        if (now > dummy.respawnTimer) {
            dummy.isDead = false;
            dummy.hp = dummy.maxHp;
        }
    }
}

// --- 5. Main Loop ---
function draw(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    camera.x = player.x + player.width / 2 - canvas.width / 2;
    camera.y = player.y + player.height / 2 - canvas.height / 2;

    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawGrid();

    // Stations
    ctx.fillStyle = shopStation.color;
    ctx.fillRect(shopStation.x, shopStation.y, shopStation.width, shopStation.height);
    ctx.fillStyle = resellStation.color;
    ctx.fillRect(resellStation.x, resellStation.y, resellStation.width, resellStation.height);

    // Dummy
    ctx.fillStyle = dummy.isDead ? '#a8e6cf' : '#2ecc71'; 
    ctx.fillRect(dummy.x, dummy.y, dummy.width, dummy.height);
    if (!dummy.isDead) {
        ctx.fillStyle = 'red';
        ctx.fillRect(dummy.x, dummy.y - 10, (dummy.hp / dummy.maxHp) * dummy.width, 5);
    }

    // World Items
    worldItems.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, item.y, item.width, item.height);
    });

    // Player
    ctx.fillStyle = equippedWeapon ? equippedWeapon.color : player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Cooldown Bar
    if (equippedWeapon) {
        const progress = Math.min((Date.now() - player.lastAttack) / (1000 / equippedWeapon.speed), 1);
        ctx.fillStyle = '#555';
        ctx.fillRect(player.x, player.y - 15, player.width, 5);
        ctx.fillStyle = progress === 1 ? '#f1c40f' : '#fff';
        ctx.fillRect(player.x, player.y - 15, player.width * progress, 5);
    }

    ctx.restore();

    // UI (Screen Space)
    ctx.fillStyle = 'black'; 
    ctx.font = '20px Arial';
    ctx.fillText(`Currency: $${Math.floor(currency)}`, 20, 30);
    ctx.fillText(`Weapon: ${equippedWeapon ? equippedWeapon.name : 'None'}`, 20, 60);
    
    if (dummy.isDead) {
        ctx.fillStyle = 'black';
        ctx.fillText('Dummy Respawning...', 20, 90);
    }

    update();
    handleInteractions();
    requestAnimationFrame(draw);
}

draw();