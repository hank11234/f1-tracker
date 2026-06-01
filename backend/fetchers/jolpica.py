import httpx
import logging

BASE_URL = "https://api.jolpi.ca/ergast/f1"
logger = logging.getLogger(__name__)

PAGE_SIZE = 100  # Jolpica hard-caps results at 100 per request


async def _get(path: str, params: dict = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{BASE_URL}{path}", params=params or {})
            resp.raise_for_status()
            return resp.json().get("MRData", {})
    except Exception as e:
        logger.warning(f"Jolpica {path} failed: {e}")
        return {}


async def _get_all_races(path: str, table_key: str, row_key: str) -> list:
    """Paginate through Jolpica results (capped at 100/page) and merge by round."""
    rounds: dict = {}
    offset = 0

    while True:
        data = await _get(path, {"limit": PAGE_SIZE, "offset": offset})
        total = int(data.get("total", "0") or "0")
        races = data.get(table_key, {}).get("Races", [])
        if not races:
            break

        for race in races:
            r = race.get("round", "0")
            if r not in rounds:
                rounds[r] = {**race, row_key: []}
            rounds[r][row_key].extend(race.get(row_key, []))

        offset += PAGE_SIZE
        if offset >= total:
            break

    return sorted(rounds.values(), key=lambda r: int(r.get("round", "0")))


async def get_schedule(year: int) -> list:
    data = await _get(f"/{year}.json", {"limit": 100})
    return data.get("RaceTable", {}).get("Races", [])


async def get_drivers(year: int) -> list:
    data = await _get(f"/{year}/drivers.json", {"limit": 100})
    return data.get("DriverTable", {}).get("Drivers", [])


async def get_constructors(year: int) -> list:
    data = await _get(f"/{year}/constructors.json", {"limit": 100})
    return data.get("ConstructorTable", {}).get("Constructors", [])


async def get_driver_standings(year: int) -> list:
    data = await _get(f"/{year}/driverStandings.json")
    lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    return lists[0].get("DriverStandings", []) if lists else []


async def get_constructor_standings(year: int) -> list:
    data = await _get(f"/{year}/constructorStandings.json")
    lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    return lists[0].get("ConstructorStandings", []) if lists else []


async def get_race_results(year: int) -> list:
    return await _get_all_races(f"/{year}/results.json", "RaceTable", "Results")


async def get_race_results_round(year: int, round_num: int) -> list:
    data = await _get(f"/{year}/{round_num}/results.json")
    return data.get("RaceTable", {}).get("Races", [])


async def get_qualifying_results(year: int) -> list:
    return await _get_all_races(f"/{year}/qualifying.json", "RaceTable", "QualifyingResults")


async def get_sprint_results(year: int) -> list:
    data = await _get(f"/{year}/sprint.json", {"limit": 100})
    return data.get("RaceTable", {}).get("Races", [])


async def get_pit_stops(year: int, round_num: int) -> list:
    data = await _get(f"/{year}/{round_num}/pitstops.json", {"limit": 100})
    races = data.get("RaceTable", {}).get("Races", [])
    return races[0].get("PitStops", []) if races else []


async def get_lap_times(year: int, round_num: int) -> list:
    data = await _get(f"/{year}/{round_num}/laps.json", {"limit": 2000})
    races = data.get("RaceTable", {}).get("Races", [])
    return races[0].get("Laps", []) if races else []
