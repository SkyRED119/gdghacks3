"""
Academia Quest — FastAPI Backend
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from .database import get_db, engine
from . import models, schemas, crud
from .auth import (
    verify_google_token,
    create_jwt,
    get_current_user,
    get_current_user_optional,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Academia Quest API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # lock down to your Vercel URL after hackathon
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "academia-quest"}


# ─── Auth ──────────────────────────────────────────────────────────────────

@app.post("/api/auth/google", response_model=schemas.GoogleAuthResponse)
async def google_auth(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Frontend sends Google ID token → we verify it → return our JWT.
    The user copies the JWT into the extension once.
    """
    google_data = await verify_google_token(payload.idToken)

    user_id = google_data["sub"]          # unique Google user ID
    email = google_data["email"]
    name = google_data.get("name")
    picture = google_data.get("picture")

    # Upsert user
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.name = name
        user.picture = picture
    else:
        user = models.User(id=user_id, email=email, name=name, picture=picture)
        db.add(user)
    db.commit()

    token = create_jwt(user_id, email)
    return schemas.GoogleAuthResponse(
        token=token,
        userId=user_id,
        email=email,
        name=name,
        picture=picture,
    )


# ─── User ──────────────────────────────────────────────────────────────────

@app.get("/api/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
        "xp": current_user.xp,
        "level": current_user.level,
        "streak": current_user.streak,
    }


# ─── Assignments ───────────────────────────────────────────────────────────

