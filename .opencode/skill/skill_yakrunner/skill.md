---
name: yak-plugin-write
description: 写 Yak/Yakit 漏洞检测插件时必用。编写任意类型插件（SQL 注入、XSS、SSRF、文件读写、命令注入等）与 POC、risk 上报；含脚本骨架、risktype、script 案例与 API 易错点
---

# Yak 插件编写技能

**何时必须使用本 skill**：用户要写**任意类型的 yak 漏洞检测插件**（如 SQL 注入、XSS、SSRF、命令注入、文件读写、XXE、SSTI 等）、yak 插件、Yaklang POC 时，**必须先调用本 skill 加载本文档**，再按文档中的 `script/*.yak` 案例与 `语法/risktype.txt` 编写，不要仅凭 yak-plugins 或通用 Web 漏洞描述写插件。

当用户需要**编写或修改 Yaklang/Yakit 插件脚本**（漏洞检测、POC、风险上报）时使用本技能。插件即可在 Yakit 中运行的 `.yak` 脚本，通常从 HTTP 历史取请求、枚举参数、检测漏洞并调用 `risk.NewRisk` 上报。

## 工作目录与必须参考（不可跳过）

以下路径均相对于**本 skill 的 Base directory**（调用 skill 工具后返回的「Base directory」即本技能所在目录）。

| 用途 | 路径 |
|------|------|
| 风险类型合法值 | `语法/risktype.txt` |
| 函数/模块签名、补全 | `语法/yaklang-completion.json` |
| 脚本结构与范式 | `script/*.yak` |

- 编写或修改插件前，必须先查阅 `risktype.txt` 确定 `risk.type(...)` 的取值；从 `yaklang-completion.json` 检索所需函数/模块，不要臆造 API。
- 脚本结构必须参考 `script/` 下现有脚本（如 `command_injection.yak`、`file_read.yak`、`ssrf.yak`、`xss.yak` 等），复用其 CLI、输出、主流程与上报方式。

## 何时使用

- 用户要写/改**任意类型的 yak 漏洞检测插件**（SQL 注入、XSS、SSRF、命令注入、文件读写、XXE、SSTI 等）或 POC 脚本
- 用户要写/改 Yak 或 Yakit 插件脚本
- 用户需要补齐或修正 `risk.NewRisk` 上报字段

## 插件脚本骨架（遵循 script/*.yak）

1. **头部元信息**
   - `__DESC__`：简短描述
   - `__VERBOSE_NAME__`：展示用名称
   - `__KEYWORDS__`：逗号分隔关键词

2. **CLI 参数**
   - 必须包含 `httpflow-id`（从历史取请求），例如：`cli.String("httpflow-id", cli.setRequired(true))`，末尾 `cli.check()`。

3. **输出**
   - 使用 `yakit.AIOutput(msg)` 输出；失败时回退到 `println(msg)`（可用 `aiOut = msg => { try { yakit.AIOutput(msg) } catch { println(msg) } }`）。

4. **主流程**
   - 根据 `httpflow-id` 取 HTTPFlow → 解析请求（`fuzz.HTTPRequest`）→ 枚举参数（`GetCommonParams()`）→ 对每个参数做检测 → 命中则 `risk.NewRisk(...)` 上报。

## 风险类型速查（必须来自 risktype.txt）

| 类别 | 合法 type 示例 |
|------|----------------|
| SQL 注入 | `sqli`, `sqlinj`, `sql-injection` |
| 跨站脚本 | `xss` |
| 远程执行 | `rce`, `rce-command`, `rce-code` |
| 文件操作 | `lfi`, `file-read`, `file-upload`, `file-download`, `rfi`, `file-write` |
| 其他注入 | `xxe`, `ssti` |
| 序列化 | `unserialize`, `deserialization` |
| 访问控制 | `unauth-access`, `auth-bypass`, `privilege-escalation` |
| 信息泄露 | `path-traversal`, `info-exposure`, `information-exposure` |
| 配置/凭证 | `insecure-default`, `weak-pass`, `weak-password` |
| 逻辑漏洞 | `logic` |
| SSRF/CSRF | `ssrf`, `csrf` |
| 反连检测 | `reverse-tcp`, `reverse-http`, `reverse-dns` 等 |

完整列表以**本技能目录下** `语法/risktype.txt` 为准；**禁止**使用该文件中不存在的 type。

## risk.NewRisk 规范与检查清单

- `risk.title(...)`、`risk.titleVerbose(...)`：必填
- `risk.severity(...)`：`low` | `medium` | `high` | `critical`
- `risk.type(...)`：必须来自 `risktype.txt`
- `risk.payload(...)`：实际触发漏洞的 payload
- `risk.request(...)`、`risk.response(...)`：原始字节（如 `res.RequestRaw`、`res.ResponseRaw`），**缺一不可**
- `risk.description(...)`、`risk.solution(...)`：建议填写，内容具体可执行

## API 易错点（编写时必查）

