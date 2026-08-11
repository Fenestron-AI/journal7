"""Universal LLM-powered sync engine for document catalog management.

Replaces per-site HTML parsers. One engine for all sources:
1. Fetch HTML → strip noise (scripts, styles, nav) → extract body text
2. Send to yandexgpt-lite with classification prompt
3. Parse JSON response → upsert into ai.documents
4. Mark removed documents as ARCHIVED
"""

import json
import logging
import re
import time
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from config import settings
from db import _connect
from yandex import complete as ask_yandexgpt

logger = logging.getLogger("sync-llm")

SYNC_SYSTEM_PROMPT = """Ты — помощник для извлечения структурированных данных из HTML-страниц с нормативно-правовыми документами.

Твоя задача: извлечь ВСЕ документы, перечисленные на странице, и вернуть их в формате JSON.

Правила:
1. Для каждого документа определи: номер (35-ФЗ, 442, 1178), дату в формате ДД.ММ.ГГГГ.
2. Классифицируй в поле type: federal_law, gov_decree, ministry_order, fas_order, regulation, standard, charter, tariff, other.
3. Определи doc_group: laws, gov_decrees, ministry_orders, fas_orders, regulations, standards, charters, tariffs, other.
4. Предложи sync_interval: daily, weekly, monthly.
5. Найди ВСЕ доступные ссылки на файл. Один документ может быть в нескольких форматах:
   - docx (MS Word), odt (LibreOffice), rtf (Rich Text), pdf, doc (MS Word старый)
6. В поле formats перечисли все найденные форматы с URL, а в preferred_url — ссылку по приоритету:
   DOCX > ODT > RTF > DOC > PDF (DOCX/ODT/RTF лучше разбираются на текст для AI-обучения)
7. Название документа делай коротким и смысловым:
   - В поле title — краткая суть (до 60 символов): номер + ключевая тема
   - В поле full_title — полное название как на странице источника
   - Выкидывай «Постановление Правительства РФ от ДД.ММ.ГГГГ», «Приказ Минэнерго...», «Федеральный закон...» — тип уже указан в type
   - Хорошо: «№35-ФЗ Об электроэнергетике», «№442 Функционирование розничных рынков»
   - Плохо: «Постановление Правительства РФ от 04.05.2012 № 442 «О функционировании...»»
8. Если документов нет на странице — верни пустой массив.
9. Не выдумывай документы, которых нет на странице.

Ответ — ТОЛЬКО валидный JSON-массив, без markdown-обёртки, без пояснений:

[{"title": "№442 Функционирование розничных рынков", "full_title": "Постановление Правительства РФ от 04.05.2012 № 442...", "doc_number": "442", "doc_date": "04.05.2012", "type": "gov_decree", "doc_group": "gov_decrees", "sync_interval": "weekly", "formats": {"docx": "https://...", "pdf": "https://..."}, "preferred_url": "https://.../file.docx"}]"""


def _clean_html(html: str, base_url: str) -> str:
    """Strip scripts, styles, navigation, headers, footers. Keep main content with links."""
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "nav", "header", "footer",
                      "form", "input", "button", "select", "textarea"]):
        tag.decompose()

    # Remove common nav/header/footer classes
    for cls in ["header", "footer", "nav", "menu", "sidebar", "breadcrumb",
                 "pagination", "cookie", "banner", "search"]:
        for tag in soup.select(f"[class*={cls}]"):
            tag.decompose()

    # Convert relative URLs to absolute
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if isinstance(href, str):
            a["href"] = urljoin(base_url, href)

    # Get body text with structure
    body = soup.find("body")
    if not body:
        body = soup

    # Keep only text and links
    lines = []
    for el in body.descendants:
        if el.name == "a" and el.get("href"):
            text = el.get_text(strip=True)
            if text and len(text) > 3:
                lines.append(f"{text} | {el['href']}")
        elif el.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            text = el.get_text(strip=True)
            if text:
                lines.append(f"\n## {text}\n")
        elif isinstance(el, str) and len(el.strip()) > 20:
                lines.append(el.strip())

    result = "\n".join(lines)
    # Collapse whitespace
    result = re.sub(r"\n{3,}", "\n\n", result)
    result = re.sub(r" {2,}", " ", result)

    # Truncate to ~8000 chars (model context limit)
    if len(result) > 8000:
        result = result[:8000] + "\n... (truncated)"

    return result


