#!/usr/bin/env bash
# 打包 Mac 版 Yaklang 桌面应用
# 前置：需已安装 Rust (https://rustup.rs) 和 Tauri 要求的环境 (https://v2.tauri.app/start/prerequisites/)

set -e
cd "$(dirname "$0")/.."

# 避免 CI=1 导致 tauri 参数解析错误
unset CI

echo ">>> 安装依赖..."
bun install

echo ">>> 构建前端并打包 Mac 应用..."
bun run tauri build

echo ""
echo ">>> 完成。产物在："
echo "    $(pwd)/src-tauri/target/release/bundle/"
echo "    - .app: macOS 应用"
echo "    - .dmg: 安装包"
