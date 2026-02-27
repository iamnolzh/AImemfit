---
name: crawlerx
description: 基于无头浏览器的点击式爬虫，使用 yak crawlerx 对目标 URL 进行深度爬取，支持表单填充、代理、黑白名单
---

# 爬虫技能（Yak crawlerx）

当用户需要对目标站点做深度爬取、收集 URL/表单/前端路由时使用此技能。基于无头浏览器、模拟点击，适合 SPA、需登录或强依赖 JS 的站点。

## 基本用法

```bash
yak crawlerx --url <目标URL> [--output 结果文件] [其他选项...]
yak crawlerx -u https://example.com -o urls.txt
```

## 常用用法

### 1. 基础爬取并输出
```bash
yak crawlerx -u https://target.com
yak crawlerx -u https://target.com -o result.txt
```

### 2. 限制深度与数量
```bash
yak crawlerx -u https://target.com --max-depth 2 --max-url 500
```

### 3. 代理（便于配合 Yakit 抓包）
```bash
yak crawlerx -u https://target.com --proxy http://127.0.0.1:8080
```

### 4. 表单填充与文件上传占位
```bash
yak crawlerx -u https://target.com --form-fill "username:admin;password:test"
yak crawlerx -u https://target.com --file-input "file:/tmp/test.txt"
```

### 5. Cookie / Header
```bash
yak crawlerx -u https://target.com --cookie "session=xxx; token=yyy"
yak crawlerx -u https://target.com --headers "Authorization: Bearer xxx;"
```

### 6. 黑白名单
```bash
yak crawlerx -u https://target.com --whitelist "target.com,api.target.com"
yak crawlerx -u https://target.com --blacklist "logout,delete,admin/delete"
```

### 7. 超时与并发
```bash
yak crawlerx -u https://target.com --page-timeout 60 --full-timeout 3600 --concurrent 4
```

### 8. 范围与去重
```bash
yak crawlerx -u https://target.com --range-level 1
yak crawlerx -u https://target.com --repeat-level 2 --ignore-query "sid,csrf"
```

## 参数速查

| 参数 | 说明 | 默认 |
|------|------|------|
| `--url` / `-u` | 爬取入口 URL | 必填 |
| `--output` / `-o` | 结果输出文件 |  stdout |
| `--proxy` | HTTP/SOCKS 代理 | - |
| `--max-url` | 最大 URL 数量，0 不限 | 0 |
| `--max-depth` | 最大深度 | 3 |
| `--concurrent` | 并发数 | 2 |
| `--page-timeout` | 单页超时（秒） | 30 |
| `--full-timeout` | 整站超时（秒） | 1800 |
| `--form-fill` | 表单填充，格式 KEYWORD:VALUE; | - |
| `--file-input` | 文件输入占位 KEYWORD:FILEPATH; | - |
| `--headers` | 请求头 KEY:VALUE; | - |
| `--cookie` | Cookie | - |
| `--whitelist` | 白名单域名，逗号分隔 | - |
| `--blacklist` | 黑名单 URL 关键词，逗号分隔 | - |
| `--range-level` | 0 主域 / 1 子域 | 0 |
| `--repeat-level` | 去重级别 0–4 | 1 |
| `--ignore-query` | 去重时忽略的 query 参数 | - |
| `--sensitive-word` | 不点击包含该词的元素 | - |
| `--local-storage` | 本地存储 KEY:VALUE; | - |
| `--browser-path` | 指定浏览器可执行文件路径 | - |
| `--ws` | 已有浏览器 WS 地址 | - |

## 输出与后续

- 输出为每行一个 URL，可直接作为目录扫描、漏洞扫描的输入。
- 可与 **Yakit** 抓包配合：爬虫走代理，在 Yakit 中查看/重放请求。
- 可与 **auto-pentest**、**manual-pentest** 衔接：先爬取再对关键 URL 做漏洞检测。
- **注意**：若需将爬取结果交给 auto-pentest 的 `script/*.yak`（需 `--httpflow-id`），应使用 **auto-pentest** 的 `tools/crawler/crawler.yak`（会将请求写入 Yakit 数据库）；本技能 `yak crawlerx` 输出为 URL 列表，不直接写入 HTTP History，无法直接供 script/*.yak 使用。

## 注意事项

- 仅对授权目标使用；注意 `--max-url`/`--full-timeout` 避免长时间占用。
- 需登录时使用 `--cookie` 或 `--form-fill` 传入凭据。
