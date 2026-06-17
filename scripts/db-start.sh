#!/usr/bin/env bash
set -euo pipefail

# Start the project's Supabase CLI local stack, then strip the auto-restart
# policy from every container the CLI created.
#
# WHY: the Supabase CLI hardcodes `restart: unless-stopped` on all of its
# containers, so the dev stack would silently come back up on a Docker/host
# reboot. Our convention is that dev containers must NOT auto-start — a
# developer starts them explicitly per session ([[code-quality]] § Dev
# Environment). `config.toml` exposes no knob for this, and a one-off
# `docker update` is wiped on the next `supabase start`, so we re-apply the
# override here on every start to make "no auto-start" durable.

supabase start "$@"

# Match the CLI's own project label rather than a name substring — more robust
# and exactly scoped to this project's containers.
mapfile -t container_ids < <(docker ps -aq --filter "label=com.supabase.cli.project=top-dog")

if [ "${#container_ids[@]}" -eq 0 ]; then
	echo "db-start: no top-dog Supabase containers found; nothing to update."
	exit 0
fi

# Idempotent: setting --restart=no repeatedly is a no-op once already applied.
docker update --restart=no "${container_ids[@]}"

echo "db-start: cleared auto-restart on ${#container_ids[@]} top-dog container(s)."
