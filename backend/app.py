"""FastAPI bridge from the browser game to the real MaleCNS simulation."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field, field_validator

from .brain import BrainNotTrainedError, MaleCNSConnectFour

brain: MaleCNSConnectFour | None = None
startup_error: str | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global brain, startup_error
    try:
        brain = await run_in_threadpool(MaleCNSConnectFour, require_model=False)
        startup_error = None
    except Exception as error:  # surfaced through /health rather than hidden
        startup_error = str(error)
    yield


app = FastAPI(
    title="Fly Four MaleCNS Brain",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1_000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "FLY_FOUR_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class DecisionRequest(BaseModel):
    board: list[int] = Field(min_length=42, max_length=42)
    shape: tuple[int, int] = (6, 7)
    legalColumns: list[int]

    @field_validator("board")
    @classmethod
    def board_values_are_valid(cls, values: list[int]):
        if any(value not in (-1, 0, 1) for value in values):
            raise ValueError("board values must be -1, 0, or 1")
        return values


class RewardRequest(BaseModel):
    board: list[int] = Field(min_length=42, max_length=42)
    selectedColumn: int = Field(ge=0, le=6)
    reward: Literal[-1, 0, 1]
    result: Literal["human", "fly", "draw"]


def require_brain(require_model: bool = True) -> MaleCNSConnectFour:
    if brain is None:
        raise HTTPException(
            status_code=503,
            detail=f"MaleCNS brain failed to load: {startup_error or 'unknown error'}",
        )
    if require_model and brain.readout is None:
        raise HTTPException(
            status_code=503,
            detail="MaleCNS data loaded, but the Connect Four readout is not trained. "
            "Run `npm run brain:train`.",
        )
    return brain


@app.get("/health")
async def health():
    if brain is None:
        return {"ready": False, "error": startup_error}
    return brain.status()


@app.get("/neurons")
async def neurons():
    active_brain = require_brain(require_model=False)
    positions, localized_count = await run_in_threadpool(active_brain.coordinates)
    return {
        "source": "MaleCNS-v1.0",
        "count": int(len(positions)),
        "localizedCount": localized_count,
        "unlocalizedCount": int(len(positions) - localized_count),
        "neurons": positions.tolist(),
    }


@app.post("/decide")
async def decide(request: DecisionRequest):
    active_brain = require_brain()
    computed_legal = [
        column for column, value in enumerate(request.board[:7]) if value == 0
    ]
    if sorted(request.legalColumns) != computed_legal:
        raise HTTPException(status_code=422, detail="legalColumns does not match the board")
    try:
        return await run_in_threadpool(active_brain.decide, request.board)
    except (ValueError, BrainNotTrainedError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/reward")
async def reward(request: RewardRequest):
    log_path = Path(os.environ.get("FLY_REWARD_LOG", "backend/models/rewards.jsonl"))
    log_path.parent.mkdir(parents=True, exist_ok=True)
    event = {
        **request.model_dump(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dataset": "MaleCNS v1.0",
    }
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, separators=(",", ":")) + "\n")
    return {"logged": True}
