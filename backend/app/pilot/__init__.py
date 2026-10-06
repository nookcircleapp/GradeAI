"""Pilot workflow: teacher accounts, papers, student submissions, contest.

Mounted alongside the original demo API. Everything lives under /api/pilot
and in pilot_* tables so the demo keeps working untouched.
"""
from fastapi import FastAPI


def register_pilot(api: FastAPI) -> None:
    from app.pilot import models  # noqa: F401  Register tables with SQLModel.metadata
    from app.pilot.bootstrap import on_startup
    from app.pilot.routers import admin, auth, papers, public

    for module in (auth, admin, papers, public):
        api.include_router(module.router)
    api.on_event("startup")(on_startup)
