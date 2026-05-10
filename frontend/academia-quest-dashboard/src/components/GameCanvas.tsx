import { useEffect, useRef } from 'react';
import {
  drawCooldownBar,
  drawGrid,
  processInteractions,
  updatePlayerPhysics,
  type GameState,
  type Rect,
} from '../engine';

export type ArmorColor = 'silver' | 'red' | 'blue' | 'gold' | 'black';
export type ArmorSlot = 'head' | 'chest' | 'legs';
export type ArmorSelection = Record<ArmorSlot, ArmorColor>;

type Direction = 'up' | 'down' | 'left' | 'right';
type Action = 'idle' | 'run' | 'slash';

type GameCanvasProps = {
  armor: ArmorSelection;
};

type SpriteImageMap = Record<ArmorSlot, Record<ArmorColor, Record<Action, HTMLImageElement>>>;

type PlayerAnimationState = {
  direction: Direction;
  action: Action;
  slashUntil: number;
  slashStart: number;
  spaceWasDown: boolean;
};

const FRAME_SIZE = 64;

const ACTION_FRAMES: Record<Action, number> = {
  idle: 2,
  run: 8,
  slash: 6,
};

// Standard LPC sprite layout used by the source sheets:
//   row 0 = facing up, row 1 = facing left, row 2 = facing down, row 3 = facing right
const DIRECTION_ROW: Record<Direction, number> = {
  up: 0,
  left: 1,
  down: 2,
  right: 3,
};

const SLASH_DURATION_MS = 750;

// Drawing order — legs first, then chest, then head — matters so the helmet
// sits visually on top of the body.
const DRAW_ORDER: ArmorSlot[] = ['legs', 'chest', 'head'];
const ARMOR_COLORS: ArmorColor[] = ['silver', 'red', 'blue', 'gold', 'black'];
const ALL_ACTIONS: Action[] = ['idle', 'run', 'slash'];

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

function getInputDirection(keys: Record<string, boolean>): Direction | null {
  if (keys['KeyW'] || keys['ArrowUp']) return 'up';
  if (keys['KeyA'] || keys['ArrowLeft']) return 'left';
  if (keys['KeyD'] || keys['ArrowRight']) return 'right';
  if (keys['KeyS'] || keys['ArrowDown']) return 'down';
  return null;
}

function isMoving(keys: Record<string, boolean>) {
  return Boolean(
    keys['KeyW'] ||
      keys['ArrowUp'] ||
      keys['KeyA'] ||
      keys['ArrowLeft'] ||
      keys['KeyS'] ||
      keys['ArrowDown'] ||
      keys['KeyD'] ||
      keys['ArrowRight']
  );
}

function drawArmorSprite(
  ctx: CanvasRenderingContext2D,
  images: SpriteImageMap,
  armor: ArmorSelection,
  x: number,
  y: number,
  action: Action,
  direction: Direction,
  frame: number
) {
  const row = DIRECTION_ROW[direction];
  const frameCount = ACTION_FRAMES[action];
  const frameIndex = frame % frameCount;
  const sourceX = frameIndex * FRAME_SIZE;
  const sourceY = row * FRAME_SIZE;

  DRAW_ORDER.forEach((slot) => {
    const img = images[slot][armor[slot]][action];
    if (!img.complete || img.naturalWidth === 0) return;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      FRAME_SIZE,
      FRAME_SIZE,
      x,
      y,
      FRAME_SIZE,
      FRAME_SIZE
    );
  });
}

