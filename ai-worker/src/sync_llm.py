"""Hybrid sync engine for document catalog.

Strategy (cost-optimized):
1. Deterministically extract ALL file links (pdf/docx/odt/rtf/doc) from HTML — free, lossless
2. Optionally crawl sub-pages (crawl_depth + url_filter) for tree-like sources
3. One batched yandexgpt-lite call per ~100 links → structured descriptions (title, number, date, type, category)
4. Upsert into ai.documents; archive removed ones; record diff into ai.sync_diffs
5. User-forgotten documents are never re-created nor shown
"""

import json
import logging
import re
import time
from urllib.parse import urljoin, urlparse, unquote

import httpx
from bs4 import BeautifulSoup

from config import settings
from db import _connect
from yandex import complete as ask_yandexgpt

logger = logging.getLogger("sync-llm")

# --- Sync state (global, thread-safe via GIL) ---
_SYNC_STATE = {
    "running": False,
    "cancelled": False,
    "current_source": None,
    "done_sources": 0,
    "total_sources": 0,
    "started_at": None,
    "last_result": None,
}

# Category → sync interval (approved scheme)
CATEGORY_INTERVAL = {
    "laws": "weekly",
    "regulations": "weekly",
    "standards": "monthly",
    "charters": "monthly",
    "other": "monthly",
    "tariffs": "monthly",
}

FILE_EXT_RE = re.compile(r"\.(pdf|docx?|odt|rtf|doc|xlsx?|zip)(?:[?#].*)?$", re.I)
ENERGY_KEYWORDS = [
    "электроэнергетик", "энергетик", "энергосбыт", "миненерго", "орэм", "оптовый рынок",
    "розничн", "сбыт", "сетев", "передач", "техприсоедин", "861", "442", "1178", "35-фз",
    "фз", "закон", "постановлен", "приказ", "регламент", "стандарт", "раскрытие информац",
    "коммерческ", "потребител", "мощност", "регулирован",
]
# Financial/corporate sections that are NOT regulatory energy documents
ENERGY_EXCLUDE = [
    "акци", "облигац", "дивиденд", "инсайдер", "годов", "отчет", "отчёт", "финансовая",
    "ежеквартальн", "аффилирован", "эмисси", "проспект", "ценн бумаг", "акционер",
    "котировальн", "листинг", "бюллетень", "закупк",
]
# Pages with more files than this are operational disclosures (regional graphs etc.),
# not regulatory documents — skip them to keep the catalog clean.
MAX_FILES_PER_PAGE = 500


def get_sync_state() -> dict:
    return dict(_SYNC_STATE)


def request_cancel():
    _SYNC_STATE["cancelled"] = True
    logger.info("Sync cancel requested")


def is_cancelled() -> bool:
    return _SYNC_STATE["cancelled"]


def _mark_cancelled(prefix: str = "") -> bool:
    if _SYNC_STATE["cancelled"]:
        logger.info("%sSync cancelled by user", prefix)
        return True
    return False


SYNC_SYSTEM_PROMPT = """Ты — помощник для описания нормативно-правовых документов энергетики.

Тебе дают СПИСОК ссылок на документы с сайта (каждая строка: «текст ссылки | URL»).
Для КАЖДОЙ ссылки определи:
1. title — оригинальное название документа как на сайте (полное, без сокращений и «№» в начале).
2. doc_number — номер документа (35-ФЗ, 442, 1178, 82 и т.п.) или null, если его нет.
3. doc_date — дата в формате ДД.ММ.ГГГГ или null.
4. type — federal_law, gov_decree, ministry_order, fas_order, regulation, standard, charter, tariff, other.
5. doc_group — laws, gov_decrees, ministry_orders, fas_orders, regulations, standards, charters, tariffs, other.
6. url — URL файла из ссылки (обязательно сохрани как есть).
7. formats — объект {формат: url}, где формат из расширения (pdf, docx, doc, odt, rtf). Если ссылок на один документ несколько — объедини их в один объект.

Правила:
- Не пропускай ни одной ссылки из списка. Каждой ссылке соответствует отдельный документ (или формат уже известного).
- Если это файл, а не документ (картинка, стиль) — пропусти.
- Если по URL нельзя понять название — используй текст ссылки как title.
- Не выдумывай номера и даты, которых нет в тексте.
- Отвечай ТОЛЬКО валидным JSON-массивом без markdown-обёртки и пояснений.

Пример:
[{"title": "Постановление Правительства РФ от 04.05.2012 № 442 «О функционировании розничных рынков электрической энергии»", "doc_number": "442", "doc_date": "04.05.2012", "type": "gov_decree", "doc_group": "gov_decrees", "url": "https://.../file.pdf", "formats": {"pdf": "https://.../file.pdf"}}]"""


