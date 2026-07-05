import path from "path"
import z from "zod"
import fs from "fs/promises"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { NamedError } from "@opencode-ai/util/error"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { exists } from "fs/promises"
import { Flag } from "@/flag/flag"

export namespace Skill {
  const log = Log.create({ service: "skill" })
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    editable: z.boolean().optional(),
  })
  export type Info = z.infer<typeof Info>

  export const Detail = Info.extend({
    content: z.string(),
  })
  export type Detail = z.infer<typeof Detail>

  export const UpsertInput = z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Skill name may contain letters, numbers, hyphen, and underscore."),
    description: z.string().trim().min(1).max(500),
    content: z.string().default(""),
  })
  export type UpsertInput = z.infer<typeof UpsertInput>

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  )

  const OPENCODE_SKILL_GLOB = new Bun.Glob("{skill,skills}/**/SKILL.md")
  const CLAUDE_SKILL_GLOB = new Bun.Glob("skills/**/SKILL.md")
  /** OPENCODE_SKILL_DIR 下任意子目录的 SKILL.md */
  const CUSTOM_SKILL_GLOB = new Bun.Glob("**/SKILL.md")

  function isEditableLocation(location: string) {
    const roots = [
      path.join(Instance.worktree, ".yaklang", "skill"),
      path.join(Instance.worktree, ".yaklang", "skills"),
    ]
    return roots.some((root) => path.relative(root, location) && !path.relative(root, location).startsWith(".."))
  }

  function targetPath(name: string) {
    return path.join(Instance.worktree, ".yaklang", "skill", name, "SKILL.md")
  }

  function renderMarkdown(input: UpsertInput) {
    const description = JSON.stringify(input.description)
    const name = JSON.stringify(input.name)
    return `---\nname: ${name}\ndescription: ${description}\n---\n\n${input.content.trim()}\n`
  }

  async function scan() {
    const skills: Record<string, Info> = {}

    const addSkill = async (match: string) => {
      const md = await ConfigMarkdown.parse(match)
      if (!md) {
        return
      }

      const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
      if (!parsed.success) return

      // Warn on duplicate skill names
      if (skills[parsed.data.name]) {
        log.warn("duplicate skill name", {
          name: parsed.data.name,
          existing: skills[parsed.data.name].location,
          duplicate: match,
        })
      }

      skills[parsed.data.name] = {
        name: parsed.data.name,
        description: parsed.data.description,
        location: match,
        editable: isEditableLocation(match),
      }
    }

    // Scan .claude/skills/ directories (project-level)
    const claudeDirs = await Array.fromAsync(
      Filesystem.up({
        targets: [".claude"],
        start: Instance.directory,
        stop: Instance.worktree,
      }),
    )
    // Also include global ~/.claude/skills/
    const globalClaude = `${Global.Path.home}/.claude`
    if (await exists(globalClaude)) {
      claudeDirs.push(globalClaude)
    }

    for (const dir of claudeDirs) {
      const matches = await Array.fromAsync(
        CLAUDE_SKILL_GLOB.scan({
          cwd: dir,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        }),
      ).catch((error) => {
        log.error("failed .claude directory scan for skills", { dir, error })
        return []
      })

      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Scan .yaklang/skill/ directories. Include the project .yaklang path even
    // when it did not exist during config bootstrap, so newly created skills are
    // visible immediately.
    const opencodeDirs = new Set([...(await Config.directories()), path.join(Instance.worktree, ".yaklang")])
    for (const dir of opencodeDirs) {
      if (!(await exists(dir))) continue
      for await (const match of OPENCODE_SKILL_GLOB.scan({
        cwd: dir,
        absolute: true,
        onlyFiles: true,
        followSymlinks: true,
      })) {
        await addSkill(match)
      }
    }

    // 可选：环境变量 OPENCODE_SKILL_DIR 指定额外 skill 根目录（多个用 path.delimiter 分隔）
    if (Flag.OPENCODE_SKILL_DIR) {
      const customDirs = Flag.OPENCODE_SKILL_DIR.split(path.delimiter).map((d) => d.trim()).filter(Boolean)
      for (const dir of customDirs) {
        if (!(await exists(dir))) {
          log.warn("OPENCODE_SKILL_DIR path does not exist", { dir })
          continue
        }
        for await (const match of CUSTOM_SKILL_GLOB.scan({
          cwd: dir,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
        })) {
          await addSkill(match)
        }
      }
    }

    return skills
  }

  export const state = Instance.state(scan)

  export async function refresh() {
    const cached = await state()
    const next = await scan()
    for (const key of Object.keys(cached)) delete cached[key]
    Object.assign(cached, next)
    return Object.values(cached)
  }

  export async function get(name: string) {
    return state().then((x) => x[name])
  }

  export async function all() {
    return state().then((x) => Object.values(x))
  }

  export async function detail(name: string) {
    const skill = await get(name)
    if (!skill) return undefined
    const md = await ConfigMarkdown.parse(skill.location)
    return Detail.parse({
      ...skill,
      content: md.content.trim(),
    })
  }

  export async function create(input: UpsertInput) {
    const parsed = UpsertInput.parse(input)
    const existing = await get(parsed.name)
    if (existing) {
      throw new InvalidError({
        path: existing.location,
        message: `Skill "${parsed.name}" already exists.`,
      })
    }

    const file = targetPath(parsed.name)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, renderMarkdown(parsed), "utf8")
    await refresh()
    const created = await detail(parsed.name)
    if (!created) throw new InvalidError({ path: file, message: "Failed to create skill." })
    return created
  }

  export async function update(name: string, input: UpsertInput) {
    const parsed = UpsertInput.parse(input)
    const skill = await get(name)
    if (!skill) {
      throw new InvalidError({ path: targetPath(name), message: `Skill "${name}" not found.` })
    }
    if (!skill.editable) {
      throw new InvalidError({ path: skill.location, message: "Only project skills under .yaklang/skill can be edited." })
    }
    if (parsed.name !== name) {
      const conflict = await get(parsed.name)
      if (conflict) {
        throw new InvalidError({ path: conflict.location, message: `Skill "${parsed.name}" already exists.` })
      }
    }

    await fs.writeFile(skill.location, renderMarkdown(parsed), "utf8")
    if (parsed.name !== name) {
      const nextFile = targetPath(parsed.name)
      await fs.mkdir(path.dirname(nextFile), { recursive: true })
      await fs.rename(skill.location, nextFile)
      await fs.rm(path.dirname(skill.location), { recursive: true, force: true })
    }
    await refresh()
    const updated = await detail(parsed.name)
    if (!updated) throw new InvalidError({ path: targetPath(parsed.name), message: "Failed to update skill." })
    return updated
  }

  export async function remove(name: string) {
    const skill = await get(name)
    if (!skill) return true
    if (!skill.editable) {
      throw new InvalidError({ path: skill.location, message: "Only project skills under .yaklang/skill can be deleted." })
    }
    await fs.rm(path.dirname(skill.location), { recursive: true, force: true })
    await refresh()
    return true
  }
}
