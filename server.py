"""Throwaway prototype: pandas workbench. Pure stdlib server + pandas.

One execution path: /api/run evals/execs the text from the run box.
"""
import ast, base64, collections, importlib, io, itertools, json, mimetypes, os, re, socketserver
import threading, time
import http.server
import urllib.parse

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
STATIC = os.path.join(ROOT, "static")
EXPORT_DIR = os.path.join(ROOT, "exports")

# before anything imports matplotlib: figures must render headless
os.environ.setdefault("MPLBACKEND", "Agg")
MAX_FIGURES = 6
MAX_IMAGE_BYTES = 6_000_000
ORIGIN_PREVIEW = 300      # what rides in the frames payload
SESSIONS = os.path.join(ROOT, "sessions")
PENDING = {}              # frames named by a session file but not yet read into memory
CURRENT = {"transcript": [], "history": [], "file": None}

# WORKSPACE is the live python namespace: frames, imported modules, any variable
# the user binds. Anything in it that is a DataFrame appears in the tree.
WORKSPACE = {}
META = {}               # name -> {"path": str} for frames that came from a file
ENV = []                # what the preload list resolved to, for the env panel
RESULTS = collections.OrderedDict()   # rid -> DataFrame shown in a card, newest last
MAX_RESULTS = 5
RID = itertools.count(1)
LOCK = threading.RLock()
os.makedirs(DATA, exist_ok=True)          # a fresh clone has no data folder
os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(SESSIONS, exist_ok=True)


def df_memory(df):
    return int(df.memory_usage(deep=True).sum())


def frame_info(name, df):
    cols = []
    if index_means_something(df):
        cols.append({"name": str(df.index.name or "index"),
                     "dtype": str(df.index.dtype), "index": True})
    cols += [{"name": str(c), "dtype": str(df[c].dtype), "index": False} for c in df.columns]
    meta = META.get(name, {})
    path = meta.get("path", "")
    code = meta.get("code", "")
    # the newest truth wins: a frame reassigned by an expression is now that expression
    origin = code or (os.path.basename(path) if path else "")
    return {"name": name, "rows": int(len(df)), "cols": int(df.shape[1]),
            "bytes": df_memory(df), "path": path,
            "source": os.path.basename(path) if path else "",
            "origin": origin[:ORIGIN_PREVIEW],
            "origin_len": len(origin), "loaded": True,
            "columns": cols}


def as_frame(v):
    """DataFrame, or a Series seen as a one-column frame. None otherwise."""
    if isinstance(v, pd.DataFrame):
        return v
    if isinstance(v, pd.Series):
        return v.to_frame()
    return None


def frames_payload():
    # snapshot: exec mutates WORKSPACE, and iterating a live dict raises
    out = []
    for n, v in list(WORKSPACE.items()):
        f = as_frame(v)
        if f is not None:
            out.append(frame_info(n, f))
    return out


def manifest():
    """Everything needed to rebuild this workspace: where each frame came from."""
    out = []
    for n, v in list(WORKSPACE.items()):
        f = as_frame(v)
        if f is None:
            continue
        m = META.get(n, {})
        out.append({"name": n, "path": m.get("path", ""), "usecols": m.get("usecols"),
                    "code": m.get("code", ""), "rows": int(len(f)), "cols": int(f.shape[1]),
                    "bytes": df_memory(f)})
    for n, m in PENDING.items():
        if n not in WORKSPACE:
            out.append(m)
    return out


def session_payload():
    """Loaded frames plus the ones the session knows about but has not read yet."""
    frames = frames_payload()
    loaded = {f["name"] for f in frames}
    for n, m in PENDING.items():
        if n in loaded:
            continue
        path = m.get("path", "")
        code = m.get("code", "")
        origin = code or (os.path.basename(path) if path else "")
        frames.append({"name": n, "rows": m.get("rows", 0), "cols": m.get("cols", 0),
                       "bytes": m.get("bytes", 0), "path": path,
                       "source": os.path.basename(path) if path else "",
                       "origin": origin[:ORIGIN_PREVIEW], "origin_len": len(origin),
                       "columns": [], "loaded": False})
    return frames


