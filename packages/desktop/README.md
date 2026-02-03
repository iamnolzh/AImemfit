# OpenCode Desktop

Native OpenCode desktop app, built with Tauri v2.

## Development

From the repo root:

```bash
bun install
bun run --cwd packages/desktop tauri dev
```

This starts the Vite dev server on http://localhost:1420 and opens the native window.

If you only want the web dev server (no native shell):

```bash
bun run --cwd packages/desktop dev
```

## Build

### 全平台打包（推荐）

在 **当前系统** 上打 **当前平台** 的桌面包（Mac → .app/.dmg，Windows → .exe/.msi，Linux → .AppImage/.deb）：

```bash
# 在仓库根目录
bun run --cwd packages/desktop build:desktop
```

或进入 `packages/desktop` 后执行：

```bash
cd packages/desktop
bun run build:desktop
```

前置：已安装 [Rust](https://rustup.rs) 和 [Bun](https://bun.sh)。脚本会自动：安装依赖 → 构建 opencode CLI → 复制 sidecar → 执行 `tauri build`。

### 仅打前端 + Tauri（已有 sidecar 时）

若 sidecar 已就绪，只打前端并打 Tauri 包：

```bash
bun run --cwd packages/desktop tauri build
```

### Windows 上也可用 PowerShell 脚本

在仓库根目录 PowerShell 执行：`.\packages\desktop\scripts\build-windows.ps1`，效果与 `build:desktop` 相同。

## Prerequisites

Running the desktop app requires additional Tauri dependencies (Rust toolchain, platform-specific libraries). See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for setup instructions.
