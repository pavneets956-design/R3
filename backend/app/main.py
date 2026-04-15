from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import post_status as post_status_router
from app.routes import risk as risk_router
from app.routes import risk_summary as risk_summary_router

app = FastAPI(title="R3 Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(post_status_router.router, prefix="/api/v1")
app.include_router(risk_router.router, prefix="/api/v1")
app.include_router(risk_summary_router.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
