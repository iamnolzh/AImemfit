import { useGlobalSync } from "@/context/global-sync"
import { createMemo, createSignal, For, Match, ParentProps, Show, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"
import { SDKProvider, useSDK } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider, useLocal } from "@/context/local"
import { DataProvider } from "@opencode-ai/ui/context"
import { Select } from "@opencode-ai/ui/select"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { ModelSelectorPopover } from "@/components/dialog-select-model"
import { DialogSelectModelUnpaid } from "@/components/dialog-select-model-unpaid"
import { useProviders } from "@/hooks/use-providers"
import { useCommand } from "@/context/command"

function HomeProjectData(props: ParentProps<{ directory: string }>) {
  const sync = useSync()
  const sdk = useSDK()

  return (
    <DataProvider
      data={sync.data}
      directory={props.directory}
      onPermissionRespond={(input) => sdk.client.permission.respond(input)}
      onNavigateToSession={() => undefined}
    >
      <LocalProvider>{props.children}</LocalProvider>
    </DataProvider>
  )
}

function HomeProjectProvider(props: ParentProps<{ directory: string }>) {
  return (
    <SDKProvider directory={props.directory}>
      <SyncProvider>
        <HomeProjectData directory={props.directory}>{props.children}</HomeProjectData>
      </SyncProvider>
    </SDKProvider>
  )
}

function ComposerControls(props: {
  prompt: string
  onChooseProject: () => void
  onSend: (settings: { agent?: string; providerID?: string; modelID?: string; variant?: string }) => void | Promise<void>
}) {
  const local = useLocal()
  const providers = useProviders()
  const dialog = useDialog()
  const command = useCommand()

  const currentModel = createMemo(() => local.model.current())
  const currentAgent = createMemo(() => local.agent.current())

  function submit() {
    const model = currentModel()
    props.onSend({
      agent: currentAgent()?.name,
      providerID: model?.provider.id,
      modelID: model?.id,
      variant: local.model.variant.current(),
    })
  }

  return (
    <>
      <div class="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="normal"
          class="size-8 shrink-0 rounded-full p-0 text-text-weak hover:bg-surface-raised-base-hover"
          onClick={props.onChooseProject}
          title="打开项目"
        >
          <Icon name="plus" size="large" />
        </Button>
        <TooltipKeybind placement="top" title="切换模式" keybind={command.keybind("agent.cycle")}>
          <Select
            options={local.agent.list().map((agent) => agent.name)}
            current={currentAgent()?.name ?? ""}
            onSelect={local.agent.set}
            class="capitalize"
            variant="ghost"
          />
        </TooltipKeybind>
        <Show
          when={providers.paid().length > 0}
          fallback={
            <TooltipKeybind placement="top" title="选择模型" keybind={command.keybind("model.choose")}>
              <Button as="div" variant="ghost" onClick={() => dialog.show(() => <DialogSelectModelUnpaid />)}>
                {currentModel()?.name ?? "选择模型"}
                <Icon name="chevron-down" size="small" />
              </Button>
            </TooltipKeybind>
          }
        >
          <ModelSelectorPopover>
            <TooltipKeybind placement="top" title="选择模型" keybind={command.keybind("model.choose")}>
              <Button as="div" variant="ghost">
                {currentModel()?.name ?? "选择模型"}
                <Icon name="chevron-down" size="small" />
              </Button>
            </TooltipKeybind>
          </ModelSelectorPopover>
        </Show>
        <Show when={local.model.variant.list().length > 0}>
          <TooltipKeybind placement="top" title="思考强度" keybind={command.keybind("model.variant.cycle")}>
            <Button variant="ghost" onClick={() => local.model.variant.cycle()}>
              <span class="capitalize text-12-regular">{local.model.variant.current() ?? "Default"}</span>
            </Button>
          </TooltipKeybind>
        </Show>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <Tooltip placement="top" value={props.prompt.trim() ? "发送" : "输入任务后发送"}>
          <Button
            variant="ghost"
            size="normal"
            class="size-10 rounded-full bg-[#ff5a1f] p-0 text-white shadow-[0_6px_18px_rgba(255,90,31,0.28)] hover:bg-[#e84b14] disabled:opacity-50"
            disabled={!props.prompt.trim()}
            onClick={submit}
          >
            <Icon name="arrow-up" size="large" />
          </Button>
        </Tooltip>
      </div>
    </>
  )
}

