import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, "..")
const repoRoot = path.resolve(desktopDir, "../..")
const appPublicDir = path.join(repoRoot, "packages/app/public")
const desktopPublicDir = path.join(desktopDir, "public")

console.log("[assets] 同步公共资源...")
await $`mkdir -p ${desktopPublicDir}`
await $`cp -r ${appPublicDir}/* ${desktopPublicDir}/`
console.log("[assets] 同步完成")
