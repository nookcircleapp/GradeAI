from __future__ import annotations

from fastapi import APIRouter

from app.models_registry import is_available, list_models
from app.schemas.submission import ModelInfo


router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models", response_model=list[ModelInfo])
def get_models() -> list[ModelInfo]:
    """Every model in the registry, with live `available`/`default_selected` flags.

    `available` is True only when that provider's API key is configured, so the
    UI can grey out models that cannot possibly run. `default_selected` is the
    registry's opinion about which models the student view should pre-tick on
    load; expensive models are deliberately left out of it.
    """
    return [
        ModelInfo(
            id=spec.id,
            label=spec.label,
            provider=spec.provider,
            tier=spec.tier,
            available=is_available(spec),
            default_selected=spec.default_selected,
            price_in_per_mtok=spec.price_in_per_mtok,
            price_out_per_mtok=spec.price_out_per_mtok,
        )
        for spec in list_models()
    ]
