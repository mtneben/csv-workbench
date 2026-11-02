# workbench — user manual

A local workbench for wide CSV files. Pick your columns before anything is loaded, then work in
plain pandas with results as cards.

Everything runs on your own machine. Nothing is uploaded, nothing phones home, and the only network
traffic is your browser talking to `127.0.0.1`.

---

## 1. The problem it solves

A 10 GB CSV with 100 columns. You need 12 of them. The usual routine:

```python
df = pd.read_csv("huge.csv")     # 4 minutes, 12 GB of RAM
list(df.columns)                 # scroll, squint
# copy twelve names by hand into an editor
del df                           # 4 more minutes of nothing
df = pd.read_csv("huge.csv", usecols=[...])   # do it again
```

Two full parses and a manual copying exercise, before you have asked a single question of the data.

workbench does that step in one screen: it reads the header and 2,000 sample rows in milliseconds,
shows you every column with its type, null rate, distinct count and most common value, and lets you
tick what you actually want. Only the ticked columns are read.

The second thing it solves is the ritual around it — activating a venv, remembering which folder
has the venv with scipy in it, launching a notebook, importing, forgetting which variable held what.
workbench is one window that is already open, and the dataframes are listed down the left side with
their source, shape and memory.

What it deliberately is **not**: a notebook. There are no cells, no execution order, no hidden
kernel state to scroll back through, and no outputs stored anywhere. One text box, Enter to run,
results stack newest-first.

---

## 2. Install (macOS)

```bash
# 1. a venv with the libraries
python3.12 -m venv ~/venvs/workbench
~/venvs/workbench/bin/pip install --upgrade pip
~/venvs/workbench/bin/pip install pandas pyarrow plotly matplotlib duckdb

# 2. run it
cd ~/tools/workbench
~/venvs/workbench/bin/python server.py 8840 127.0.0.1

# 3. open http://127.0.0.1:8840
```

`pyarrow` is required — parquet export and the fast CSV reader both depend on it. `plotly` and
`matplotlib` give you charts. Everything else is optional.

Bind `127.0.0.1`, never `0.0.0.0`. It keeps the tool off the office network, and `localhost` counts
as a secure context, which is what makes the copy button work.

**Launcher.** `workbench.command` does all of the above and opens Safari. Double-click it in
Finder; if macOS refuses the first time, right-click → Open. It assumes
`~/venvs/workbench/bin/python`; override with `WORKBENCH_PYTHON=/path/to/python`.

**As a Dock app.** With the page open in Safari: **File → Add to Dock**. Own icon, no address bar,
⌘-tab. No signing, no bundle.

**At login.** System Settings → General → Login Items → add `workbench.command`.

---

## 3. The interface

```
┌──────────────────────────────────────────────────────────────────────┐
│ workbench        [theme] [env]        [open] [save] [notebook] [new] [+ Add file] │
├───────────────┬──────────────────────────────────────────────────────┤
│ WORKSPACE     │  ╷                                                    │
│  orders       │  │  cards: one per result, newest first               │
│  products     │  ╵                                                    │
│  basket       │                                                      │
│               ├──────────────────────────────────────────────────────┤
│               │ ›  type an expression here — Enter to run             │
└───────────────┴──────────────────────────────────────────────────────┘
```

### The tree (left)

One row per dataframe: name, where it came from, shape and memory.

```
orders
orders.csv
40,000 × 100 · 16.9 MB
```

The middle line is the **origin**: the source filename if the frame came from a file, or the
expression that produced it if it came from a query. Click it to read the full expression.

- **Click a frame name** — insert it into the run box.
- **Click the `›` caret** — expand to see every column with its type. A column whose name is followed
  by `INDEX` is the dataframe's index, and clicking it inserts `frame.index`.
- **Click a column** — insert into the run box, context-aware (see §4).
- **`×` on the row** — delete that frame from memory.

### The run box (bottom)

Plain pandas. `Enter` runs, `Shift+Enter` is a newline, `↑` walks back through what you have run.
The status line under it is the only chrome.

### Result cards (centre)

Each run makes a card: the expression it ran, how long it took, the shape, and the first 100 rows.
Buttons on each card:

| | |
|---|---|
| `↩` | put the expression back in the run box |
| `⤢` | make the table 68 vh instead of 250 px |
| `Copy` | copy the expression text |
| `CSV` / `PARQUET` | download the result |
| `×` | remove the card from view (the frame survives) |
| header | click a column header to sort the rows **shown**, again to reverse |

