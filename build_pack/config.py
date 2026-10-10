import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tokenguard.db")

# Explicit, recorded FX rate (USD -> MYR)
USD_TO_MYR = 4.40

# Forecasting settings
MIN_HISTORY_DAYS = 7        # fewer than this -> SHORT_HISTORY fallback
TRAIN_FRACTION = 0.8        # oldest 80% train, newest 20% holdout (chronological)
RIDGE_ALPHA = 1.0
ROLLING_WINDOW = 7

VALID_SOURCES = {"real", "simulated"}