def dedupe(lines):
    """Consecutive identical entries are never meaningful in a transcript."""
    out = []
    for x in lines or []:
        if not out or out[-1] != x:
            out.append(x)
    return out


def write_session(filename, transcript=None, history=None):
    data = {"version": 1, "saved": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "frames": manifest(),
            "transcript": dedupe(transcript if transcript is not None else CURRENT["transcript"]),
            "history": dedupe(history if history is not None else CURRENT["history"])}
    path = os.path.join(SESSIONS, filename)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    os.replace(tmp, path)          # atomic: a crash mid-write must not eat the session
    return path


def apply_session(data, filename):
    """Load the manifest into PENDING. Nothing is read from disk here."""
    with LOCK:
        for n in [n for n, v in list(WORKSPACE.items()) if as_frame(v) is not None]:
            WORKSPACE.pop(n, None)
        for n in list(META):
            META.pop(n, None)
        PENDING.clear()
        for entry in data.get("frames", []):
            name = entry.get("name")
            if not name:
                continue
            PENDING[name] = {k: entry.get(k) for k in
                             ("name", "path", "usecols", "code", "rows", "cols", "bytes")}
        CURRENT["transcript"] = dedupe(data.get("transcript", []) or [])
        CURRENT["history"] = dedupe(data.get("history", []) or [])
        CURRENT["file"] = filename
    return {"frames": session_payload(), "transcript": CURRENT["transcript"],
            "history": CURRENT["history"], "file": filename}


def load_pending(name):
    """Actually bring one session frame into memory: read the file, or re-run its expression."""
    with LOCK:
        m = PENDING.get(name)
    if not m:
        return {"error": f"{name} is already loaded"}
    t0 = time.perf_counter()
    if m.get("path"):
        if not os.path.isfile(m["path"]):
            return {"error": f"missing file — {os.path.basename(m['path'])}"}
        try:
            df = pd.read_csv(m["path"], usecols=m.get("usecols") or None, low_memory=False)
        except Exception as e:
            return {"error": f"could not read {os.path.basename(m['path'])}: {e}"}
        with LOCK:
            WORKSPACE[name] = df
            META[name] = {"path": m["path"], "usecols": m.get("usecols")}
            PENDING.pop(name, None)
        return {"name": name, "elapsed": round(time.perf_counter() - t0, 2)}
    if m.get("code"):
        try:
            exec(f"{name} = {m['code']}", WORKSPACE)     # noqa: S102 - the session is the user's own code
        except Exception as e:
            return {"error": f"{type(e).__name__}: {e} — load its inputs first"}
        f = as_frame(WORKSPACE.get(name))
        if f is None:
            return {"error": f"{name} did not produce a dataframe"}
        with LOCK:
            META[name] = {"path": "", "code": m["code"]}
            PENDING.pop(name, None)
        return {"name": name, "elapsed": round(time.perf_counter() - t0, 2)}
    return {"error": f"{name} has no source to load from"}