Charts and matplotlib figures are cards too, with `PNG` in place of the export pair.

---

## 4. Inserting column names

Clicking a column puts the right text in the right place for where your cursor already is:

| you have typed | clicking `orders → product_id` inserts |
|---|---|
| `orders.merge(products, on='` | `product_id'` |
| `orders.sort_values(by=` | `'product_id'` |
| `orders[` | `'product_id']` |
| `orders.groupby(` | `'product_id'` |
| anything else, or an empty box | `orders['product_id']` |

If you have already typed the closing quote it will not double it. This is the shortcut that makes
the tool faster than a notebook: you never type a column name from memory.

---

## 5. Running queries

Everything is ordinary pandas — the same lines you would paste into a notebook unchanged.

```python
# a bare expression shows its result in a card
orders['net_amount_gbp'].sum().round(2)

# an assignment creates a frame, which appears in the tree
basket = orders[orders.quantity > 3]

# and the card shows what it made, so you are not left looking at nothing
spend = orders.groupby('channel')['net_amount_gbp'].agg(['sum', 'mean', 'count'])
```

The rule is simple: **if the statement assigns, it makes a frame; otherwise it shows a result.** A
frame can be renamed only by assigning a new name; the old one stays.

### Joining

```python
enriched = orders.merge(products, on='product_id', how='left')
```

Both sides keep their columns; duplicates get `_x` / `_y` suffixes, as pandas always does. If you get
a `KeyError` on the join key, one of the two frames does not have that column — expand both in the
tree and check.

### Pivoting

```python
by_region = orders.pivot_table(
    index='region', columns='channel', values='net_amount_gbp',
    aggfunc='sum', fill_value=0)
```

The pivot key becomes the index. workbench shows it as a real column in the card and marks it
`INDEX` in the tree, so the labels never vanish.

### Filtering and grouping

```python
worst = (orders[orders.order_status == 'refunded']
         .groupby(['region', 'channel'])['net_amount_gbp']
         .agg(['sum', 'count'])
         .sort_values('sum', ascending=False)
         .head(10))
```

Long chains like that are fine. The tree shows the first 300 characters and the rest is one click
away.

---

## 6. Charts

Both libraries work, with no import needed — they are preloaded.

**plotly** — interactive, and the right default:

```python
px.scatter(orders.sample(5000), x='weight_kg', y='net_amount_gbp',
           color='channel', opacity=0.55)

px.histogram(orders, x='net_amount_gbp', nbins=60, color='channel')

px.box(orders, x='channel', y='net_amount_gbp')
```

**matplotlib** — for code you already have, or figures you want to export:

```python
orders['net_amount_gbp'].plot.hist(bins=60)

orders.boxplot(column='net_amount_gbp', by='channel')

plt.plot([1, 4, 9, 16], marker='o'); plt.title('sanity check')
```

Every figure open at the end of a run is captured, saved at 150 dpi and closed, so one expression
can produce several. **`MPL_STYLE` in `config.py`** controls the look: `dark_background` matches the
app, `default` gives you the white figures you would see in a notebook.

Charts are not stored in sessions — the card keeps the code, so re-run it to see the picture again.

---

## 7. Naming a result without re-running it

If a bare expression produced something you want to keep:

```python
orders.pivot_table(index='region', columns='channel', values='net_amount_gbp', aggfunc='sum')
```

…click **Save as…** on the card, type a name, Enter. It binds the result that is *already in memory*
— no second query. The server holds the last five results for exactly this, so if you have run more
than five things since, the card will tell you it is no longer held.

You can also click the card's expression to edit it in place, add `basket = ` at the front, and press
Enter — which does re-run, and is the right move when the query is cheap.

---

## 8. Exporting

`CSV` or `PARQUET` on any result card.

Which one wins depends on size, and the buttons order themselves accordingly:

| rows | CSV | parquet |
|---|---|---|
| 12 | **8 KB** | 61 KB |
| 40,000 | 4.1 MB | ~1.2 MB |

Parquet has a fixed footer and schema overhead, so below a few thousand rows it is *larger* than
plain text. Above that it is roughly a quarter of the size and keeps its types. The tool picks the
sensible default and the tooltip tells you why.

---

## 9. Sessions