# ============================================================
# Deterministic link extraction
# ============================================================

def _extract_links(html: str, base_url: str) -> list[dict]:
    """Extract all file links (pdf/docx/odt/rtf/doc) with link text and section heading."""
    soup = BeautifulSoup(html, "html.parser")

    # Current section heading context (h2/h3 before the link)
    results: list[dict] = []
    seen_urls: set[str] = set()
    current_group = ""

    for el in soup.descendants:
        if el.name in ("h1", "h2", "h3", "h4"):
            txt = el.get_text(strip=True)
            if txt:
                current_group = txt
        elif el.name == "a" and el.get("href"):
            href = el.get("href", "").strip()
            if not href or href.startswith("#") or "javascript" in href.lower():
                continue
            abs_url = urljoin(base_url, href)
            if not FILE_EXT_RE.search(abs_url):
                continue
            key = abs_url.split("#")[0]
            if key in seen_urls:
                continue
            text = el.get_text(strip=True)
            if not text:
                # try parent container text
                parent = el.find_parent(["li", "div", "p"])
                text = parent.get_text(strip=True, separator=" ") if parent else ""
                text = re.sub(r"\s+", " ", text)[:200]
            seen_urls.add(key)
            results.append({
                "url": key,
                "text": text or unquote(key.rsplit("/", 1)[-1]),
                "group": current_group,
            })
    return results


def _matches_energy(url: str, text: str = "") -> bool:
    """Filter: only energy-related sections for tree crawling."""
    haystack = (url + " " + text).lower()
    if any(kw in haystack for kw in ENERGY_EXCLUDE):
        return False
    return any(kw.lower() in haystack for kw in ENERGY_KEYWORDS)


# ============================================================
# Crawling
# ============================================================

