"""Ingest historical usage CSV into UsageEvent, preserving source provenance."""
import hashlib
import logging
from pathlib import Path

import pandas as pd
from sqlmodel import Session, select

from .config import USD_TO_MYR, VALID_SOURCES
from .models import UsageEvent

log = logging.getLogger(__name__)

REQUIRED_COLUMNS = [
    "tenant_id", "app_id", "provider", "model",
    "input_tokens", "output_tokens",
    "actual_provider_cost_usd", "actual_provider_cost_myr", "source",
]
NUMERIC_COLUMNS = [
    "input_tokens", "output_tokens",
    "actual_provider_cost_usd", "actual_provider_cost_myr",
]


def load_and_validate_csv(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    aliases = {
        "timestamp": ("timestamp_utc", "date"),
        "model": ("model_used",),
    }
    for canonical, alternatives in aliases.items():
        if canonical not in df.columns:
            for alternative in alternatives:
                if alternative in df.columns:
                    df[canonical] = df[alternative]
                    break

    if "timestamp" not in df.columns:
        raise ValueError("CSV must contain a 'timestamp', 'timestamp_utc', or 'date' column")

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    if df["timestamp"].isna().any():
        raise ValueError("Unparseable timestamp/date values found")

    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].isna().any():
            raise ValueError(f"Non-numeric or null values in '{col}'")
        if (df[col] < 0).any():
            raise ValueError(f"Negative values in '{col}'")

    df["source"] = df["source"].astype(str).str.strip().str.lower()
    bad = set(df["source"]) - VALID_SOURCES
    if bad:
        raise ValueError(f"Invalid source values {bad}; must be one of {VALID_SOURCES}")

    for col in ("tenant_id", "app_id", "provider", "model"):
        df[col] = df[col].astype(str).str.strip()

    # Sanity-check FX consistency (warn only; source data may use another rate)
    expected = df["actual_provider_cost_usd"] * USD_TO_MYR
    drift = (expected - df["actual_provider_cost_myr"]).abs()
    if (drift > 0.01 + 0.02 * expected).any():
        log.warning("Some MYR costs deviate from USD*%.2f by >2%%", USD_TO_MYR)

    return df


def _request_id(row: pd.Series, idx: int) -> str:
    raw = (f"{row.tenant_id}|{row.app_id}|{row.timestamp.isoformat()}|{row.provider}|"
           f"{row.model}|{row.input_tokens}|{row.output_tokens}|{row.source}|{idx}")
    return "csv-" + hashlib.sha1(raw.encode()).hexdigest()[:24]


def ingest_csv(session: Session, path: str | Path, status: str = "success") -> dict:
    """Idempotent: deterministic request_ids make re-ingestion skip existing rows."""
    df = load_and_validate_csv(path)
    df["request_id"] = [_request_id(row, i) for i, (_, row) in enumerate(df.iterrows())]

    existing = set(session.exec(
        select(UsageEvent.request_id).where(UsageEvent.request_id.in_(df["request_id"].tolist()))
    ).all())

    inserted = 0
    for _, r in df.iterrows():
        if r["request_id"] in existing:
            continue
        session.add(UsageEvent(
            request_id=r["request_id"],
            tenant_id=r["tenant_id"],
            app_id=r["app_id"],
            timestamp=r["timestamp"].to_pydatetime(),
            source=r["source"],
            provider=r["provider"],
            model=r["model"],
            status=status,
            cache_type="none",
            input_tokens=int(r["input_tokens"]),
            output_tokens=int(r["output_tokens"]),
            actual_provider_cost_usd=float(r["actual_provider_cost_usd"]),
            actual_provider_cost_myr=float(r["actual_provider_cost_myr"]),
        ))
        inserted += 1
    session.commit()

    summary = {
        "rows_in_csv": len(df),
        "inserted": inserted,
        "skipped_existing": len(df) - inserted,
        "tenants": df["tenant_id"].nunique(),
        "tenant_app_pairs": df[["tenant_id", "app_id"]].drop_duplicates().shape[0],
        "by_source": df["source"].value_counts().to_dict(),
        "total_cost_myr": round(float(df["actual_provider_cost_myr"].sum()), 4),
    }
    log.info("Ingest summary: %s", summary)
    return summary