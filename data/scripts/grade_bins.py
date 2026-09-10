"""The 11-bin grade distribution shared by clean_grades.py,
clean_tableau_data.py, model/history.py, and the API - kept in one place so
column names and display labels never drift out of sync across the pipeline.

Matches what the newer Tableau sources report. PAIR's raw CSVs additionally
break the below-50 bucket down into 0-9, 10-19, ..., 40-49, but their own
"<50" column is already the total of those five (verified against a real
row: CPSC 110 2016W has 0-9..40-49 summing to 239, and <50=239, and
Fail=239 - all three agree), so PAIR's "<50" column is used directly rather
than re-summing the finer columns underneath it.
"""

BIN_COLS = [
    "below_50", "50_54", "55_59", "60_63", "64_67",
    "68_71", "72_75", "76_79", "80_84", "85_89", "90_100",
]

BIN_LABELS = {
    "below_50": "<50", "50_54": "50-54", "55_59": "55-59", "60_63": "60-63",
    "64_67": "64-67", "68_71": "68-71", "72_75": "72-75", "76_79": "76-79",
    "80_84": "80-84", "85_89": "85-89", "90_100": "90-100",
}
