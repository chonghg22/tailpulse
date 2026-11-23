#!/bin/bash
# Install / update the tailpulse agent on a server. Run with sudo on the target server.
# It never touches the web server or the app (logs are only read). Only tailpulse-agent is (re)started.
#
# Put these files in one directory on the server:
#   tailpulse_agent.py  tailpulse-agent.service  install-agent.sh  <your config.json>  [<token file>]
#
#   sudo bash install-agent.sh install <config.json> [<token file>] [--group <log group>]
#       Installs the agent, checks with --check (as the service account) that the logs can be read and parsed,
#       then enables and (re)starts it. Without a token file, the existing /etc/tailpulse-agent/token is kept.
#       --group: group that can read the logs (default: adm on Debian/Ubuntu, otherwise asked to be set).
#   sudo bash install-agent.sh check       re-run the parse check with the installed config
#   sudo bash install-agent.sh status      service state, Python / systemd versions, memory
#   sudo bash install-agent.sh uninstall   stop and remove the agent (config and token are kept)
#
# The token value is never printed. Older systemd (< 232, e.g. CentOS 7 / Amazon Linux 2) gets equivalent limits.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=/usr/local/lib/tailpulse-agent
ETC=/etc/tailpulse-agent
UNIT=/etc/systemd/system/tailpulse-agent.service
U=tailpulse
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 2; }
PY=$(command -v python3 || true)
[ -n "$PY" ] || { echo "python3 not found (3.6 or newer is required)"; exit 2; }
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 6) else 1)' || { echo "Python 3.6 or newer is required: $("$PY" --version 2>&1)"; exit 2; }

check() { sudo -u "$U" "$PY" "$LIB/tailpulse_agent.py" --config "$ETC/config.json" --check; }

status() {
  # systemd 219 has no "show --value"
  echo "agent: $(systemctl is-active tailpulse-agent 2>/dev/null || true), since $(systemctl show tailpulse-agent -p ActiveEnterTimestamp 2>/dev/null | cut -d= -f2-)"
  echo "python: $("$PY" --version 2>&1), systemd $(systemctl --version | awk 'NR==1{print $2}'), account: $(id "$U" 2>/dev/null || echo none)"
  echo "memory: $(ps -C python3 -o rss=,args= 2>/dev/null | awk '/tailpulse_agent/{printf "%.1fMB", $1/1024}')"
}

default_group() {
  if getent group adm >/dev/null 2>&1; then echo adm; else echo ""; fi
}

install_agent() {
  local config="" token="" group=""
  while [ $# -gt 0 ]; do
    case "$1" in
    --group) group=${2:-}; shift 2 ;;
    *) if [ -z "$config" ]; then config=$1; elif [ -z "$token" ]; then token=$1; fi; shift ;;
    esac
  done
  [ -n "$config" ] && [ -f "$config" ] || { echo "Config file not found: ${config:-<none>}"; exit 2; }
  "$PY" -c 'import json,sys; json.load(open(sys.argv[1]))' "$config" || { echo "Config is not valid JSON"; exit 2; }
  [ -n "$group" ] || group=$(default_group)
  [ -n "$group" ] || { echo "No adm group here. Pass --group <group that can read the access logs> (e.g. nginx)"; exit 2; }
  getent group "$group" >/dev/null || { echo "Group not found: $group"; exit 2; }
  if ! id "$U" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell "$(command -v nologin || echo /sbin/nologin)" --gid "$group" "$U"
    echo "created account $U (group $group)"
  else
    usermod -g "$group" "$U"
  fi
  install -d -m 755 "$LIB" "$ETC"
  install -m 644 "$HERE/tailpulse_agent.py" "$LIB/tailpulse_agent.py"
  install -m 644 "$config" "$ETC/config.json"
  if [ -n "$token" ]; then
    install -m 600 -o "$U" -g "$group" "$token" "$ETC/token"
  fi
  [ -s "$ETC/token" ] || { echo "Token file missing: $ETC/token (pass it as the 2nd argument)"; exit 2; }
  chown "$U:$group" "$ETC/token"
  echo "--- checking that the service account can read and parse the logs"
  check || { echo "Parse failed or no read permission — the agent was NOT started"; exit 3; }
  local unit_tmp
  unit_tmp=$(mktemp)
  cp "$HERE/tailpulse-agent.service" "$unit_tmp"
  sed -i -e "s#^ExecStart=/usr/bin/python3 #ExecStart=$PY #" -e "s#^Group=.*#Group=$group#" "$unit_tmp"
  if [ "$(systemctl --version | awk 'NR==1{print $2}')" -lt 232 ]; then
    sed -i -e 's/^ProtectSystem=strict/ProtectSystem=full/' -e 's/^MemoryMax=/MemoryLimit=/' "$unit_tmp"
  fi
  install -m 644 "$unit_tmp" "$UNIT"
  rm -f "$unit_tmp"
  systemctl daemon-reload
  systemctl enable tailpulse-agent >/dev/null 2>&1
  systemctl restart tailpulse-agent
  sleep 3
  status
}

uninstall_agent() {
  systemctl disable --now tailpulse-agent >/dev/null 2>&1 || true
  rm -f "$UNIT" "$LIB/tailpulse_agent.py"
  rmdir "$LIB" 2>/dev/null || true
  systemctl daemon-reload
  echo "removed the service. $ETC (config, token) and account $U are kept; delete them by hand if you want."
}

case "${1:-}" in
status) status ;;
check) check ;;
install) shift; install_agent "$@" ;;
uninstall) uninstall_agent ;;
*) echo "usage: sudo bash $0 install <config.json> [<token file>] [--group <log group>] | check | status | uninstall"; exit 2 ;;
esac