export default function Home() {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const homedir = createMemo(() => sync.data.path.home)
  const [prompt, setPrompt] = createSignal("")
  const [selectedWorktree, setSelectedWorktree] = createSignal<string | undefined>()
  const projects = createMemo(() =>
    sync.data.project
      .toSorted((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 8),
  )
  const activeProject = createMemo(() => {
    const selected = selectedWorktree()
    if (selected) return sync.data.project.find((project) => project.worktree === selected) ?? projects()[0]
    return projects()[0]
  })

  function selectProject(directory: string) {
    layout.projects.open(directory)
    setSelectedWorktree(directory)
  }

  function openProject(directory: string, settings?: { agent?: string; providerID?: string; modelID?: string; variant?: string }) {
    selectProject(directory)
    const text = prompt().trim()
    const query = new URLSearchParams()
    if (text) {
      query.set("prompt", text)
      query.set("autosend", "1")
    }
    if (settings?.agent) query.set("agent", settings.agent)
    if (settings?.providerID) query.set("provider", settings.providerID)
    if (settings?.modelID) query.set("model", settings.modelID)
    if (settings?.variant) query.set("variant", settings.variant)
    const suffix = query.toString() ? `?${query.toString()}` : ""
    navigate(`/${base64Encode(directory)}/session${suffix}`)
  }

  async function startSession(settings?: { agent?: string; providerID?: string; modelID?: string; variant?: string }) {
    if (!prompt().trim()) return
    const project = activeProject()
    if (!project) {
      await chooseProject({ startAfterSelect: true, settings })
      return
    }
    openProject(project.worktree, settings)
  }

  async function chooseProject(options?: {
    startAfterSelect?: boolean
    settings?: { agent?: string; providerID?: string; modelID?: string; variant?: string }
  }) {
    function resolve(result: string | string[] | null) {
      const directory = Array.isArray(result) ? result[0] : result
      if (!directory) return

      if (options?.startAfterSelect) {
        openProject(directory, options.settings)
        return
      }

      selectProject(directory)
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: "打开项目",
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  return (
    <div class="flex min-h-full w-full flex-col bg-background-base px-6 py-5 text-text-strong">
      <div class="flex items-center justify-end gap-2">
        <Button
          size="normal"
          variant="ghost"
          class="rounded-full px-3 text-12-regular text-text-weak hover:bg-surface-raised-base-hover"
          onClick={() => dialog.show(() => <DialogSelectServer />)}
        >
          <div
            classList={{
              "size-2 rounded-full": true,
              "bg-icon-success-base": server.healthy() === true,
              "bg-icon-critical-base": server.healthy() === false,
              "bg-border-weak-base": server.healthy() === undefined,
            }}
          />
          {server.name}
        </Button>
      </div>

      <main class="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center pb-16">
        <section class="flex flex-col items-center">
          <div class="mb-8 flex flex-col items-center gap-4">
            <img src="/chengfeng-mark.png" alt="" class="size-20 rounded-2xl object-contain shadow-sm" />
            <div class="text-center">
              <div class="text-[38px] font-semibold leading-none tracking-normal text-text-strong">橙锋</div>
            </div>
          </div>

          <div class="mb-8 text-center text-[26px] font-medium leading-9 tracking-normal text-text-strong md:text-[30px] md:leading-10">
            洞见攻击路径，守护管网安全。
          </div>

          <div class="w-full max-w-3xl overflow-hidden rounded-3xl border border-border-weak-base bg-background-base shadow-[0_22px_70px_rgba(24,28,20,0.09)]">
            <textarea
              value={prompt()}
              onInput={(event) => setPrompt(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                  const target = event.currentTarget
                  const start = target.selectionStart
                  const end = target.selectionEnd
                  event.preventDefault()
                  setPrompt(`${prompt().slice(0, start)}\n${prompt().slice(end)}`)
                  queueMicrotask(() => {
                    target.selectionStart = start + 1
                    target.selectionEnd = start + 1
                  })
                  return
                }
                event.preventDefault()
                if (activeProject()) {
                  void startSession()
                }
              }}
              placeholder="随心输入"
              class="h-28 w-full resize-none border-none bg-transparent px-5 py-4 text-15-regular text-text-strong outline-none placeholder:text-text-subtle"
            />
            <div class="flex min-h-12 items-center justify-between gap-3 border-t border-border-weak-base px-4 py-3">
              <Show
                when={activeProject()}
                fallback={
                  <>
                    <Button
                      variant="ghost"
                      size="normal"
                      class="size-8 shrink-0 rounded-full p-0 text-text-weak hover:bg-surface-raised-base-hover"
                      onClick={() => void chooseProject()}
                    >
                      <Icon name="plus" size="large" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="normal"
                      class="size-10 rounded-full bg-[#ff5a1f] p-0 text-white shadow-[0_6px_18px_rgba(255,90,31,0.28)] hover:bg-[#e84b14]"
                      onClick={() => void chooseProject()}
                    >
                      <Icon name="arrow-up" size="large" />
                    </Button>
                  </>
                }
              >
                {(project) => (
                  <HomeProjectProvider directory={project().worktree}>
                    <ComposerControls prompt={prompt()} onChooseProject={() => void chooseProject()} onSend={startSession} />
                  </HomeProjectProvider>
                )}
              </Show>
            </div>
          </div>

          <div class="mt-3 flex w-full max-w-3xl items-center gap-2 rounded-2xl bg-background-stronger px-5 py-3 text-13-regular text-text-base">
            <Icon name="folder" size="small" class="shrink-0 text-text-weak" />
            <span class="truncate">{activeProject()?.worktree.replace(homedir(), "~") ?? "打开一个项目开始"}</span>
          </div>

          <div class="mt-7 w-full max-w-3xl">
            <Switch>
              <Match when={projects().length > 0}>
                <div class="flex flex-col divide-y divide-border-weak-base">
                  <For each={projects().slice(0, 3)}>
                    {(project, index) => (
                      <button
                        class="group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-surface-raised-base-hover"
                        onClick={() => selectProject(project.worktree)}
                      >
                        <Icon
                          name={index() === 0 ? "folder" : "bubble-5"}
                          size="small"
                          class="shrink-0 text-text-weak"
                        />
                        <span class="min-w-0 flex-1 truncate text-14-regular text-text-base">
                          {project.worktree.replace(homedir(), "~")}
                        </span>
                        <span class="shrink-0 text-13-regular text-text-weak">
                          <Show when={DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}>
                            {(relative) => relative()}
                          </Show>
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Match>
              <Match when={true}>
                <button
                  class="flex w-full items-center gap-3 border-t border-border-weak-base px-4 py-3 text-left text-14-regular text-text-base hover:bg-surface-raised-base-hover"
                  onClick={() => void chooseProject()}
                >
                  <Icon name="folder-add-left" size="small" class="text-text-weak" />
                  打开项目
                </button>
              </Match>
            </Switch>
          </div>
        </section>
      </main>
    </div>
  )
}