def load_preload():
    ENV.clear()
    try:
        import config
    except Exception as e:
        ENV.append({"alias": "config", "module": "config.py", "version": None,
                    "error": f"{type(e).__name__}: {e}"})
        return
    for alias, module in getattr(config, "PRELOAD", []):
        try:
            mod = importlib.import_module(module)
            WORKSPACE[alias] = mod
            if module == "matplotlib.pyplot":
                try:
                    import matplotlib
                    matplotlib.style.use(getattr(config, "MPL_STYLE", "dark_background"))
                except Exception:
                    pass
            ENV.append({"alias": alias, "module": module,
                        "version": str(getattr(mod, "__version__", "")) or "?"})
        except Exception as e:
            ENV.append({"alias": alias, "module": module, "version": None,
                        "error": f"{type(e).__name__}: {e}"})


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else f
    if isinstance(v, (pd.Timestamp,)):
        return str(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def index_means_something(df):
    """A named index is a key (groupby, pivot). An unnamed integer index is just
    row position left over from a filter — showing it as a column is noise."""
    idx = df.index
    if idx.name is not None:
        return True
    return not pd.api.types.is_integer_dtype(idx)


def grid_payload(df, limit=100):
    # a groupby/pivot keeps its key in the index — show it as a column, or the
    # reader sees numbers with no idea which district they belong to
    indexed = index_means_something(df)
    if indexed:
        df = df.reset_index()
    # pivot_table gives ("net_amount_gbp", "web") columns; drop the level that never varies
    if isinstance(df.columns, pd.MultiIndex):
        first = {c[0] for c in df.columns}
        if len(first) == 1:
            df.columns = [c[-1] for c in df.columns]
        else:
            df.columns = ["_".join(str(p) for p in c if str(p)) for c in df.columns]
    head = df.head(limit)
    rows = [[clean(v) for v in row] for row in head.astype(object).values.tolist()]
    return {"columns": [str(c) for c in head.columns], "rows": rows,
            "shown": len(rows), "total": int(len(df)), "indexed": indexed}


def capture_figures():
    """Save and close every open matplotlib figure. Returns base64 PNGs."""
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return []
    out, total = [], 0
    for num in list(plt.get_fignums()):
        try:
            fig = plt.figure(num)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                        facecolor=fig.get_facecolor())
            png = buf.getvalue()
            plt.close(fig)
            if total + len(png) > MAX_IMAGE_BYTES or len(out) >= MAX_FIGURES:
                continue
            total += len(png)
            out.append({"b64": base64.b64encode(png).decode(), "bytes": len(png)})
        except Exception:
            try:
                plt.close(num)
            except Exception:
                pass
    return out


def is_plotly_fig(obj):
    mod = type(obj).__module__ or ""
    return mod.startswith("plotly") and hasattr(obj, "to_json")


def plotly_payload(fig):
    try:
        spec = json.loads(fig.to_json())
    except Exception as e:
        return {"error": f"could not serialise the figure: {e}"}
    traces = spec.get("data") or []
    # plotly 7 encodes coordinates as base64 binary ("bdata"), so count on the
    # figure object, not on the serialised JSON
    points = 0
    for tr in getattr(fig, "data", []):
        # x and y are both present on a scatter and both the same length: take the
        # longest, do not add them up, or every scatter reads double
        longest = 0
        for k in ("x", "y", "z", "values", "labels"):
            v = getattr(tr, k, None)
            if v is None:
                continue
            try:
                longest = max(longest, len(v))
            except TypeError:
                pass
        points += longest
    return {"spec": spec, "traces": len(traces), "points": points}


