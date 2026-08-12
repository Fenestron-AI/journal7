"""RAG Q&A: retrieve chunks from pgvector, ask YandexGPT."""

import json

from config import settings
from db import search as db_search
from yandex import SYSTEM_PROMPT, complete, embed


def build_context(results: list[dict]) -> str:
    parts = []
    for i, r in enumerate(results, 1):
        source = r["title"]
        if r["doc_number"]:
            source += f" (№{r['doc_number']})"
        parts.append(f"[Источник {i}: {source}]\n{r['content']}")
    return "\n\n".join(parts)


def ask(question: str, history: list[dict] | None = None) -> dict:
    # 1. Embed the question
    query_emb = embed(question, query=True)

    # 2. Retrieve similar chunks
    results = db_search(query_emb, settings.top_k)
    results = [r for r in results if r["score"] >= settings.similarity_threshold]

    # 3. Build context
    context = build_context(results)
    if not context:
        return {
            "answer": "Не нашёл релевантных нормативных материалов по вашему вопросу. "
                      "Уточните вопрос или проверьте, что нужные документы загружены в базу.",
            "sources": [],
        }

    # 4. Ask YandexGPT
    has_formula = any(r.get("metadata", {}).get("contains_formula") for r in results)
    user_text = f"Контекст (нормативные документы):\n{context}\n\nВопрос: {question}"
    if has_formula:
        user_text = (
            "Контекст содержит формулы в LaTeX-нотации ($$...$$).\n"
            "ПРАВИЛА РАБОТЫ С ФОРМУЛАМИ:\n"
            "1. Цитируй формулы ТОЧНО как в контексте, не упрощай и не переписывай.\n"
            "2. НЕ выполняй расчёты по формулам — ты не калькулятор. Назови формулу и укажи,\n"
            "   какие величины в неё подставляются и где она закреплена (пункт документа).\n"
            "3. Если формула в контексте неполная или вызывает сомнение — так и скажи\n"
            "   и посоветуй проверить по первоисточнику.\n\n"
            f"{user_text}"
        )
    answer = complete(SYSTEM_PROMPT, user_text)

    # 5. Sources
    sources = [
        {
            "documentId": r["document_id"],
            "title": r["title"],
            "docNumber": r["doc_number"],
            "chunkIndex": r["chunk_index"],
            "text": r["content"][:500],
        }
        for r in results
    ]

    return {"answer": answer, "sources": sources}
