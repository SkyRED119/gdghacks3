from pydantic import BaseModel
from typing import Optional, List


class AssignmentIn(BaseModel):
    id: str
    courseId: Optional[str] = None
    course: Optional[str] = None
    title: str
    dueDate: Optional[str] = None
    status: Optional[str] = "pending"
    grade: Optional[float] = None
    maxGrade: Optional[float] = None
    priority: Optional[float] = None
    url: Optional[str] = None
    source: Optional[str] = None
    syncedAt: Optional[str] = None
    completedAt: Optional[str] = None
    class Config:
        extra = "allow"


class GradeIn(BaseModel):
    id: str
    courseId: Optional[str] = None
    course: Optional[str] = None
    title: str
    grade: Optional[float] = None
    maxGrade: Optional[float] = None
    percentage: Optional[float] = None
    source: Optional[str] = None
    class Config:
        extra = "allow"


class UserStateIn(BaseModel):
    xp: Optional[int] = 0
    level: Optional[int] = 1
    streak: Optional[int] = 0
    lastActiveDate: Optional[str] = None
    userId: Optional[str] = None
    userName: Optional[str] = None
    class Config:
        extra = "allow"


# ─── Auth ──────────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    idToken: str                  # Google ID token from frontend

class GoogleAuthResponse(BaseModel):
    token: str                    # our JWT — store this in the extension
    userId: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None


# ─── Sync payloads ─────────────────────────────────────────────────────────

class AssignmentSyncPayload(BaseModel):
    assignments: List[AssignmentIn]

class GradeSyncPayload(BaseModel):
    grades: List[GradeIn]

class CompletePayload(BaseModel):
    assignmentId: str

class FullSyncPayload(BaseModel):
    userId: Optional[str] = None
    assignments: Optional[List[AssignmentIn]] = None
    grades: Optional[List[GradeIn]] = None
    state: Optional[UserStateIn] = None


# ─── Game ──────────────────────────────────────────────────────────────────

class GameActionPayload(BaseModel):
    sessionId: str
    action: str   # "attack" | "defend" | "skill"
