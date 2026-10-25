"""FastAPI application entry point.

    uvicorn app.main:app --reload

The service starts even when PostgreSQL is unreachable. That is intentional:
the ML endpoints need no database, so a missing connection string should
degrade the service rather than prevent it booting, and ``/health`` is then
able to tell you exactly what is wrong. A hard failure at startup would just
hide the diagnosis behind a stack trace.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import (
    auth,
    books,
    clients,
    collaboration,
    compliance,
    copilot,
    dashboard,
    documents,
    gst_runs,
    income_tax,
    ledger,
    notices,
    onboarding,
    payroll,
    recon,
    reports,
    risk,
    risk_runs,
    secretarial,
    security,
)
from app.core.config import settings
from app.core.database import check_connection, ensure_extensions
from app.ml.ledger.predict import get_classifier

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ca_os")

#: Set by the startup probe and reported by /health.
_state: dict[str, object] = {"db_ok": False, "db_detail": "not checked", "model": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting %s (%s)", settings.PROJECT_NAME, settings.ENV)

    db_ok, db_detail = check_connection()
    _state["db_ok"] = db_ok
    _state["db_detail"] = db_detail
    if db_ok:
        logger.info("database: %s", db_detail)
        ensure_extensions()
    else:
        logger.warning(
            "database unreachable: %s\n"
            "  The ML endpoints will still work. To fix, set DATABASE_URL in .env -\n"
            "  see README.md -> 'Connecting PostgreSQL'.",
            db_detail,
        )

    # Load the model eagerly so the first request does not pay for it.
    classifier = get_classifier()
    _state["model"] = classifier.version if classifier else None
    if classifier is None:
        logger.warning(
            "no ledger model found in %s - /ledger/classify will return 503 until you run "
            "scripts/train_ledger_classifier.py",
            settings.MODEL_DIR,
        )

    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    yield
    logger.info("shutting down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    summary="AI operating system for Indian chartered accountancy practices",
    description=(
        "Backend for CA-OS. The machine-learning features are documented in "
        "`app/ml/*/README.md`; where a model is used, the endpoint returns the "
        "confidence and the rows the answer came from rather than an "
        "unexplained verdict."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Server-side duration, so a slow ML call is visible without a profiler."""
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Response-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


# ------------------------------------------------------ error handling ------


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Flatten FastAPI's nested validation errors into something a frontend can
    map straight onto form fields."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request body failed validation",
            "errors": [
                {
                    "field": ".".join(str(p) for p in error["loc"][1:]) or "body",
                    "message": error["msg"],
                }
                for error in exc.errors()
            ],
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_handler(request: Request, exc: SQLAlchemyError):
    """Never let a driver error reach the client verbatim.

    Database messages quote table names, constraint names and sometimes the
    offending value - a disclosure problem on a multi-tenant system. The detail
    goes to the log; the caller gets a sentence.
    """
    logger.error("database error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "The database is unavailable or rejected the request"},
    )


# ---------------------------------------------------------------- routes ----

for module in (
    auth,
    dashboard,  # before clients: /clients-overview must not be read as a client id
    clients,
    onboarding,
    documents,
    ledger,
    books,
    recon,
    gst_runs,
    risk,
    risk_runs,
    compliance,
    notices,
    income_tax,
    payroll,
    secretarial,
    collaboration,
    reports,
    security,
    copilot,
):
    app.include_router(module.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["meta"], summary="Liveness and dependency status")
def health() -> dict:
    """Reports each dependency separately.

    A single boolean would be useless here - "degraded because pgvector is
    missing" and "degraded because the password is wrong" need different
    actions, so the response names which part is unhappy.
    """
    db_ok, db_detail = check_connection()
    _state["db_ok"], _state["db_detail"] = db_ok, db_detail

    classifier = get_classifier()
    components = {
        "database": {"ok": db_ok, "detail": db_detail},
        "ledger_model": {
            "ok": classifier is not None,
            "detail": classifier.version if classifier else "not trained",
        },
    }
    return {
        "status": "ok" if all(c["ok"] for c in components.values()) else "degraded",
        "environment": settings.ENV,
        "components": components,
    }


@app.get("/", tags=["meta"], include_in_schema=False)
def root() -> dict:
    return {
        "service": settings.PROJECT_NAME,
        "docs": "/api/docs",
        "health": "/health",
    }
