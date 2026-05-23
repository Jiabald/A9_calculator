#!/usr/bin/env bash
# 同时启动后端 (4000) 与前端 (5173)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "正在停止后端 (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装: https://nodejs.org/"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请确认 Node.js 安装完整。"
  exit 1
fi

ensure_deps() {
  local dir="$1"
  local name="$2"
  if [[ ! -d "$dir/node_modules" ]]; then
    echo ">>> 首次运行：正在安装 $name 依赖..."
    (cd "$dir" && npm install)
  fi
}

ensure_deps "$SERVER_DIR" "后端"
ensure_deps "$CLIENT_DIR" "前端"

echo "========================================"
echo "  A9 仓位计算器 - 开发环境"
echo "  后端: http://localhost:4000"
echo "  前端: http://localhost:5173"
echo "  按 Ctrl+C 停止全部服务"
echo "========================================"
echo ""

(cd "$SERVER_DIR" && npm run dev) &
SERVER_PID=$!

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "后端启动失败，请检查 server 目录日志。"
  exit 1
fi

cd "$CLIENT_DIR"
npm run dev
