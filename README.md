# workbench

A local analysis workbench for wide CSV files: drop a file, choose the columns before anything is
loaded, then work in plain pandas with results as cards.

Built for a specific annoyance — 10 GB CSVs where you only want 12 of 100 columns, and the usual
routine is open Jupyter, import everything, list the columns, copy them, `del` the frame, re-import
with `usecols`. This does that in one screen, and keeps the dataframe session that follows.

It is **not** a notebook. There are no cells, no execution order, no hidden kernel state you have to
scroll back through. One text box, Enter to run, results stack newest-first.

## Run it

```bash
python3.12 -m venv ~/venvs/workbench
~/venvs/workbench/bin/pip install --upgrade pip
~/venvs/workbench/bin/pip install pandas pyarrow plotly matplotlib duckdb

cd workbench
~/venvs/workbench/bin/python server.py 8840 127.0.0.1
```

Then open <http://127.0.0.1:8840>. On macOS, `workbench.command` does all of that and opens Safari,
and **File → Add to Dock** turns the page into a Dock app.

Bind `127.0.0.1`, not `0.0.0.0` — it keeps the tool off the office network, and localhost counts as a
secure context, which is what makes the clipboard button work.

`pyarrow` is not optional: parquet export and the fast CSV reader both need it. `plotly` and
`matplotlib` give you charts. Everything in `config.py` beyond those is optional — the `env` panel
reports what is missing rather than failing at startup.

## Using it

- **+ Add file** — paste a full path, or pick from `data/`. The preview reads a 2,000-row sample and
  shows type, null rate, distinct count and the most common value per column, so you can tick what
  you want before anything is loaded.
- **The name field** — the frame's Python name. Pre-filled from the filename, editable, validated,
  and it must be a valid identifier because it appears literally in your expressions.
- **The tree** — every frame, with its source file (or the expression that made it), shape and
  memory. Click a name to insert it. Click a column to insert context-aware text:
  `frame['col']` normally, bare `col` inside a quote, `'col'` after `=`, `(` or `,`, and `'col']`
  after `[`.
- **The run box** — plain pandas. Enter runs, Shift+Enter is a newline, ArrowUp walks your history.
  An assignment creates a frame; a bare expression shows a result.
- **Results** — a card each, newest first, with the expression it ran, its timing, a 100-row grid
  capped at what is shown, click-to-sort, `Save as…` to name a result without re-running it, and
  CSV / parquet export.
- **Charts** — `px.scatter(...)` renders a plotly figure; `df.plot(...)` or `plt.*` renders
  matplotlib. Both become cards.

## Files

```
server.py           one file, stdlib http.server + pandas. All the endpoints.
config.py           the preload list and the matplotlib style. Edit this.
static/             app.html/css/js — no build step, no framework
data/               staged CSVs (git-ignored; gen_data.py regenerates samples)
sessions/           saved sessions, autosave.json
exports/            written exports
workbench.command   macOS launcher
gen_icon.py         draws the icon; SVG is the source of truth
```

The server is the whole backend. There is exactly **one execution path**: `/api/run` evaluates the
text from the run box. Nothing else in the app executes code, and no UI control owns any logic you
cannot see.

## Sessions

`autosave.json` is written a second after every change, so reopening the app resumes the last
session: frames return as **not loaded** placeholders with their source and last-known shape, and
the transcript returns as `restored — not run` cards. Nothing is read from disk until you click a
frame, because re-reading a 10 GB CSV on launch would be the worst possible behaviour.

File-backed frames remember their `usecols`. Derived frames remember their right-hand side, not the
whole statement — which is why a frame you renamed still restores under the new name.

## Known limits

- The workspace belongs to the **server process**, not the browser tab. Two tabs share it, and so
  would anyone else who can reach the port.
- A page reload keeps frames; killing the process ends the session (the autosave restores it).
- A `while True` in the run box holds the GIL and wedges the app. So would a segfault inside PROJ or
  GDAL. Nothing in-process can rescue that; run it under a supervisor if it matters.
- Only the first 100 rows of a result are sent to the browser. Sorting sorts those rows and says so.
- Never run on macOS as of writing — only Linux.

MIT licensed.
