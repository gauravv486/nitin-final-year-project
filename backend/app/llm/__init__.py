"""Language-model providers.

Only drafting (notice replies, engagement letters, board minutes) and the
copilot's answers to legal questions use a language model. Ledger
classification, reconciliation, risk scoring and extraction are classical and
never call one.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from functools import lru_cache

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Completion:
    text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0


class LlmUnavailable(RuntimeError):
    """The configured provider cannot be used right now. The message says why."""


#: Qwen3 and other reasoning models emit their scratchpad between these tags.
#: It is not part of the answer and must never reach a drafted letter.
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str, model: str, timeout: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def status(self) -> tuple[bool, str]:
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=2.0)
            response.raise_for_status()
        except httpx.HTTPError:
            return False, f"Ollama is not running at {self.base_url}"
        names = {m.get("name", "") for m in response.json().get("models", [])}
        if not any(n == self.model or n.split(":")[0] == self.model.split(":")[0] for n in names):
            return False, f"Ollama is running but model {self.model} is not pulled (ollama pull {self.model})"
        return True, f"Ollama {self.model}"

    def complete(self, system: str, prompt: str, *, max_tokens: int = 1500) -> Completion:
        started = time.perf_counter()
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "think": False,
                    "options": {"temperature": 0.2, "num_predict": max_tokens},
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise LlmUnavailable(f"Ollama request failed: {exc}") from exc
        body = response.json()
        text = _THINK_RE.sub("", body.get("message", {}).get("content", "")).strip()
        return Completion(
            text=text,
            provider=self.name,
            model=self.model,
            prompt_tokens=int(body.get("prompt_eval_count") or 0),
            output_tokens=int(body.get("eval_count") or 0),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class AnthropicProvider:
    """Claude via the Messages API.

    Plain HTTP rather than the SDK: it is one endpoint, and one fewer
    dependency is one fewer thing to keep current.
    """

    name = "anthropic"
    url = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str, model: str, timeout: float) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def status(self) -> tuple[bool, str]:
        if not self.api_key:
            return False, "ANTHROPIC_API_KEY is not set"
        return True, f"Anthropic {self.model}"

    def complete(self, system: str, prompt: str, *, max_tokens: int = 1500) -> Completion:
        if not self.api_key:
            raise LlmUnavailable("ANTHROPIC_API_KEY is not set")
        started = time.perf_counter()
        try:
            response = httpx.post(
                self.url,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise LlmUnavailable(
                f"Anthropic returned {exc.response.status_code}: {exc.response.text[:200]}"
            ) from exc
        except httpx.HTTPError as exc:
            raise LlmUnavailable(f"Anthropic request failed: {exc}") from exc
        body = response.json()
        text = "".join(
            block.get("text", "") for block in body.get("content", []) if block.get("type") == "text"
        ).strip()
        usage = body.get("usage", {})
        return Completion(
            text=text,
            provider=self.name,
            model=body.get("model", self.model),
            prompt_tokens=int(usage.get("input_tokens") or 0),
            output_tokens=int(usage.get("output_tokens") or 0),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


@lru_cache(maxsize=1)
def configured_provider() -> OllamaProvider | AnthropicProvider | None:
    if settings.LLM_PROVIDER == "ollama":
        return OllamaProvider(settings.OLLAMA_BASE_URL, settings.OLLAMA_MODEL, settings.LLM_TIMEOUT_SECONDS)
    if settings.LLM_PROVIDER == "anthropic":
        return AnthropicProvider(
            settings.ANTHROPIC_API_KEY, settings.ANTHROPIC_MODEL, settings.LLM_TIMEOUT_SECONDS
        )
    return None


def provider_status() -> dict:
    provider = configured_provider()
    if provider is None:
        return {
            "configured": settings.LLM_PROVIDER,
            "available": False,
            "detail": "LLM_PROVIDER=stub: drafts use the built-in templates",
        }
    available, detail = provider.status()
    return {"configured": provider.name, "model": provider.model, "available": available, "detail": detail}


def complete_or_none(
    system: str, prompt: str, *, max_tokens: int = 1500
) -> tuple[Completion | None, str | None]:
    """Try the configured model. Returns ``(completion, None)`` or
    ``(None, reason)`` - callers fall back to a template and *say so*."""
    provider = configured_provider()
    if provider is None:
        return None, "No language model configured (LLM_PROVIDER=stub)"
    available, detail = provider.status()
    if not available:
        return None, detail
    try:
        completion = provider.complete(system, prompt, max_tokens=max_tokens)
    except LlmUnavailable as exc:
        logger.warning("LLM call failed: %s", exc)
        return None, str(exc)
    if not completion.text:
        return None, f"{provider.name} returned an empty response"
    return completion, None
