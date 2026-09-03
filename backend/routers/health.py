"""Health endpoint used by local and hosting checks."""

from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