@app.post("/api/assignments/sync")
def sync_assignments(
    payload: schemas.AssignmentSyncPayload,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else None
    upserted = crud.upsert_assignments(db, payload.assignments, user_id=user_id)
    return {"ok": True, "upserted": upserted}


@app.post("/api/assignments/complete")
def complete_assignment(
    payload: schemas.CompletePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assignment = crud.mark_complete(db, payload.assignmentId, user_id=current_user.id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    # Award XP for completion
    current_user.xp = (current_user.xp or 0) + 100
    current_user.level = max(1, (current_user.xp // 1000) + 1)
    db.commit()
    return {"ok": True, "xpAwarded": 100, "totalXp": current_user.xp}


@app.get("/api/assignments")
def get_assignments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_assignments(db, user_id=current_user.id)


# ─── Grades ────────────────────────────────────────────────────────────────

@app.post("/api/grades/sync")
def sync_grades(
    payload: schemas.GradeSyncPayload,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else None
    upserted = crud.upsert_grades(db, payload.grades, user_id=user_id)
    return {"ok": True, "upserted": upserted}


@app.get("/api/grades")
def get_grades(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_grades(db, user_id=current_user.id)


# ─── Full sync (periodic alarm) ────────────────────────────────────────────

@app.post("/api/sync")
def full_sync(
    payload: schemas.FullSyncPayload,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else payload.userId
    if payload.assignments:
        crud.upsert_assignments(db, payload.assignments, user_id=user_id)
    if payload.grades:
        crud.upsert_grades(db, payload.grades, user_id=user_id)
    if payload.state and current_user:
        crud.update_user_state(db, current_user, payload.state)
    return {"ok": True}


# ─── Game ──────────────────────────────────────────────────────────────────
# In-memory sessions (replace with DB/Redis for production)
_game_sessions: dict = {}


# ─── Quest Arena: persistent armor / gems / unlocks state ──────────────────

@app.get("/api/game/me", response_model=schemas.GameStateOut)
def get_my_game_state(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return the authenticated user's persisted Quest Arena game state.
    Creates a default silver-armor record if the user has never played.
    """
    row = crud.get_or_create_game_state(db, current_user.id)
    return crud.serialize_game_state(row)


@app.put("/api/game/me", response_model=schemas.GameStateOut)
def save_my_game_state(
    payload: schemas.GameStateIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Replace the authenticated user's Quest Arena game state with the
    incoming payload. The frontend should call this whenever gems,
    armor, unlocks, or pending grades change. Server validates colors
    and clamps values, so it's safe to send the whole state blindly.
    """
    row = crud.upsert_game_state(db, current_user.id, payload)
    return crud.serialize_game_state(row)


BOSSES = [
    {"name": "The Procrastination Dragon", "emoji": "🐉", "maxHp": 300, "attack": 25},
    {"name": "The Deadline Demon",         "emoji": "👹", "maxHp": 250, "attack": 30},
    {"name": "The GPA Goblin",             "emoji": "👺", "maxHp": 200, "attack": 20},
]

XP_PER_BOSS_KILL = 200
PLAYER_MAX_HP = 200
PLAYER_BASE_ATTACK = 40


def _boss_for_level(level: int) -> dict:
    return BOSSES[(level - 1) % len(BOSSES)]


@app.post("/api/game/start")
def game_start(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Start a new boss-raid session for the authenticated user."""
    boss = _boss_for_level(current_user.level)
    session_id = str(uuid.uuid4())
    _game_sessions[session_id] = {
        "userId": current_user.id,
        "boss": boss.copy(),
        "bossHp": boss["maxHp"],
        "playerHp": PLAYER_MAX_HP,
        "turn": 1,
        "log": [f"A wild {boss['name']} {boss['emoji']} appears!"],
        "over": False,
        "won": False,
    }
    return {
        "sessionId": session_id,
        "boss": boss,
        "playerHp": PLAYER_MAX_HP,
        "bossHp": boss["maxHp"],
        "playerAttack": PLAYER_BASE_ATTACK,
        "log": _game_sessions[session_id]["log"],
    }


@app.post("/api/game/action")
def game_action(
    payload: schemas.GameActionPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Process one player action.
    action: "attack" | "defend" | "skill"
    """
    import random

    session = _game_sessions.get(payload.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session["over"]:
        raise HTTPException(status_code=400, detail="Battle is already over")

    log = []

    # ── Player turn
    if payload.action == "attack":
        dmg = random.randint(
            int(PLAYER_BASE_ATTACK * 0.8), int(PLAYER_BASE_ATTACK * 1.2)
        )
        session["bossHp"] = max(0, session["bossHp"] - dmg)
        log.append(f"You attack for {dmg} damage!")
    elif payload.action == "defend":
        # Reduce next boss hit by 50 % (flag it)
        session["defending"] = True
        log.append("You brace for impact! (next hit -50%)")
    elif payload.action == "skill":
        # Big hit, costs nothing for now
        dmg = random.randint(
            int(PLAYER_BASE_ATTACK * 1.4), int(PLAYER_BASE_ATTACK * 1.8)
        )
        session["bossHp"] = max(0, session["bossHp"] - dmg)
        log.append(f"✨ Power Strike! {dmg} damage!")
    else:
        raise HTTPException(status_code=400, detail="Unknown action")

    # Check boss death
    if session["bossHp"] <= 0:
        session["over"] = True
        session["won"] = True
        log.append(f"🏆 You defeated {session['boss']['name']}!")
        # Award XP
        current_user.xp = (current_user.xp or 0) + XP_PER_BOSS_KILL
        current_user.level = max(1, (current_user.xp // 1000) + 1)
        db.commit()
        session["log"] += log
        return {**_session_view(session), "xpAwarded": XP_PER_BOSS_KILL}

    # ── Boss turn
    boss_dmg = random.randint(
        int(session["boss"]["attack"] * 0.8),
        int(session["boss"]["attack"] * 1.2),
    )
    if session.pop("defending", False):
        boss_dmg = boss_dmg // 2
    session["playerHp"] = max(0, session["playerHp"] - boss_dmg)
    log.append(f"{session['boss']['emoji']} Boss attacks for {boss_dmg}!")

    if session["playerHp"] <= 0:
        session["over"] = True
        session["won"] = False
        log.append("💀 You were defeated… Try again!")

    session["turn"] += 1
    session["log"] += log
    return _session_view(session)


@app.get("/api/game/state/{session_id}")
def game_state(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
):
    session = _game_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return _session_view(session)


def _session_view(s: dict) -> dict:
    return {
        "sessionId": s.get("sessionId", ""),
        "boss": s["boss"],
        "bossHp": s["bossHp"],
        "playerHp": s["playerHp"],
        "turn": s["turn"],
        "log": s["log"][-6:],   # last 6 log lines
        "over": s["over"],
        "won": s["won"],
        "xpAwarded": 0,
    }
