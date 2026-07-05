import { useGlobalSync } from "@/context/global-sync"
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { getFilename } from "@opencode-ai/util/path"

export default function Skills() {
  const sync = useGlobalSync()
  const navigate = useNavigate()
  const [query, setQuery] = createSignal("")

  const skills = createMemo(() => {
    const byName = new Map<
      string,
      {
        name: string
        description: string
        location: string
        projects: string[]
        worktree?: string
      }
    >()

    for (const project of sync.data.project) {
      const [store] = sync.child(project.worktree)
      for (const skill of store.skill) {
        const current = byName.get(skill.name)
        const projectName = project.name || getFilename(project.worktree)
        if (current) {
          if (!current.projects.includes(projectName)) current.projects.push(projectName)
          continue
        }
        byName.set(skill.name, {
          ...skill,
          projects: [projectName],
          worktree: project.worktree,
        })
      }
    }

    return [...byName.values()].toSorted((a, b) => a.name.localeCompare(b.name))
  })

  const filtered = createMemo(() => {
    const text = query().trim().toLowerCase()
    if (!text) return skills()
    return skills().filter((skill) => {
      return (
        skill.name.toLowerCase().includes(text) ||
        skill.description.toLowerCase().includes(text) ||
        skill.projects.some((project) => project.toLowerCase().includes(text))
      )
    })
  })

  function useSkill(skill: { name: string; worktree?: string }) {
    const worktree = skill.worktree ?? sync.data.project[0]?.worktree
    if (!worktree) {
      navigate("/")
      return
    }
    navigate(`/${base64Encode(worktree)}/session?prompt=${encodeURIComponent(`$${skill.name} `)}`)
  }

  return (
    <div class="flex min-h-full w-full flex-col bg-background-base px-8 py-8 text-text-strong">
      <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <div class="flex items-start justify-between gap-6">
          <div>
            <div class="text-12-medium text-[#ff5a1f]">橙锋</div>
            <h1 class="mt-2 text-[34px] font-semibold leading-tight tracking-normal text-text-strong">技能</h1>
            <p class="mt-2 text-15-regular text-text-base">查看当前项目可用技能。需要调用时，在对话输入框输入 `$技能名`。</p>
          </div>
          <Button variant="ghost" size="large" class="rounded-lg px-3 text-text-base hover:bg-surface-raised-base-hover" onClick={() => navigate("/")}>
            返回首页
          </Button>
        </div>

        <div class="mt-8 flex h-12 items-center gap-3 rounded-2xl border border-border-weak-base bg-background-base px-4 shadow-sm">
          <Icon name="bubble-5" size="small" class="text-text-weak" />
          <input
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索技能、说明或项目"
            class="min-w-0 flex-1 border-none bg-transparent text-14-regular text-text-strong outline-none placeholder:text-text-subtle"
          />
        </div>

        <div class="mt-6">
          <Switch>
            <Match when={filtered().length > 0}>
              <div class="grid gap-3 md:grid-cols-2">
                <For each={filtered()}>
                  {(skill) => (
                    <article class="rounded-2xl border border-border-weak-base bg-background-base p-4 shadow-sm transition-colors hover:border-[#ff5a1f]/35">
                      <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                          <h2 class="truncate text-16-medium text-text-strong">{skill.name}</h2>
                          <p class="mt-2 line-clamp-3 text-13-regular leading-5 text-text-base">
                            {skill.description || "暂无说明"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="normal"
                          class="shrink-0 rounded-lg px-3 text-[#ff5a1f] hover:bg-[#ff5a1f]/10"
                          onClick={() => useSkill(skill)}
                        >
                          使用
                        </Button>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <For each={skill.projects}>
                          {(project) => (
                            <span class="rounded-full bg-surface-raised-base px-2.5 py-1 text-12-regular text-text-base">
                              {project}
                            </span>
                          )}
                        </For>
                      </div>
                      <Show when={skill.location}>
                        <div class="mt-3 truncate text-12-regular text-text-weak">{skill.location}</div>
                      </Show>
                    </article>
                  )}
                </For>
              </div>
            </Match>
            <Match when={true}>
              <div class="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border-weak-base bg-background-base text-center">
                <div class="text-15-medium text-text-strong">暂无技能</div>
                <div class="mt-2 text-13-regular text-text-base">打开包含技能的项目后，这里会自动聚合展示。</div>
              </div>
            </Match>
          </Switch>
        </div>
      </main>
    </div>
  )
}
