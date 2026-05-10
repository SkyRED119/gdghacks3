import { useEffect, useRef } from 'react';
import {
  drawCooldownBar,
  drawGrid,
  processInteractions,
  updatePlayerPhysics,
  type GameState,
} from '../engine';
import { io, Socket } from 'socket.io-client';

export type ArmorColor = 'silver' | 'red' | 'blue' | 'gold' | 'black';
export type ArmorSlot = 'head' | 'chest' | 'legs';
export type ArmorSelection = Record<ArmorSlot, ArmorColor>;

type Direction = 'up' | 'down' | 'left' | 'right';
type Action = 'idle' | 'run' | 'slash';
type ZombieAction = 'walk' | 'slash' | 'hurt';

type GameCanvasProps = {
  armor: ArmorSelection;
  isDark?: boolean;
};

type SpriteImageMap = Record<ArmorSlot, Record<ArmorColor, Record<Action, HTMLImageElement>>>;
type ZombieSpriteMap = Record<ZombieAction, HTMLImageElement>;

type PlayerAnimationState = {
  direction: Direction;
  action: Action;
  slashUntil: number;
  slashStart: number;
  spaceWasDown: boolean;
};

type ZombieClientState = {
  hitUntil: number;
  isDying: boolean;
  dyingUntil: number;
};

// ── Sprite constants ───────────────────────────────────────────────────────
const FRAME_SIZE = 64;
const SLASH_DURATION_MS = 750;

const ACTION_FRAMES: Record<Action, number> = { idle: 2, run: 8, slash: 6 };
const ZOMBIE_FRAMES: Record<ZombieAction, number> = { walk: 9, slash: 6, hurt: 6 };

const DIRECTION_ROW: Record<Direction, number> = { up: 0, left: 1, down: 2, right: 3 };

const DRAW_ORDER: ArmorSlot[] = ['legs', 'chest', 'head'];
const ARMOR_COLORS: ArmorColor[] = ['silver', 'red', 'blue', 'gold', 'black'];
const ALL_ACTIONS: Action[] = ['idle', 'run', 'slash'];

// ── Theme colours (Flowestra palette) ─────────────────────────────────────
const THEME = {
  light: {
    bg: '#efede9',
    grid: '#d8d5d0',
    worldBorder: '#b0aba3',
    medkit: '#e74c3c',
    medkitCross: '#ffffff',
    medkitText: '#1a1a18',
    hpBarBg: 'rgba(0,0,0,0.18)',
    weaponText: '#1a1a18',
    weaponPriceTxt: '#555450',
    hudText: '#1a1a18',
    hudBg: 'rgba(255,255,255,0.85)',
    hudBorder: 'rgba(0,0,0,0.15)',
    feedbackBg: 'rgba(255,255,255,0.92)',
    feedbackText: '#1a1a18',
  },
  dark: {
    bg: '#1a1a1f',
    grid: '#2a2a33',
    worldBorder: '#3d3d4a',
    medkit: '#c0392b',
    medkitCross: '#f5f5f0',
    medkitText: '#e8e6e2',
    hpBarBg: 'rgba(255,255,255,0.12)',
    weaponText: '#e8e6e2',
    weaponPriceTxt: '#8a8880',
    hudText: '#e8e6e2',
    hudBg: 'rgba(20,20,25,0.85)',
    hudBorder: 'rgba(255,255,255,0.15)',
    feedbackBg: 'rgba(20,20,25,0.92)',
    feedbackText: '#e8e6e2',
  },
};

// ── Image factories ────────────────────────────────────────────────────────
function createSpriteImages(): SpriteImageMap {
  const images = {} as SpriteImageMap;
  (['head', 'chest', 'legs'] as ArmorSlot[]).forEach((slot) => {
    images[slot] = {} as Record<ArmorColor, Record<Action, HTMLImageElement>>;
    ARMOR_COLORS.forEach((color) => {
      images[slot][color] = {} as Record<Action, HTMLImageElement>;
      ALL_ACTIONS.forEach((action) => {
        const img = new Image();
        img.src = `/sprites/armor/${slot}/${color}/${action}.png`;
        images[slot][color][action] = img;
      });
    });
  });
  return images;
}

