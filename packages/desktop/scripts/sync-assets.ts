import path from "path"
import { fileURLToPath } from "url"
import { cp, mkdir } from "fs/promises"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(__dirname, "..")
const repoRoot = path.resolve(desktopDir, "../..")
const appPublicDir = path.join(repoRoot, "packages/app/public")
const desktopPublicDir = path.join(desktopDir, "public")

console.log("[assets] 同步公共资源...")
try {
    await mkdir(desktopPublicDir, { recursive: true })
    await cp(appPublicDir, desktopPublicDir, { recursive: true, force: true })
    console.log("[assets] 同步完成")
} catch (err) {
    console.error("[assets] 同步失败:", err)
    process.exit(1)
}
