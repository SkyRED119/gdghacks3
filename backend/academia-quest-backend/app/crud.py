from sqlalchemy.orm import Session
from typing import List, Optional
from . import models, schemas


def upsert_assignments(db, assignments, user_id=None):
    count = 0
    for a in assignments:
        existing = db.query(models.Assignment).filter(models.Assignment.id == a.id).first()
        if existing:
            existing.course_id = a.courseId
            existing.course = a.course
            existing.title = a.title
            existing.due_date = a.dueDate
            existing.status = a.status
            existing.grade = a.grade
            existing.max_grade = a.maxGrade
            existing.priority = a.priority
            existing.url = a.url
            existing.source = a.source
            existing.synced_at = a.syncedAt
            if user_id:
                existing.user_id = user_id
        else:
            db.add(models.Assignment(
                id=a.id, user_id=user_id, course_id=a.courseId,
                course=a.course, title=a.title, due_date=a.dueDate,
                status=a.status, grade=a.grade, max_grade=a.maxGrade,
                priority=a.priority or 0.0, url=a.url, source=a.source,
                synced_at=a.syncedAt,
            ))
            count += 1
    db.commit()
    return count


def mark_complete(db, assignment_id, user_id=None):
    q = db.query(models.Assignment).filter(models.Assignment.id == assignment_id)
    if user_id:
        q = q.filter(models.Assignment.user_id == user_id)
    a = q.first()
    if not a:
        return None
    a.status = "submitted"
    db.commit()
    return a


def get_assignments(db, user_id=None):
    q = db.query(models.Assignment)
    if user_id:
        q = q.filter(models.Assignment.user_id == user_id)
    return q.order_by(models.Assignment.priority.desc()).all()


def upsert_grades(db, grades, user_id=None):
    count = 0
    for g in grades:
        existing = db.query(models.Grade).filter(models.Grade.id == g.id).first()
        if existing:
            existing.grade = g.grade
            existing.max_grade = g.maxGrade
            existing.percentage = g.percentage
            existing.source = g.source
            if user_id:
                existing.user_id = user_id
        else:
            db.add(models.Grade(
                id=g.id, user_id=user_id, course_id=g.courseId,
                course=g.course, title=g.title, grade=g.grade,
                max_grade=g.maxGrade, percentage=g.percentage, source=g.source,
            ))
            count += 1
    db.commit()
    return count


def get_grades(db, user_id=None):
    q = db.query(models.Grade)
    if user_id:
        q = q.filter(models.Grade.user_id == user_id)
    return q.all()


def update_user_state(db, user: models.User, state: schemas.UserStateIn):
    if state.xp is not None:
        user.xp = state.xp
    if state.level is not None:
        user.level = state.level
    if state.streak is not None:
        user.streak = state.streak
    if state.lastActiveDate:
        user.last_active_date = state.lastActiveDate
    db.commit()


# ─── Quest Arena game state ────────────────────────────────────────────────

import json

_ARMOR_SLOTS = ("head", "chest", "legs")
_VALID_COLORS = {"silver", "red", "blue", "gold", "black"}


def _safe_color(value, default="silver"):
    """Coerce an incoming color string to a valid choice, falling back to default."""
    if isinstance(value, str) and value in _VALID_COLORS:
        return value
    return default


def _safe_color_list(values):
    """Coerce a list of colors into a deduped, validated list. Always includes silver."""
    if not isinstance(values, list):
        values = []
    out = ["silver"]
    seen = {"silver"}
    for v in values:
        if isinstance(v, str) and v in _VALID_COLORS and v not in seen:
            out.append(v)
            seen.add(v)
    return out


def serialize_game_state(row: models.GameState) -> dict:
    """Serialize a GameState row to the JSON shape the frontend expects."""
    try:
        unlocks_head = json.loads(row.unlocks_head)
    except (TypeError, ValueError):
        unlocks_head = ["silver"]
    try:
        unlocks_chest = json.loads(row.unlocks_chest)
    except (TypeError, ValueError):
        unlocks_chest = ["silver"]
    try:
        unlocks_legs = json.loads(row.unlocks_legs)
    except (TypeError, ValueError):
        unlocks_legs = ["silver"]
    try:
        pending_grades = json.loads(row.pending_grades)
    except (TypeError, ValueError):
        pending_grades = []

    return {
        "gems": int(row.gems or 0),
        "armor": {
            "head": _safe_color(row.armor_head),
            "chest": _safe_color(row.armor_chest),
            "legs": _safe_color(row.armor_legs),
        },
        "unlocks": {
            "head": _safe_color_list(unlocks_head),
            "chest": _safe_color_list(unlocks_chest),
            "legs": _safe_color_list(unlocks_legs),
        },
        "pendingGrades": pending_grades if isinstance(pending_grades, list) else [],
    }


def get_or_create_game_state(db, user_id: str) -> models.GameState:
    """Fetch the user's game state, or create a fresh silver-default record."""
    row = db.query(models.GameState).filter(models.GameState.user_id == user_id).first()
    if row:
        return row
    row = models.GameState(
        user_id=user_id,
        gems=0,
        armor_head="silver",
        armor_chest="silver",
        armor_legs="silver",
        unlocks_head='["silver"]',
        unlocks_chest='["silver"]',
        unlocks_legs='["silver"]',
        pending_grades='[]',
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def upsert_game_state(db, user_id: str, payload: schemas.GameStateIn) -> models.GameState:
    """Replace the user's game state with the incoming payload. Validates colors."""
    row = db.query(models.GameState).filter(models.GameState.user_id == user_id).first()
    if not row:
        row = models.GameState(user_id=user_id)
        db.add(row)

    armor = payload.armor or {}
    unlocks = payload.unlocks or {}

    row.gems = max(0, int(payload.gems or 0))
    row.armor_head = _safe_color(armor.get("head"))
    row.armor_chest = _safe_color(armor.get("chest"))
    row.armor_legs = _safe_color(armor.get("legs"))
    row.unlocks_head = json.dumps(_safe_color_list(unlocks.get("head")))
    row.unlocks_chest = json.dumps(_safe_color_list(unlocks.get("chest")))
    row.unlocks_legs = json.dumps(_safe_color_list(unlocks.get("legs")))

    # Pending grades: trust shape from Pydantic, but cap list to 200 entries.
    grades = [g.model_dump() for g in (payload.pendingGrades or [])][:200]
    row.pending_grades = json.dumps(grades)

    db.commit()
    db.refresh(row)
    return row