| 错误用法 | 正确用法 |
|----------|----------|
| `freq.ExecFirst(fuzz.timeout(5))`（无 timeout 参数） | `freq.ExecFirst()`，超时用其他方式控制 |
| 用 `str.MatchAllOfRegexp` 的返回值当数组取 `len(matches)` | 匹配用 `str.MatchAnyOfRegexp`（返回 bool）；提取多组用 `re.FindAll`（返回 `[]string`） |
| 只对 GET 参数 Fuzz，漏掉 POST/Cookie | 用 `freq.GetCommonParams()` 获取全部参数，再用 `param.Fuzz(payload).ExecFirst()` |
| 使用 `res.StatusCode` 等不存在的字段 | 状态码用 `poc.GetStatusCodeFromResponse(res.ResponseRaw)`；Body 用 `str.ExtractBodyFromHTTPResponseRaw(res.ResponseRaw)` |
| 臆造 `dnslog.NewDNSLogDomain()` | DNSLog 在 `risk` 模块：`risk.NewDNSLogDomain()`、`risk.CheckDNSLogByToken(token)` |

响应对象可用字段：`res.RequestRaw`、`res.ResponseRaw`、`res.Url`、`res.DurationMs`。

## 检测逻辑设计

- **分层检测（快→慢）**：先快速特征/报错注入，再布尔盲注，最后时间盲注或带外（DNSLog）。尽早 `return` 可提高效率。
- **无回显场景**：阶段一未命中时不要直接 `return nil`，应继续尝试带外或其它方法。
- **阈值与多维度判断**：
  - 响应差异：建议百分比阈值 3%–5%，并加绝对值（如 > 20 bytes）；可配合关键词（success/error 等）减少误报。
  - 时间盲注：考虑网络延迟，常用 0.8–1.5 秒量级。
  - 避免仅靠单一维度（如仅长度差）判定，宜结合长度、内容关键词、时间等多维判断。

## 参数过滤建议

对 `GetCommonParams()` 得到的参数，可跳过明显与漏洞无关的项，例如：`page`、`limit`、`csrf`、`token`、`lang`、`PHPSESSID`、`JSESSIONID` 等（用正则或列表过滤），减少无效请求。

## 测试与验证（必须执行）

1. **语法**：`yak script/xxx.yak --help` 无报错。
2. **运行**：使用 `yak script/xxx.yak --httpflow-id <id>` 或按脚本要求的参数（如 `--root_url`）执行。
3. 若报错，必须先修复再交付；交付时给出**最短运行命令**和**期望输出**说明。

## 案例驱动建议

| 需求 | 参考脚本 |
|------|----------|
| 命令注入、多阶段检测、回显/时间/DNSLog | `script/command_injection.yak` |
| SQL 注入、XSS 等注入类检测 | 参考 `script/command_injection.yak`、`script/xss.yak` 的分层与参数 Fuzz，type 用 `sqli`、`xss` 等（见 risktype.txt） |
| 路径遍历、OS 路径处理 | `script/file_read.yak` |
| 文件上传、可访问性校验 | `script/file_upload.yak` |
| Payload 循环与响应匹配、SSRF | `script/ssrf.yak` |
| XSS 等 Web 漏洞检测与上报 | `script/xss.yak` |

## 红旗（必须修正）

- `risk.type(...)` 使用了 `risktype.txt` 中不存在的值
- 上报缺少 `risk.request(...)` 或 `risk.response(...)`
- 未提供 CLI 参数 `httpflow-id`（或脚本约定的其他必填参数）
- 脚本结构与 `script/*.yak` 范式严重偏离且未说明原因
- 未做运行测试就声称脚本可用

## 规避借口表

| 借口 | 事实 |
|------|------|
| “可以自定义 risk 类型” | 必须使用 `risktype.txt` 中的类型 |
| “不需要看案例” | 需复用 `script/*.yak` 保证一致性与可运行 |
| “补全文件太大” | 只按需检索 `yaklang-completion.json` 中的符号 |

## 最小脚本模板（复制后按需改）

```yak
__DESC__ = "漏洞检测工具，支持 xxx 检测"
__VERBOSE_NAME__ = "XXX 漏洞检测"
__KEYWORDS__ = "xxx,detection,security"

flowIDStr = cli.String("httpflow-id", cli.setRequired(true))
cli.check()

aiOut = msg => { try { yakit.AIOutput(msg) } catch { println(msg) } }

// 检测与上报逻辑参考 script/*.yak
flowID = parseInt(flowIDStr)
flow = db.QueryHTTPFlowsByID(flowID) |> first
if flow == nil { return }
reqBytes = flow.GetRequest()
freq, _ = fuzz.HTTPRequest(reqBytes, fuzz.https(flow.IsHTTPS))

for param in freq.GetCommonParams() {
    // 过滤无关参数后...
    res, err = param.Fuzz(payload).ExecFirst()
    if err != nil { continue }
    if 检测到漏洞(res) {
        risk.NewRisk(flow.Url, risk.type("sqli"), risk.severity("high"),
            risk.payload(payload), risk.request(res.RequestRaw), risk.response(res.ResponseRaw),
            risk.title("..."), risk.titleVerbose("..."), risk.description("..."), risk.solution("..."))
    }
}
```
