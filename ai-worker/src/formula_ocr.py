"""HTTP client for pix2text OCR server (p2t serve).

Recognizes math formulas on page images → LaTeX.
Server runs separately (GPU on dev, CPU Docker on hosting).
If server is unavailable, functions return empty results (pipeline must not fail).
"""

import io
import logging

import httpx

from config import settings

logger = logging.getLogger("formula-ocr")

OCR_URL = getattr(settings, "formula_ocr_url", "http://localhost:8001")
TIMEOUT = 120


def _post_image(image_bytes: bytes, image_type: str = "mixed") -> list[dict]:
    """POST an image to pix2text server. Returns list of result dicts."""
    try:
        resp = httpx.post(
            f"{OCR_URL}/pix2text",
            data={"image_type": image_type, "resized_shape": "768"},
            files={"image": ("page.png", image_bytes, "image/png")},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if isinstance(results, str):
            # Server may return plain text directly
            return [{"text": results}]
        return results
    except Exception as e:
        logger.warning("pix2text unavailable (%s): %s", OCR_URL, e)
        return []


def recognize_page(image_bytes: bytes) -> str:
    """Recognize a full page image (text + formulas). Returns text with $$...$$ LaTeX blocks.

    NOTE: pix2text's Cyrillic text OCR is poor; we only rely on its formula output.
    The caller merges this with pypdf-extracted text.
    """
    results = _post_image(image_bytes, image_type="mixed")
    parts = []
    for r in results:
        text = r.get("text", "")
        if text:
            parts.append(text)
    return "\n".join(parts)


def extract_formulas(image_bytes: bytes) -> list[str]:
    """Extract ONLY LaTeX formulas from a page image ($$...$$ blocks)."""
    text = recognize_page(image_bytes)
    import re
    return re.findall(r"\$\$(.*?)\$\$", text, re.DOTALL)


def recognize_formula_image(image_bytes: bytes) -> str:
    """Recognize a single cropped formula image. Returns LaTeX (no $$ wrappers)."""
    results = _post_image(image_bytes, image_type="formula")
    text = results[0].get("text", "") if results else ""
    # Strip $$ wrappers if present
    return text.strip("$ \n") if text else ""
