import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let players = {};
let enemies = {};
let enemyIdCounter = 0;
let dummyState = { hp: 100, maxHp: 100, isDead: false, respawnTimer: 0 };

// --- GLOBAL LOOPS (Run once for the whole server) ---

// 1. Zombie AI & Spawning Loop
setInterval(() => {
    // A. Spawn logic (Keep up to 10 zombies)
    if (Object.keys(enemies).length < 10) {
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
        };
    }

    const playerIds = Object.keys(players);
    if (playerIds.length > 0) {
        for (let id in enemies) {
            const enemy = enemies[id];
            let nearestPlayer = null;
            let minDist = Infinity;
            let nearestPId = null;

            // B. Find the nearest player for THIS specific zombie
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
                // C. Movement Logic
                const angle = Math.atan2(nearestPlayer.y - enemy.y, nearestPlayer.x - enemy.x);
                enemy.x += Math.cos(angle) * enemy.speed;
                enemy.y += Math.sin(angle) * enemy.speed;

                // D. Attack Logic (Now correctly inside the loop and using minDist)
                // 35px is a good "contact" distance for 40x40 players
                if (minDist < 35) { 
                    const now = Date.now();
                    
                    // Initialize lastHitByZombie if it doesn't exist
                    if (!nearestPlayer.lastHitByZombie) nearestPlayer.lastHitByZombie = 0;

                    if (now - nearestPlayer.lastHitByZombie > 1000) {
                        nearestPlayer.hp -= 10; 
                        nearestPlayer.lastHitByZombie = now;
                        console.log(`Player ${nearestPId} hit! HP: ${nearestPlayer.hp}`);

                        // Death/Respawn Logic
                        if (nearestPlayer.hp <= 0) {
                            nearestPlayer.hp = 100;
                            nearestPlayer.x = 50; 
                            nearestPlayer.y = 50;
                        }

                        // Broadcast update immediately when health changes
                        io.emit('updatePlayers', players);
                    }
                }
            }
        }
    }
    io.emit('updateEnemies', enemies);
}, 50);

// 2. Dummy Regen/Respawn Loop
setInterval(() => {
    const now = Date.now();
    let changed = false;
    if (dummyState.isDead) {
        if (now > dummyState.respawnTimer) {
            dummyState.isDead = false;
            dummyState.hp = dummyState.maxHp;
            changed = true;
        }
    } else if (dummyState.hp < dummyState.maxHp) {
        dummyState.hp = Math.min(dummyState.maxHp, dummyState.hp + 0.5);
        changed = true;
    }
    if (changed) io.emit('updateDummy', dummyState);
}, 100);


// --- CONNECTION LOGIC ---

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    players[socket.id] = { 
        x: 50, y: 50, width: 40, height: 40, 
        hp: 100, maxHp: 100, 
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        lastHitByZombie: 0 // To prevent instant death
    };

    // Sync current state to the new player
    io.emit('updatePlayers', players);
    socket.emit('updateDummy', dummyState);

    // MOVE listener
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
        }
    });

    // ZOMBIE HIT listener (Now correctly inside!)
    socket.on('hitEnemy', (data) => {
        const enemy = enemies[data.enemyId];
        if (enemy) {
            enemy.hp -= data.damage;
            if (enemy.hp <= 0) delete enemies[data.enemyId];
            io.emit('updateEnemies', enemies);
        }
    });

    // DUMMY HIT listener
    socket.on('hitDummy', (data) => {
        if (dummyState.isDead) return;
        dummyState.hp -= data.damage;
        if (dummyState.hp <= 0) {
            dummyState.hp = 0;
            dummyState.isDead = true;
            dummyState.respawnTimer = Date.now() + 3000;
            io.emit('enemyDeath', { type: 'dummy' });
        }
        io.emit('updateDummy', dummyState);
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));