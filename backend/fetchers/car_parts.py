"""Best-effort scraper for power-unit component usage.

There is no public API for F1 PU component usage, and the obvious public
sources (FIA event PDFs, RaceFans, f1technical, ...) either publish only PDFs
or actively block automated requests (HTTP 403). This module therefore:

  * reads its source URL from the CAR_PARTS_SOURCE_URL env var, so it can be
    pointed at any accessible page whose main table is "driver x component
    count" (e.g. a self-hosted mirror or a source that doesn't block bots);
  * sends a normal browser User-Agent;
  * parses a generic HTML table mapping each driver to per-component counts;
  * returns [] on any failure so the sync never breaks.

If no source is configured (or it can't be parsed), component data falls back
to the manual POST /api/cars/update endpoint.
"""
import os
import logging

import httpx

try:
    from bs4 import BeautifulSoup
    _HAS_BS4 = True
except ImportError:  # dependency optional at runtime
    _HAS_BS4 = False

logger = logging.getLogger(__name__)

SOURCE_URL = os.environ.get("CAR_PARTS_SOURCE_URL", "").strip()

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Header text fragment (lowercased) -> canonical component key.
_COMPONENT_ALIASES = {
    "internal combustion": "ICE", "ice": "ICE",
    "turbocharger": "TC", "turbo": "TC", "tc": "TC",
    "mgu-k": "MGU-K", "mguk": "MGU-K", "mgu k": "MGU-K",
    "energy store": "ES", "es": "ES",
    "control electronics": "CE", "ce": "CE",
    "exhaust": "Exhaust", "exh": "Exhaust",
}


def _component_for_header(text: str):
    t = (text or "").strip().lower()
    if not t:
        return None
    # Longest aliases first so "mgu-k" beats a stray "k", etc.
    for alias in sorted(_COMPONENT_ALIASES, key=len, reverse=True):
        if alias in t:
            return _COMPONENT_ALIASES[alias]
    return None


def _parse_tables(html: str) -> list:
    """Parse any 'driver x component count' table on the page."""
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [c.get_text(strip=True) for c in rows[0].find_all(["th", "td"])]
        col_to_component = {i: _component_for_header(h) for i, h in enumerate(headers)}
        if not any(col_to_component.values()):
            continue  # not a component table

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            driver_label = cells[0].get_text(strip=True)
            if not driver_label:
                continue
            for i, cell in enumerate(cells):
                comp = col_to_component.get(i)
                if not comp:
                    continue
                digits = "".join(ch for ch in cell.get_text() if ch.isdigit())
                if digits:
                    out.append({
                        "driver": driver_label,
                        "component": comp,
                        "count": int(digits),
                    })
    return out


async def fetch_component_usage() -> list:
    """Return [{driver, component, count}] best-effort (empty on any failure).

    `driver` is the raw label from the source (an abbreviation or name); the
    caller is responsible for matching it to a driver record.
    """
    if not SOURCE_URL:
        logger.info("Car parts scrape skipped: CAR_PARTS_SOURCE_URL not set")
        return []
    if not _HAS_BS4:
        logger.warning("Car parts scrape skipped: beautifulsoup4 not installed")
        return []
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True,
                                     headers={"User-Agent": _UA}) as client:
            resp = await client.get(SOURCE_URL)
            resp.raise_for_status()
            records = _parse_tables(resp.text)
            logger.info(f"Car parts scrape: {len(records)} records from {SOURCE_URL}")
            return records
    except Exception as e:
        logger.warning(f"Car parts scrape failed: {e}")
        return []
