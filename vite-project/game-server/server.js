import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: "*" // Allow all origins for local testing
    }
});

let players = {};

let dummyState = {
    hp: 100,
    maxHp: 100,
    isDead: false,
    respawnTimer: 0
};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create a new player entry with random color
    players[socket.id] = { 
        x: 50, 
        y: 50, 
        color: '#' + Math.floor(Math.random()*16777215).toString(16) 
    };

    // Tell everyone about the new player state
    io.emit('updatePlayers', players);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            // Broadcast the move to everyone else
            socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });

    socket.emit('updateDummy', dummyState); // Send initial dummy state to new player

    socket.on('hitDummy', (data) => {
        if (dummyState.isDead) return;

        dummyState.hp -= data.damage;
        if (dummyState.hp <= 0) {
            dummyState.hp = 0;
            dummyState.isDead = true;
            dummyState.respawnTimer = Date.now() + 3000;
            io.emit('enemyDeath', { type: 'dummy' }); // Notify everyone of death
        }

        io.emit('updateDummy', dummyState); // Broadcast new HP to everyone
    });

    // Server-side loop for regen and respawn (runs every 100ms)
    setInterval(() => {
        const now = Date.now();
        if (dummyState.isDead) {
            if (now > dummyState.respawnTimer) {
                dummyState.isDead = false;
                dummyState.hp = dummyState.maxHp;
                io.emit('updateDummy', dummyState);
            }
        } else if (dummyState.hp < dummyState.maxHp) {
            dummyState.hp = Math.min(dummyState.maxHp, dummyState.hp + 0.5);
            io.emit('updateDummy', dummyState);
        }
    }, 100);
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));   