def _classify_and_sync(conn, source_id: str, source_url: str, doc_group_default: str) -> dict:
    """Core sync cycle for one source: fetch → clean → LLM extract → upsert."""
    cur = conn.cursor()

    # 1. Fetch HTML
    logger.info("Fetching: %s", source_url)
    try:
        resp = httpx.get(source_url, timeout=45, follow_redirects=True, verify=False,
                         headers={"User-Agent": "journal7-bot/1.0 (catalog sync)"})
        resp.raise_for_status()
    except Exception as e:
        logger.error("Failed to fetch %s: %s", source_url, e)
        return {"error": "fetch_failed", "detail": str(e)}

    # 2. Clean HTML
    html = resp.text
    clean = _clean_html(html, source_url)
    if len(clean) < 100:
        logger.warning("Cleaned HTML too short (%d chars), using raw", len(clean))
        clean = re.sub(r"<[^>]+>", " ", html)
        clean = re.sub(r"\s+", " ", clean)[:8000]

    logger.info("Cleaned HTML: %d chars", len(clean))

    # 3. LLM extraction
    raw_response = ""
    try:
        user_prompt = f"Извлеки все документы со страницы:\n\n{clean}"
        raw_response = ask_yandexgpt(SYNC_SYSTEM_PROMPT, user_prompt, model=settings.yandex_sync_model)
        logger.info("LLM response: %d chars", len(raw_response))

        # Strip markdown code fences if present
        raw_response = raw_response.strip()
        if raw_response.startswith("```"):
            raw_response = re.sub(r"^```(?:json)?\s*\n?", "", raw_response)
            raw_response = re.sub(r"\n?```\s*$", "", raw_response)

        # Extract only the JSON array from the response
        start = raw_response.find("[")
        end = raw_response.rfind("]")
        if start != -1 and end != -1 and end > start:
            raw_response = raw_response[start:end + 1]

        documents = json.loads(raw_response)
        if not isinstance(documents, list):
            logger.error("LLM returned non-list: %s", type(documents))
            return {"error": "invalid_response", "detail": "not a list"}

    except json.JSONDecodeError as e:
        logger.error("JSON parse failed: %s\nResponse: %.500s", e, raw_response)
        return {"error": "json_parse_failed", "detail": str(e)}
    except Exception as e:
        logger.error("LLM call failed: %s", e, exc_info=True)
        return {"error": "llm_failed", "detail": str(e)}

    if not documents:
        logger.info("No documents found on %s", source_url)
        return {"new": 0, "updated": 0, "archived": 0}

    # 4. Upsert into DB
    new_count = 0
    updated_count = 0
    now_ms = int(time.time() * 1000)

    page_nums = set()

    for doc in documents:
        title = (doc.get("title") or doc.get("filename") or "Без названия").strip()
        doc_number = doc.get("doc_number") or doc.get("docNumber") or doc.get("number")
        doc_date = doc.get("doc_date") or doc.get("docDate") or doc.get("date")
        doc_type = doc.get("type") or doc.get("doc_type") or doc.get("docType") or "other"
        doc_group = doc.get("doc_group") or doc.get("docGroup") or doc_group_default
        sync_interval = doc.get("sync_interval") or doc.get("syncInterval") or "weekly"

        # New format priority: preferred_url over url, formats stored in metadata
        preferred_url = doc.get("preferred_url") or doc.get("url") or ""
        formats = doc.get("formats") or ({"pdf": doc.get("url")} if doc.get("url") else {})
        url = preferred_url
        filename = doc.get("filename", "") or (url.rsplit("/", 1)[-1] if url else "")

        if not title or len(title) < 3:
            continue

        if doc_number:
            doc_number = str(doc_number).strip()
            page_nums.add(doc_number)

        # Validate interval
        if sync_interval not in ("daily", "weekly", "monthly"):
            sync_interval = "weekly"

        # Extract source domain from url
        source_domain = ""
        if url:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            source_domain = parsed.netloc

        # Find existing by doc_number + source URL, or title
        if doc_number:
            cur.execute(
                """SELECT id, title, status, updated_at, pinned FROM ai.documents
                   WHERE doc_number = %s AND source_url LIKE %s""",
                (doc_number, f"%{source_domain}%")
            )
            existing = cur.fetchone()
        else:
            cur.execute(
                """SELECT id, title, status, updated_at, pinned FROM ai.documents
                   WHERE title = %s AND source_url LIKE %s""",
                (title, f"%{source_domain}%")
            )
            existing = cur.fetchone()

        if existing:
            pinned = existing[4] if len(existing) > 4 else False
            if pinned:
                continue  # User locked this doc — skip

        # Build metadata
        meta = dict(doc.get("metadata", {}))
        meta["formats"] = formats
        meta["source"] = source_domain or "unknown"
        if doc.get("full_title"):
            meta["full_title"] = doc["full_title"]
        meta_json = json.dumps(meta, ensure_ascii=False)

        if existing:
            cur.execute(
                """UPDATE ai.documents SET
                    title = %s, doc_number = %s, doc_date = %s, doc_type = %s,
                    doc_category = %s, sync_interval = %s,
                    source_url = %s, original_filename = %s,
                    metadata = %s, last_checked_at = %s, updated_at = %s
                WHERE id = %s""",
                (title, doc_number, doc_date, doc_type,
                 doc_group, sync_interval,
                 url, filename,
                 meta_json,
                 now_ms, now_ms, existing[0])
            )
            updated_count += 1
        else:
            cur.execute(
                """INSERT INTO ai.documents
                (id, title, doc_number, doc_date, doc_type, doc_category,
                 status, source, source_url, original_filename,
                 sync_interval,
                 metadata, created_at, updated_at, last_checked_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s,
                 'TRACKED', %s, %s, %s,
                 %s,
                 %s, %s, %s, %s)""",
                 (title, doc_number, doc_date, doc_type, doc_group,
                  source_domain or "unknown", url, filename,
                  sync_interval,
                  meta_json,
                  now_ms, now_ms, now_ms)
            )
            new_count += 1

    # 5. Archive removed documents
    cur.execute(
        """SELECT id, doc_number FROM ai.documents
           WHERE source = %s AND status = 'INGESTED'
           AND doc_number IS NOT NULL""",
        (source_url.split("/")[2],)  # domain as source
    )
    archived = 0
    for doc_id, doc_num in cur.fetchall():
        if doc_num and doc_num not in page_nums:
            cur.execute("UPDATE ai.documents SET status = 'ARCHIVED' WHERE id = %s", (doc_id,))
            archived += 1
            logger.info("ARCHIVED: %s", doc_num)

    conn.commit()
    logger.info("Source %s: %d new, %d updated, %d archived", source_url, new_count, updated_count, archived)
    return {"new": new_count, "updated": updated_count, "archived": archived}


