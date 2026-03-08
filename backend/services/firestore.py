import os
from google.cloud import firestore

_db: firestore.AsyncClient | None = None


def get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        _db = firestore.AsyncClient(project=os.getenv("GOOGLE_CLOUD_PROJECT"))
    return _db


COLLECTION = os.getenv("FIRESTORE_COLLECTION", "citylens_sessions")


async def save_session_context(session_id: str, data: dict) -> None:
    """Persist session context (home address, preferences, visited places)."""
    try:
        db = get_db()
        await db.collection(COLLECTION).document(session_id).set(data, merge=True)
    except Exception as e:
        print(f"[Firestore] Write failed: {e}")


async def get_session_context(session_id: str) -> dict:
    """Retrieve persisted session context."""
    try:
        db = get_db()
        doc = await db.collection(COLLECTION).document(session_id).get()
        return doc.to_dict() or {}
    except Exception as e:
        print(f"[Firestore] Read failed: {e}")
        return {}


async def append_visited_place(session_id: str, place: str) -> None:
    """Add a visited place to the session log."""
    try:
        db = get_db()
        await db.collection(COLLECTION).document(session_id).set(
            {"visited_places": firestore.ArrayUnion([place])}, merge=True
        )
    except Exception as e:
        print(f"[Firestore] Append failed: {e}")
