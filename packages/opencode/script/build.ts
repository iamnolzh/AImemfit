#!/usr/bin/env bun

import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import path from "path"
import fs from "fs"
import { $ } from "bun"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

import pkg from "../package.json"
import { Script } from "@opencode-ai/script"

const singleFlag = process.argv.includes("--single")
const baselineFlag = process.argv.includes("--baseline")
const skipInstall = process.argv.includes("--skip-install")

const allTargets: {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false,
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
    avx2: false,
  },
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "darwin",
    arch: "x64",
    avx2: false,
  },
  {
    os: "win32",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
    avx2: false,
  },
]

const targets = singleFlag
  ? allTargets.filter((item) => {
      if (item.os !== process.platform || item.arch !== process.arch) {
        return false
      }

      // When building for the current platform, prefer a single native binary by default.
      // Baseline binaries require additional Bun artifacts and can be flaky to download.
      if (item.avx2 === false) {
        return baselineFlag
      }

      return true
    })
  : allTargets

console.log("[build] 目标平台:", singleFlag ? targets.map((t) => `${t.os}/${t.arch}`) : "全部")
console.log("[build] 清理 dist...")
await $`rm -rf dist`

const binaries: Record<string, string> = {}
if (skipInstall) {
  console.log("[build] 已加 --skip-install，跳过依赖安装，直接编译（需确保 node_modules 已装好）")
} else {
  // --single 时只装当前平台依赖，避免 Resolving dependencies 卡很久
  const otuiVer = pkg.dependencies["@opentui/core"]
  const watcherVer = pkg.dependencies["@parcel/watcher"]
  if (singleFlag) {
    console.log("[build] 安装可选依赖 (仅当前平台): @opentui/core@" + otuiVer)
    await $`bun install --os=${process.platform} --cpu=${process.arch} @opentui/core@${otuiVer}`.quiet(false)
    console.log("[build] 安装可选依赖 (仅当前平台): @parcel/watcher@" + watcherVer)
    await $`bun install --os=${process.platform} --cpu=${process.arch} @parcel/watcher@${watcherVer}`.quiet(false)
  } else {
    console.log("[build] 安装可选依赖 (全平台): @opentui/core@" + otuiVer)
    await $`bun install --os="*" --cpu="*" @opentui/core@${otuiVer}`.quiet(false)
    console.log("[build] 安装可选依赖 (全平台): @parcel/watcher@" + watcherVer)
    await $`bun install --os="*" --cpu="*" @parcel/watcher@${watcherVer}`.quiet(false)
  }
}
for (const item of targets) {
  const name = [
    pkg.name,
    // changing to win32 flags npm for some reason
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  console.log("[build] 正在编译:", name)
  await $`mkdir -p dist/${name}/bin`

  const parserWorker = fs.realpathSync(path.resolve(dir, "./node_modules/@opentui/core/parser.worker.js"))
  const workerPath = "./src/cli/cmd/tui/worker.ts"

  // Use platform-specific bunfs root path based on target OS
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  const buildResult = await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [solidPlugin],
    sourcemap: "external",
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      //@ts-ignore (bun types aren't up to date)
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace(pkg.name, "bun") as any,
      outfile: `dist/${name}/bin/opencode`,
      execArgv: [`--user-agent=opencode/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    entrypoints: ["./src/index.ts", parserWorker, workerPath],
    define: {
      OPENCODE_VERSION: `'${Script.version}'`,
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      OPENCODE_WORKER_PATH: workerPath,
      OPENCODE_CHANNEL: `'${Script.channel}'`,
      OPENCODE_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
    },
  })

  if (!buildResult.success) {
    console.error("[build] 编译失败:", name)
    for (const log of buildResult.logs) console.error(log)
    process.exit(1)
  }
  console.log("[build] 完成:", name, "->", `dist/${name}/bin/opencode`)

  await $`rm -rf ./dist/${name}/bin/tui`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: Script.version,
        os: [item.os],
        cpu: [item.arch],
      },
      null,
      2,
    ),
  )
  binaries[name] = Script.version
}

console.log("[build] 全部完成，产物:", Object.keys(binaries).join(", "))
export { binaries }
