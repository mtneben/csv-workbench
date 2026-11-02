#!/bin/bash
# workbench launcher — double-click this in Finder, or pin it to the Dock.
# Starts the local server (127.0.0.1 only), waits for it to answer, opens Safari.

cd "$(dirname "$0")" || exit 1

PY="${WORKBENCH_PYTHON:-$HOME/venvs/workbench/bin/python}"
PORT="${WORKBENCH_PORT:-8840}"
URL="http://127.0.0.1:$PORT/"

if [ ! -x "$PY" ]; then
  echo "No python at: $PY"
  echo
  echo "Create the venv first:"
  echo "  python3.12 -m venv ~/venvs/workbench"
  echo "  ~/venvs/workbench/bin/pip install --upgrade pip"
  echo "  ~/venvs/workbench/bin/pip install pandas pyarrow plotly matplotlib duckdb"
  echo
  echo "Then run this again. (If your venv lives elsewhere:"
  echo "  export WORKBENCH_PYTHON=/path/to/venv/bin/python  )"
  read -r -p "Press return to close."
  exit 1
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
echo "workbench running at $URL"
echo "Leave this window open. Close it (or press Ctrl-C) to stop the server."
wait $SERVER_PID