The app always starts empty. Everything you do is autosaved a second after it happens, and that
autosave appears at the top of the **open** list as **last session (auto)**.

- **new** — clear everything and start a fresh analysis. Two clicks, because it throws away the
  workspace. It also deletes the autosave, so the cleared state is not offered back.
- **open** — a list of sessions with their frame and cell counts and timestamps.
- **save** — write a named session next to the autosave.

Opening a session **does not read any data**. Frames come back as *not loaded* placeholders with
their source file and last-known shape; click one to load it, or load them in order. Derived frames
rebuild by re-running their expression, so their inputs have to be loaded first — if they are not,
you get `NameError: name 'orders' is not defined — load its inputs first`, and the frame stays
pending rather than half-existing.

If a data file has moved, that one frame reports `missing — orders.csv` and everything else opens
normally.

Sessions live in `sessions/` as versioned JSON: a manifest of frames (path, `usecols`, producing
expression) plus the transcript. They contain no data and no results.

---

## 10. Keyboard and view

| | |
|---|---|
| `Enter` | run |
| `Shift+Enter` | newline in the run box |
| `↑` / `↓` | previous / next expression (caret must be on the first line) |
| `⌘B` | collapse or expand the left pane |
| drag the thin bar between panes | resize it (180–620 px) |
| double-click that bar | collapse / expand |
| `Esc` | close the current panel or cancel an import |

The **theme** dropdown has six: Daylight, Fog, Steel, Charcoal, Slate, Navy. It is remembered per
browser, so switching to a light theme before showing someone your screen is one click.

The **env** button lists every library preloaded into the run box, with versions, and says plainly
which ones are missing.

---

## 11. Configuration

`config.py` is the only file you need to touch:

```python
PRELOAD = [
    ("pd",  "pandas"),
    ("np",  "numpy"),
    ("px",  "plotly.express"),
    ("plt", "matplotlib.pyplot"),
    ("gpd", "geopandas"),
    ...
]

MPL_STYLE = "dark_background"   # or "default"
```

Anything listed is imported at startup and available without an `import`. Anything not installed is
reported in the `env` panel and skipped — it never stops the app from starting. Restart the server
after editing.

---

## 12. Knowing what you can use

`env` lists the preloaded libraries. Anything else you can import yourself, and because the
namespace now persists between runs, the import sticks:

```python
import re
# later runs:
re.findall(r'S\d+', orders.postcode_district.iloc[0])
```

Any name you bind that is a dataframe or a series shows up in the tree automatically — including
intermediate results you did not plan to keep.

---

## 13. Limits worth knowing

- **The workspace belongs to the server process, not the browser tab.** Two tabs share it, and so
  would anyone who can reach the port. Bind `127.0.0.1`.
- **A page reload keeps your frames** (they are re-fetched from the server). Killing the process ends
  the session; the autosave brings it back on the next launch via **open → last session**.
- **Only the first 100 rows of a result reach the browser.** Sorting sorts those rows, and the card
  says `sorted the rows shown only`. To sort the data, sort in pandas.
- **`while True` in the run box will wedge the app.** So would a segfault inside PROJ or GDAL —
  everything runs in one process, and nothing in-process can rescue that. Run it under a supervisor
  if that matters.
- **Results are not stored.** A session remembers code and file locations, never outputs, because
  they would be stale the moment the data changed.
- **No join or pivot builder.** Deliberate. A GUI over pandas covers a tenth of pandas and then you
  have two mental models; the run box covers all of it and the same lines paste into a notebook.

---

## 14. Troubleshooting

**`Address already in use`** — something is on port 8840. Either it is workbench already
(`open http://127.0.0.1:8840`), or pick another port:
`~/venvs/workbench/bin/python server.py 8841 127.0.0.1`.

**`ModuleNotFoundError`** — the venv is missing a library, or the launcher is pointing at a different
interpreter. Check with `~/venvs/workbench/bin/pip list`.

**The copy button does nothing** — you are not on `localhost`. The clipboard API needs a secure
context, which `127.0.0.1` is and a LAN IP is not. The app falls back to selecting the text for you
and says so.

**`.command` will not open** — macOS quarantined it after download:
`xattr -dr com.apple.quarantine ~/tools/workbench`.

**A frame says `missing — orders.csv`** — the file moved or was renamed. Import it again under the
same name and the session picks up where it left off.

**Charts do not appear** — `plotly` or `matplotlib` is not installed in that venv. Check `env`.