function createZombieImages(): ZombieSpriteMap {
  const map = {} as ZombieSpriteMap;
  (['walk', 'slash', 'hurt'] as ZombieAction[]).forEach((action) => {
    const img = new Image();
    img.src = `/sprites/zombie/${action}.png`;
    map[action] = img;
  });
  return map;
}

// ── Input helpers ──────────────────────────────────────────────────────────
function getInputDirection(keys: Record<string, boolean>): Direction | null {
  if (keys['KeyW'] || keys['ArrowUp'])    return 'up';
  if (keys['KeyA'] || keys['ArrowLeft'])  return 'left';
  if (keys['KeyD'] || keys['ArrowRight']) return 'right';
  if (keys['KeyS'] || keys['ArrowDown'])  return 'down';
  return null;
}

function isMoving(keys: Record<string, boolean>) {
  return Boolean(
    keys['KeyW'] || keys['ArrowUp'] ||
    keys['KeyA'] || keys['ArrowLeft'] ||
    keys['KeyS'] || keys['ArrowDown'] ||
    keys['KeyD'] || keys['ArrowRight']
  );
}

function angleToDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

// ── Draw helpers ───────────────────────────────────────────────────────────
function drawArmorSprite(
  ctx: CanvasRenderingContext2D,
  images: SpriteImageMap,
  armor: ArmorSelection,
  x: number, y: number,
  action: Action, direction: Direction, frame: number
) {
  const row = DIRECTION_ROW[direction];
  const frameIndex = frame % ACTION_FRAMES[action];
  const sourceX = frameIndex * FRAME_SIZE;
  const sourceY = row * FRAME_SIZE;
  DRAW_ORDER.forEach((slot) => {
    const img = images[slot][armor[slot]][action];
    if (!img.complete || img.naturalWidth === 0) return;
    ctx.drawImage(img, sourceX, sourceY, FRAME_SIZE, FRAME_SIZE, x, y, FRAME_SIZE, FRAME_SIZE);
  });
}

function drawZombieSprite(
  ctx: CanvasRenderingContext2D,
  zombieImages: ZombieSpriteMap,
  x: number, y: number,
  zombieAction: ZombieAction,
  direction: Direction,
  frame: number
) {
  const img = zombieImages[zombieAction];
  if (!img.complete || img.naturalWidth === 0) return;
  const frameIndex = frame % ZOMBIE_FRAMES[zombieAction];
  const sourceX = frameIndex * FRAME_SIZE;
  const row = zombieAction === 'hurt' ? 0 : DIRECTION_ROW[direction];
  const sourceY = row * FRAME_SIZE;
  ctx.drawImage(img, sourceX, sourceY, FRAME_SIZE, FRAME_SIZE, x, y, FRAME_SIZE, FRAME_SIZE);
}

