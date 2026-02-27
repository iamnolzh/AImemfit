---
name: yak-plugins
description: Yak 官方插件库管理（pull-plugins、update-nuclei-database）。检测框架漏洞（如 ThinkPHP）请用 auto-pentest 快速模式
---

# 插件与 POC 扫描技能（Yak pull-plugins / scan）

## ⚠️ 技能优先级（必读，否则会覆盖本地技能）

**本技能不覆盖、也不替代 auto-pentest / manual-pentest 的本地脚本。**

当用户请求测试以下漏洞类型时，**不要**加载本技能，应**优先使用 auto-pentest 或 manual-pentest 中的本地脚本**（如 `file_read.yak`、`xss.yak`、`ssrf.yak`、`file_upload.yak`、`command_injection.yak`、`xxe.yak` 等）：

| 用户请求的漏洞类型     | 本地脚本（优先）                         | 本技能 |
|------------------------|------------------------------------------|--------|
| 文件读取 / LFI / 文件包含 | auto-pentest `script/file_read.yak`      | ❌ 不使用 |
| XSS                    | auto-pentest `script/xss.yak`            | ❌ 不使用 |
| SSRF                   | auto-pentest `script/ssrf.yak`           | ❌ 不使用 |
| 文件上传               | auto-pentest `script/file_upload.yak`    | ❌ 不使用 |
| 命令注入               | auto-pentest `script/command_injection.yak` | ❌ 不使用 |
| SQL 注入               | auto-pentest `script/sql_injection.yak`     | ❌ 不使用 |
| XXE                    | auto-pentest `script/xxe.yak`            | ❌ 不使用 |
| 开放重定向             | auto-pentest `script/open_redirect.yak`  | ❌ 不使用 |
| SSTI / XPath 等        | auto-pentest 对应 script                 | ❌ 不使用 |

### ⚠️ 本地脚本的调用前提：必须先爬虫获取 httpflow-id

上述本地脚本（`file_read.yak`、`xss.yak`、`ssrf.yak` 等）**全部需要传入 `--httpflow-id` 参数**，该 ID 来自 **爬虫阶段**（Yakit HTTP History 或 auto-pentest 的 `tools/crawler/crawler.yak`）。

**正确调用流程**：
1. **先执行爬虫**：加载 **auto-pentest** 或 **crawlerx** 技能，对目标 URL 执行爬虫，爬虫会把请求存入 Yakit 数据库并生成 HTTPFlow ID
2. **获取 Flow ID**：爬虫完成后，使用 **smart_filter.yak**（`tools/filter/smart_filter.yak`）筛选并输出执行计划，计划中包含每条请求的 `httpflow-id`。
3. **调用漏洞脚本**：将 Flow ID 传入脚本，例如：
   ```bash
   cd "<SKILL_BASE_DIR>" && yak script/file_read.yak --httpflow-id 12345
   ```

**错误示例**（AI 常犯）：
- ❌ 直接调用 `yak script/file_read.yak --target http://xxx`（脚本不支持 `--target`，只支持 `--httpflow-id`）
- ❌ 跳过爬虫，凭空传一个 Flow ID（数据库里没有该请求）

**正确示例**：
1. 爬虫：`yak tools/crawler/crawler.yak --targetUrl http://192.168.3.24:8081`
2. 筛选：`yak tools/filter/smart_filter.yak --target-host 192.168.3.24`
3. 漏洞检测：`yak script/file_read.yak --httpflow-id <筛选输出的ID>`

**本技能仅适用于**：用户明确请求「更新插件库」「拉取 Nuclei 模板」等**官方插件管理**场景。

**注意**：若用户说「检测 xxx 是否存在 ThinkPHP 漏洞」等明确指定框架名的请求，应使用 **auto-pentest 的快速检测模式**（查插件→执行），而非本技能。

---

当用户需要更新漏洞库、拉取 Nuclei 模板时使用此技能。

## 插件与模板拉取（pull-plugins）

从 yaklang 官方与 Nuclei 模板仓库拉取插件到本地，供 `yak scan` / `yak poc` 使用。

### 基本用法
```bash
yak pull-plugins
yak pull
```

### 指定源与代理
```bash
yak pull-plugins --base-url https://www.yaklang.com/
yak pull-plugins --nuclei-templates-url https://github.com/projectdiscovery/nuclei-templates
yak pull-plugins --proxy http://127.0.0.1:8080
```

### 相关命令（CVE/Nuclei 数据库）
```bash
yak update-nuclei-database   # 将 Nuclei 模板导入本地插件库
yak remove-nuclei-database  # 从本地移除 Nuclei 模板
```

## POC / 漏洞扫描（scan / poc）

使用已安装的插件对目标执行扫描，通常在 **Yakit** 中配置目标与插件后执行；CLI 用法以实际 `yak scan --help` / `yak poc --help` 为准。

- **yak scan** / **yak poc**：用插件（UI 在 Yakit）进行扫描。
- 先通过 `yak pull-plugins` 或 `yak update-nuclei-database` 更新插件库，再在 Yakit 中选择目标与 POC 执行。

## 典型流程

1. **更新插件库**：`yak pull-plugins` 或 `yak update-nuclei-database`。
2. **POC 扫描**：在 Yakit 中导入目标，选择对应插件执行 scan/poc；或根据 CLI 帮助在命令行指定目标与插件。
3. **若用户明确指定框架名**（如「检测 xxx 是否存在 ThinkPHP 漏洞」）：使用 **auto-pentest 快速检测模式**（query_plugin_by_fp → call_yak_plugin），不要用本技能。

## 参数速查（pull-plugins）

| 参数 | 说明 | 默认 |
|------|------|------|
| `--base-url` / `-u` | yaklang 插件服务器 URL | https://www.yaklang.com/ |
| `--nuclei-templates-url` / `-n` | Nuclei 模板仓库 URL | https://github.com/projectdiscovery/nuclei-templates |
| `--proxy` | HTTP/SOCKS 代理 | $http_proxy |

## 注意事项

- 拉取前确保网络可访问对应仓库；国内环境可配置代理或镜像。
- 扫描仅对授权目标执行；Nuclei 模板与 Yak 插件需遵守各自许可协议。
- **用户说「用 yak 插件测试 XXX 漏洞」时**：若 XXX 为文件读取、XSS、SSRF、文件上传、命令注入、XXE 等，应使用 **auto-pentest** 或 **manual-pentest** 的本地脚本（`script/file_read.yak` 等），**不要**加载本技能。本技能仅处理官方插件库的拉取与 yak scan（CVE、Nuclei 等远程 POC）。
