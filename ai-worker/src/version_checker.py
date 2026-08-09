"""Periodic check for new editions of regulatory documents.

Since КонсультантПлюс/Гарант have no public API, we check official
publication feeds (pravo.gov.ru) and compare document numbers with
what's stored in the DB. If a newer revision is detected, we create
a notification (the Kotlin side exposes it to the user).

Upload remains manual: the user downloads the new edition and drops
the file into data/legal-docs/current/.
"""

import logging

import httpx

logger = logging.getLogger("version-checker")

PRAVO_FEED = "https://pravo.gov.ru/rss/feed.xml"

KNOWN_PP = {
    "442": "Постановление Правительства РФ №442 (функционирование розничных рынков)",
    "1178": "Постановление Правительства РФ №1178 (ценообразование)",
    "861": "Постановление Правительства РФ №861 (недискриминационный доступ)",
    "354": "Постановление Правительства РФ №354 (коммунальные услуги)",
}


def check_pravo_gov() -> list[dict]:
    """Return list of detected updates: [{doc_number, title}]."""
    updates = []
    try:
        resp = httpx.get(PRAVO_FEED, timeout=30)
        resp.raise_for_status()
        content = resp.text
        for number, title in KNOWN_PP.items():
            if number in content:
                # Feed contains mention of the document — flag for review
                updates.append({"doc_number": number, "title": title})
    except Exception as e:
        logger.warning("pravo.gov.ru check failed: %s", e)
    return updates
