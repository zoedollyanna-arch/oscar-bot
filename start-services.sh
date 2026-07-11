#!/bin/sh
set -eu

node index.js &
discord_pid=$!

# The Discord bot owns Render's public PORT and health endpoint.
TAMMY_HEALTH_SERVER=false dotnet TammyAgent/TammyAgent.dll &
agent_pid=$!

shutdown() {
  kill -TERM "$discord_pid" "$agent_pid" 2>/dev/null || true
  wait "$discord_pid" "$agent_pid" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

# If either process exits, stop the other so Render restarts the complete service.
while kill -0 "$discord_pid" 2>/dev/null && kill -0 "$agent_pid" 2>/dev/null; do
  sleep 2
done

if ! kill -0 "$discord_pid" 2>/dev/null; then
  wait "$discord_pid" || status=$?
else
  wait "$agent_pid" || status=$?
fi
status=${status:-0}
exit "$status"
