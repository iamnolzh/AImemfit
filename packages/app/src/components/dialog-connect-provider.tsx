import type { ProviderAuthAuthorization } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import type { IconName } from "@opencode-ai/ui/icons/provider"
import { List, type ListRef } from "@opencode-ai/ui/list"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { Spinner } from "@opencode-ai/ui/spinner"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { iife } from "@opencode-ai/util/iife"
import { createMemo, Match, onCleanup, onMount, Switch } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Link } from "@/components/link"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { usePlatform } from "@/context/platform"
import { DialogSelectModel } from "./dialog-select-model"
import { DialogSelectProvider } from "./dialog-select-provider"

export function DialogConnectProvider(props: { provider: string }) {
  const dialog = useDialog()
  const globalSync = useGlobalSync()
  const globalSDK = useGlobalSDK()
  const platform = usePlatform()
  const provider = createMemo(() => globalSync.data.provider.all.find((x) => x.id === props.provider)!)
  const methods = createMemo(
    () =>
      globalSync.data.provider_auth[props.provider] ?? [
        {
          type: "api",
          label: "API 密钥",
        },
      ],
  )
  const [store, setStore] = createStore({
    methodIndex: undefined as undefined | number,
    authorization: undefined as undefined | ProviderAuthAuthorization,
    state: "pending" as undefined | "pending" | "complete" | "error",
    error: undefined as string | undefined,
  })

  const method = createMemo(() => (store.methodIndex !== undefined ? methods().at(store.methodIndex!) : undefined))

  async function selectMethod(index: number) {
    const method = methods()[index]
    setStore(
      produce((draft) => {
        draft.methodIndex = index
        draft.authorization = undefined
        draft.state = undefined
        draft.error = undefined
      }),
    )

    if (method.type === "oauth") {
      setStore("state", "pending")
      const start = Date.now()
      await globalSDK.client.provider.oauth
        .authorize(
          {
            providerID: props.provider,
            method: index,
          },
          { throwOnError: true },
        )
        .then((x) => {
          const elapsed = Date.now() - start
          const delay = 1000 - elapsed

          if (delay > 0) {
            setTimeout(() => {
              setStore("state", "complete")
              setStore("authorization", x.data!)
            }, delay)
            return
          }
          setStore("state", "complete")
          setStore("authorization", x.data!)
        })
        .catch((e) => {
          setStore("state", "error")
          setStore("error", String(e))
        })
    }
  }

  let listRef: ListRef | undefined
  function handleKey(e: KeyboardEvent) {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      return
    }
    if (e.key === "Escape") return
    listRef?.onKeyDown(e)
  }

  onMount(() => {
    if (methods().length === 1) {
      selectMethod(0)
    }
    document.addEventListener("keydown", handleKey)
    onCleanup(() => {
      document.removeEventListener("keydown", handleKey)
    })
  })

  async function complete() {
    await globalSDK.client.global.dispose()
    dialog.close()
    showToast({
      variant: "success",
      icon: "circle-check",
      title: `已连接 ${provider().name}`,
      description: `现已可使用 ${provider().name} 的模型。`,
    })
  }

  function goBack() {
    if (methods().length === 1) {
      dialog.show(() => <DialogSelectProvider />)
      return
    }
    if (store.authorization) {
      setStore("authorization", undefined)
      setStore("methodIndex", undefined)
      return
    }
    if (store.methodIndex) {
      setStore("methodIndex", undefined)
      return
    }
    dialog.show(() => <DialogSelectProvider />)
  }

  return (
    <Dialog title={<IconButton tabIndex={-1} icon="arrow-left" variant="ghost" onClick={goBack} />}>
      <div class="flex flex-col gap-6 px-2.5 pb-3">
        <div class="px-2.5 flex gap-4 items-center">
          <ProviderIcon id={props.provider as IconName} class="size-5 shrink-0 icon-strong-base" />
          <div class="text-16-medium text-text-strong">
            <Switch>
              <Match when={props.provider === "anthropic" && method()?.label?.toLowerCase().includes("max")}>
                使用 Claude Pro/Max 登录
              </Match>
              <Match when={true}>连接 {provider().name}</Match>
            </Switch>
          </div>
        </div>
        <div class="px-2.5 pb-10 flex flex-col gap-6">
          <Switch>
            <Match when={store.methodIndex === undefined}>
              <div class="text-14-regular text-text-base">选择 {provider().name} 的登录方式。</div>
              <div class="">
                <List
                  ref={(ref) => {
                    listRef = ref
                  }}
                  items={methods}
                  key={(m) => m?.label}
                  onSelect={async (method, index) => {
                    if (!method) return
                    selectMethod(index)
                  }}
                >
                  {(i) => (
                    <div class="w-full flex items-center gap-x-2">
                      <div class="w-4 h-2 rounded-[1px] bg-input-base shadow-xs-border-base flex items-center justify-center">
                        <div class="w-2.5 h-0.5 bg-icon-strong-base hidden" data-slot="list-item-extra-icon" />
                      </div>
                      <span>{i.label}</span>
                    </div>
                  )}
                </List>
              </div>
            </Match>
            <Match when={store.state === "pending"}>
              <div class="text-14-regular text-text-base">
                <div class="flex items-center gap-x-2">
                  <Spinner />
                  <span>正在授权…</span>
                </div>
              </div>
            </Match>
            <Match when={store.state === "error"}>
              <div class="text-14-regular text-text-base">
                <div class="flex items-center gap-x-2">
                  <Icon name="circle-ban-sign" class="text-icon-critical-base" />
                  <span>授权失败：{store.error}</span>
                </div>
              </div>
            </Match>
            <Match when={method()?.type === "api"}>
              {iife(() => {
                const [formStore, setFormStore] = createStore({
                  value: "",
                  error: undefined as string | undefined,
                })

                async function handleSubmit(e: SubmitEvent) {
                  e.preventDefault()

                  const form = e.currentTarget as HTMLFormElement
                  const formData = new FormData(form)
                  const apiKey = formData.get("apiKey") as string

                  if (!apiKey?.trim()) {
                    setFormStore("error", "API key is required")
                    return
                  }

                  setFormStore("error", undefined)
                  await globalSDK.client.auth.set({
                    providerID: props.provider,
                    auth: {
                      type: "api",
                      key: apiKey,
                    },
                  })
                  await complete()
                }

                return (
                  <div class="flex flex-col gap-6">
                    <Switch>
                      <Match when={provider().id === "opencode"}>
                        <div class="flex flex-col gap-4">
                          <div class="text-14-regular text-text-base">
                            Yaklang Zen 提供精选的可靠优化模型，供编程助手使用。
                          </div>
                          <div class="text-14-regular text-text-base">
                            使用一个 API 密钥即可访问 Claude、GPT、Gemini、GLM 等模型。
                          </div>
                          <div class="text-14-regular text-text-base">
                            请访问{" "}
                            <Link href="https://opencode.ai/zen" tabIndex={-1}>
                              yaklang.ai/zen
                            </Link>{" "}
                            获取 API 密钥。
                          </div>
                        </div>
                      </Match>
                      <Match when={true}>
                        <div class="text-14-regular text-text-base">
                          输入您的 {provider().name} API 密钥以连接账户，并在 Yaklang 中使用 {provider().name} 模型。
                        </div>
                      </Match>
                    </Switch>
                    <form onSubmit={handleSubmit} class="flex flex-col items-start gap-4">
                      <TextField
                        autofocus
                        type="text"
                        label={`${provider().name} API 密钥`}
                        placeholder="API 密钥"
                        name="apiKey"
                        value={formStore.value}
                        onChange={setFormStore.bind(null, "value")}
                        validationState={formStore.error ? "invalid" : undefined}
                        error={formStore.error}
                      />
                      <Button class="w-auto" type="submit" size="large" variant="primary">
                        提交
                      </Button>
                    </form>
                  </div>
                )
              })}
            </Match>
            <Match when={method()?.type === "oauth"}>
              <Switch>
                <Match when={store.authorization?.method === "code"}>
                  {iife(() => {
                    const [formStore, setFormStore] = createStore({
                      value: "",
                      error: undefined as string | undefined,
                    })

                    onMount(() => {
                      if (store.authorization?.method === "code" && store.authorization?.url) {
                        platform.openLink(store.authorization.url)
                      }
                    })

                    async function handleSubmit(e: SubmitEvent) {
                      e.preventDefault()

                      const form = e.currentTarget as HTMLFormElement
                      const formData = new FormData(form)
                      const code = formData.get("code") as string

                      if (!code?.trim()) {
                        setFormStore("error", "请输入授权码")
                        return
                      }

                      setFormStore("error", undefined)
                      const { error } = await globalSDK.client.provider.oauth.callback({
                        providerID: props.provider,
                        method: store.methodIndex,
                        code,
                      })
                      if (!error) {
                        await complete()
                        return
                      }
                      setFormStore("error", "授权码无效")
                    }

                    return (
                      <div class="flex flex-col gap-6">
                        <div class="text-14-regular text-text-base">
                          请访问 <Link href={store.authorization!.url}>此链接</Link> 获取授权码，以连接账户并在 Yaklang 中使用 {provider().name} 模型。
                        </div>
                        <form onSubmit={handleSubmit} class="flex flex-col items-start gap-4">
                          <TextField
                            autofocus
                            type="text"
                            label={`${method()?.label} 授权码`}
                            placeholder="授权码"
                            name="code"
                            value={formStore.value}
                            onChange={setFormStore.bind(null, "value")}
                            validationState={formStore.error ? "invalid" : undefined}
                            error={formStore.error}
                          />
                          <Button class="w-auto" type="submit" size="large" variant="primary">
                            提交
                          </Button>
                        </form>
                      </div>
                    )
                  })}
                </Match>
                <Match when={store.authorization?.method === "auto"}>
                  {iife(() => {
                    const code = createMemo(() => {
                      const instructions = store.authorization?.instructions
                      if (instructions?.includes(":")) {
                        return instructions?.split(":")[1]?.trim()
                      }
                      return instructions
                    })

                    onMount(async () => {
                      const result = await globalSDK.client.provider.oauth.callback({
                        providerID: props.provider,
                        method: store.methodIndex,
                      })
                      if (result.error) {
                        // TODO: show error
                        dialog.close()
                        return
                      }
                      await complete()
                    })

                    return (
                      <div class="flex flex-col gap-6">
                        <div class="text-14-regular text-text-base">
                          请访问 <Link href={store.authorization!.url}>此链接</Link> 并输入下方代码，以连接账户并在 Yaklang 中使用 {provider().name} 模型。
                        </div>
                        <TextField label="确认码" class="font-mono" value={code()} readOnly copyable />
                        <div class="text-14-regular text-text-base flex items-center gap-4">
                          <Spinner />
                          <span>等待授权完成…</span>
                        </div>
                      </div>
                    )
                  })}
                </Match>
              </Switch>
            </Match>
          </Switch>
        </div>
      </div>
    </Dialog>
  )
}
