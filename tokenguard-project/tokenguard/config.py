import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tokenguard.db")

USD_TO_MYR = 4.40

MIN_HISTORY_DAYS = 7
TRAIN_FRACTION = 0.8
RIDGE_ALPHA = 1.0
ROLLING_WINDOW = 7

VALID_SOURCES = {"real", "simulated"}
