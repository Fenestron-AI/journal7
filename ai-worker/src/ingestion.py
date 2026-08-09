"""Document parsing: RTF/DOCX/TXT/PDF -> clean text."""

import re
from pathlib import Path


def extract_text(file_path: str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".rtf":
        return _extract_rtf(path)
    if suffix == ".docx":
        return _extract_docx(path)
    if suffix == ".pdf":
        return _extract_pdf(path)
    if suffix in (".txt", ".md"):
        return path.read_text(encoding="utf-8", errors="replace")
    # Fallback: try RTF anyway
    return _extract_rtf(path)


def _extract_rtf(path: Path) -> str:
    """Extract text from RTF. Handles cp1251 hex escapes and tables."""
    try:
        from striprtf.striprtf import rtf_to_text
        raw = path.read_text(encoding="cp1251", errors="replace")
        return rtf_to_text(raw)
    except ImportError:
        pass

    # Fallback manual stripper
    raw = path.read_bytes().decode("latin-1")
    text = re.sub(r"\\'([0-9a-fA-F]{2})", lambda m: _hex_to_char(m.group(1)), raw)
    text = re.sub(r"\\[a-zA-Z]+\d*\s?", " ", text)
    text = re.sub(r"\{[^{}]*\}", "", text)
    text = text.replace("\\par", "\n").replace("\\cell", " | ").replace("\\row", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text


def _hex_to_char(hex_str: str) -> str:
    try:
        return bytes([int(hex_str, 16)]).decode("cp1251")
    except Exception:
        return "?"


def _extract_docx(path: Path) -> str:
    try:
        from docx import Document
        doc = Document(str(path))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells]
                parts.append(" | ".join(cells))
        return "\n".join(parts)
    except ImportError:
        return path.read_text(encoding="utf-8", errors="replace")


def _extract_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except ImportError:
        return ""


def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 150) -> list[str]:
    """Split text into overlapping chunks, preferring article/paragraph boundaries."""
    # Normalize whitespace but keep paragraphs
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Try splitting by sections first
    sections = re.split(r"(?=(?:Статья|Пункт|Раздел|Приложение|Глава)\s*\d)", text)
    sections = [s.strip() for s in sections if s.strip()]

    if len(sections) > 1 and all(len(s) > 100 for s in sections):
        chunks: list[str] = []
        for section in sections:
            chunks.extend(_chunk_by_size(section, chunk_size, overlap))
        return chunks
    return _chunk_by_size(text, chunk_size, overlap)


def _chunk_by_size(text: str, chunk_size: int, overlap: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            # try to break at paragraph boundary
            boundary = text.rfind("\n", start + chunk_size // 2, end)
            if boundary == -1:
                boundary = text.rfind(" ", start + chunk_size // 2, end)
            if boundary != -1:
                end = boundary
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = max(end - overlap, start + 1)
        if start >= len(text):
            break
    return chunks


def parse_metadata_from_filename(filename: str) -> dict:
    base = filename.rsplit(".", 1)[0].replace("_", " ")
    number = re.search(r"N\s*(\d+)", base)
    date = re.search(r"от\s+(\d{2}\.\d{2}\.\d{4})", base)
    revision = re.search(r"ред\.?\s*от\s*(\d{2}\.\d{2}\.\d{4})", base)
    title = re.sub(r"\s+от\s+\d{2}\.\d{2}\.\d{4}.*", "", base)
    title = re.sub(r"\s+N\s*\d+.*", "", title).strip()
    return {
        "title": title or filename,
        "doc_number": number.group(1) if number else None,
        "doc_date": date.group(1) if date else None,
        "revision": revision.group(1) if revision else None,
    }
