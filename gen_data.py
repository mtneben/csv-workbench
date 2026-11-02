"""Generate the small synthetic CSVs the prototype runs against."""
import numpy as np, pandas as pd, os, time

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

# ---------- cell_register: the thing you join to ----------
NCELL = 2000
cell_ids = rng.choice(np.arange(4_000_000, 5_000_000), NCELL, replace=False)
cells = pd.DataFrame({
    "cell_id":        cell_ids,
    "site_id":        [f"UK{40000 + i // 3}" for i in range(NCELL)],
    "sector":         np.tile([1, 2, 3], NCELL // 3 + 1)[:NCELL],
    "azimuth_deg":    np.tile([0.0, 120.0, 240.0], NCELL // 3 + 1)[:NCELL],
    "antenna_height_m": np.round(rng.normal(20, 5, NCELL), 1),
    "clutter_class":  rng.choice(["Urban", "Suburban", "Rural"], NCELL, p=[.55, .3, .15]),
    "band":           rng.choice(["L08", "L21", "n78"], NCELL, p=[.3, .45, .25]),
})
cells.to_csv(os.path.join(OUT, "cell_register.csv"), index=False)
print("cell_register.csv", len(cells), "rows")

# ---------- drive_test: the wide one ----------
N = 40_000
pick = rng.integers(0, NCELL, N)
bands = ["L08", "L21", "n78"]
d = {
    "timestamp": pd.date_range("2026-10-29 08:00:00", periods=N, freq="s").astype(str),
    "sample_id": np.arange(4_812_001, 4_812_001 + N),
    "cell_id": cell_ids[pick],
    "pci": rng.integers(0, 504, N),
    "band": rng.choice(bands, N, p=[.3, .45, .25]),
    "rat": rng.choice(["LTE", "NR"], N, p=[.7, .3]),
    "rsrp_dbm": np.round(rng.normal(-95, 12, N), 1),
    "rsrq_db": np.round(rng.normal(-11, 3, N), 1),
    "sinr_db": np.round(rng.normal(9, 6, N), 1),
    "dl_thr_kbps": np.round(rng.lognormal(10.2, 0.6, N), 0),
    "ul_thr_kbps": np.round(rng.lognormal(8.9, 0.6, N), 0),
    "ta": rng.integers(0, 40, N),
    "cqi": rng.integers(1, 16, N),
    "mcs_dl": rng.integers(0, 28, N),
    "bler_pct": np.round(rng.gamma(1.2, 1.4, N), 2),
    "lat": np.round(53.53 + rng.normal(0, .05, N), 5),
    "lon": np.round(-1.47 + rng.normal(0, .06, N), 5),
    "easting": rng.integers(430_000, 440_000, N),
    "northing": rng.integers(400_000, 410_000, N),
    "speed_kmh": np.round(np.abs(rng.normal(30, 22, N)), 1),
    "district": rng.choice(["Barnsley", "Doncaster", "Rotherham", "Sheffield", "Wakefield"], N),
    "postcode_district": rng.choice(["S70", "S71", "DN1", "S60", "WF1"], N),
    "ue_model": rng.choice(["SM-S911B", "SM-G991B", "iPhone15,2", "Pixel8"], N),
    "notes": ["" for _ in range(N)],
}
# pad out to 100 columns the way a real MRDB export pads out
fillers = {}
for i in range(100 - len(d)):
    kind = i % 3
    name = (f"nb{i//3+1}_rsrp" if kind == 0 else
            f"meas_{i:03d}" if kind == 1 else f"cat_{i:03d}")
    if kind == 0:
        col = np.round(rng.normal(-105, 15, N), 1)
        col[rng.random(N) < .35] = np.nan
    elif kind == 1:
        col = np.round(rng.normal(50, 15, N), 3)
    else:
        col = rng.choice(["north", "south", "east", "west"], N)
    fillers[name] = col
d.update(fillers)

drive = pd.DataFrame(d)
drive.to_csv(os.path.join(OUT, "drive_test.csv"), index=False)
print("drive_test.csv", len(drive), "x", drive.shape[1])

# ---------- cell_register_daily: a small unrelated one ----------
mrd = pd.DataFrame({
    "date": np.tile(pd.date_range("2026-10-01", periods=30, freq="D").astype(str), 20),
    "cell_id": rng.choice(cell_ids, 600),
    "dl_traffic_gb": np.round(rng.lognormal(1.5, .8, 600), 2),
    "ul_traffic_gb": np.round(rng.lognormal(0.6, .8, 600), 2),
    "active_users": rng.integers(1, 400, 600),
})
mrd.to_csv(os.path.join(OUT, "mrdb_daily.csv"), index=False)
print("mrdb_daily.csv", len(mrd), "x", mrd.shape[1])

for f in sorted(os.listdir(OUT)):
    print(" ", f, f"{os.path.getsize(os.path.join(OUT, f))/1e6:.1f} MB")
