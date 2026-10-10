"""
Usage:
  python -m tokenguard.run_forecast daily_usage.csv --budget 500
Ingests the CSV, creates default PolicySettings if missing, runs forecasts, prints a report.
"""
import argparse
import json
from dataclasses import asdict

from sqlmodel import Session, select

from .db import engine, init_db
from .forecast import run_all_forecasts
from .ingest import ingest_csv
from .models import PolicySettings, UsageEvent


def print_forecast_report(d):
    """Display a forecast in a readable format."""

    def money(value):
        return f"RM {float(value):,.2f}"

    print("\n" + "=" * 58)
    print(f"  AI COST FORECAST: {d['app_id']}")
    print("=" * 58)
    print(f"  Tenant              : {d['tenant_id']}")
    print(f"  Forecast date       : {d['as_of']}")
    print(f"  Forecast method     : {d['method']}")

    print("\n  SPENDING SUMMARY")
    print(f"  Spent so far        : {money(d['actual_mtd_myr'])}")
    print(f"  Estimated tomorrow : {money(d['next_day_cost_myr'])}")
    print(f"  Estimated month-end: {money(d['predicted_month_end_myr'])}")

    actual_pct = float(d.get("actual_budget_pct", 0)) * 100
    predicted_pct = float(d.get("predicted_budget_pct", 0)) * 100

    print("\n  BUDGET MONITORING")
    print(f"  Budget used so far  : {actual_pct:.1f}%")
    print(f"  Forecast budget use : {predicted_pct:.1f}%")

    if predicted_pct >= 100:
        print("  Status              : OVER BUDGET RISK")
    else:
        print("  Status              : Within budget")

    print("\n  FORECAST ACCURACY")
    for label, key in [
        ("Baseline MAE", "baseline_mae_myr"),
        ("Ridge model MAE", "ridge_mae_myr"),
    ]:
        if d.get(key) is not None:
            print(f"  {label:<21}: {money(d[key])}")

    print(f"  Training samples    : {d.get('n_train', 'N/A')}")
    print(f"  Test samples        : {d.get('n_holdout', 'N/A')}")

    if d.get("fallback_reason"):
        print(f"  Model note          : {d['fallback_reason']}")

    if d.get("n_train") is not None and d["n_train"] < 30:
        print("  Warning             : Limited training data;")
        print("                          forecast accuracy may be unreliable.")

    print("=" * 58)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--budget", type=float, default=500.0, help="Default monthly budget (MYR)")
    args = ap.parse_args()

    init_db()
    with Session(engine) as session:
        print("Ingest:", json.dumps(ingest_csv(session, args.csv_path), indent=2, default=str))

        # Ensure a PolicySettings row for every tenant/app
        pairs = session.exec(select(UsageEvent.tenant_id, UsageEvent.app_id).distinct()).all()
        for tenant_id, app_id in pairs:
            exists = session.exec(select(PolicySettings).where(
                PolicySettings.tenant_id == tenant_id, PolicySettings.app_id == app_id)).first()
            if not exists:
                session.add(PolicySettings(tenant_id=tenant_id, app_id=app_id,
                                           monthly_budget_myr=args.budget))
        session.commit()

        for r in run_all_forecasts(session):
            d = asdict(r)
            d["as_of"] = str(d["as_of"])
            print_forecast_report(d)

if __name__ == "__main__":
    main()