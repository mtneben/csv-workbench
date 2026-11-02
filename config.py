# Libraries pre-imported into the run box at startup.
# alias -> importable module path. A module that is not installed is reported
# in the env panel and skipped; it never stops the app from starting.

PRELOAD = [
    ("pd",       "pandas"),
    ("np",       "numpy"),
    ("gpd",      "geopandas"),
    ("shapely",  "shapely"),
    ("xr",       "xarray"),
    ("rioxarray", "rioxarray"),
    ("duckdb",   "duckdb"),
    ("scipy",    "scipy"),
    ("dd",       "dask.dataframe"),
    ("px",       "plotly.express"),
    ("plt",      "matplotlib.pyplot"),
]

# matplotlib look when a figure is captured into the app.
# "dark_background" matches the app; switch to "default" for white figures.
MPL_STYLE = "dark_background"