def _crawl_pages(base_url: str, depth: int, url_filter: list[str]) -> list[str]:
    """BFS crawl sub-pages from the root. Returns list of page URLs to parse."""
    if depth <= 1:
        return [base_url]

    seen_pages: set[str] = set()
    queue = [(base_url, 1)]
    pages = [base_url]
    seen_pages.add(base_url)

    client = httpx.Client(timeout=30, follow_redirects=True, verify=False,
                          headers={"User-Agent": "journal7-bot/1.0 (catalog sync)"})
    try:
        while queue:
            url, level = queue.pop(0)
            if level >= depth or is_cancelled():
                continue
            html = _fetch_with_retry(client, url)
            if html is None:
                continue
            soup = BeautifulSoup(html, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a.get("href", "")
                if not href or href.startswith(("#", "javascript", "mailto", "tel:")):
                    continue
                abs_url = urljoin(url, href)
                if abs_url in seen_pages:
                    continue
                if urlparse(abs_url).netloc != urlparse(base_url).netloc:
                    continue
                if FILE_EXT_RE.search(abs_url):
                    continue  # files handled on each page parse
                text = a.get_text(strip=True)
                # Filter by energy keywords if configured
                if url_filter and not _matches_energy(abs_url, text):
                    continue
                seen_pages.add(abs_url)
                pages.append(abs_url)
                if level + 1 < depth:
                    queue.append((abs_url, level + 1))
    finally:
        client.close()
    return pages


# ============================================================
# LLM batch classification
# ============================================================

def _classify_links(links: list[dict], source_url: str, doc_group_default: str) -> list[dict]:
    """One LLM call per batch of links. Returns document descriptions."""
    if not links:
        return []

    lines = []
    for i, lnk in enumerate(links, 1):
        lines.append(f"{i}. {lnk['text'][:150]} | {lnk['url']}")
    user_prompt = f"Источник: {source_url}\n\nСписок документов со страницы:\n" + "\n".join(lines)

    raw_response = ""
    try:
        raw_response = ask_yandexgpt(SYNC_SYSTEM_PROMPT, user_prompt,
                                     model=settings.yandex_sync_model,
                                     max_tokens=settings.yandex_sync_max_tokens)
        logger.info("LLM response: %d chars", len(raw_response))
        return _extract_json(raw_response)
    except json.JSONDecodeError as e:
        logger.error("JSON parse failed: %s\nResponse: %.500s", e, raw_response)
        # Repair attempt
        try:
            if is_cancelled():
                return []
            repair_prompt = (
                "Твой предыдущий ответ был обрезан — это невалидный JSON:\n\n"
                f"{raw_response[-3000:]}\n\n"
                "Верни ТОЛЬКО исправленный полный JSON-массив со ВСЕМИ документами, "
                "не обрезая его. Никакого текста вокруг."
            )
            raw_response = ask_yandexgpt(SYNC_SYSTEM_PROMPT, repair_prompt,
                                         model=settings.yandex_sync_model,
                                         max_tokens=settings.yandex_sync_max_tokens)
            logger.info("LLM repair response: %d chars", len(raw_response))
            return _extract_json(raw_response)
        except Exception as e2:
            logger.error("LLM repair failed: %s", e2, exc_info=True)
            return []
    except Exception as e:
        logger.error("LLM call failed: %s", e, exc_info=True)
        return []


def _extract_json(raw_response: str) -> list:
    """Strip markdown fences and extract the JSON array from LLM response."""
    text = raw_response.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    documents = json.loads(text)
    if not isinstance(documents, list):
        raise ValueError(f"LLM returned non-list: {type(documents)}")
    return documents


# ============================================================
# Catalog rules (состав НПБ — свободное редактирование)
# ============================================================

def _load_catalog_rules(cur) -> list[dict]:
    """Load active catalog rules from DB."""
    cur.execute(
        "SELECT id, action, priority, source, category, doc_type, doc_number, "
        "title_mask, comment FROM ai.catalog_rules WHERE active = TRUE ORDER BY priority DESC"
    )
    return [
        {
            "id": str(r[0]), "action": r[1], "priority": r[2] or 0,
            "source": r[3], "category": r[4], "doc_type": r[5],
            "doc_number": r[6], "title_mask": r[7], "comment": r[8],
        }
        for r in cur.fetchall()
    ]


def _rule_matches(rule: dict, source: str, category: str, doc_type: str,
                  doc_number: str, title: str) -> bool:
    """A rule matches a document if ALL non-empty fields match (empty = any)."""
    if rule.get("source"):
        src = rule["source"].lower()
        if src not in source.lower() and source.lower() not in src:
            return False
    if rule.get("category") and rule["category"].lower() != category.lower():
        return False
    if rule.get("doc_type") and rule["doc_type"].lower() != doc_type.lower():
        return False
    if rule.get("doc_number") and rule["doc_number"].lower() != (doc_number or "").lower():
        return False
    if rule.get("title_mask"):
        try:
            import fnmatch
            # Convert SQL-style LIKE mask (%...) to fnmatch pattern (*...)
            pattern = rule["title_mask"].lower().replace("%", "*")
            if not fnmatch.fnmatch(title.lower(), pattern):
                return False
        except Exception:
            pass
    return True


def apply_rules(documents: list[dict], rules: list[dict],
                source_url: str, doc_group_default: str,
                source_name: str = "") -> tuple[list[dict], list[dict]]:
    """Filter documents by catalog rules (ALLOWLIST mode).

    Returns (kept, excluded).
    - If no rules configured → everything is kept (backward compatibility).
    - Otherwise: a document is KEPT only if it matches an `include` rule
      AND does not match any `exclude` rule (exclude wins on tie).
    """
    if not rules:
        return documents, []

    source_domain = urlparse(source_url).netloc
    # Match rules against both domain and source name (e.g. "Россети — Стандарты организации")
    source_key = f"{source_domain} {source_name}".strip()
    kept: list[dict] = []
    excluded: list[dict] = []

    for doc in documents:
        title = (doc.get("title") or doc.get("filename") or "").strip()
        category = doc.get("doc_group") or doc.get("docGroup") or doc_group_default
        doc_type = doc.get("type") or doc.get("doc_type") or doc.get("docType") or "other"
        doc_number = doc.get("doc_number") or doc.get("docNumber") or doc.get("number") or ""

        included = False
        for rule in rules:
            if not _rule_matches(rule, source_key, category, doc_type, str(doc_number), title):
                continue
            if rule["action"] == "include":
                included = True
            else:  # exclude wins regardless of priority/order
                included = False
                break

        if included:
            kept.append(doc)
        else:
            excluded.append(doc)

    return kept, excluded


def _load_file_sources(cur) -> list[dict]:
    """Load active trusted file-storage domains, ordered by trust (priority ASC)."""
    cur.execute(
        "SELECT domain, priority FROM ai.file_sources WHERE active = TRUE ORDER BY priority ASC"
    )
    return [{"domain": r[0], "priority": r[1]} for r in cur.fetchall()]


FORMAT_RANK = {"docx": 5, "odt": 4, "rtf": 3, "doc": 2, "pdf": 1, "xlsx": 0, "zip": 0}


def _best_file_url(formats: dict, file_sources: list[dict]) -> str:
    """Pick the best file URL for a document.

    Priority: format rank first (docx > odt > rtf > doc > pdf), then trusted
    file_source domain (lower priority value = more trusted).
    """
    if not formats:
        return ""
    best_url = ""
    best_key = (0, 10_000)
    for fmt, url in formats.items():
        fmt = str(fmt).lower()
        url = str(url)
        rank = FORMAT_RANK.get(fmt, 0)
        # Trust: find file_sources entry matching the URL's domain
        trust = 10_000
        domain = urlparse(url).netloc
        for fs in file_sources:
            if fs["domain"].lower() in domain or domain in fs["domain"].lower():
                trust = fs["priority"]
                break
        # Higher format rank wins; on tie, more trusted domain (lower priority) wins
        key = (rank, -trust)
        if key > best_key:
            best_key = key
            best_url = url
    return best_url


# ============================================================
# Core sync cycle
# ============================================================

FETCH_RETRIES = 3
FETCH_RETRY_DELAYS = [5, 15, 45]
SOURCE_TIMEOUT = 15 * 60  # seconds — hard limit per source


def _fetch_with_retry(client: httpx.Client, url: str) -> str | None:
    """GET with retries (network resilience: DNS flakiness, timeouts, 5xx)."""
    for attempt in range(FETCH_RETRIES):
        if is_cancelled():
            return None
        try:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            logger.warning("Fetch %s failed (attempt %d/%d): %s",
                           url, attempt + 1, FETCH_RETRIES, e)
            if attempt < FETCH_RETRIES - 1:
                time.sleep(FETCH_RETRY_DELAYS[attempt])
    return None


def _classify_and_sync(conn, source_id: str, source_url: str, doc_group_default: str,
                       crawl_depth: int = 1, url_filter: list[str] | None = None,
                       source_name: str = "") -> dict:
    """Full sync cycle for one source: crawl → extract links → LLM classify → upsert → archive → diff."""
    cur = conn.cursor()
    _source_start = time.time()

    # 1. Crawl pages
    pages = _crawl_pages(source_url, crawl_depth, url_filter or [])
    logger.info("Crawled %d page(s) for %s", len(pages), source_url)

    # 2. Extract ALL file links deterministically (free, lossless)
    all_links: list[dict] = []
    seen_urls: set[str] = set()
    client = httpx.Client(timeout=45, follow_redirects=True, verify=False,
                          headers={"User-Agent": "journal7-bot/1.0 (catalog sync)"})
    try:
        for page_url in pages:
            if is_cancelled():
                return {"error": "cancelled", "detail": "Отменено пользователем"}
            if time.time() - _source_start > SOURCE_TIMEOUT:
                logger.error("Source %s exceeded %ds timeout", source_url, SOURCE_TIMEOUT)
                return {"error": "timeout", "detail": f"превышен лимит {SOURCE_TIMEOUT}с"}
            html = _fetch_with_retry(client, page_url)
            if html is None:
                logger.error("Failed to fetch %s after %d attempts", page_url, FETCH_RETRIES)
                continue
            links = _extract_links(html, page_url)
            if len(links) > MAX_FILES_PER_PAGE:
                logger.warning("Page %s has %d files (>%d) — operational disclosure, skipped",
                               page_url, len(links), MAX_FILES_PER_PAGE)
                continue
            for lnk in links:
                key = lnk["url"].split("#")[0]
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                all_links.append(lnk)
            logger.info("Page %s: %d links (total %d)", page_url, len(links), len(all_links))
    finally:
        client.close()

    if is_cancelled():
        return {"error": "cancelled", "detail": "Отменено пользователем"}

    if not all_links:
        logger.info("No file links found on %s", source_url)
        return {"new": 0, "updated": 0, "archived": 0}

    # 3. LLM classify in batches (cost optimization: one call per ~100 links)
    documents: list[dict] = []
    BATCH = 100
    for i in range(0, len(all_links), BATCH):
        if is_cancelled():
            return {"error": "cancelled", "detail": "Отменено пользователем"}
        batch = all_links[i:i + BATCH]
        docs = _classify_links(batch, source_url, doc_group_default)
        logger.info("Batch %d/%d: LLM described %d docs", i // BATCH + 1,
                    (len(all_links) + BATCH - 1) // BATCH, len(docs))
        documents.extend(docs)

    # 4. Normalize: fallback for links LLM missed (never lose documents)
    llm_urls = set()
    for doc in documents:
        u = doc.get("url") or doc.get("preferred_url")
        if u:
            llm_urls.add(u.split("#")[0])
    for lnk in all_links:
        if lnk["url"].split("#")[0] not in llm_urls:
            documents.append({
                "title": lnk["text"] or unquote(lnk["url"].rsplit("/", 1)[-1]),
                "doc_number": None, "doc_date": None,
                "type": "other", "doc_group": doc_group_default,
                "url": lnk["url"],
                "formats": {lnk["url"].rsplit(".", 1)[-1].lower(): lnk["url"]},
            })
            logger.info("Fallback doc (LLM missed): %s", lnk["url"][:80])

    # 5. Apply catalog rules (состав НПБ)
    rules = _load_catalog_rules(cur)
    excluded_urls: set[str] = set()
    if rules:
        documents, excluded_docs = apply_rules(documents, rules, source_url, doc_group_default,
                                               source_name)
        if excluded_docs:
            logger.info("Excluded %d docs by catalog rules", len(excluded_docs))
            for d in excluded_docs[:5]:
                logger.info("  excluded: %s", (d.get("title") or d.get("url", ""))[:80])
                u = d.get("url") or d.get("preferred_url")
                if u:
                    excluded_urls.add(u.split("#")[0])

    # 6. Upsert
    file_sources = _load_file_sources(cur)
    new_count, updated_count, archived, new_docs_ids, archived_docs_ids = _upsert(
        cur, documents, source_url, doc_group_default, source_id, file_sources
    )

    # 7. Re-evaluate existing docs against rules: previously added docs that are
    #    now excluded by rules (or not on page) → ARCHIVED (shown in diff)
    if rules:
        reeval_archived = _archive_rule_violations(
            cur, source_id, documents, rules, source_url, doc_group_default,
            excluded_urls, source_name,
        )
        archived += reeval_archived
        logger.info("Rules re-evaluation: archived %d docs", reeval_archived)

    # 8. Record diff
    _record_diff(conn, source_id, source_url,
                 new_docs=new_docs_ids, archived_docs=archived_docs_ids)

    conn.commit()
    logger.info("Source %s: %d new, %d updated, %d archived", source_url, new_count, updated_count, archived)
    return {"new": new_count, "updated": updated_count, "archived": archived}


def _archive_rule_violations(cur, source_id, documents: list[dict], rules: list[dict],
                             source_url: str, doc_group_default: str,
                             excluded_urls: set[str], source_name: str = "") -> int:
    """Archive existing docs of the source that:
    - were excluded by catalog rules (their URL in excluded_urls), or
    - are no longer on the page AND fail the rules (explicitly excluded).
    """
    cur.execute(
        """SELECT id, title, doc_number, doc_type, doc_category, source_url FROM ai.documents
           WHERE source_id = %s AND status IN ('TRACKED', 'INGESTED')
           AND forgotten = FALSE AND pinned = FALSE""",
        (source_id,)
    )
    kept_titles = {d.get("title") for d in documents}
    archived = 0

    for doc_id, title, doc_num, doc_type, doc_category, d_url in cur.fetchall():
        # Skip docs that will be updated by upsert (still on page and kept)
        if title in kept_titles:
            continue
        # Archive if URL was explicitly excluded by rules
        if d_url and d_url.split("#")[0] in excluded_urls:
            cur.execute("UPDATE ai.documents SET status = 'ARCHIVED' WHERE id = %s", (doc_id,))
            archived += 1
            logger.info("ARCHIVED by rules: %s", doc_num or title)
            continue
        # Not on page and fails rules → archive (already handled in _upsert for page-miss,
        # here for rule-excluded docs not on page)
        fake = {
            "title": title or "", "doc_number": doc_num or "",
            "type": doc_type or "other", "doc_group": doc_category or doc_group_default,
            "url": None,
        }
        kept, _ = apply_rules([fake], rules, source_url, doc_group_default)
        if not kept:
            cur.execute("UPDATE ai.documents SET status = 'ARCHIVED' WHERE id = %s", (doc_id,))
            archived += 1
            logger.info("ARCHIVED by rules: %s", doc_num or title)
    return archived


def _upsert(cur, documents: list[dict], source_url: str, doc_group_default: str,
            source_id, file_sources: list[dict] | None = None) -> tuple[int, int, int, list, list]:
    """Insert/update documents. Returns (new, updated, archived, new_docs, archived_docs).
    Forgotten docs are never touched."""
    new_count = 0
    updated_count = 0
    archived = 0
    now_ms = int(time.time() * 1000)
    page_urls: set[str] = set()
    new_docs_ids = []
    archived_docs_ids = []

    for doc in documents:
        title = (doc.get("title") or doc.get("filename") or "Без названия").strip()
        # Strip leading format garbage LLM sometimes prepends ("pdfСТО...", "docxНазвание")
        m = re.match(r"^(?:pdf|docx?|odt|rtf|doc)\s*(.*)$", title, re.I)
        if m and m.group(1):
            title = m.group(1).strip()
        if not title or len(title) < 3:
            continue

        doc_number = doc.get("doc_number") or doc.get("docNumber") or doc.get("number")
        doc_date = doc.get("doc_date") or doc.get("docDate") or doc.get("date")
        doc_type = doc.get("type") or doc.get("doc_type") or doc.get("docType") or "other"
        doc_group = doc.get("doc_group") or doc.get("docGroup") or doc_group_default

        # New format: url in "url", formats dict with per-format URLs
        url = (doc.get("url") or doc.get("preferred_url") or "").strip()
        formats = doc.get("formats") or ({"pdf": url} if url else {})
        if isinstance(formats, dict):
            formats = {str(k).lower(): str(v) for k, v in formats.items()}
        preferred_url = _best_file_url(formats, file_sources or []) or url or next(iter(formats.values()), "")

        if not preferred_url:
            continue
        page_urls.add(preferred_url.split("#")[0])

        # Category → interval
        category = doc_group
        interval = CATEGORY_INTERVAL.get(category, "monthly")

        source_domain = urlparse(preferred_url).netloc or source_url.split("/")[2]

        # Find existing by URL (primary key for dedup), fallback to doc_number/title
        cur.execute(
            """SELECT id, forgotten, pinned FROM ai.documents
               WHERE source_url = %s AND status NOT IN ('ARCHIVED')""",
            (preferred_url.split("#")[0],)
        )
        existing = cur.fetchone()
        if not existing and doc_number:
            cur.execute(
                """SELECT id, forgotten, pinned FROM ai.documents
                   WHERE doc_number = %s AND source_id = %s AND status NOT IN ('ARCHIVED')""",
                (str(doc_number), source_id)
            )
            existing = cur.fetchone()
        if not existing:
            # Title-based fallback (old syncs may have truncated URLs)
            cur.execute(
                """SELECT id, forgotten, pinned FROM ai.documents
                   WHERE source_id = %s AND status NOT IN ('ARCHIVED')
                     AND lower(title) = lower(%s)""",
                (source_id, title[:200])
            )
            existing = cur.fetchone()

        if existing:
            if existing[1]:  # forgotten — never touch
                continue
            if existing[2]:  # pinned — skip
                continue
            # Update metadata
            meta = json.dumps({
                "formats": formats,
                "source": source_domain,
                "group": doc_group,
            }, ensure_ascii=False)
            cur.execute(
                """UPDATE ai.documents SET
                    title = %s, doc_number = %s, doc_date = %s, doc_type = %s,
                    doc_category = %s, sync_interval = %s,
                    source_url = %s, source_id = %s, metadata = %s,
                    last_checked_at = %s, updated_at = %s,
                    status = 'TRACKED'
                WHERE id = %s""",
                (title, doc_number, doc_date, doc_type,
                 category, interval,
                 preferred_url.split("#")[0], source_id, meta,
                 now_ms, now_ms, existing[0])
            )
            updated_count += 1
        else:
            cur.execute(
                """INSERT INTO ai.documents
                (id, title, doc_number, doc_date, doc_type, doc_category,
                 status, source, source_url, source_id, sync_interval,
                 metadata, created_at, updated_at, last_checked_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s,
                 'TRACKED', %s, %s, %s, %s,
                 %s, %s, %s, %s)""",
                (title, doc_number, doc_date, doc_type, category,
                 source_domain, preferred_url.split("#")[0], source_id, interval,
                 json.dumps({"formats": formats, "source": source_domain, "group": doc_group}, ensure_ascii=False),
                 now_ms, now_ms, now_ms)
            )
            new_count += 1
            new_docs_ids.append({"title": title, "doc_number": doc_number})

    # Archive: docs of THIS source whose URL is no longer on the page.
    # Fallback: if a page title partially matches, keep the doc (LLM URLs may be truncated).
    page_titles = {d.get("title", "").lower() for d in documents}
    cur.execute(
        """SELECT id, title, doc_number, source_url FROM ai.documents
           WHERE source_id = %s AND status IN ('TRACKED', 'INGESTED')
           AND source_url IS NOT NULL AND forgotten = FALSE""",
        (source_id,)
    )
    for doc_id, d_title, d_num, d_url in cur.fetchall():
        if d_url and d_url.split("#")[0] in page_urls:
            continue
        # Fallback: title match (robust against truncated URLs from old syncs)
        d_title_l = (d_title or "").lower()
        if d_title_l and any(d_title_l[:40] in t or t[:40] in d_title_l for t in page_titles if t):
            continue
        cur.execute("UPDATE ai.documents SET status = 'ARCHIVED' WHERE id = %s", (doc_id,))
        archived += 1
        archived_docs_ids.append({"title": d_title, "doc_number": d_num})
        logger.info("ARCHIVED: %s", d_num or d_title)

    return new_count, updated_count, archived, new_docs_ids, archived_docs_ids


def _record_diff(conn, source_id, source_name, new_docs, archived_docs):
    """Write one-time diff summary into ai.sync_diffs."""
    if not new_docs and not archived_docs:
        return
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO ai.sync_diffs (source_id, source_name, new_docs, archived_docs, created_at)
           VALUES (%s, %s, %s::jsonb, %s::jsonb, %s)""",
        (source_id, source_name,
         json.dumps(new_docs, ensure_ascii=False),
         json.dumps(archived_docs, ensure_ascii=False),
         int(time.time() * 1000))
    )
    conn.commit()
    cur.close()


# ============================================================
# Sync orchestration
# ============================================================

def _load_sources(cur) -> list[tuple]:
    """Active LLM sources with crawl config, ordered by last sync."""
    cur.execute(
        """SELECT id, name, url, doc_group, sync_interval, last_synced_at,
                  crawl_depth, url_filter
           FROM ai.sources
           WHERE active = TRUE AND sync_strategy = 'html_parse_llm'
           ORDER BY last_synced_at ASC"""
    )
    return cur.fetchall()


def _due(interval: str, last_synced: int, now_s: int) -> bool:
    """Check whether a source is due for sync based on its interval."""
    last_s = (last_synced or 0) // 1000
    if interval == "daily":
        return (now_s - last_s) >= 86400
    if interval == "weekly":
        return (now_s - last_s) >= 604800
    if interval == "monthly":
        return (now_s - last_s) >= 2592000
    return True


def _parse_url_filter(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        val = json.loads(raw)
        if isinstance(val, list):
            return [str(v) for v in val]
    except Exception:
        pass
    return []


def sync_all(force: bool = False):
    """Sync all active sources that are due for check."""
    _SYNC_STATE["running"] = True
    _SYNC_STATE["cancelled"] = False
    _SYNC_STATE["current_source"] = None
    _SYNC_STATE["done_sources"] = 0
    _SYNC_STATE["started_at"] = int(time.time() * 1000)

    conn = _connect()
    cur = conn.cursor()

    sources = _load_sources(cur)

    logger.info("Found %d active LLM sources", len(sources))

    if not sources:
        logger.info("No active LLM sources found")
        _SYNC_STATE["running"] = False
        _SYNC_STATE["started_at"] = None
        cur.close()
        conn.close()
        return {"sources": 0}

    now_s = int(time.time())
    stats = []
    synced = 0
    _SYNC_STATE["total_sources"] = len(sources)

    for idx, (src_id, name, url, doc_group, interval, last_synced,
              crawl_depth, url_filter) in enumerate(sources, 1):
        if _mark_cancelled():
            break

        # Check if due
        if not force and not _due(interval, last_synced, now_s):
            logger.info("Source %s: not due (interval=%s)", name, interval)
            continue

        _SYNC_STATE["current_source"] = name
        _SYNC_STATE["done_sources"] = idx
        logger.info("=== Syncing: %s (%s) ===", name, url)
        cur.execute("UPDATE ai.sources SET status = 'SYNCING' WHERE id = %s", (src_id,))
        conn.commit()

        try:
            result = _classify_and_sync(
                conn, src_id, url, doc_group,
                crawl_depth=int(crawl_depth or 1),
                url_filter=_parse_url_filter(url_filter),
                source_name=name,
            )
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

    _SYNC_STATE["current_source"] = None
    _SYNC_STATE["running"] = False
    _SYNC_STATE["started_at"] = None
    cur.close()
    conn.close()

    # Record activity for badge
    total_new = sum(s.get("new", 0) for s in stats if isinstance(s, dict))
    total_archived = sum(s.get("archived", 0) for s in stats if isinstance(s, dict))
    if total_new > 0 or total_archived > 0:
        conn2 = _connect()
        cur2 = conn2.cursor()
        cur2.execute(
            "INSERT INTO ai.activity (new_count, archived_count, created_at) VALUES (%s, %s, %s)",
            (total_new, total_archived, int(time.time() * 1000))
        )
        conn2.commit()
        cur2.close()
        conn2.close()

    logger.info("=== Sync all done: %d sources synced ===", synced)
    result = {"sources_synced": synced, "details": stats,
              "cancelled": _SYNC_STATE["cancelled"]}
    _SYNC_STATE["last_result"] = result
    return result


def sync_single(source_id: str) -> dict:
    """Sync a single source by ID (used by scheduler and manual button)."""
    _SYNC_STATE["running"] = True
    _SYNC_STATE["cancelled"] = False
    _SYNC_STATE["current_source"] = None
    _SYNC_STATE["done_sources"] = 0
    _SYNC_STATE["total_sources"] = 1
    _SYNC_STATE["started_at"] = int(time.time() * 1000)

    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, url, doc_group, crawl_depth, url_filter FROM ai.sources WHERE id = %s",
        (source_id,)
    )
    row = cur.fetchone()
    if not row:
        _SYNC_STATE["running"] = False
        _SYNC_STATE["started_at"] = None
        cur.close()
        conn.close()
        return {"error": "source not found"}

    src_id, name, url, doc_group, crawl_depth, url_filter = row
    _SYNC_STATE["current_source"] = name
    now_ms = int(time.time() * 1000)
    cur.execute("UPDATE ai.sources SET status = 'SYNCING' WHERE id = %s", (src_id,))
    conn.commit()

    try:
        result = _classify_and_sync(
            conn, src_id, url, doc_group,
            crawl_depth=int(crawl_depth or 1),
            url_filter=_parse_url_filter(url_filter),
            source_name=name,
        )
        cur.execute("UPDATE ai.sources SET status = 'IDLE', last_synced_at = %s WHERE id = %s",
                     (now_ms, src_id))
        conn.commit()
        result["name"] = name
        # Record activity for single source
        new = result.get("new", 0)
        archived = result.get("archived", 0)
        if new > 0 or archived > 0:
            cur2 = _connect().cursor()
            cur2.execute(
                "INSERT INTO ai.activity (new_count, archived_count, created_at) VALUES (%s, %s, %s)",
                (new, archived, int(time.time() * 1000))
            )
            cur2.connection.commit()
            cur2.close()
        result["cancelled"] = _SYNC_STATE["cancelled"]
        _SYNC_STATE["last_result"] = result
        return result
    except Exception as e:
        logger.error("Sync failed for %s: %s", name, e, exc_info=True)
        cur.execute("UPDATE ai.sources SET status = 'ERROR' WHERE id = %s", (src_id,))
        conn.commit()
        return {"error": str(e)}
    finally:
        _SYNC_STATE["current_source"] = None
        _SYNC_STATE["running"] = False
        _SYNC_STATE["started_at"] = None
        cur.close()
        conn.close()
