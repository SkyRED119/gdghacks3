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
