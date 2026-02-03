import { $ } from "bun"

export const SIDECAR_BINARIES: Array<{ rustTarget: string; ocBinary: string; assetExt: string }> = [
  {
    rustTarget: "aarch64-apple-darwin",
    ocBinary: "yaklang-darwin-arm64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-apple-darwin",
    ocBinary: "yaklang-darwin-x64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-pc-windows-msvc",
    ocBinary: "yaklang-windows-x64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-unknown-linux-gnu",
    ocBinary: "yaklang-linux-x64",
    assetExt: "tar.gz",
  },
  {
    rustTarget: "aarch64-unknown-linux-gnu",
    ocBinary: "yaklang-linux-arm64",
    assetExt: "tar.gz",
  },
]

export const RUST_TARGET = Bun.env.RUST_TARGET

/** 根据当前进程的 platform/arch 得到本机对应的 Rust target 和 opencode 产物名 */
export function getCurrentPlatformSidecar(): (typeof SIDECAR_BINARIES)[number] {
  const platform = process.platform
  const arch = process.arch
  const entry = SIDECAR_BINARIES.find((b) => {
    if (b.rustTarget === "aarch64-apple-darwin") return platform === "darwin" && arch === "arm64"
    if (b.rustTarget === "x86_64-apple-darwin") return platform === "darwin" && arch === "x64"
    if (b.rustTarget === "x86_64-pc-windows-msvc") return platform === "win32" && arch === "x64"
    if (b.rustTarget === "x86_64-unknown-linux-gnu") return platform === "linux" && arch === "x64"
    if (b.rustTarget === "aarch64-unknown-linux-gnu") return platform === "linux" && arch === "arm64"
    return false
  })
  if (!entry) throw new Error(`Unsupported platform: ${platform}/${arch}`)
  return entry
}

export function getCurrentSidecar(target = RUST_TARGET) {
  if (!target && !RUST_TARGET) throw new Error("RUST_TARGET not set")

  const binaryConfig = SIDECAR_BINARIES.find((b) => b.rustTarget === target)
  if (!binaryConfig) throw new Error(`Sidecar configuration not available for Rust target '${RUST_TARGET}'`)

  return binaryConfig
}

export async function copyBinaryToSidecarFolder(source: string, target = RUST_TARGET) {
  await $`mkdir -p src-tauri/sidecars`
  const isWinTarget = target.includes("windows")
  const dest = `src-tauri/sidecars/opencode-cli-${target}${isWinTarget ? ".exe" : ""}`
  await $`cp ${source} ${dest}`

  console.log(`Copied ${source} to ${dest}`)
}
