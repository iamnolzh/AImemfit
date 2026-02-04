export * from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { OpencodeClient } from "./gen/sdk.gen.js"
export { type Config as OpencodeClientConfig, OpencodeClient }

export function createOpencodeClient(config?: Config & { directory?: string }) {
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      // @ts-ignore
      req.timeout = false
      return fetch(req)
    }
    config = {
      ...config,
      fetch: customFetch,
    }
  }

  if (config?.directory) {
    // Encode directory path to base64 to support Unicode characters (e.g., Chinese Windows usernames)
    const directoryBase64 = btoa(unescape(encodeURIComponent(config.directory)))
    config.headers = {
      ...config.headers,
      "x-opencode-directory": directoryBase64,
    }
  }

  const client = createClient(config)
  return new OpencodeClient({ client })
}
