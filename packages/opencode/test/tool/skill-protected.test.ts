import { describe, expect, test } from "bun:test"
import path from "path"
import { isSkillProtectedPath, SKILL_PROTECTED_MESSAGE } from "../../src/tool/skill-protected"

describe("tool.skill-protected", () => {
  test("isSkillProtectedPath returns true for .opencode/skill paths", () => {
    expect(isSkillProtectedPath("/repo/.opencode/skill/auto-pentest/SKILL.md")).toBe(true)
    expect(isSkillProtectedPath("/repo/.opencode/skill/port-scan/SKILL.md")).toBe(true)
    expect(isSkillProtectedPath("/home/user/proj/.opencode/skill/foo/bar.md")).toBe(true)
  })

  test("isSkillProtectedPath returns true for .opencode/skills paths", () => {
    expect(isSkillProtectedPath("/repo/.opencode/skills/xyz/SKILL.md")).toBe(true)
  })

  test("isSkillProtectedPath returns true for .claude/skills paths", () => {
    expect(isSkillProtectedPath("/home/user/.claude/skills/helper/SKILL.md")).toBe(true)
    expect(isSkillProtectedPath("/repo/.claude/skills/foo/bar.md")).toBe(true)
  })

  test("isSkillProtectedPath returns false for normal project paths", () => {
    expect(isSkillProtectedPath("/repo/src/index.ts")).toBe(false)
    expect(isSkillProtectedPath("/repo/.opencode/command/foo.md")).toBe(false)
    expect(isSkillProtectedPath("/repo/skill/not-under-dot-opencode/SKILL.md")).toBe(false)
  })

  test("SKILL_PROTECTED_MESSAGE is non-empty", () => {
    expect(SKILL_PROTECTED_MESSAGE.length).toBeGreaterThan(0)
    expect(SKILL_PROTECTED_MESSAGE).toContain("read-only")
  })
})