def sync_all():
    """Sync all active sources that are due for check."""
    conn = _connect()
    cur = conn.cursor()

    cur.execute(
        """SELECT id, name, url, doc_group, sync_interval, last_synced_at
           FROM ai.sources
           WHERE active = TRUE AND sync_strategy = 'html_parse_llm'
           ORDER BY last_synced_at ASC"""
    )
    sources = cur.fetchall()

    logger.info("Found %d active LLM sources", len(sources))

    if not sources:
        logger.info("No active LLM sources found")
        cur.close()
        conn.close()
        return {"sources": 0}

    now_s = int(time.time())
    stats = []
    synced = 0

    for src_id, name, url, doc_group, interval, last_synced in sources:
        # Check if due
        last_s = (last_synced or 0) // 1000
        logger.info("Checking source %s: interval=%s last_s=%d now_s=%d diff=%d", name, interval, last_s, now_s, now_s - last_s)
        if interval == "daily" and (now_s - last_s) < 86400:
            continue
        if interval == "weekly" and (now_s - last_s) < 604800:
            continue
        if interval == "monthly" and (now_s - last_s) < 2592000:
            continue

        logger.info("=== Syncing: %s (%s) ===", name, url)
        cur.execute("UPDATE ai.sources SET status = 'SYNCING' WHERE id = %s", (src_id,))
        conn.commit()

        try:
            result = _classify_and_sync(conn, src_id, url, doc_group)
            result["name"] = name
            result["url"] = url
            stats.append(result)
            if "error" not in result:
                synced += 1
                now_ms = int(time.time() * 1000)
                cur.execute(
                    "UPDATE ai.sources SET status = 'IDLE', last_synced_at = %s WHERE id = %s",
                    (now_ms, src_id)
                )
                conn.commit()
            else:
                cur.execute("UPDATE ai.sources SET status = 'ERROR' WHERE id = %s", (src_id,))
                conn.commit()
        except Exception as e:
            logger.error("Sync failed for %s: %s", name, e, exc_info=True)
            cur.execute("UPDATE ai.sources SET status = 'ERROR' WHERE id = %s", (src_id,))
            conn.commit()
            stats.append({"name": name, "url": url, "error": str(e)})

    cur.execute("UPDATE ai.sources SET status = 'SYNCING' WHERE sync_strategy = 'html_parse_so_ups'")
    conn.commit()

    # Also run legacy so-ups parser for backward compat (existing docs)
    try:
        from sync_so_ups import sync_so_ups
        ss = sync_so_ups()
        if ss and not ss.get("error"):
            stats.append({"name": "СО ЕЭС (legacy)", "url": "so-ups.ru/functioning/laws/", **ss})
    except Exception as e:
        logger.warning("Legacy so-ups sync skipped: %s", e)

    cur.close()
    conn.close()

    logger.info("=== Sync all done: %d sources synced ===", synced)
    return {"sources_synced": synced, "details": stats}


def sync_single(source_id: str) -> dict:
    """Sync a single source by ID."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, url, doc_group FROM ai.sources WHERE id = %s",
        (source_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return {"error": "source not found"}

    src_id, name, url, doc_group = row
    now_ms = int(time.time() * 1000)
    cur.execute("UPDATE ai.sources SET status = 'SYNCING' WHERE id = %s", (src_id,))
    conn.commit()

    try:
        result = _classify_and_sync(conn, src_id, url, doc_group)
        cur.execute("UPDATE ai.sources SET status = 'IDLE', last_synced_at = %s WHERE id = %s",
                     (now_ms, src_id))
        conn.commit()
        result["name"] = name
        return result
    except Exception as e:
        logger.error("Sync failed for %s: %s", name, e, exc_info=True)
        cur.execute("UPDATE ai.sources SET status = 'ERROR' WHERE id = %s", (src_id,))
        conn.commit()
        return {"error": str(e)}
    finally:
        cur.close()
        conn.close()
