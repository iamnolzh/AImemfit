#!/usr/bin/env bun
/**
 * 全平台本地打包：在当前系统上打当前平台的桌面包。
 * - Mac → .app / .dmg
 * - Windows → .exe / .msi
 * - Linux → .AppImage / .deb
 *
 * 用法：在仓库根目录执行
 *   bun run --cwd packages/desktop scripts/build.ts
 * 或在 packages/desktop 下
 *   bun scripts/build.ts
 */

import { $ } from "bun"
import { copyBinaryToSidecarFolder, getCurrentPlatformSidecar } from "./utils"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, "..")
const repoRoot = path.resolve(desktopDir, "../..")
const opencodeDir = path.join(repoRoot, "packages/opencode")

// 非 git 或 CI 时避免 opencode build 里 git branch 报错
process.env.OPENCODE_CHANNEL = process.env.OPENCODE_CHANNEL ?? "latest"
process.env.OPENCODE_VERSION = process.env.OPENCODE_VERSION ?? "1.1.4"
// 避免 CI=1 导致 tauri 参数解析错误
delete process.env.CI

const sidecar = getCurrentPlatformSidecar()
const isWin = process.platform === "win32"
const cliName = `opencode${isWin ? ".exe" : ""}`
const cliPath = path.join(opencodeDir, "dist", sidecar.ocBinary, "bin", cliName)

console.log("[build] 当前平台:", process.platform, process.arch, "→", sidecar.rustTarget, sidecar.ocBinary)

console.log("[build] 安装依赖...")
await $`bun install`.cwd(repoRoot)

console.log("[build] 构建 opencode CLI...")
await $`bun run build --single`.cwd(opencodeDir)

console.log("[build] 复制 sidecar...")
process.env.RUST_TARGET = sidecar.rustTarget
const prevCwd = process.cwd()
process.chdir(desktopDir)
await copyBinaryToSidecarFolder(cliPath, sidecar.rustTarget)
process.chdir(prevCwd)

console.log("[build] 构建 Tauri 桌面包...")
await $`bun run tauri build`.cwd(desktopDir)

const bundleBase = path.join(desktopDir, "src-tauri/target", sidecar.rustTarget, "release/bundle")
console.log("\n[build] 完成。产物在:", bundleBase)
if (process.platform === "darwin") {
  console.log("  - macos/*.app")
  console.log("  - dmg/*.dmg")
} else if (process.platform === "win32") {
  console.log("  - nsis/*.exe")
  console.log("  - msi/*.msi")
} else {
  console.log("  - appimage/*.AppImage")
  console.log("  - deb/*.deb")
}