def estimate_rows(path):
    size = os.path.getsize(path)
    probe = pd.read_csv(path, nrows=300)
    try:
        sample = len(probe.to_csv(index=False))
    except Exception:
        return None
    if not sample:
        return None
    return int(size * 300 / sample)


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "wb/0.1"

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args), flush=True)

    # ---------- helpers ----------
    def _send(self, code, body, ctype="application/json", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, default=str).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        return json.loads(self.rfile.read(n).decode())

    # ---------- routes ----------
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        p = u.path
        if p == "/":
            p = "/index.html"
        if p.startswith("/api/export"):
            q = urllib.parse.parse_qs(u.query)
            name = (q.get("name") or [""])[0]
            fmt = (q.get("fmt") or ["parquet"])[0].lower()
            with LOCK:
                df = as_frame(WORKSPACE.get(name))
            if df is None:
                return self._send(404, {"error": "no such frame"})
            if fmt == "csv":
                return self._send(200, df.to_csv(index=False).encode(), "text/csv",
                                  {"Content-Disposition": f'attachment; filename="{name}.csv"'})
            try:
                buf = io.BytesIO()
                df.to_parquet(buf, index=False)
            except Exception as e:
                return self._send(400, {"error": f"parquet failed ({e}) — try CSV"}, "application/json")
            return self._send(200, buf.getvalue(), "application/octet-stream",
                              {"Content-Disposition": f'attachment; filename="{name}.parquet"'})
        if p == "/plotly.min.js":
            try:
                import plotly
                js = os.path.join(os.path.dirname(plotly.__file__),
                                  "package_data", "plotly.min.js")
                with open(js, "rb") as fh:
                    return self._send(200, fh.read(), "application/javascript")
            except Exception as e:
                return self._send(404, f"no plotly: {e}", "text/plain")
        fname = p.lstrip("/")
        path = os.path.join(STATIC, fname)
        if not os.path.isfile(path):
            return self._send(404, "not found", "text/plain")
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as fh:
            self._send(200, fh.read(), ctype)

    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        try:
            payload = self._json_body()
        except Exception as e:
            return self._send(400, {"error": f"bad json: {e}"})

        if p == "/api/files":
            out = []
            if not os.path.isdir(DATA):
                return self._send(200, {"files": []})
            for f in sorted(os.listdir(DATA)):
                fp = os.path.join(DATA, f)
                if os.path.isfile(fp) and f.lower().endswith((".csv", ".parquet", ".tsv")):
                    out.append({"name": f, "path": fp,
                                "bytes": os.path.getsize(fp)})
            return self._send(200, {"files": out})

        if p == "/api/notebook":
            return self._send(200, build_notebook(payload.get("cells") or []))

        if p == "/api/session/state":
            with LOCK:
                return self._send(200, {"frames": session_payload(),
                                        "transcript": CURRENT["transcript"],
                                        "history": CURRENT["history"],
                                        "file": CURRENT["file"]})

        if p == "/api/session/save":
            transcript = payload.get("transcript") or []
            history = payload.get("history") or []
            label = re.sub(r"[^A-Za-z0-9_-]+", "_", (payload.get("label") or "session"))[:40]
            with LOCK:
                CURRENT["transcript"] = dedupe(transcript)
                CURRENT["history"] = dedupe(history)
                if payload.get("auto"):
                    name = "autosave.json"
                else:
                    name = time.strftime("%Y-%m-%d_%H%M") + f"_{label}.json"
                path = write_session(name, transcript, history)
                CURRENT["file"] = name
            return self._send(200, {"file": name, "bytes": os.path.getsize(path)})

        if p == "/api/session/list":
            out = []
            for f in sorted(os.listdir(SESSIONS), reverse=True):
                if not f.endswith(".json") or f.startswith("_"):
                    continue
                try:
                    with open(os.path.join(SESSIONS, f), encoding="utf-8") as fh:
                        d = json.load(fh)
                except Exception:
                    continue
                names = [x.get("name") for x in (d.get("frames") or [])][:6]
                out.append({"file": f, "saved": d.get("saved", ""),
                            "auto": f == "autosave.json",
                            "frames": len(d.get("frames") or []),
                            "cells": len(d.get("transcript") or []), "names": names})
            out.sort(key=lambda r: (not r["auto"], r["file"]), reverse=False)
            return self._send(200, {"sessions": out})

        if p == "/api/session/open":
            f = os.path.basename(payload.get("file") or "")
            path = os.path.join(SESSIONS, f)
            if not f or not os.path.isfile(path):
                return self._send(400, {"error": "no such session"})
            try:
                with open(path, encoding="utf-8") as fh:
                    data = json.load(fh)
            except Exception as e:
                return self._send(400, {"error": f"unreadable session: {e}"})
            return self._send(200, apply_session(data, f))

        if p == "/api/load":
            r = load_pending(payload.get("name", ""))
            if "error" in r:
                return self._send(200, dict(r, frames=session_payload()))
            return self._send(200, dict(r, frames=session_payload()))

        if p == "/api/origin":
            name = payload.get("name", "")
            with LOCK:
                m = dict(META.get(name) or {})
            return self._send(200, {"name": name, "code": m.get("code", ""),
                                    "path": m.get("path", "")})

        if p == "/api/env":
            with LOCK:
                return self._send(200, {"env": ENV, "frames": len(frames_payload())})

        if p == "/api/frames":
            with LOCK:
                return self._send(200, {"frames": session_payload()})

        if p == "/api/preview":
            path = payload.get("path", "")
            if not os.path.isfile(path):
                return self._send(400, {"error": "no such file"})
            t0 = time.perf_counter()
            df = pd.read_csv(path, nrows=2000)
            cols = []
            n = len(df)
            for c in df.columns:
                col = df[c]
                nulls = int(col.isna().sum())
                vals = [str(v) for v in col.dropna().head(3).tolist()]
                while len(vals) < 3:
                    vals.append("")
                try:
                    distinct = int(col.nunique(dropna=True))
                except Exception:
                    distinct = None
                top, topn = "", 0
                try:
                    vc = col.dropna().value_counts()
                    if len(vc):
                        top, topn = str(vc.index[0]), int(vc.iloc[0])
                        if len(top) > 18:
                            top = top[:18] + "…"
                except Exception:
                    pass
                rng = ""
                if pd.api.types.is_numeric_dtype(col) and not pd.api.types.is_bool_dtype(col):
                    try:
                        rng = f"min {col.min():.4g} · max {col.max():.4g}"
                    except Exception:
                        rng = ""
                cols.append({"name": str(c), "dtype": str(col.dtype),
                             "samples": vals, "distinct": distinct,
                             "top": top, "topn": topn, "range": rng,
                             "nullpct": round(100 * nulls / n, 1) if n else 0.0})
            return self._send(200, {
                "path": path, "file": os.path.basename(path),
                "bytes": os.path.getsize(path),
                "rows_est": estimate_rows(path), "cols": cols,
                "sampled_rows": int(len(df)),
                "elapsed": round(time.perf_counter() - t0, 3),
                "suggested_name": suggest_name(os.path.basename(path)),
            })

        if p == "/api/import":
            path = payload.get("path", "")
            name = (payload.get("name") or "").strip()
            usecols = payload.get("usecols") or None
            if name in WORKSPACE:
                return self._send(400, {"error": f"'{name}' already exists — pick another name"})
            if not os.path.isfile(path):
                return self._send(400, {"error": "no such file"})
            t0 = time.perf_counter()
            try:
                df = pd.read_csv(path, usecols=usecols, low_memory=False)
            except Exception as e:
                return self._send(400, {"error": f"read failed: {e}"})
            with LOCK:
                WORKSPACE[name] = df
                META[name] = {"path": path, "usecols": usecols}
            return self._send(200, {
                "name": name, "rows": int(len(df)), "cols": int(df.shape[1]),
                "bytes": df_memory(df), "elapsed": round(time.perf_counter() - t0, 2),
                "frames": session_payload(),
            })

        if p == "/api/run":
            code = (payload.get("code") or "").strip()
            if not code:
                return self._send(400, {"error": "empty"})
            # the namespace persists between runs: imports and plain variables survive
            with LOCK:
                ns = WORKSPACE
                before = set(ns)
            t0 = time.perf_counter()
            try:
                tree = ast.parse(code, mode="exec")
            except SyntaxError as e:
                return self._send(400, {"error": f"SyntaxError: {e.msg} (line {e.lineno})"})
            # names being assigned, so re-running `cells = ...` still shows cells
            targets = []
            code_for = {}          # name -> the expression that produced it
            for node in tree.body:
                if isinstance(node, ast.Assign):
                    rhs = ast.get_source_segment(code, node.value) or ""
                    for t in node.targets:
                        if isinstance(t, ast.Name):
                            targets.append(t.id)
                            code_for[t.id] = rhs
                elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) \
                        and node.value is not None:
                    targets.append(node.target.id)
                    code_for[node.target.id] = ast.get_source_segment(code, node.value) or ""
                elif isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Name):
                    targets.append(node.target.id)
                    code_for[node.target.id] = ast.get_source_segment(code, node) or ""
            try:
                if len(tree.body) == 1 and isinstance(tree.body[0], ast.Expr):
                    val = eval(compile(ast.Expression(tree.body[0].value), "<run>", "eval"), ns)
                    result = val
                else:
                    exec(compile(tree, "<run>", "exec"), ns)
                    result = None
            except Exception as e:
                capture_figures()          # do not leak half-drawn figures
                return self._send(200, {"error": f"{type(e).__name__}: {e}",
                                        "elapsed": round(time.perf_counter() - t0, 2)})
            elapsed = round(time.perf_counter() - t0, 2)
            figures = capture_figures()

            created = []
            created_frames = {}
            with LOCK:
                for k in set(ns) - before:
                    f = as_frame(ns[k])
                    if f is not None:
                        META.setdefault(k, {"path": ""})
                        created.append(k)
                        created_frames[k] = f

            assigned = [t for t in targets if as_frame(ns.get(t)) is not None]
            with LOCK:
                for nm in targets:
                    if as_frame(ns.get(nm)) is not None:
                        m = META.setdefault(nm, {"path": ""})
                        # one dense line: indentation and newlines are display noise here
                        m["code"] = " ".join((code_for.get(nm) or "").split())

            # a plotly figure can be the result, an assigned name, or a new binding
            chart_obj = None
            for cand in [result] + [ns.get(t) for t in targets]:   # targets: any assigned name
                if is_plotly_fig(cand):
                    chart_obj = cand
                    break

            card = None
            shown_obj = None
            if isinstance(result, pd.DataFrame):
                shown_obj = result
            elif isinstance(result, pd.Series):
                shown_obj = result.to_frame()
            elif result is not None:
                # np.float64(-94.96) is noise; show the number
                v = result.item() if isinstance(result, np.generic) else result
                card = {"kind": "value", "value": repr(v)}
            # an assignment is a statement and yields nothing — show what it made
            elif assigned:
                shown_obj = as_frame(ns[assigned[-1]])
            elif created:
                shown_obj = created_frames[created[-1]]

            rid = None
            if shown_obj is not None:
                card = {"kind": "frame", **grid_payload(shown_obj)}
                with LOCK:
                    rid = next(RID)
                    RESULTS[rid] = shown_obj          # a reference, not a copy
                    while len(RESULTS) > MAX_RESULTS:
                        RESULTS.popitem(last=False)

            if chart_obj is not None:
                payload = plotly_payload(chart_obj)
                if "error" in payload:
                    card = {"kind": "value", "value": payload["error"]}
                else:
                    size = len(json.dumps(payload["spec"]))
                    if size > 12_000_000:
                        card = {"kind": "value", "value":
                                f"figure is {size/1e6:.0f} MB of JSON — sample the frame "
                                f"first, e.g. orders.sample(20000)"}
                    else:
                        card = {"kind": "chart", **payload, "bytes": size}

            if chart_obj is None and figures:
                card = {"kind": "image", "images": figures}

            if card is not None:
                card["rid"] = rid

            return self._send(200, {"card": card, "code": code, "elapsed": elapsed,
                                    "created": created, "assigned": assigned,
                                    "frames": session_payload()})

        if p == "/api/reset":
            # clears the session - frames, bindings, imports, cached results - and
            # re-seeds the preload list. The process itself keeps running.
            t0 = time.perf_counter()
            with LOCK:
                WORKSPACE.clear()
                META.clear()
                RESULTS.clear()
                PENDING.clear()
                CURRENT["transcript"] = []
                CURRENT["history"] = []
                CURRENT["file"] = None
                load_preload()
                auto = os.path.join(SESSIONS, "autosave.json")
                if os.path.isfile(auto):
                    os.remove(auto)
            return self._send(200, {"frames": session_payload(), "env": ENV,
                                    "elapsed": round(time.perf_counter() - t0, 2)})

        if p == "/api/keep":
            rid = payload.get("rid")
            name = (payload.get("name") or "").strip()
            try:
                rid = int(rid)
            except (TypeError, ValueError):
                return self._send(400, {"error": "bad card id"})
            if not name or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name):
                return self._send(400, {"error": "not a valid python name"})
            code = " ".join((payload.get("code") or "").split())
            with LOCK:
                if name in WORKSPACE:
                    return self._send(400, {"error": f"'{name}' already exists"})
                df = RESULTS.get(rid)
                if df is None:
                    return self._send(400, {"error": "that result is no longer held — re-run it"})
                WORKSPACE[name] = df
                META[name] = {"path": "", "code": code}
            return self._send(200, {"name": name, "frames": session_payload()})

        if p == "/api/drop":
            name = payload.get("name", "")
            with LOCK:
                if any(name == a for a, _ in [(e["alias"], e["module"]) for e in ENV]):
                    return self._send(400, {"error": f"{name} is a preloaded library, not a frame"})
                if name in WORKSPACE:
                    del WORKSPACE[name]
                    META.pop(name, None)
            return self._send(200, {"frames": session_payload()})

        if p == "/api/rename":
            old, new = payload.get("name", ""), (payload.get("new") or "").strip()
            with LOCK:
                if old not in WORKSPACE:
                    return self._send(400, {"error": "no such frame"})
                if new in WORKSPACE:
                    return self._send(400, {"error": "name already taken"})
                WORKSPACE[new] = WORKSPACE.pop(old)
                if old in META:
                    META[new] = META.pop(old)
            return self._send(200, {"frames": session_payload()})

        return self._send(404, {"error": "no route"})


