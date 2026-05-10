import { useMemo, useState } from 'react';
import { GameCanvas, type ArmorColor, type ArmorSlot, type ArmorSelection } from './GameCanvas';
import './App.css';

const AVAILABLE_COLORS: ArmorColor[] = ['silver', 'red', 'blue', 'gold', 'black'];
const ARMOR_SLOTS: ArmorSlot[] = ['head', 'chest', 'legs'];
const ITEM_COST = 10;

type Unlocks = Record<ArmorSlot, ArmorColor[]>;

type GradeInput = {
  id: number;
  name: string;
  percent: number;
};

const STARTING_ARMOR: ArmorSelection = {
  head: 'silver',
  chest: 'silver',
  legs: 'silver',
};

const STARTING_UNLOCKS: Unlocks = {
  head: ['silver'],
  chest: ['silver'],
  legs: ['silver'],
};

function gemsForGrade(percent: number) {
  if (percent < 50) return 0;
  if (percent < 60) return 2;
  if (percent < 70) return 4;
  if (percent < 80) return 6;
  if (percent < 90) return 8;
  return 10;
}

function slotLabel(slot: ArmorSlot) {
  if (slot === 'head') return 'Helmet';
  if (slot === 'chest') return 'Upper Body';
  return 'Lower Body';
}

function colorLabel(color: ArmorColor) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [gems, setGems] = useState(0);
  const [armor, setArmor] = useState<ArmorSelection>(STARTING_ARMOR);
  const [unlocks, setUnlocks] = useState<Unlocks>(STARTING_UNLOCKS);
  const [grades, setGrades] = useState<GradeInput[]>([
    { id: 1, name: 'Example Midterm', percent: 92 },
  ]);

  const earnedGemPreview = useMemo(() => {
    return grades.reduce((total, grade) => total + gemsForGrade(grade.percent), 0);
  }, [grades]);

  function claimGradeGems() {
    setGems((current) => current + earnedGemPreview);
    setGrades([]);
  }

  function addTestGrade(percent: number) {
    setGrades((current) => [
      ...current,
      {
        id: Date.now(),
        name: `Test Grade ${percent}%`,
        percent,
      },
    ]);
  }

  function buyColor(slot: ArmorSlot, color: ArmorColor) {
    const alreadyOwned = unlocks[slot].includes(color);

    if (alreadyOwned) {
      setArmor((current) => ({ ...current, [slot]: color }));
      return;
    }

    if (gems < ITEM_COST) return;

    setGems((current) => current - ITEM_COST);
    setUnlocks((current) => ({
      ...current,
      [slot]: [...current[slot], color],
    }));
    setArmor((current) => ({ ...current, [slot]: color }));
  }

  if (!gameStarted) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card hero-card">
          <p className="eyebrow">Academia Quest</p>
          <h1>Turn grades into gear.</h1>
          <p className="hero-copy">
            Start with silver armor. Earn gems from good grades. Spend gems on new helmet,
            upper body, and lower body armor colors.
          </p>

          <div className="rules-grid">
            <div><strong>&lt; 50%</strong><span>0 gems</span></div>
            <div><strong>50-59%</strong><span>2 gems</span></div>
            <div><strong>60-69%</strong><span>4 gems</span></div>
            <div><strong>70-79%</strong><span>6 gems</span></div>
            <div><strong>80-89%</strong><span>8 gems</span></div>
            <div><strong>90%+</strong><span>10 gems</span></div>
          </div>

          <button className="primary-button" onClick={() => setGameStarted(true)}>
            Start Game
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="game-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Academia Quest</p>
          <h1>Armor Arena</h1>
        </div>

        <div className="topbar-actions">
          <div className="gem-pill">💎 {gems} gems</div>
          <button className="secondary-button" onClick={() => setShopOpen(true)}>
            Open Armor Shop
          </button>
        </div>
      </header>

      <section className="game-layout">
        <GameCanvas armor={armor} />

        <aside className="side-panel">
          <div className="panel-card">
            <h2>Controls</h2>
            <p><kbd>W</kbd> run up</p>
            <p><kbd>A</kbd> run left</p>
            <p><kbd>S</kbd> run down</p>
            <p><kbd>D</kbd> run right</p>
            <p><kbd>Space</kbd> slash facing direction</p>
          </div>

          <div className="panel-card">
            <h2>Equipped Armor</h2>
            {ARMOR_SLOTS.map((slot) => (
              <p key={slot}>
                <strong>{slotLabel(slot)}:</strong> {colorLabel(armor[slot])}
              </p>
            ))}
          </div>

          <div className="panel-card">
            <h2>Grade Gem Test</h2>
            <p className="muted">Temporary until your D2L grade sync is connected.</p>
            <div className="grade-buttons">
              {[45, 55, 65, 75, 85, 95].map((grade) => (
                <button key={grade} onClick={() => addTestGrade(grade)}>{grade}%</button>
              ))}
            </div>
            <p>Pending gems: <strong>{earnedGemPreview}</strong></p>
            <button className="primary-button full" disabled={earnedGemPreview === 0} onClick={claimGradeGems}>
              Claim Grade Gems
            </button>
          </div>
        </aside>
      </section>

      {shopOpen && (
        <div className="modal-backdrop" onClick={() => setShopOpen(false)}>
          <section className="shop-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Armor Shop</p>
                <h2>Buy armor colors</h2>
                <p className="muted">Each locked color costs 10 gems. Silver is unlocked by default.</p>
              </div>
              <button className="icon-button" onClick={() => setShopOpen(false)}>×</button>
            </div>

            <div className="shop-grid">
              {ARMOR_SLOTS.map((slot) => (
                <div className="shop-section" key={slot}>
                  <h3>{slotLabel(slot)}</h3>
                  <div className="color-grid">
                    {AVAILABLE_COLORS.map((color) => {
                      const owned = unlocks[slot].includes(color);
                      const equipped = armor[slot] === color;
                      const disabled = !owned && gems < ITEM_COST;

                      return (
                        <button
                          key={`${slot}-${color}`}
                          className={`color-card ${equipped ? 'equipped' : ''}`}
                          disabled={disabled}
                          onClick={() => buyColor(slot, color)}
                        >
                          <span className={`swatch ${color}`} />
                          <strong>{colorLabel(color)}</strong>
                          <small>{owned ? (equipped ? 'Equipped' : 'Owned') : '10 gems'}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