// ── Component ──────────────────────────────────────────────────────────────
export function GameCanvas({ armor, isDark = false }: GameCanvasProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const imagesRef     = useRef<SpriteImageMap>(createSpriteImages());
  const zombieImgRef  = useRef<ZombieSpriteMap>(createZombieImages());
  const socketRef     = useRef<Socket | null>(null);
  const isDarkRef     = useRef(isDark);

  const animationRef = useRef<PlayerAnimationState>({
    direction: 'down',
    action: 'idle',
    slashUntil: 0,
    slashStart: 0,
    spaceWasDown: false,
  });
  const frameRef = useRef(0);

  // Zombie client-side animation tracking
  const zombieClientRef  = useRef<Record<string, ZombieClientState>>({});
  const knownZombieIds   = useRef<Set<string>>(new Set());
  const dyingZombies     = useRef<Record<string, any>>({});
  const prevZombiePos    = useRef<Record<string, { x: number; y: number; direction: Direction }>>({});

  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);

  const state = useRef<GameState>({
    player: {
      x: 100, y: 100, width: 64, height: 64,
      vx: 0, vy: 0, accel: 0.8, friction: 0.85, maxSpeed: 6,
      color: '#3498db', lastAttack: 0,
      hp: 100, maxHp: 100,
    },
    otherPlayers: {},
    worldItems: [
      { id: 1, name: 'Dagger', x: 200, y: 100, width: 24, height: 24, price: 20,  damage: 10, speed: 1.5, color: '#95a5a6', range: 30 },
      { id: 2, name: 'Sword',  x: 300, y: 100, width: 28, height: 28, price: 50,  damage: 25, speed: 1.0, color: '#bdc3c7', range: 55 },
      { id: 3, name: 'Hammer', x: 400, y: 100, width: 32, height: 32, price: 100, damage: 60, speed: 0.5, color: '#7f8c8d', range: 70 },
    ],
    medkitStation: {
      x: 520, y: 100, width: 60, height: 60,
      price: 10, healAmount: 30,
    },
    currency: 100,
    equippedWeapon: null,
    keys: {},
    enemies: {},
    fWasDown: false,
    feedback: null,
  });

  // ── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Game server URL — use 'localhost' for solo dev, or a LAN IP for multi-device play.
    socketRef.current = io('http://localhost:3000');
    const socket = socketRef.current;

    socket.on('updatePlayers', (serverPlayers) => {
      // Sync our local player HP from the server (zombies do damage server-side)
      const me = serverPlayers[socket.id!];
      if (me) {
        state.current.player.hp = me.hp;
        state.current.player.maxHp = me.maxHp;
        // If the server respawned us, snap our position to match
        if (me.respawned) {
          state.current.player.x = me.x;
          state.current.player.y = me.y;
          state.current.player.vx = 0;
          state.current.player.vy = 0;
        }
      }
      const others = { ...serverPlayers };
      delete others[socket.id!];
      state.current.otherPlayers = others;
    });

    socket.on('playerMoved', (data) => {
      if (state.current.otherPlayers[data.id]) {
        state.current.otherPlayers[data.id].x = data.x;
        state.current.otherPlayers[data.id].y = data.y;
      }
    });

    socket.on('updateEnemies', (serverEnemies: Record<string, any>) => {
      const now = Date.now();
      const newIds = new Set(Object.keys(serverEnemies));
      const prevIds = knownZombieIds.current;

      prevIds.forEach((id) => {
        if (!newIds.has(id)) {
          const oldData = state.current.enemies[id] || dyingZombies.current[id];
          if (oldData) {
            const HURT_MS = 500;
            dyingZombies.current[id] = { ...oldData, direction: prevZombiePos.current[id]?.direction || 'down' };
            zombieClientRef.current[id] = { hitUntil: 0, isDying: true, dyingUntil: now + HURT_MS };
          }
          delete prevZombiePos.current[id];
        }
      });

      knownZombieIds.current = newIds;

      Object.entries(serverEnemies).forEach(([id, zombie]: [string, any]) => {
        const prev = prevZombiePos.current[id];
        if (prev) {
          const dx = zombie.x - prev.x;
          const dy = zombie.y - prev.y;
          const dir = (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) ? angleToDirection(dx, dy) : prev.direction;
          prevZombiePos.current[id] = { x: zombie.x, y: zombie.y, direction: dir };
          zombie.direction = dir;
        } else {
          prevZombiePos.current[id] = { x: zombie.x, y: zombie.y, direction: 'down' };
          zombie.direction = 'down';
        }
      });

      state.current.enemies = serverEnemies;
    });

    socket.emit('updateEnemies', state.current.enemies);

    return () => { socket.disconnect(); };
  }, []);

  // ── Update ────────────────────────────────────────────────────────────────
  const update = () => {
    const s = state.current;
    const oldX = s.player.x;
    const oldY = s.player.y;
    const now = Date.now();
    const anim = animationRef.current;
    const spaceDown = !!s.keys['Space'];
    const slashing = now < anim.slashUntil;

    if (!slashing) {
      const dir = getInputDirection(s.keys);
      if (dir) anim.direction = dir;
    }

    if (spaceDown && !anim.spaceWasDown && !slashing) {
      anim.action = 'slash';
      anim.slashStart = now;
      anim.slashUntil = now + SLASH_DURATION_MS;
    } else if (slashing) {
      anim.action = 'slash';
    } else if (isMoving(s.keys)) {
      anim.action = 'run';
    } else {
      anim.action = 'idle';
    }
    anim.spaceWasDown = spaceDown;

    updatePlayerPhysics(s.player, s.keys);
    const result = processInteractions(s);

    if (result?.hit && result.enemyId) {
      const zid = result.enemyId;
      if (!zombieClientRef.current[zid]) {
        zombieClientRef.current[zid] = { hitUntil: 0, isDying: false, dyingUntil: 0 };
      }
      zombieClientRef.current[zid].hitUntil = Date.now() + 280;
      socketRef.current?.emit('hitEnemy', { enemyId: zid, damage: result.damage });
    }

    if (s.player.x !== oldX || s.player.y !== oldY) {
      socketRef.current?.emit('move', { x: s.player.x, y: s.player.y });
    }
  };

  // ── Draw ─────────────────────────────────────────────────────────────────
  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = state.current;
    const p = s.player;
    const anim = animationRef.current;
    const colors = isDarkRef.current ? THEME.dark : THEME.light;
    const now = Date.now();
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(Math.floor(-p.x + W / 2), Math.floor(-p.y + H / 2));

    drawGrid(ctx, colors.grid, colors.worldBorder);

    // ── Medkit station ───────────────────────────────────────────────────
    const m = s.medkitStation;
    ctx.fillStyle = colors.medkit;
    ctx.fillRect(m.x, m.y, m.width, m.height);
    // White cross
    ctx.fillStyle = colors.medkitCross;
    const cx = m.x + m.width / 2;
    const cy = m.y + m.height / 2;
    const armLong = 28, armShort = 8;
    ctx.fillRect(cx - armLong / 2, cy - armShort / 2, armLong, armShort);
    ctx.fillRect(cx - armShort / 2, cy - armLong / 2, armShort, armLong);
    // Label
    ctx.fillStyle = colors.medkitText;
    ctx.font = 'bold 11px DM Sans, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Medkit', cx, m.y - 14);
    ctx.font = '10px DM Sans, system-ui, sans-serif';
    ctx.fillText(`${m.price}🪙 → +${m.healAmount} HP`, cx, m.y - 2);
    ctx.textAlign = 'left';

    // ── World weapons (on the ground) ────────────────────────────────────
    s.worldItems.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(item.x, item.y, item.width, item.height);
      ctx.fillStyle = colors.weaponText;
      ctx.font = 'bold 10px DM Sans, system-ui, sans-serif';
      ctx.fillText(item.name, item.x, item.y - 5);
    });

    // ── Live zombies ─────────────────────────────────────────────────────
    Object.entries(s.enemies).forEach(([id, zombie]: [string, any]) => {
      const cState = zombieClientRef.current[id];
      const isHit  = cState && now < cState.hitUntil && !cState.isDying;
      const zAction: ZombieAction = isHit ? 'slash' : 'walk';
      const dir: Direction = zombie.direction || 'down';

      drawZombieSprite(ctx, zombieImgRef.current, zombie.x, zombie.y, zAction, dir, frameRef.current);

      const barW = FRAME_SIZE;
      ctx.fillStyle = colors.hpBarBg;
      ctx.fillRect(zombie.x, zombie.y - 10, barW, 5);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(zombie.x, zombie.y - 10, (zombie.hp / zombie.maxHp) * barW, 5);
    });

    // ── Dying zombies (hurt anim → fade → remove) ────────────────────────
    const toRemove: string[] = [];
    Object.entries(dyingZombies.current).forEach(([id, zombie]: [string, any]) => {
      const cState = zombieClientRef.current[id];
      if (!cState) { toRemove.push(id); return; }
      if (now < cState.dyingUntil) {
        const elapsed = now - (cState.dyingUntil - 500);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 500);
        drawZombieSprite(ctx, zombieImgRef.current, zombie.x, zombie.y, 'hurt', zombie.direction || 'down', frameRef.current);
        ctx.globalAlpha = 1;
      } else {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => {
      delete dyingZombies.current[id];
      delete zombieClientRef.current[id];
    });

    // ── Other remote players ────────────────────────────────────────────
    Object.values(s.otherPlayers).forEach((rp: any) => {
      ctx.fillStyle = rp.color || '#3498db';
      ctx.fillRect(rp.x, rp.y, 64, 64);
      if (rp.hp !== undefined && rp.maxHp) {
        ctx.fillStyle = colors.hpBarBg;
        ctx.fillRect(rp.x, rp.y - 10, 64, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(rp.x, rp.y - 10, (rp.hp / rp.maxHp) * 64, 5);
      }
    });

    // ── Local player armor sprites ───────────────────────────────────────
    let displayFrame = frameRef.current;
    if (anim.action === 'slash') {
      const elapsed = now - anim.slashStart;
      const slashFps = (ACTION_FRAMES.slash * 1000) / SLASH_DURATION_MS;
      displayFrame = Math.min(Math.floor((elapsed / 1000) * slashFps), ACTION_FRAMES.slash - 1);
    }

    drawArmorSprite(ctx, imagesRef.current, armor, p.x, p.y, anim.action, anim.direction, displayFrame);

    // Player HP bar
    const hpRatio = p.hp / (p.maxHp || 100);
    ctx.fillStyle = colors.hpBarBg;
    ctx.fillRect(p.x, p.y - 12, FRAME_SIZE, 5);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f1c40f' : '#c0392b';
    ctx.fillRect(p.x, p.y - 12, FRAME_SIZE * hpRatio, 5);

    // Cooldown bar
    if (s.equippedWeapon) {
      drawCooldownBar(ctx, p, s.equippedWeapon);
    }

    ctx.restore();

    // ── HUD (screen-space, drawn AFTER ctx.restore) ──────────────────────
    drawHUD(ctx, s, colors, W, H);
  };

  // ── Render loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastFrameTime = 0;
    const fps = 8;

    const render = (timestamp: number) => {
      update();
      if (timestamp - lastFrameTime > 1000 / fps) {
        frameRef.current += 1;
        lastFrameTime = timestamp;
      }
      draw(ctx);
      animId = window.requestAnimationFrame(render);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (['KeyW','KeyA','KeyS','KeyD','KeyF','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
      state.current.keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => { state.current.keys[e.code] = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    animId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.cancelAnimationFrame(animId);
    };
  }, [armor]);

  return (
    <div className="aq-game-container" style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} width={480} height={300} className="aq-game-canvas" />
    </div>
  );
}

