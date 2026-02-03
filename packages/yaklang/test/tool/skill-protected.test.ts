import { describe, expect, test } from "bun:test"
import path from "path"
import { isSkillProtectedPath, SKILL_PROTECTED_MESSAGE } from "../../src/tool/skill-protected"

describe("tool.skill-protected", () => {
  test("isSkillProtectedPath returns true for .yaklang/skill paths", () => {
    expect(isSkillProtectedPath("/repo/.yaklang/skill/auto-pentest/SKILL.md")).toBe(true)
    expect(isSkillProtectedPath("/repo/.yaklang/skill/port-scan/SKILL.md")).toBe(true)
    expect(isSkillProtectedPath("/home/user/proj/.yaklang/skill/foo/bar.md")).toBe(true)
  })

  test("isSkillProtectedPath returns true for .yaklang/skills paths", () => {
    expect(isSkillProtectedPath("/repo/.yaklang/skills/xyz/SKILL.md")).toBe(true)
  })

  test("isSkillProtectedPath returns true for .claude/skills paths", () => {
    expect(isSkillProtectedPath("/home/user/.claude/skills/helper/SKILL.md")).toBe(true)
    expect(isSkillProtectedPath("/repo/.claude/skills/foo/bar.md")).toBe(true)
  })

  test("isSkillProtectedPath returns false for normal project paths", () => {
    expect(isSkillProtectedPath("/repo/src/index.ts")).toBe(false)
    expect(isSkillProtectedPath("/repo/.yaklang/command/foo.md")).toBe(false)
    expect(isSkillProtectedPath("/repo/skill/not-under-dot-yaklang/SKILL.md")).toBe(false)
  })

  test("SKILL_PROTECTED_MESSAGE is non-empty", () => {
    expect(SKILL_PROTECTED_MESSAGE.length).toBeGreaterThan(0)
    expect(SKILL_PROTECTED_MESSAGE).toContain("read-only")
  })
})
