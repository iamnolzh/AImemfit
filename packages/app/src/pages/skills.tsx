import { useGlobalSync } from "@/context/global-sync"
import { useGlobalSDK } from "@/context/global-sdk"
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { getFilename } from "@opencode-ai/util/path"
import { showToast } from "@opencode-ai/ui/toast"

type SkillItem = {
  name: string
  description: string
  location: string
  editable?: boolean
  projects: string[]
  worktree?: string
}

type FormMode = "create" | "edit" | "view"

export default function Skills() {
  const sync = useGlobalSync()
  const globalSDK = useGlobalSDK()
  const navigate = useNavigate()
  const [query, setQuery] = createSignal("")
  const [mode, setMode] = createSignal<FormMode | undefined>()
  const [originalName, setOriginalName] = createSignal("")
  const [formProject, setFormProject] = createSignal("")
  const [formName, setFormName] = createSignal("")
  const [formDescription, setFormDescription] = createSignal("")
  const [formContent, setFormContent] = createSignal("")
  const [saving, setSaving] = createSignal(false)

  const projects = createMemo(() =>
    sync.data.project.map((project) => ({
      name: project.name || getFilename(project.worktree) || project.worktree,
      worktree: project.worktree,
    })),
  )

  const skills = createMemo(() => {
    const byName = new Map<string, SkillItem>()

    for (const project of sync.data.project) {
      const [store] = sync.child(project.worktree)
      for (const skill of store.skill) {
        const current = byName.get(skill.name)
        const projectName = project.name || getFilename(project.worktree) || project.worktree
        if (current) {
          if (!current.projects.includes(projectName)) current.projects.push(projectName)
          if (!current.editable && skill.editable) {
            current.editable = skill.editable
            current.worktree = project.worktree
            current.location = skill.location
          }
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

  function errorMessage(err: unknown) {
    if (err && typeof err === "object" && "data" in err) {
      const data = (err as { data?: { message?: string } }).data
      if (data?.message) return data.message
    }
    if (err instanceof Error) return err.message
    return "请求失败"
  }

  function useSkill(skill: { name: string; worktree?: string }) {
    const worktree = skill.worktree ?? sync.data.project[0]?.worktree
    if (!worktree) {
      navigate("/")
      return
    }
    navigate(`/${base64Encode(worktree)}/session?prompt=${encodeURIComponent(`$${skill.name} `)}`)
  }

  function resetForm() {
    setMode(undefined)
    setOriginalName("")
    setFormProject("")
    setFormName("")
    setFormDescription("")
    setFormContent("")
  }

  function createSkill() {
    const project = projects()[0]
    setMode("create")
    setOriginalName("")
    setFormProject(project?.worktree ?? "")
    setFormName("")
    setFormDescription("")
    setFormContent("")
  }

  async function openSkill(skill: SkillItem, nextMode: FormMode) {
    if (!skill.worktree) return
    setSaving(true)
    try {
      const detail = await globalSDK.client.app.skillGet({ name: skill.name, directory: skill.worktree }).then((x) => x.data)
      if (!detail) return
      setMode(nextMode)
      setOriginalName(detail.name)
      setFormProject(skill.worktree)
      setFormName(detail.name)
      setFormDescription(detail.description)
      setFormContent(detail.content)
    } catch (err) {
      showToast({ title: "读取技能失败", description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function saveSkill() {
    const directory = formProject()
    if (!directory) {
      showToast({ title: "请选择项目" })
      return
    }
    if (!formName().trim() || !formDescription().trim()) {
      showToast({ title: "请填写技能名称和说明" })
      return
    }

    setSaving(true)
    try {
      const body = {
        name: formName().trim(),
        description: formDescription().trim(),
        content: formContent(),
      }
      if (mode() === "create") {
        await globalSDK.client.app.skillCreate({ directory, body })
      } else {
        await globalSDK.client.app.skillUpdate({ directory, name: originalName(), body })
      }
      await sync.skill.load(directory)
      showToast({ title: mode() === "create" ? "技能已创建" : "技能已保存" })
      resetForm()
    } catch (err) {
      showToast({ title: "保存技能失败", description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function deleteSkill(skill: SkillItem) {
    if (!skill.worktree || !skill.editable) return
    const confirmed = window.confirm(`删除技能「${skill.name}」？该操作会删除项目内对应的 SKILL.md。`)
    if (!confirmed) return

    setSaving(true)
    try {
      await globalSDK.client.app.skillDelete({ directory: skill.worktree, name: skill.name })
      await sync.skill.load(skill.worktree)
      showToast({ title: "技能已删除" })
      if (originalName() === skill.name) resetForm()
    } catch (err) {
      showToast({ title: "删除技能失败", description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="flex min-h-full w-full flex-col bg-background-base px-8 py-8 text-text-strong">
      <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <div class="flex items-start justify-between gap-6">
          <div>
            <h1 class="text-[34px] font-semibold leading-tight tracking-normal text-text-strong">技能</h1>
            <p class="mt-2 text-15-regular text-text-base">
              管理当前项目可用技能。需要调用时，在对话输入框输入 `$技能名`。
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="large" class="rounded-lg px-3 text-text-base hover:bg-background-stronger" onClick={createSkill}>
              新建技能
            </Button>
            <Button variant="ghost" size="large" class="rounded-lg px-3 text-text-base hover:bg-background-stronger" onClick={() => navigate("/")}>
              返回首页
            </Button>
          </div>
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

        <Show when={mode()}>
          <section class="mt-6 rounded-2xl border border-border-weak-base bg-background-base p-5 shadow-sm">
            <div class="flex items-center justify-between gap-4">
              <h2 class="text-18-medium text-text-strong">
                <Switch>
                  <Match when={mode() === "create"}>新建技能</Match>
                  <Match when={mode() === "edit"}>编辑技能</Match>
                  <Match when={true}>查看技能</Match>
                </Switch>
              </h2>
              <Button variant="ghost" size="normal" class="rounded-lg px-3 text-text-base hover:bg-background-stronger" onClick={resetForm}>
                关闭
              </Button>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <label class="flex flex-col gap-2">
                <span class="text-12-medium text-text-base">项目</span>
                <select
                  value={formProject()}
                  disabled={mode() !== "create"}
                  onChange={(event) => setFormProject(event.currentTarget.value)}
                  class="h-10 rounded-lg border border-border-weak-base bg-background-base px-3 text-14-regular text-text-strong outline-none disabled:text-text-weak"
                >
                  <For each={projects()}>
                    {(project) => <option value={project.worktree}>{project.name}</option>}
                  </For>
                </select>
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-12-medium text-text-base">技能名称</span>
                <input
                  value={formName()}
                  disabled={mode() === "view"}
                  onInput={(event) => setFormName(event.currentTarget.value)}
                  placeholder="例如 web-pentest"
                  class="h-10 rounded-lg border border-border-weak-base bg-background-base px-3 text-14-regular text-text-strong outline-none placeholder:text-text-subtle disabled:text-text-weak"
                />
              </label>
            </div>

            <label class="mt-4 flex flex-col gap-2">
              <span class="text-12-medium text-text-base">说明</span>
              <textarea
                value={formDescription()}
                disabled={mode() === "view"}
                onInput={(event) => setFormDescription(event.currentTarget.value)}
                placeholder="说明这个技能适合什么任务"
                class="h-20 resize-none rounded-lg border border-border-weak-base bg-background-base px-3 py-2 text-14-regular text-text-strong outline-none placeholder:text-text-subtle disabled:text-text-weak"
              />
            </label>

            <label class="mt-4 flex flex-col gap-2">
              <span class="text-12-medium text-text-base">内容</span>
              <textarea
                value={formContent()}
                disabled={mode() === "view"}
                onInput={(event) => setFormContent(event.currentTarget.value)}
                placeholder="写入技能正文，系统会自动生成 frontmatter。"
                class="min-h-64 resize-y rounded-lg border border-border-weak-base bg-background-base px-3 py-2 font-mono text-13-regular leading-5 text-text-strong outline-none placeholder:text-text-subtle disabled:text-text-weak"
              />
            </label>

            <Show when={mode() !== "view"}>
              <div class="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="normal" class="rounded-lg px-3 text-text-base hover:bg-background-stronger" onClick={resetForm}>
                  取消
                </Button>
                <Button size="normal" class="rounded-lg px-3" disabled={saving()} onClick={saveSkill}>
                  保存
                </Button>
              </div>
            </Show>
          </section>
        </Show>

        <div class="mt-6">
          <Switch>
            <Match when={filtered().length > 0}>
              <div class="grid gap-3 md:grid-cols-2">
                <For each={filtered()}>
                  {(skill) => (
                    <article class="rounded-2xl border border-border-weak-base bg-background-base p-4 shadow-sm transition-colors hover:border-border-base">
                      <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                          <h2 class="truncate text-16-medium text-text-strong">{skill.name}</h2>
                          <p class="mt-2 line-clamp-3 text-13-regular leading-5 text-text-base">
                            {skill.description || "暂无说明"}
                          </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="normal" class="rounded-lg px-3 text-[#ff5a1f] hover:bg-[#ff5a1f]/10" onClick={() => useSkill(skill)}>
                            使用
                          </Button>
                          <Button variant="ghost" size="normal" class="rounded-lg px-3 text-text-base hover:bg-background-stronger" disabled={saving()} onClick={() => openSkill(skill, skill.editable ? "edit" : "view")}>
                            {skill.editable ? "编辑" : "查看"}
                          </Button>
                          <Show when={skill.editable}>
                            <Button variant="ghost" size="normal" class="rounded-lg px-3 text-text-base hover:bg-background-stronger" disabled={saving()} onClick={() => deleteSkill(skill)}>
                              删除
                            </Button>
                          </Show>
                        </div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <For each={skill.projects}>
                          {(project) => (
                            <span class="rounded-full bg-background-stronger px-2.5 py-1 text-12-regular text-text-base">
                              {project}
                            </span>
                          )}
                        </For>
                        <Show when={!skill.editable}>
                          <span class="rounded-full bg-background-stronger px-2.5 py-1 text-12-regular text-text-weak">
                            只读
                          </span>
                        </Show>
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
                <Button class="mt-4 rounded-lg px-3" onClick={createSkill}>
                  新建技能
                </Button>
              </div>
            </Match>
          </Switch>
        </div>
      </main>
    </div>
  )
}