def build_notebook(cells):
    """Assemble a .ipynb that would rebuild this session: imports, the read_csv
    for every frame loaded from a file, then the expressions in order."""
    nb_cells = []

    def code_cell(src):
        return {"cell_type": "code", "metadata": {}, "execution_count": None,
                "outputs": [], "source": src.splitlines(keepends=True)}

    lines = []
    for e in ENV:
        if not e.get("version"):
            continue
        mod, alias = e["module"], e["alias"]
        lines.append(f"import {mod}" if alias == mod.split(".")[-1] else f"import {mod} as {alias}")
    if lines:
        nb_cells.append(code_cell("\n".join(lines) + "\n"))

    reads = []
    for name, meta in META.items():
        path = meta.get("path")
        if not path or meta.get("code"):
            continue
        cols = meta.get("usecols")
        args = f'"{path}"'
        if cols:
            args += ", usecols=" + repr(list(cols))
        reads.append(f"{name} = pd.read_csv({args})")
    if reads:
        nb_cells.append(code_cell("\n".join(reads) + "\n"))

    for src in cells:
        if isinstance(src, str) and src.strip():
            nb_cells.append(code_cell(src.rstrip() + "\n"))

    return {"filename": "session.ipynb",
            "notebook": {"cells": nb_cells,
                         "metadata": {"kernelspec": {"name": "python3", "display_name": "Python 3",
                                                     "language": "python"},
                                      "language_info": {"name": "python"}},
                         "nbformat": 4, "nbformat_minor": 5}}


def suggest_name(filename):
    stem = os.path.splitext(filename)[0]
    out = "".join(ch if (ch.isalnum() or ch == "_") else "_" for ch in stem)
    out = "_".join(p for p in out.split("_") if p)
    if out and out[0].isdigit():
        out = "f_" + out
    return out[:32] or "frame"


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8840
    host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    t0 = time.perf_counter()
    load_preload()
    ok = sum(1 for e in ENV if e.get("version"))
    print(f"preloaded {ok}/{len(ENV)} libraries in {time.perf_counter() - t0:.1f}s", flush=True)
    for e in ENV:
        if not e.get("version"):
            print(f"  missing: {e['alias']:<10} {e['module']}  ({e.get('error', '')})", flush=True)
    # the app starts empty on purpose. The autosave is still written and still
    # offered as "last session" in the open list — just never opened behind your back.
    auto = os.path.join(SESSIONS, "autosave.json")
    if os.path.isfile(auto):
        print("last session available from the open button (not auto-opened)", flush=True)

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer((host, port), Handler)
    print(f"workbench prototype on http://{host}:{port}", flush=True)
    httpd.serve_forever()
