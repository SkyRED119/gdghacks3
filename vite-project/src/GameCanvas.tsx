import React, { useEffect, useRef, useState } from 'react';
import { 
    updatePlayerPhysics, 
    processInteractions, 
    drawGrid, 
    drawCooldownBar, 
    type GameState, 
    type Rect 
} from './engine';
import { io, Socket } from 'socket.io-client';

export const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currency, setCurrency] = useState(100);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Connect to the server
        socketRef.current = io('http://10.12.187.119:3000');
        const socket = socketRef.current;

        socket.on('updateDummy', (serverDummy) => {
        state.current.dummy = { ...state.current.dummy, ...serverDummy };
        });

        socket.on('enemyDeath', (data) => {
        console.log(`${data.type} has been defeated!`);
        // You could trigger a global sound or animation here
        });

        socket.on('updatePlayers', (serverPlayers) => {
        const myId = socket.id;
        if (myId && serverPlayers[myId]) {
            // Sync our own HP and position if the server forced a respawn
            state.current.player.hp = serverPlayers[myId].hp;
            
            // If we are far away from where the server says we are (Respawn)
            const dist = Math.hypot(state.current.player.x - serverPlayers[myId].x, state.current.player.y - serverPlayers[myId].y);
            if (dist > 100) {
                state.current.player.x = serverPlayers[myId].x;
                state.current.player.y = serverPlayers[myId].y;
            }
        }
            const others = { ...serverPlayers };
            delete others[myId!];
            state.current.otherPlayers = others;
        });

        socket.on('playerMoved', (data) => {
            if (state.current.otherPlayers[data.id]) {
                state.current.otherPlayers[data.id].x = data.x;
                state.current.otherPlayers[data.id].y = data.y;
            }
        });

        socket.on('updateEnemies', (serverEnemies) => {
            state.current.enemies = serverEnemies;
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Define stations here so they are accessible
    const resellStation: Rect = { x: 500, y: 300, width: 80, height: 80 };

    const state = useRef<GameState>({
        player: { 
            x: 50, y: 50, width: 40, height: 40, 
            vx: 0, vy: 0, accel: 0.8, friction: 0.85, 
            maxSpeed: 6, color: '#3498db', lastAttack: 0,
            hp: 100, maxHp: 100
        },
        otherPlayers: {},
        dummy: { x: 100, y: 300, width: 40, height: 40, hp: 100, maxHp: 100, isDead: false, respawnTimer: 0 },
        worldItems: [
        { id: 1, name: 'Dagger', x: 200, y: 100, width: 20, height: 20, price: 20, damage: 10, speed: 1.5, color: '#95a5a6', range: 30 },
        { id: 2, name: 'Sword', x: 300, y: 100, width: 25, height: 25, price: 50, damage: 25, speed: 1.0, color: '#bdc3c7', range: 50 },
        { id: 3, name: 'Hammer', x: 400, y: 100, width: 30, height: 30, price: 100, damage: 60, speed: 0.5, color: '#7f8c8d', range: 70 }
    ],
        currency: 100,
        equippedWeapon: null,
        keys: {}, 
        enemies: {}
    });

    // --- GAME ENGINE FUNCTIONS ---
    const update = () => {
    const s = state.current;
    if (!s) return;

    // 1. Physics & Movement
    const oldX = s.player.x;
    const oldY = s.player.y;
    updatePlayerPhysics(s.player, s.keys);

    // 2. Interaction Logic
    // This is where the crash was happening!
    const interactionResult = processInteractions(s, resellStation);

    // ONLY proceed if interactionResult is NOT null
        if (interactionResult) {
            if (interactionResult.enemyId) {
                // We hit a zombie
                socketRef.current?.emit('hitEnemy', { 
                    enemyId: interactionResult.enemyId, 
                    damage: interactionResult.damage 
                });
            } else if (interactionResult.hit) {
                // We hit the dummy
                socketRef.current?.emit('hitDummy', { 
                    damage: interactionResult.damage 
                });
            }
        }

        // 3. Sync movement to server
        if (s.player.x !== oldX || s.player.y !== oldY) {
            socketRef.current?.emit('move', { x: s.player.x, y: s.player.y });
        }

        // 4. Sync currency to React UI
        if (s.currency !== currency) setCurrency(s.currency);
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const s = state.current;
        if (!s || !s.player) return;
        
        // 1. ALWAYS CLEAR FIRST
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const p = s.player;

        ctx.save();
        // 2. APPLY CAMERA
        ctx.translate(
            Math.floor(-p.x + ctx.canvas.width / 2), 
            Math.floor(-p.y + ctx.canvas.height / 2)
        );

        drawGrid(ctx);

        // Draw Zombies safely
        if (s.enemies) {
            Object.values(s.enemies).forEach((zombie: any) => {
                ctx.fillStyle = '#8e44ad';
                ctx.fillRect(zombie.x, zombie.y, 30, 30);
                
                // Health bar
                ctx.fillStyle = 'red';
                const healthWidth = (zombie.hp / zombie.maxHp) * 30;
                ctx.fillRect(zombie.x, zombie.y - 5, Math.max(0, healthWidth), 3);
            });
        }

        // 1. Draw Stations
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(resellStation.x, resellStation.y, resellStation.width, resellStation.height);

        // 2. Draw World Items
        s.worldItems.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.fillRect(item.x, item.y, item.width, item.height);
            ctx.fillStyle = 'black';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`$${item.price}`, item.x, item.y - 5);
        });

        // 3. Draw Dummy
        ctx.fillStyle = s.dummy.isDead ? '#a8e6cf' : '#2ecc71';
        ctx.fillRect(s.dummy.x, s.dummy.y, s.dummy.width, s.dummy.height);
        if (!s.dummy.isDead) {
            ctx.fillStyle = 'red';
            ctx.fillRect(s.dummy.x, s.dummy.y - 10, (s.dummy.hp / s.dummy.maxHp) * s.dummy.width, 5);
        }

        // 3. Draw Local Player
        ctx.fillStyle = s.equippedWeapon ? s.equippedWeapon.color : p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);

        ctx.fillStyle = '#2ecc71'; 
        const myHealthWidth = (p.hp / p.maxHp) * 40;
        ctx.fillRect(p.x, p.y - 10, myHealthWidth, 5);

        // Inside the draw loop in GameCanvas.tsx
        Object.values(s.otherPlayers).forEach(remotePlayer => {
            ctx.fillStyle = remotePlayer.color;
            ctx.fillRect(remotePlayer.x, remotePlayer.y, 40, 40);

            // Draw Health Bar for others
            ctx.fillStyle = 'red';
            const healthBarWidth = (remotePlayer.hp / remotePlayer.maxHp) * 40;
            ctx.fillRect(remotePlayer.x, remotePlayer.y - 10, healthBarWidth, 5);
        });

        // 5. Draw Cooldown
        if (s.equippedWeapon) {
            drawCooldownBar(ctx, p, s.equippedWeapon);
        }

        ctx.restore();
    };

    // --- THE REACT BRIDGE ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            update();
            draw(ctx);
            animationFrameId = window.requestAnimationFrame(render);
        };

        const handleKeyDown = (e: KeyboardEvent) => (state.current.keys[e.code] = true);
        const handleKeyUp = (e: KeyboardEvent) => (state.current.keys[e.code] = false);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        render();

        // Cleanup: Stops the game if you navigate away from the page
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="game-container" style={{ position: 'relative', width: '800px', height: '600px' }}>
            {/* UI Overlay (React shines here!) */}
            <div className="hud" style={{ position: 'absolute', top: 10, left: 10, pointerEvents: 'none' }}>
                <h2 style={{ color: 'black', margin: 0 }}>Money: ${currency}</h2>
            </div>

            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ background: '#eee', display: 'block' }}
            />
        </div>
    );
};