export function GameCanvas({ armor }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<SpriteImageMap>(createSpriteImages());
  const animationRef = useRef<PlayerAnimationState>({
    direction: 'down',
    action: 'idle',
    slashUntil: 0,
    slashStart: 0,
    spaceWasDown: false,
  });
  const frameRef = useRef(0);

  const resellStation: Rect = { x: 500, y: 300, width: 80, height: 80 };

  const state = useRef<GameState>({
    player: {
      x: 50,
      y: 50,
      width: 64,
      height: 64,
      vx: 0,
      vy: 0,
      accel: 0.8,
      friction: 0.85,
      maxSpeed: 6,
      color: '#3498db',
      lastAttack: 0,
    },
    otherPlayers: {},
    dummy: { x: 260, y: 240, width: 64, height: 64, hp: 100, maxHp: 100, isDead: false, respawnTimer: 0 },
    worldItems: [],
    currency: 0,
    equippedWeapon: { id: 1, name: 'Training Sword', x: 0, y: 0, width: 30, height: 30, price: 0, damage: 10, speed: 1.5, color: '#bdc3c7' },
    keys: {},
  });

  const update = () => {
    const s = state.current;
    const now = Date.now();
    const anim = animationRef.current;

    const spaceDown = !!s.keys['Space'];
    const slashing = now < anim.slashUntil;

    // Update facing direction from input ONLY when not mid-slash.
    // During slash we lock the direction so the swing always finishes facing
    // the way the player was last running.
    if (!slashing) {
      const inputDirection = getInputDirection(s.keys);
      if (inputDirection) {
        anim.direction = inputDirection;
      }
    }

    // Trigger a fresh slash on the rising edge of Space (so holding Space
    // doesn't restart the animation every frame).
    if (spaceDown && !anim.spaceWasDown && !slashing) {
      anim.action = 'slash';
      anim.slashStart = now;
      anim.slashUntil = now + SLASH_DURATION_MS;
    } else if (slashing) {
      anim.action = 'slash';
    } else if (isMoving(s.keys)) {
      anim.action = 'run';
    } else {
      // Idle keeps the last facing direction we set above.
      anim.action = 'idle';
    }

    anim.spaceWasDown = spaceDown;

    updatePlayerPhysics(s.player, s.keys);
    processInteractions(s, resellStation);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = state.current;
    const p = s.player;
    const animation = animationRef.current;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.translate(-p.x + ctx.canvas.width / 2, -p.y + ctx.canvas.height / 2);

    drawGrid(ctx);

    ctx.fillStyle = '#c0392b';
    ctx.fillRect(resellStation.x, resellStation.y, resellStation.width, resellStation.height);
    ctx.fillStyle = '#111110';
    ctx.font = 'bold 12px DM Sans, system-ui, sans-serif';
    ctx.fillText('Sell Zone', resellStation.x + 10, resellStation.y + 45);

    ctx.fillStyle = s.dummy.isDead ? '#a8e6cf' : '#5a7a3e';
    ctx.fillRect(s.dummy.x, s.dummy.y, s.dummy.width, s.dummy.height);

    if (!s.dummy.isDead) {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(s.dummy.x, s.dummy.y - 10, (s.dummy.hp / s.dummy.maxHp) * s.dummy.width, 5);
    }

    // For slash, compute the frame from elapsed time since the slash started so
    // it always plays cleanly from frame 0 through the last frame, regardless
    // of where the global frame counter happens to be.
    let displayFrame = frameRef.current;
    if (animation.action === 'slash') {
      const elapsed = Date.now() - animation.slashStart;
      const slashFps = (ACTION_FRAMES.slash * 1000) / SLASH_DURATION_MS;
      displayFrame = Math.min(
        Math.floor((elapsed / 1000) * slashFps),
        ACTION_FRAMES.slash - 1
      );
    }

    drawArmorSprite(
      ctx,
      imagesRef.current,
      armor,
      p.x,
      p.y,
      animation.action,
      animation.direction,
      displayFrame
    );

    if (s.equippedWeapon) {
      drawCooldownBar(ctx, p, s.equippedWeapon);
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastFrameTime = 0;
    const fps = 8;

    const render = (timestamp: number) => {
      update();

      if (timestamp - lastFrameTime > 1000 / fps) {
        frameRef.current += 1;
        lastFrameTime = timestamp;
      }

      draw(ctx);
      animationFrameId = window.requestAnimationFrame(render);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      state.current.keys[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      state.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [armor]);

  return (
    <div className="aq-game-container">
      <canvas ref={canvasRef} width={760} height={460} className="aq-game-canvas" />
    </div>
  );
}
