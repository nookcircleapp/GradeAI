"""Config-driven model registry for multi-model grading.

Adding a new model MUST be a new entry in ``MODEL_REGISTRY`` and nothing else —
the grading service reads everything it needs (api model string, base_url, which
settings field holds the key, prices) from the ``ModelSpec``.

Every provider is reached through the OpenAI-compatible ``AsyncOpenAI`` client
with a swapped ``base_url``, so future providers are one entry each:

    Gemini     -> base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                  api_key_setting="gemini_api_key"
    OpenRouter -> base_url="https://openrouter.ai/api/v1",
                  api_key_setting="openrouter_api_key"

(Both would also need the matching ``*_api_key`` field added to ``Settings``.)

------------------------------------------------------------------------------
PRICING PROVENANCE — these numbers are shown on stage, so they are auditable.
All prices are USD per 1,000,000 tokens, standard (non-batch, non-cached) tier.

OpenAI   source: https://developers.openai.com/api/docs/pricing
         model list: https://developers.openai.com/api/docs/models
         accessed: 2026-08-08
           gpt-5.6-sol   $5.00 in / $30.00 out   (flagship / frontier)
           gpt-4o-mini   $0.15 in /  $0.60 out   (budget, high-volume)

Groq     source: https://console.groq.com/docs/models  (production models table)
         accessed: 2026-08-08
           llama-3.3-70b-versatile  $0.59 in / $0.79 out
           llama-3.1-8b-instant     $0.05 in / $0.08 out
------------------------------------------------------------------------------
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


# Groq speaks the OpenAI chat-completions dialect at this base_url.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"


@dataclass(frozen=True)
class ModelSpec:
    """A single gradeable model. Everything the grading service needs."""

    id: str
    label: str
    provider: str
    tier: str  # "large" | "small"
    api_model_name: str
    base_url: str | None  # None -> the provider SDK default (OpenAI)
    api_key_setting: str  # attribute name on Settings holding the key
    price_in_per_mtok: float
    price_out_per_mtok: float
    # The GPT-5 family rejects any temperature other than the default 1
    # ("Unsupported value: 'temperature' does not support 0.3 with this model").
    # The *prompt* is identical across every model; only this provider-imposed
    # sampling knob differs, and it is declared here rather than in the grader.
    supports_temperature: bool = True
    # True -> the provider CONSTRAINS generation to our grade schema
    # (response_format={"type": "json_schema", ...}, strict), so malformed JSON
    # is impossible. False -> we can only ask for json_object, which the provider
    # validates *after* generation and rejects with a 400 when the model slips.
    # See SUPPORT NOTES above the registry for how each value was verified.
    supports_json_schema: bool = False
    # True -> the student view ticks this model on page load, so the side-by-side
    # comparison is the zero-click state. This registry is the single source of
    # truth for that default: the UI reads it from GET /api/models rather than
    # guessing "first available of each tier".
    # Expensive models are deliberately opt-in — gpt-5.6-sol ($5/$30 per 1M
    # tokens) stays selectable in the picker but is never billed by a casual
    # click on Try. Keep this in sync with GRADEAI_DEFAULT_MODEL_IDS, which is
    # the server-side fallback for requests that omit model_ids.
    default_selected: bool = False


# ---------------------------------------------------------------------------
# STRUCTURED-OUTPUT SUPPORT NOTES (`supports_json_schema`)
#
# OpenAI   supported. "Structured Outputs is available in our latest large
#          language models, starting with GPT-4o. For new projects, start with
#          gpt-5.6." Strict schemas require additionalProperties=false and every
#          property listed in "required" — both hold for our grade schema.
#          source: https://developers.openai.com/api/docs/guides/structured-outputs
#          accessed: 2026-08-08 (docs only — the demo OpenAI key has no credits)
#
# Groq     NOT supported for the Llama models. Only openai/gpt-oss-20b,
#          openai/gpt-oss-120b (strict) and openai/gpt-oss-safeguard-20b
#          (best-effort) accept response_format=json_schema.
#          source: https://console.groq.com/docs/structured-outputs
#          verified live 2026-08-08 against api.groq.com: both
#          llama-3.3-70b-versatile and llama-3.1-8b-instant answer a json_schema
#          request with HTTP 400 "This model does not support response format
#          `json_schema`", with strict true AND false. They fall back to
#          json_object, which is why the grader also needs the retry + salvage
#          path in app/services/grading.py.
# ---------------------------------------------------------------------------

MODEL_REGISTRY: dict[str, ModelSpec] = {
    "gpt-5.6-sol": ModelSpec(
        id="gpt-5.6-sol",
        label="GPT-5.6 Sol",
        provider="openai",
        tier="large",
        api_model_name="gpt-5.6-sol",
        base_url=None,
        api_key_setting="openai_api_key",
        price_in_per_mtok=5.00,
        price_out_per_mtok=30.00,
        supports_temperature=False,
        supports_json_schema=True,
    ),
    "gpt-4o-mini": ModelSpec(
        id="gpt-4o-mini",
        label="GPT-4o mini",
        provider="openai",
        tier="small",
        api_model_name="gpt-4o-mini",
        base_url=None,
        api_key_setting="openai_api_key",
        # source: https://developers.openai.com/api/docs/pricing
        # accessed: 2026-08-08
        price_in_per_mtok=0.15,
        price_out_per_mtok=0.60,
        supports_json_schema=True,
        default_selected=True,
    ),
    "llama-3.3-70b-versatile": ModelSpec(
        id="llama-3.3-70b-versatile",
        label="Llama 3.3 70B Versatile",
        provider="groq",
        tier="large",
        api_model_name="llama-3.3-70b-versatile",
        base_url=GROQ_BASE_URL,
        api_key_setting="groq_api_key",
        price_in_per_mtok=0.59,
        price_out_per_mtok=0.79,
    ),
    "llama-3.1-8b-instant": ModelSpec(
        id="llama-3.1-8b-instant",
        label="Llama 3.1 8B Instant",
        provider="groq",
        tier="small",
        api_model_name="llama-3.1-8b-instant",
        base_url=GROQ_BASE_URL,
        api_key_setting="groq_api_key",
        price_in_per_mtok=0.05,
        price_out_per_mtok=0.08,
        default_selected=True,
    ),
}


def get_model(model_id: str) -> ModelSpec | None:
    """Return the spec for ``model_id``, or None if it is not registered."""
    return MODEL_REGISTRY.get(model_id)


def list_models() -> list[ModelSpec]:
    """Every registered model, large tier first (matches the UI grouping)."""
    return sorted(
        MODEL_REGISTRY.values(),
        key=lambda spec: (0 if spec.tier == "large" else 1, spec.provider, spec.id),
    )


def get_api_key(spec: ModelSpec) -> str:
    """The configured API key for this model's provider ("" if unset)."""
    return (getattr(settings, spec.api_key_setting, "") or "").strip()


def is_available(spec: ModelSpec) -> bool:
    """True only if this model's provider key is configured and non-empty.

    The UI greys out unavailable models so nobody can pick one that cannot run.
    """
    return bool(get_api_key(spec))


def default_model_ids() -> list[str]:
    """Fallback model ids used when a request omits ``model_ids``."""
    raw = settings.default_model_ids or ""
    ids = [part.strip() for part in raw.split(",") if part.strip()]
    return [model_id for model_id in ids if model_id in MODEL_REGISTRY]
