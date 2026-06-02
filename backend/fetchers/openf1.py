import httpx
import logging

BASE_URL = "https://api.openf1.org/v1"
logger = logging.getLogger(__name__)


async def _get(path: str, params: dict = None) -> list:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{BASE_URL}{path}", params=params or {})
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning(f"OpenF1 {path} failed: {e}")
        return []


async def get_sessions(year: int = 2025) -> list:
    return await _get("/sessions", {"year": year})


async def get_drivers(session_key: int) -> list:
    return await _get("/drivers", {"session_key": session_key})


async def get_laps(session_key: int) -> list:
    return await _get("/laps", {"session_key": session_key})


async def get_pit_stops(session_key: int) -> list:
    return await _get("/pit", {"session_key": session_key})


async def get_stints(session_key: int) -> list:
    return await _get("/stints", {"session_key": session_key})


async def get_position(session_key: int) -> list:
    return await _get("/position", {"session_key": session_key})


async def get_session_result(session_key: int) -> list:
    """Official classification for a session: position, points, dnf/dns/dsq,
    laps, gap_to_leader (and Q1/Q2/Q3 duration array for qualifying)."""
    return await _get("/session_result", {"session_key": session_key})


async def get_starting_grid(session_key: int) -> list:
    """Starting grid for a race (driver_number -> position). Not always
    available; callers should fall back to qualifying classification."""
    return await _get("/starting_grid", {"session_key": session_key})


async def get_intervals(session_key: int) -> list:
    return await _get("/intervals", {"session_key": session_key})


async def get_race_control(session_key: int) -> list:
    return await _get("/race_control", {"session_key": session_key})


async def get_weather(session_key: int) -> list:
    return await _get("/weather", {"session_key": session_key})
