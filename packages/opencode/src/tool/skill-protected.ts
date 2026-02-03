import * as path from "path"

/**
 * Paths under these segments are skill directories and must not be modified by edit/write/patch.
 * Protects .opencode/skill, .opencode/skills, .claude/skills so that even if the AI tries to
 * "fix" a skill or gets an error, it cannot change skill files.
 */
const SKILL_PATH_SEGMENTS = [
  ".opencode/skill",
  ".opencode/skills",
  ".claude/skills",
]

function normalizedPathForCheck(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/")
}

/**
 * Returns true if the given absolute file path is under a protected skill directory.
 * Use this in edit, write, patch, multiedit to reject any write to skill files.
 */
export function isSkillProtectedPath(filePath: string): boolean {
  const normalized = normalizedPathForCheck(filePath)
  return SKILL_PATH_SEGMENTS.some((segment) => normalized.includes(segment))
}

/** Message to throw when a write to a skill path is attempted. */
export const SKILL_PROTECTED_MESSAGE =
  "Skill files are read-only and cannot be modified. Do not edit, write, or patch any file under .opencode/skill or .claude/skills. If a skill failed to load or has errors, report the error to the user instead of changing the skill file."
