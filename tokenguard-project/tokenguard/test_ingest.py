import pandas as pd

from tokenguard.ingest import load_and_validate_csv


def test_load_and_validate_csv_accepts_forecast_dataset_column_names(tmp_path):
    csv_path = tmp_path / "usage.csv"
    pd.DataFrame([{
        "tenant_id": "tenant-1",
        "app_id": "app-1",
        "provider": "openai",
        "model_used": "gpt-4o",
        "timestamp_utc": "2026-05-01 08:40:00 UTC",
        "input_tokens": 480,
        "output_tokens": 498,
        "actual_provider_cost_usd": 0.00891,
        "actual_provider_cost_myr": 0.039204,
        "source": "simulated",
    }]).to_csv(csv_path, index=False)

    result = load_and_validate_csv(csv_path)

    assert result.loc[0, "timestamp"] == pd.Timestamp("2026-05-01 08:40:00", tz="UTC")
    assert result.loc[0, "model"] == "gpt-4o"
