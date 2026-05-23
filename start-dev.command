#!/usr/bin/env bash
# macOS：在 Finder 中双击此文件即可启动前后端

cd "$(dirname "$0")"
chmod +x scripts/start-dev.sh 2>/dev/null || true
exec ./scripts/start-dev.sh
