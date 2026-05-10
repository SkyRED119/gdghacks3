import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// ─── Tunables ──────────────────────────────────────────────────────────────
// Zombie damage: per-hit damage and how often a zombie can hit the same player.
// Default = 8 dmg every 1500ms → ~19s of constant contact before death (100 hp).
// Lower the cooldown or raise the damage to make combat harder.
const ZOMBIE_DAMAGE       = 8;
const ZOMBIE_HIT_COOLDOWN = 1500; // ms
const ZOMBIE_HIT_RANGE    = 50;   // px from zombie center to player center
const MAX_ZOMBIES         = 10;

// ─── State ─────────────────────────────────────────────────────────────────
let players = {};
let enemies = {};
let enemyIdCounter = 0;

function angleToDirection(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
}

// ─── Zombie AI & spawning loop ─────────────────────────────────────────────
setInterval(() => {
    if (Object.keys(enemies).length < MAX_ZOMBIES) {
        const id = `zombie_${enemyIdCounter++}`;
        enemies[id] = {
            id,
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            width: 30,
            height: 30,
            hp: 30,
            maxHp: 30,
            speed: 2 + Math.random() * 1.5,
            direction: 'down',
        };
    }

    let anyPlayerHit = false;

    const playerIds = Object.keys(players);
    if (playerIds.length > 0) {
        for (let id in enemies) {
            const enemy = enemies[id];
            let nearestPlayer = null;
            let minDist = Infinity;
            let nearestPId = null;

            playerIds.forEach(pId => {
                const p = players[pId];
                const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestPlayer = p;
                    nearestPId = pId;
                }
            });

            if (nearestPlayer) {
                const angle = Math.atan2(nearestPlayer.y - enemy.y, nearestPlayer.x - enemy.x);
                const dx = Math.cos(angle) * enemy.speed;
                const dy = Math.sin(angle) * enemy.speed;
                enemy.x += dx;
                enemy.y += dy;
                enemy.direction = angleToDirection(dx, dy);

                // Damage the player on contact (with per-zombie cooldown)
                if (minDist < ZOMBIE_HIT_RANGE) {
                    const now = Date.now();
                    if (!nearestPlayer.lastHitByZombie) nearestPlayer.lastHitByZombie = 0;
                    if (now - nearestPlayer.lastHitByZombie > ZOMBIE_HIT_COOLDOWN) {
                        nearestPlayer.hp -= ZOMBIE_DAMAGE;
                        nearestPlayer.lastHitByZombie = now;
                        anyPlayerHit = true;
                        console.log(`Player ${nearestPId} hit by zombie. HP: ${nearestPlayer.hp}`);
                        if (nearestPlayer.hp <= 0) {
                            // Respawn at safe corner
                            nearestPlayer.hp = nearestPlayer.maxHp;
                            nearestPlayer.x = 50;
                            nearestPlayer.y = 50;
                            nearestPlayer.respawned = true;
                            console.log(`Player ${nearestPId} died and respawned`);
                        }
                    }
                }
            }
        }
    }

    if (anyPlayerHit) {
        io.emit('updatePlayers', players);
        // Clear the one-shot respawn flags after broadcasting
        for (const pId in players) {
            if (players[pId].respawned) delete players[pId].respawned;
        }
    }
    io.emit('updateEnemies', enemies);
}, 50);

// ─── Connection handler ────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    players[socket.id] = {
        x: 50, y: 50, width: 40, height: 40,
        hp: 100, maxHp: 100,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        lastHitByZombie: 0,
    };
    io.emit('updatePlayers', players);
    socket.emit('updateEnemies', enemies);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
        }
    });

    socket.on('hitEnemy', (data) => {
        const enemy = enemies[data.enemyId];
        if (enemy) {
            enemy.hp -= data.damage;
            if (enemy.hp <= 0) {
                io.emit('enemyDeath', { type: 'zombie', id: data.enemyId });
                delete enemies[data.enemyId];
            }
            io.emit('updateEnemies', enemies);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Game server running on port ${PORT}`));