// ── HUD drawing (screen-space, after camera restore) ──────────────────────
function drawHUD(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  colors: typeof THEME.light,
  W: number,
  _H: number
) {
  ctx.font = 'bold 12px DM Sans, system-ui, sans-serif';
  ctx.textAlign = 'left';

  // Top-left panel: scrolls + equipped weapon
  const padX = 10, padY = 10, lineH = 16;
  const lines: string[] = [];
  lines.push(`🪙 ${s.currency} scrolls`);
  if (s.equippedWeapon) {
    lines.push(`⚔ ${s.equippedWeapon.name}  (${s.equippedWeapon.damage} dmg)`);
  } else {
    lines.push('⚔ unarmed');
  }

  const panelW = 170;
  const panelH = padY * 2 + lineH * lines.length;
  ctx.fillStyle = colors.hudBg;
  ctx.fillRect(8, 8, panelW, panelH);
  ctx.strokeStyle = colors.hudBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, panelW, panelH);

  ctx.fillStyle = colors.hudText;
  lines.forEach((line, i) => {
    ctx.fillText(line, 8 + padX, 8 + padY + lineH * (i + 0.85));
  });

  // Bottom hint: F-key controls
  ctx.font = '10px DM Sans, system-ui, sans-serif';
  ctx.fillStyle = colors.hudText;
  ctx.globalAlpha = 0.75;
  const hint = 'F: pickup / drop / swap weapon · F on medkit: heal · Space: attack';
  const hintW = ctx.measureText(hint).width;
  ctx.fillText(hint, (W - hintW) / 2, 18);
  ctx.globalAlpha = 1;

  // Center toast: feedback text after F-action (auto-fades)
  if (s.feedback && Date.now() < s.feedback.until) {
    const remaining = s.feedback.until - Date.now();
    const alpha = Math.min(1, remaining / 400); // fade in last 400ms
    ctx.font = 'bold 14px DM Sans, system-ui, sans-serif';
    const tw = ctx.measureText(s.feedback.text).width;
    const boxW = tw + 28;
    const boxH = 28;
    const boxX = (W - boxW) / 2;
    const boxY = 36;
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = colors.feedbackBg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = colors.hudBorder;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.feedbackText;
    ctx.textAlign = 'center';
    ctx.fillText(s.feedback.text, W / 2, boxY + 19);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}
