"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.routers.chat import router as chat_router
from backend.routers.health import router as health_router


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        database = getattr(app.state, "shopping_database", None)
        if database is not None:
            await database.close()

    app = FastAPI(title="Shopping Agent API", version="0.1.0", lifespan=lifespan)
    app.state.shopping_database = None
    app.state.shopping_graph = None
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(chat_router)
    return app


app = create_app()
