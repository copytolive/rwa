#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=${REPO_DIR:-/opt/rwa}
VENV=${VENV:-/opt/gold24-venv}

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2; exit 1
fi

apt-get update
apt-get install -y git python3 python3-venv python3-pip ca-certificates
id gold24 >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin gold24
mkdir -p /var/lib/gold24/data
chown -R gold24:gold24 /var/lib/gold24

if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone https://github.com/copytolive/rwa.git "$REPO_DIR"
else
  git -C "$REPO_DIR" fetch origin main
  git -C "$REPO_DIR" checkout main
  git -C "$REPO_DIR" reset --hard origin/main
fi
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install -r "$REPO_DIR/backtest/gold24/requirements.txt"
"$VENV/bin/python" "$REPO_DIR/backtest/gold24/worker.py" --self-test
install -m 0644 "$REPO_DIR/deploy/gold24/gold24.service" /etc/systemd/system/gold24.service
if [[ ! -f /etc/gold24.env ]]; then
  install -m 0600 "$REPO_DIR/deploy/gold24/env.example" /etc/gold24.env
  echo "Created /etc/gold24.env; set canonical dataset/cross-check and Google credential before production." >&2
fi
systemctl daemon-reload
systemctl enable gold24.service
systemctl restart gold24.service
systemctl --no-pager status gold24.service || true
