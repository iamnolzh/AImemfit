# 在 Windows 上本地打包 Yaklang 桌面应用（.exe / .msi）
# 前置：已安装 Rust (https://rustup.rs)、Bun (https://bun.sh)

$ErrorActionPreference = "Stop"
$DesktopRoot = $PSScriptRoot + "\.."
$RepoRoot = $DesktopRoot + "\..\.."

Write-Host ">>> 安装依赖..." -ForegroundColor Cyan
Set-Location $RepoRoot
bun install

Write-Host ">>> 构建 opencode CLI (Windows)..." -ForegroundColor Cyan
Set-Location "$RepoRoot\packages\yaklang"
$env:OPENCODE_CHANNEL = "latest"
$env:OPENCODE_VERSION = "1.1.4"
bun run build --single

Write-Host ">>> 复制 sidecar 到 desktop..." -ForegroundColor Cyan
$SidecarsDir = "$DesktopRoot\src-tauri\sidecars"
New-Item -ItemType Directory -Force -Path $SidecarsDir | Out-Null
Copy-Item "$RepoRoot\packages\yaklang\dist\yaklang-windows-x64\bin\yaklang.exe" `
  -Destination "$SidecarsDir\opencode-cli-x86_64-pc-windows-msvc.exe" -Force

Write-Host ">>> 构建 Tauri 桌面应用..." -ForegroundColor Cyan
Set-Location $DesktopRoot
# 避免 CI=1 导致 tauri 参数解析错误
if ($env:CI) { Remove-Item Env:CI }
bun run tauri build

Write-Host ""
Write-Host ">>> 完成。产物在：" -ForegroundColor Green
$TargetDir = "$DesktopRoot\src-tauri\target\x86_64-pc-windows-msvc\release\bundle"
Write-Host "    $TargetDir\nsis\  (.exe 安装包)"
Write-Host "    $TargetDir\msi\   (.msi 安装包)"
