interface ImportMetaEnv {
  readonly VITE_YAKLANG_SERVER_HOST: string
  readonly VITE_YAKLANG_SERVER_PORT: string
}

declare global {
  interface Window {
    __YAKLANG__?: {
      serverReady?: boolean
      updaterEnabled?: boolean
      port?: number
    }
  }
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
