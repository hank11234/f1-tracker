import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
from database import Base, engine, SessionLocal, get_db
from fetchers import openf1, jolpica

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CURRENT_YEAR = datetime.utcnow().year

TEAM_COLORS = {
    "mclaren": "#FF8000",
    "ferrari": "#E8002D",
    "red_bull": "#3671C6",
    "mercedes": "#27F4D2",
    "aston_martin": "#229971",
    "alpine": "#FF87BC",
    "haas": "#B6BABD",
    "rb": "#6692FF",
    "williams": "#64C4FF",
    "sauber": "#52E252",
}

NATIONALITY_FLAGS = {
    "British": "gb", "Dutch": "nl", "Spanish": "es", "German": "de",
    "Mexican": "mx", "Monegasque": "mc", "Australian": "au", "Canadian": "ca",
    "French": "fr", "Finnish": "fi", "Thai": "th", "Chinese": "cn",
    "American": "us", "Brazilian": "br", "Italian": "it", "Japanese": "jp",
    "Danish": "dk", "Argentine": "ar", "New Zealander": "nz", "Austrian": "at",
}

app = FastAPI(title="F1 Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")
    asyncio.create_task(initial_sync())
    _start_scheduler()


def _start_scheduler():
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    scheduler = AsyncIOScheduler()
    scheduler.add_job(sync_all, "interval", minutes=15, id="sync_all")
    scheduler.start()
    app.state.scheduler = scheduler
    logger.info("Scheduler started (15-min interval)")


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_or_create_team(db: Session, constructor_id: str, name: str, nationality: str = "") -> models.Team:
    cid = constructor_id.lower().replace(" ", "_").replace("-", "_")
    team = db.query(models.Team).filter_by(constructor_id=cid).first()
    if not team:
        team = models.Team(
            constructor_id=cid,
            name=name,
            nationality=nationality,
            color=TEAM_COLORS.get(cid, "#e8002d"),
        )
        db.add(team)
        db.flush()
    return team


def get_or_create_driver(db: Session, driver_id: str, first: str, last: str,
                          abbrev: str, number: int, nationality: str,
                          team: models.Team = None) -> models.Driver:
    did = driver_id.lower()
    driver = db.query(models.Driver).filter_by(driver_id=did).first()
    if not driver:
        driver = models.Driver(
            driver_id=did,
            first_name=first,
            last_name=last,
            abbreviation=abbrev.upper(),
            driver_number=number,
            nationality=nationality,
            team_id=team.id if team else None,
        )
        db.add(driver)
        db.flush()
    else:
        if team and driver.team_id != team.id:
            driver.team_id = team.id
    return driver


def get_or_create_circuit(db: Session, circuit_id: str, name: str,
                           location: str, country: str) -> models.Circuit:
    cid = circuit_id.lower()
    circuit = db.query(models.Circuit).filter_by(circuit_id=cid).first()
    if not circuit:
        circuit = models.Circuit(
            circuit_id=cid,
            name=name,
            location=location,
            country=country,
        )
        db.add(circuit)
        db.flush()
    return circuit


def parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    for fmt in ["%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=None) if dt.tzinfo else dt
        except ValueError:
            continue
    return None


def lap_str_to_seconds(s: Optional[str]) -> Optional[float]:
    if not s:
        return None
    try:
        if ":" in s:
            parts = s.split(":")
            return float(parts[0]) * 60 + float(parts[1])
        return float(s)
    except Exception:
        return None


def _log_sync(db: Session, sync_type: str, status: str, msg: str = ""):
    entry = models.SyncLog(
        sync_time=datetime.utcnow(),
        sync_type=sync_type,
        status=status,
        message=msg,
    )
    db.add(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Sync functions
# ---------------------------------------------------------------------------

async def sync_schedule_and_teams(db: Session):
    """Sync race schedule, circuits, constructors from Jolpica."""
    logger.info("Syncing schedule and constructors...")

    # Constructors
    constructors = await jolpica.get_constructors(CURRENT_YEAR)
    for c in constructors:
        get_or_create_team(db, c["constructorId"], c["name"], c.get("nationality", ""))
    db.commit()

    # Schedule / circuits
    races = await jolpica.get_schedule(CURRENT_YEAR)
    for race in races:
        circuit_data = race.get("Circuit", {})
        loc = circuit_data.get("Location", {})
        circuit = get_or_create_circuit(
            db,
            circuit_data.get("circuitId", "unknown"),
            circuit_data.get("circuitName", "Unknown Circuit"),
            loc.get("locality", ""),
            loc.get("country", ""),
        )
        db.commit()

    logger.info(f"Schedule sync complete: {len(races)} races")


async def sync_jolpica_drivers(db: Session):
    """Sync driver list from Jolpica."""
    logger.info("Syncing drivers from Jolpica...")
    drivers = await jolpica.get_drivers(CURRENT_YEAR)
    for d in drivers:
        # We may not have team info here; team assigned from results sync
        existing = db.query(models.Driver).filter_by(driver_id=d["driverId"]).first()
        if not existing:
            driver = models.Driver(
                driver_id=d["driverId"],
                first_name=d.get("givenName", ""),
                last_name=d.get("familyName", ""),
                abbreviation=d.get("code", d["driverId"][:3].upper()),
                driver_number=int(d.get("permanentNumber", 0) or 0),
                nationality=d.get("nationality", ""),
            )
            db.add(driver)
    db.commit()
    logger.info(f"Drivers sync complete: {len(drivers)} drivers")


def _compute_standings_from_results(db: Session):
    """Fallback: derive standings from race SessionResult rows already in the DB."""
    race_sessions = (
        db.query(models.Session)
        .filter_by(year=CURRENT_YEAR, session_type="Race", status="completed")
        .all()
    )
    round_num = len(race_sessions)
    if round_num == 0:
        logger.info("No completed races found — standings not computed")
        return

    driver_pts: dict[int, dict] = {}
    team_pts: dict[int, dict] = {}

    for session in race_sessions:
        for r in session.results:
            pts = float(r.points or 0)
            is_win = r.position == 1

            d_id = r.driver_id
            if d_id not in driver_pts:
                driver_pts[d_id] = {"points": 0.0, "wins": 0}
            driver_pts[d_id]["points"] += pts
            if is_win:
                driver_pts[d_id]["wins"] += 1

            driver = r.driver
            if driver and driver.team_id:
                t_id = driver.team_id
                if t_id not in team_pts:
                    team_pts[t_id] = {"points": 0.0, "wins": 0}
                team_pts[t_id]["points"] += pts
                if is_win:
                    team_pts[t_id]["wins"] += 1

    for pos, (d_id, data) in enumerate(
        sorted(driver_pts.items(), key=lambda x: -x[1]["points"]), 1
    ):
        existing = db.query(models.DriverStanding).filter_by(
            year=CURRENT_YEAR, round_number=round_num, driver_id=d_id
        ).first()
        if existing:
            existing.position = pos
            existing.points = data["points"]
            existing.wins = data["wins"]
        else:
            db.add(models.DriverStanding(
                year=CURRENT_YEAR, round_number=round_num,
                driver_id=d_id, position=pos,
                points=data["points"], wins=data["wins"],
            ))

    for pos, (t_id, data) in enumerate(
        sorted(team_pts.items(), key=lambda x: -x[1]["points"]), 1
    ):
        existing = db.query(models.TeamStanding).filter_by(
            year=CURRENT_YEAR, round_number=round_num, team_id=t_id
        ).first()
        if existing:
            existing.position = pos
            existing.points = data["points"]
            existing.wins = data["wins"]
        else:
            db.add(models.TeamStanding(
                year=CURRENT_YEAR, round_number=round_num,
                team_id=t_id, position=pos,
                points=data["points"], wins=data["wins"],
            ))

    db.commit()
    logger.info(f"Standings computed from {round_num} race results in DB")


async def sync_standings(db: Session):
    """Sync standings: try Jolpica first, fall back to computing from stored results."""
    logger.info("Syncing standings...")

    driver_standings = await jolpica.get_driver_standings(CURRENT_YEAR)
    round_num = 0

    if driver_standings:
        races = await jolpica.get_race_results(CURRENT_YEAR)
        round_num = len(races)

        for s in driver_standings:
            driver_info = s.get("Driver", {})
            driver = db.query(models.Driver).filter_by(driver_id=driver_info.get("driverId")).first()
            if not driver:
                continue
            existing = db.query(models.DriverStanding).filter_by(
                year=CURRENT_YEAR, round_number=round_num, driver_id=driver.id
            ).first()
            if existing:
                existing.position = int(s.get("position", 0))
                existing.points = float(s.get("points", 0))
                existing.wins = int(s.get("wins", 0))
            else:
                db.add(models.DriverStanding(
                    year=CURRENT_YEAR, round_number=round_num, driver_id=driver.id,
                    position=int(s.get("position", 0)),
                    points=float(s.get("points", 0)),
                    wins=int(s.get("wins", 0)),
                ))

        constructor_standings = await jolpica.get_constructor_standings(CURRENT_YEAR)
        for s in constructor_standings:
            const_info = s.get("Constructor", {})
            team = db.query(models.Team).filter_by(constructor_id=const_info.get("constructorId")).first()
            if not team:
                continue
            existing = db.query(models.TeamStanding).filter_by(
                year=CURRENT_YEAR, round_number=round_num, team_id=team.id
            ).first()
            if existing:
                existing.position = int(s.get("position", 0))
                existing.points = float(s.get("points", 0))
                existing.wins = int(s.get("wins", 0))
            else:
                db.add(models.TeamStanding(
                    year=CURRENT_YEAR, round_number=round_num, team_id=team.id,
                    position=int(s.get("position", 0)),
                    points=float(s.get("points", 0)),
                    wins=int(s.get("wins", 0)),
                ))
        db.commit()
        logger.info("Standings synced from Jolpica")
    else:
        logger.info("Jolpica returned no standings — computing from stored results")
        _compute_standings_from_results(db)

    logger.info("Standings sync complete")


async def sync_race_results(db: Session):
    """Sync all race results and qualifying from Jolpica."""
    logger.info("Syncing race results...")
    races = await jolpica.get_race_results(CURRENT_YEAR)
    qual_races = await jolpica.get_qualifying_results(CURRENT_YEAR)

    qual_map = {int(r["round"]): r for r in qual_races}

    for race in races:
        circuit_data = race.get("Circuit", {})
        circuit = db.query(models.Circuit).filter_by(
            circuit_id=circuit_data.get("circuitId")
        ).first()
        round_num = int(race.get("round", 0))

        # Ensure Race session
        race_date = parse_dt(race.get("date"))
        race_session = db.query(models.Session).filter_by(
            year=CURRENT_YEAR, round_number=round_num, session_type="Race"
        ).first()
        if not race_session:
            race_session = models.Session(
                session_key=CURRENT_YEAR * 1000 + round_num * 10 + 1,
                year=CURRENT_YEAR,
                round_number=round_num,
                circuit_id=circuit.id if circuit else None,
                session_type="Race",
                session_name=race.get("raceName", "Race"),
                date_start=race_date,
                status="completed",
            )
            db.add(race_session)
            db.flush()

        # Race results
        for r in race.get("Results", []):
            driver_info = r.get("Driver", {})
            const_info = r.get("Constructor", {})

            team = get_or_create_team(db, const_info.get("constructorId", "unknown"),
                                      const_info.get("name", "Unknown"), "")
            driver = get_or_create_driver(
                db,
                driver_info.get("driverId", "unknown"),
                driver_info.get("givenName", ""),
                driver_info.get("familyName", ""),
                driver_info.get("code", "UNK"),
                int(driver_info.get("permanentNumber", 0) or 0),
                driver_info.get("nationality", ""),
                team,
            )

            fastest_time = None
            fastest = r.get("FastestLap", {})
            if fastest:
                fastest_time = lap_str_to_seconds(fastest.get("Time", {}).get("time"))

            existing = db.query(models.SessionResult).filter_by(
                session_id=race_session.id, driver_id=driver.id
            ).first()
            pos_str = r.get("position", "0")
            grid_str = r.get("grid", "0")
            if existing:
                existing.position = int(pos_str) if pos_str.isdigit() else None
                existing.grid_position = int(grid_str) if grid_str.isdigit() else None
                existing.points = float(r.get("points", 0))
                existing.laps_completed = int(r.get("laps", 0))
                existing.status = r.get("status", "")
                existing.gap_to_leader = r.get("Time", {}).get("time") or r.get("status", "")
                existing.best_lap_time = fastest_time
            else:
                db.add(models.SessionResult(
                    session_id=race_session.id,
                    driver_id=driver.id,
                    position=int(pos_str) if pos_str.isdigit() else None,
                    grid_position=int(grid_str) if grid_str.isdigit() else None,
                    points=float(r.get("points", 0)),
                    laps_completed=int(r.get("laps", 0)),
                    status=r.get("status", ""),
                    gap_to_leader=r.get("Time", {}).get("time") or r.get("status", ""),
                    best_lap_time=fastest_time,
                ))

        # Qualifying session
        if round_num in qual_map:
            qrace = qual_map[round_num]
            qual_date = parse_dt(qrace.get("date"))
            qual_session = db.query(models.Session).filter_by(
                year=CURRENT_YEAR, round_number=round_num, session_type="Qualifying"
            ).first()
            if not qual_session:
                qual_session = models.Session(
                    session_key=CURRENT_YEAR * 1000 + round_num * 10 + 2,
                    year=CURRENT_YEAR,
                    round_number=round_num,
                    circuit_id=circuit.id if circuit else None,
                    session_type="Qualifying",
                    session_name="Qualifying",
                    date_start=qual_date,
                    status="completed",
                )
                db.add(qual_session)
                db.flush()

            for r in qrace.get("QualifyingResults", []):
                driver_info = r.get("Driver", {})
                const_info = r.get("Constructor", {})
                team = get_or_create_team(db, const_info.get("constructorId", "unknown"),
                                          const_info.get("name", "Unknown"), "")
                driver = get_or_create_driver(
                    db,
                    driver_info.get("driverId", "unknown"),
                    driver_info.get("givenName", ""),
                    driver_info.get("familyName", ""),
                    driver_info.get("code", "UNK"),
                    int(driver_info.get("permanentNumber", 0) or 0),
                    driver_info.get("nationality", ""),
                    team,
                )
                best = (lap_str_to_seconds(r.get("Q3")) or
                        lap_str_to_seconds(r.get("Q2")) or
                        lap_str_to_seconds(r.get("Q1")))
                pos_str = r.get("position", "0")
                existing = db.query(models.SessionResult).filter_by(
                    session_id=qual_session.id, driver_id=driver.id
                ).first()
                if not existing:
                    db.add(models.SessionResult(
                        session_id=qual_session.id,
                        driver_id=driver.id,
                        position=int(pos_str) if pos_str.isdigit() else None,
                        best_lap_time=best,
                        points=0,
                    ))

        db.commit()

    logger.info(f"Race results sync complete: {len(races)} races")


async def sync_openf1_sessions(db: Session):
    """Sync sessions and lap data from OpenF1."""
    logger.info("Syncing OpenF1 sessions...")
    sessions = await openf1.get_sessions(CURRENT_YEAR)

    for s in sessions:
        sk = s.get("session_key")
        if not sk:
            continue

        existing = db.query(models.Session).filter_by(session_key=sk).first()
        if not existing:
            date_start = parse_dt(s.get("date_start"))
            date_end = parse_dt(s.get("date_end"))
            now = datetime.utcnow()
            if date_end and date_end < now:
                status = "completed"
            elif date_start and date_start <= now:
                status = "live"
            else:
                status = "upcoming"

            # Find or create circuit
            loc = s.get("location", "Unknown")
            country = s.get("country_name", "")
            circuit_id = loc.lower().replace(" ", "_")
            circuit = get_or_create_circuit(db, circuit_id, s.get("circuit_short_name", loc),
                                            loc, country)
            session_type = s.get("session_type", "Unknown")
            round_num = s.get("meeting_key", 0)

            new_session = models.Session(
                session_key=sk,
                openf1_key=sk,
                year=CURRENT_YEAR,
                round_number=round_num,
                circuit_id=circuit.id,
                session_type=session_type,
                session_name=s.get("session_name", session_type),
                date_start=date_start,
                date_end=date_end,
                status=status,
            )
            db.add(new_session)
            db.flush()
            existing = new_session
        else:
            date_end = parse_dt(s.get("date_end"))
            now = datetime.utcnow()
            if date_end and date_end < now:
                existing.status = "completed"
            elif existing.date_start and existing.date_start <= now:
                existing.status = "live"

        db.commit()

        # Fetch detailed data for completed sessions that don't have laps yet.
        # Sleep briefly to avoid hitting OpenF1's rate limit (429).
        if existing.status == "completed":
            lap_count = db.query(models.Lap).filter_by(session_id=existing.id).count()
            if lap_count == 0:
                await asyncio.sleep(1.5)
                await sync_openf1_session_detail(db, existing, sk)

    logger.info(f"OpenF1 sessions sync complete: {len(sessions)} sessions")


async def sync_openf1_session_detail(db: Session, session: models.Session, session_key: int):
    """Sync lap times, pit stops, stints for a specific OpenF1 session."""
    logger.info(f"Syncing detail for session {session_key}...")

    # Drivers in this session
    drivers_data = await openf1.get_drivers(session_key)
    driver_map = {}  # number -> DB driver

    for d in drivers_data:
        num = d.get("driver_number")
        if not num:
            continue
        abbrev = d.get("name_acronym", "UNK")
        full = d.get("full_name", "Unknown Driver")
        parts = full.split(" ", 1)
        first = parts[0] if len(parts) > 0 else ""
        last = parts[1] if len(parts) > 1 else ""
        team_name = d.get("team_name", "Unknown")
        team_color = d.get("team_colour") or "e8002d"
        team_color = f"#{team_color}" if not team_color.startswith("#") else team_color

        # Match or create team
        cid = team_name.lower().replace(" ", "_").replace("-", "_")
        team = db.query(models.Team).filter_by(constructor_id=cid).first()
        if not team:
            team = models.Team(
                constructor_id=cid,
                name=team_name,
                color=TEAM_COLORS.get(cid, team_color),
            )
            db.add(team)
            db.flush()

        did = f"{abbrev.lower()}_{num}"
        driver = db.query(models.Driver).filter(
            (models.Driver.driver_number == num) |
            (models.Driver.abbreviation == abbrev)
        ).first()
        if not driver:
            driver = models.Driver(
                driver_id=did,
                first_name=first,
                last_name=last,
                abbreviation=abbrev,
                driver_number=num,
                nationality="",
                team_id=team.id,
            )
            db.add(driver)
            db.flush()
        elif not driver.team_id:
            driver.team_id = team.id

        driver_map[num] = driver

    db.commit()

    # Laps — deduplicate by (driver_number, lap_number) before inserting;
    # OpenF1 occasionally returns the same lap twice with partial sector data.
    laps_data = await openf1.get_laps(session_key)
    deduped_laps = {}
    for lap in laps_data:
        num = lap.get("driver_number")
        lap_num = lap.get("lap_number")
        if num and lap_num:
            deduped_laps[(num, lap_num)] = lap  # last entry wins

    # Load already-stored lap keys into a set so the query check works even
    # before the current-session adds are flushed (autoflush=False).
    stored_laps = set(
        db.query(models.Lap.driver_id, models.Lap.lap_number)
        .filter(models.Lap.session_id == session.id)
        .all()
    )

    for (num, lap_num), lap in deduped_laps.items():
        driver = driver_map.get(num)
        if not driver:
            continue
        if (driver.id, lap_num) in stored_laps:
            continue
        stored_laps.add((driver.id, lap_num))
        compound_raw = (lap.get("compound") or "").upper()
        compound = compound_raw if compound_raw in ("SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET") else None
        db.add(models.Lap(
            session_id=session.id,
            driver_id=driver.id,
            lap_number=lap_num,
            lap_time=lap.get("lap_duration"),
            sector1=lap.get("duration_sector_1"),
            sector2=lap.get("duration_sector_2"),
            sector3=lap.get("duration_sector_3"),
            compound=compound,
            tyre_age=lap.get("st_tyre_age"),
            is_pit_out_lap=bool(lap.get("is_pit_out_lap")),
            is_personal_best=bool(lap.get("is_personal_best")),
            is_deleted=bool(lap.get("is_deleted")),
        ))

    db.commit()

    # Pit stops — deduplicate by (driver, lap) same as laps
    pits_data = await openf1.get_pit_stops(session_key)
    deduped_pits = {}
    for pit in pits_data:
        num = pit.get("driver_number")
        lap_num = pit.get("lap_number")
        if num and lap_num:
            deduped_pits[(num, lap_num)] = pit

    stored_pits = set(
        db.query(models.PitStop.driver_id, models.PitStop.lap_number)
        .filter(models.PitStop.session_id == session.id)
        .all()
    )
    for (num, lap_num), pit in deduped_pits.items():
        driver = driver_map.get(num)
        if not driver or (driver.id, lap_num) in stored_pits:
            continue
        stored_pits.add((driver.id, lap_num))
        db.add(models.PitStop(
            session_id=session.id,
            driver_id=driver.id,
            lap_number=lap_num,
            pit_duration=pit.get("pit_duration"),
        ))

    # Stints — deduplicate by (driver, stint_number)
    stints_data = await openf1.get_stints(session_key)
    deduped_stints = {}
    for stint in stints_data:
        num = stint.get("driver_number")
        stint_num = stint.get("stint_number")
        if num and stint_num:
            deduped_stints[(num, stint_num)] = stint

    stored_stints = set(
        db.query(models.Stint.driver_id, models.Stint.stint_number)
        .filter(models.Stint.session_id == session.id)
        .all()
    )
    for (num, stint_num), stint in deduped_stints.items():
        driver = driver_map.get(num)
        if not driver or (driver.id, stint_num) in stored_stints:
            continue
        stored_stints.add((driver.id, stint_num))
        compound_raw = (stint.get("compound") or "").upper()
        db.add(models.Stint(
            session_id=session.id,
            driver_id=driver.id,
            stint_number=stint_num,
            lap_start=stint.get("lap_start", 0),
            lap_end=stint.get("lap_end"),
            compound=compound_raw if compound_raw else "UNKNOWN",
            tyre_age_at_start=stint.get("tyre_age_at_start", 0),
        ))

    db.commit()

    # For Race sessions with no results yet, derive finishing positions from
    # OpenF1 position data (used when Jolpica doesn't have the race results yet).
    if session.session_type == "Race":
        existing_results = db.query(models.SessionResult).filter_by(session_id=session.id).count()
        if existing_results == 0 and driver_map:
            await _sync_race_positions_from_openf1(db, session, session_key, driver_map)

    logger.info(f"Session {session_key} detail sync complete")


POINTS_MAP = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}


async def _sync_race_positions_from_openf1(
    db: Session, session: models.Session, session_key: int, driver_map: dict
):
    """Derive finishing positions from OpenF1 position stream and store as SessionResult rows."""
    position_data = await openf1.get_position(session_key)
    if not position_data:
        return

    # Last recorded position per driver = finishing position
    final_pos: dict[int, int] = {}
    for entry in position_data:
        num = entry.get("driver_number")
        pos = entry.get("position")
        if num and pos:
            final_pos[num] = pos

    if not final_pos:
        return

    # Fastest lap (lowest lap_time among non-deleted laps) for bonus point
    best_lap = (
        db.query(models.Lap)
        .filter_by(session_id=session.id, is_deleted=False)
        .filter(models.Lap.lap_time.isnot(None))
        .order_by(models.Lap.lap_time)
        .first()
    )
    fastest_driver_id = best_lap.driver_id if best_lap else None

    for num, position in final_pos.items():
        driver = driver_map.get(num)
        if not driver:
            continue
        pts = float(POINTS_MAP.get(position, 0))
        # Fastest-lap bonus: +1 if in top 10 AND scored points
        if driver.id == fastest_driver_id and position <= 10:
            pts += 1.0
        db.add(models.SessionResult(
            session_id=session.id,
            driver_id=driver.id,
            position=position,
            points=pts,
            status="Finished",
        ))

    db.commit()
    logger.info(f"Derived {len(final_pos)} race positions from OpenF1 for session {session_key}")


# Master sync
async def sync_all():
    db = SessionLocal()
    try:
        await sync_schedule_and_teams(db)
        await sync_jolpica_drivers(db)
        await sync_race_results(db)
        await sync_openf1_sessions(db)
        await sync_standings(db)
        _log_sync(db, "full", "success")
        logger.info("Full sync complete")
    except Exception as e:
        logger.error(f"Sync error: {e}", exc_info=True)
        try:
            db.rollback()
            _log_sync(db, "full", "error", str(e)[:500])
        except Exception:
            pass
    finally:
        db.close()


async def initial_sync():
    await asyncio.sleep(1)
    await sync_all()


# ---------------------------------------------------------------------------
# API helpers / serializers
# ---------------------------------------------------------------------------

def serialize_driver(d: models.Driver) -> dict:
    team = d.team
    return {
        "id": d.id,
        "driver_id": d.driver_id,
        "name": f"{d.first_name} {d.last_name}".strip(),
        "first_name": d.first_name,
        "last_name": d.last_name,
        "abbreviation": d.abbreviation,
        "number": d.driver_number,
        "nationality": d.nationality,
        "flag": NATIONALITY_FLAGS.get(d.nationality, ""),
        "team": {
            "id": team.id if team else None,
            "name": team.name if team else "Unknown",
            "constructor_id": team.constructor_id if team else "",
            "color": team.color if team else "#e8002d",
        } if team else None,
    }


def serialize_team(t: models.Team) -> dict:
    return {
        "id": t.id,
        "constructor_id": t.constructor_id,
        "name": t.name,
        "nationality": t.nationality,
        "color": t.color,
    }


def format_lap_time(seconds: Optional[float]) -> Optional[str]:
    if seconds is None:
        return None
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m}:{s:06.3f}"


