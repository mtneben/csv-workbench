#!/bin/bash
# csvworkbench launcher — double-click this in Finder, or pin it to the Dock.
# Starts the local server (127.0.0.1 only), waits for it to answer, opens Safari.

cd "$(dirname "$0")" || exit 1

PORT="${CSVWORKBENCH_PORT:-${WORKBENCH_PORT:-8840}}"
URL="http://127.0.0.1:$PORT/"

# find the interpreter without guessing: an explicit setting, a venv inside this
# folder, or the usual home for one. First match wins.
PY="${CSVWORKBENCH_PYTHON:-${WORKBENCH_PYTHON:-}}"
if [ -z "$PY" ]; then
  for cand in "$PWD/bin/python" "$PWD/.venv/bin/python" \
              "$HOME/venvs/csvworkbench/bin/python" "$HOME/venvs/workbench/bin/python"; do
    [ -x "$cand" ] && { PY="$cand"; break; }
  done
fi

if [ -z "$PY" ] || [ ! -x "$PY" ]; then
  echo "No python found. Create the venv first:"
  echo "  python3 -m venv ~/venvs/csvworkbench"
  echo "  ~/venvs/csvworkbench/bin/python -m pip install --upgrade pip"
  echo "  ~/venvs/csvworkbench/bin/python -m pip install pandas pyarrow plotly matplotlib duckdb"
  echo
  echo "If your venv lives elsewhere:"
  echo "  export CSVWORKBENCH_PYTHON=/path/to/venv/bin/python"
  read -r -p "Press return to close."
  exit 1
fi
# a venv inside this folder means the project folder is the venv; keep it tidy
if [ "$PY" = "$PWD/bin/python" ]; then
  PY="$PWD/bin/python"
fi

# already up? just show it.
if curl -s -o /dev/null --max-time 1 "$URL"; then
  open "$URL"
  exit 0
fi

"$PY" server.py "$PORT" 127.0.0.1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 60); do
  sleep 0.25
  if curl -s -o /dev/null --max-time 1 "$URL"; then break; fi
done

if ! curl -s -o /dev/null --max-time 1 "$URL"; then
  echo "server did not start on port $PORT — see the messages above."
  read -r -p "Press return to close."
  exit 1
fi

open "$URL"
echo "csvworkbench running at $URL"
echo "Leave this window open. Close it (or press Ctrl-C) to stop the server."
wait $SERVER_PID
