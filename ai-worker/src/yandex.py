"""Yandex Cloud API client: embeddings + YandexGPT."""

import httpx
import time

from config import settings

EMBEDDING_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding"
COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

_client = httpx.Client(timeout=120)


def _headers() -> dict:
    if settings.yandex_iam_token:
        return {
            "Authorization": f"Bearer {settings.yandex_iam_token}",
            "Content-Type": "application/json",
        }
    return {
        "Authorization": f"Api-Key {settings.yandex_api_key}",
        "Content-Type": "application/json",
    }


def embed(text: str, query: bool = False) -> list[float]:
    """Return embedding vector via Yandex text-search model (256 dims)."""
    model = settings.yandex_embedding_query_model if query else settings.yandex_embedding_model
    payload = {
        "modelUri": f"emb://{settings.yandex_folder_id}/{model}/latest",
        "text": text,
    }
    resp = _client.post(EMBEDDING_URL, headers=_headers(), json=payload)
    if resp.status_code == 429:
        time.sleep(0.5)  # rate limit, retry once
        resp = _client.post(EMBEDDING_URL, headers=_headers(), json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data["embedding"]


def complete(system_prompt: str, user_text: str) -> str:
    """Call YandexGPT completion."""
    payload = {
        "modelUri": f"gpt://{settings.yandex_folder_id}/{settings.yandex_llm_model}",
        "completionOptions": {
            "stream": False,
            "temperature": settings.yandex_llm_temperature,
            "maxTokens": settings.yandex_llm_max_tokens,
        },
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": user_text},
        ],
    }
    resp = _client.post(COMPLETION_URL, headers=_headers(), json=payload)
    resp.raise_for_status()
    data = resp.json()
    alternatives = data.get("alternatives", [])
    if not alternatives:
        raise RuntimeError(f"YandexGPT returned no alternatives: {data}")
    return alternatives[0]["message"]["text"]


SYSTEM_PROMPT = (
    "Ты — ИИ-ассистент энергосбытовой компании, эксперт по нормативно-правовой базе "
    "розничного рынка электроэнергии (442-ПП, 1178-ПП, 861-ПП, 354-ПП, ГОСТы, приказы ФАС).\n"
    "Отвечай на русском языке, опираясь ТОЛЬКО на предоставленный нормативный контекст.\n"
    "Если в контексте нет ответа — так и скажи, не выдумывай.\n"
    "В ответе обязательно ссылайся на источники: номер документа и пункт/статью, если они указаны в контексте.\n"
    "При вопросах о полях документов перечисляй обязательные поля со ссылками на норму.\n"
    "Будь точен и лаконичен."
)