def serialize_lap(lap: models.Lap) -> dict:
    return {
        "lap_number": lap.lap_number,
        "lap_time": lap.lap_time,
        "lap_time_str": format_lap_time(lap.lap_time),
        "sector1": lap.sector1,
        "sector2": lap.sector2,
        "sector3": lap.sector3,
        "compound": lap.compound,
        "tyre_age": lap.tyre_age,
        "is_pit_out_lap": lap.is_pit_out_lap,
        "is_personal_best": lap.is_personal_best,
        "is_deleted": lap.is_deleted,
    }


def serialize_result(r: models.SessionResult) -> dict:
    driver = r.driver
    team = driver.team if driver else None
    return {
        "position": r.position,
        "grid_position": r.grid_position,
        "driver": serialize_driver(driver) if driver else None,
        "team_color": team.color if team else "#e8002d",
        "points": r.points,
        "laps_completed": r.laps_completed,
        "status": r.status,
        "gap_to_leader": r.gap_to_leader,
        "best_lap_time": r.best_lap_time,
        "best_lap_time_str": format_lap_time(r.best_lap_time),
    }


def serialize_session(s: models.Session) -> dict:
    circuit = s.circuit
    return {
        "id": s.id,
        "session_key": s.session_key,
        "year": s.year,
        "round": s.round_number,
        "session_type": s.session_type,
        "session_name": s.session_name,
        "date_start": s.date_start.isoformat() if s.date_start else None,
        "date_end": s.date_end.isoformat() if s.date_end else None,
        "status": s.status,
        "circuit": {
            "id": circuit.id,
            "circuit_id": circuit.circuit_id,
            "name": circuit.name,
            "location": circuit.location,
            "country": circuit.country,
        } if circuit else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/status")
def api_status(db: Session = Depends(get_db)):
    last = db.query(models.SyncLog).order_by(models.SyncLog.sync_time.desc()).first()
    driver_count = db.query(models.Driver).count()
    session_count = db.query(models.Session).count()
    lap_count = db.query(models.Lap).count()
    return {
        "status": "ok",
        "last_sync": last.sync_time.isoformat() if last else None,
        "last_sync_status": last.status if last else None,
        "drivers": driver_count,
        "sessions": session_count,
        "laps": lap_count,
    }


@app.post("/api/sync")
async def trigger_sync(background_tasks: BackgroundTasks):
    background_tasks.add_task(sync_all)
    return {"message": "Sync triggered"}


@app.get("/api/standings/drivers")
def driver_standings(db: Session = Depends(get_db)):
    latest_round = (
        db.query(models.DriverStanding.round_number)
        .filter_by(year=CURRENT_YEAR)
        .order_by(models.DriverStanding.round_number.desc())
        .scalar()
    )
    if latest_round is None:
        return []
    standings = (
        db.query(models.DriverStanding)
        .filter_by(year=CURRENT_YEAR, round_number=latest_round)
        .order_by(models.DriverStanding.position)
        .all()
    )
    return [
        {
            "position": s.position,
            "points": s.points,
            "wins": s.wins,
            "driver": serialize_driver(s.driver),
        }
        for s in standings
        if s.driver
    ]


@app.get("/api/standings/constructors")
def constructor_standings(db: Session = Depends(get_db)):
    latest_round = (
        db.query(models.TeamStanding.round_number)
        .filter_by(year=CURRENT_YEAR)
        .order_by(models.TeamStanding.round_number.desc())
        .scalar()
    )
    if latest_round is None:
        return []
    standings = (
        db.query(models.TeamStanding)
        .filter_by(year=CURRENT_YEAR, round_number=latest_round)
        .order_by(models.TeamStanding.position)
        .all()
    )
    return [
        {
            "position": s.position,
            "points": s.points,
            "wins": s.wins,
            "team": serialize_team(s.team),
        }
        for s in standings
        if s.team
    ]


@app.get("/api/drivers")
def list_drivers(db: Session = Depends(get_db)):
    drivers = db.query(models.Driver).order_by(models.Driver.driver_number).all()
    return [serialize_driver(d) for d in drivers]


@app.get("/api/drivers/{driver_id}")
def get_driver(driver_id: str, db: Session = Depends(get_db)):
    driver = db.query(models.Driver).filter_by(driver_id=driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    # All results
    results = db.query(models.SessionResult).filter_by(driver_id=driver.id).all()
    result_data = []
    for r in results:
        s = r.session
        result_data.append({
            **serialize_result(r),
            "session": serialize_session(s) if s else None,
        })

    # Best laps by circuit
    circuit_bests = {}
    laps = (
        db.query(models.Lap)
        .filter_by(driver_id=driver.id, is_deleted=False)
        .filter(models.Lap.lap_time.isnot(None))
        .all()
    )
    for lap in laps:
        session = lap.session
        if not session or not session.circuit:
            continue
        cid = session.circuit.circuit_id
        if cid not in circuit_bests or (lap.lap_time and lap.lap_time < circuit_bests[cid]["time"]):
            circuit_bests[cid] = {
                "circuit": session.circuit.name,
                "time": lap.lap_time,
                "time_str": format_lap_time(lap.lap_time),
                "session_type": session.session_type,
                "year": session.year,
                "lap_number": lap.lap_number,
                "compound": lap.compound,
            }

    # Standings history
    standings = (
        db.query(models.DriverStanding)
        .filter_by(driver_id=driver.id, year=CURRENT_YEAR)
        .order_by(models.DriverStanding.round_number)
        .all()
    )

    # Car parts
    parts = db.query(models.CarPart).filter_by(driver_id=driver.id, year=CURRENT_YEAR).all()
    parts_data = [
        {"component": p.component, "count": p.pool_count, "round": p.round_number,
         "penalty": p.penalty_applied, "notes": p.notes}
        for p in parts
    ]

    return {
        **serialize_driver(driver),
        "results": result_data,
        "best_laps_by_circuit": list(circuit_bests.values()),
        "standings_history": [
            {"round": s.round_number, "position": s.position, "points": s.points}
            for s in standings
        ],
        "car_parts": parts_data,
    }


@app.get("/api/teams")
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).order_by(models.Team.name).all()
    result = []
    for team in teams:
        drivers = db.query(models.Driver).filter_by(team_id=team.id).all()
        result.append({
            **serialize_team(team),
            "drivers": [serialize_driver(d) for d in drivers],
        })
    return result


@app.get("/api/teams/{constructor_id}")
def get_team(constructor_id: str, db: Session = Depends(get_db)):
    team = db.query(models.Team).filter_by(constructor_id=constructor_id).first()
    if not team:
        raise HTTPException(404, "Team not found")

    drivers = db.query(models.Driver).filter_by(team_id=team.id).all()

    # All results across all drivers
    all_results = []
    for driver in drivers:
        results = db.query(models.SessionResult).filter_by(driver_id=driver.id).all()
        for r in results:
            s = r.session
            all_results.append({
                **serialize_result(r),
                "session": serialize_session(s) if s else None,
            })

    # Team standings history
    standings = (
        db.query(models.TeamStanding)
        .filter_by(team_id=team.id, year=CURRENT_YEAR)
        .order_by(models.TeamStanding.round_number)
        .all()
    )

    # Car parts across team's drivers
    parts = []
    for driver in drivers:
        dparts = db.query(models.CarPart).filter_by(driver_id=driver.id, year=CURRENT_YEAR).all()
        for p in dparts:
            parts.append({
                "driver": serialize_driver(driver),
                "component": p.component,
                "count": p.pool_count,
                "round": p.round_number,
                "penalty": p.penalty_applied,
                "notes": p.notes,
            })

    return {
        **serialize_team(team),
        "drivers": [serialize_driver(d) for d in drivers],
        "results": sorted(all_results, key=lambda x: (
            x["session"]["round"] if x["session"] else 0), reverse=True),
        "standings_history": [
            {"round": s.round_number, "position": s.position, "points": s.points}
            for s in standings
        ],
        "car_parts": parts,
    }


@app.get("/api/circuits")
def list_circuits(db: Session = Depends(get_db)):
    circuits = db.query(models.Circuit).order_by(models.Circuit.name).all()
    result = []
    for c in circuits:
        session_count = db.query(models.Session).filter_by(circuit_id=c.id).count()
        result.append({
            "id": c.id,
            "circuit_id": c.circuit_id,
            "name": c.name,
            "location": c.location,
            "country": c.country,
            "session_count": session_count,
        })
    return result


@app.get("/api/circuits/{circuit_id}")
def get_circuit(circuit_id: str, db: Session = Depends(get_db)):
    circuit = db.query(models.Circuit).filter_by(circuit_id=circuit_id).first()
    if not circuit:
        raise HTTPException(404, "Circuit not found")

    sessions = (
        db.query(models.Session)
        .filter_by(circuit_id=circuit.id)
        .order_by(models.Session.date_start.desc())
        .all()
    )

    # Track records — best lap per driver per session type
    track_records = {}
    for session in sessions:
        if session.session_type in ("Race", "Qualifying"):
            laps = (
                db.query(models.Lap)
                .filter_by(session_id=session.id, is_deleted=False)
                .filter(models.Lap.lap_time.isnot(None))
                .order_by(models.Lap.lap_time)
                .all()
            )
            if laps:
                best = laps[0]
                key = session.session_type
                if key not in track_records or best.lap_time < track_records[key]["time"]:
                    track_records[key] = {
                        "time": best.lap_time,
                        "time_str": format_lap_time(best.lap_time),
                        "driver": serialize_driver(best.driver),
                        "session_type": session.session_type,
                        "year": session.year,
                        "compound": best.compound,
                    }

    return {
        "id": circuit.id,
        "circuit_id": circuit.circuit_id,
        "name": circuit.name,
        "location": circuit.location,
        "country": circuit.country,
        "sessions": [serialize_session(s) for s in sessions],
        "track_records": track_records,
    }


@app.get("/api/sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(models.Session)
        .order_by(models.Session.date_start.desc())
        .all()
    )
    return [serialize_session(s) for s in sessions]


@app.get("/api/sessions/{session_key}")
def get_session(session_key: int, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter_by(session_key=session_key).first()
    if not session:
        raise HTTPException(404, "Session not found")

    results = (
        db.query(models.SessionResult)
        .filter_by(session_id=session.id)
        .order_by(models.SessionResult.position)
        .all()
    )

    # Laps grouped by driver
    all_laps = (
        db.query(models.Lap)
        .filter_by(session_id=session.id)
        .order_by(models.Lap.driver_id, models.Lap.lap_number)
        .all()
    )
    laps_by_driver = {}
    for lap in all_laps:
        did = lap.driver_id
        if did not in laps_by_driver:
            laps_by_driver[did] = []
        laps_by_driver[did].append(serialize_lap(lap))

    # Build result set with laps
    results_with_laps = []
    for r in results:
        d = serialize_result(r)
        d["laps"] = laps_by_driver.get(r.driver_id, [])
        # Best lap
        driver_laps = [l for l in all_laps if l.driver_id == r.driver_id and l.lap_time and not l.is_deleted]
        if driver_laps:
            best = min(driver_laps, key=lambda l: l.lap_time)
            d["best_lap_time"] = best.lap_time
            d["best_lap_time_str"] = format_lap_time(best.lap_time)
            d["best_lap_number"] = best.lap_number
        results_with_laps.append(d)

    # Pit stops
    pits = (
        db.query(models.PitStop)
        .filter_by(session_id=session.id)
        .order_by(models.PitStop.lap_number)
        .all()
    )
    pits_data = [
        {
            "driver": serialize_driver(p.driver),
            "lap": p.lap_number,
            "duration": p.pit_duration,
            "duration_str": f"{p.pit_duration:.3f}s" if p.pit_duration else None,
        }
        for p in pits
    ]

    # Stints
    stints = (
        db.query(models.Stint)
        .filter_by(session_id=session.id)
        .order_by(models.Stint.driver_id, models.Stint.stint_number)
        .all()
    )
    stints_data = [
        {
            "driver": serialize_driver(s.driver),
            "stint": s.stint_number,
            "lap_start": s.lap_start,
            "lap_end": s.lap_end,
            "compound": s.compound,
            "tyre_age": s.tyre_age_at_start,
            "laps": (s.lap_end or 0) - s.lap_start if s.lap_end else None,
        }
        for s in stints
    ]

    return {
        **serialize_session(session),
        "results": results_with_laps,
        "pit_stops": pits_data,
        "stints": stints_data,
    }


@app.get("/api/sessions/{session_key}/laps/{driver_id}")
def get_driver_laps(session_key: int, driver_id: str, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter_by(session_key=session_key).first()
    if not session:
        raise HTTPException(404, "Session not found")
    driver = db.query(models.Driver).filter_by(driver_id=driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    laps = (
        db.query(models.Lap)
        .filter_by(session_id=session.id, driver_id=driver.id)
        .order_by(models.Lap.lap_number)
        .all()
    )
    return [serialize_lap(l) for l in laps]


@app.get("/api/cars")
def get_cars(db: Session = Depends(get_db)):
    """Power unit component usage for all drivers this season."""
    drivers = db.query(models.Driver).order_by(models.Driver.driver_number).all()
    result = []
    for driver in drivers:
        parts = db.query(models.CarPart).filter_by(driver_id=driver.id, year=CURRENT_YEAR).all()
        components = {}
        for p in parts:
            if p.component not in components:
                components[p.component] = 0
            components[p.component] = max(components[p.component], p.pool_count)
        result.append({
            "driver": serialize_driver(driver),
            "components": components,
            "has_penalty": any(p.penalty_applied for p in parts),
        })
    return result


@app.post("/api/cars/update")
def update_car_part(
    driver_id: str,
    year: int,
    round_number: int,
    component: str,
    pool_count: int,
    penalty_applied: bool = False,
    notes: str = "",
    db: Session = Depends(get_db),
):
    """Manually update car part usage (for data not available via API)."""
    driver = db.query(models.Driver).filter_by(driver_id=driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    existing = db.query(models.CarPart).filter_by(
        driver_id=driver.id, year=year, round_number=round_number, component=component
    ).first()
    if existing:
        existing.pool_count = pool_count
        existing.penalty_applied = penalty_applied
        existing.notes = notes
    else:
        db.add(models.CarPart(
            driver_id=driver.id,
            year=year,
            round_number=round_number,
            component=component,
            pool_count=pool_count,
            penalty_applied=penalty_applied,
            notes=notes or None,
        ))
    db.commit()
    return {"message": "Updated"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
