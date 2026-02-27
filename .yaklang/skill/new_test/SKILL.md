---
name: web-pentest-yaklang
description: 使用 Yaklang 引擎进行 Web 应用渗透测试，聚焦逻辑漏洞与通用漏洞检测。当用户需要进行 Web 渗透测试、安全评估、漏洞检测时使用此 Skill。
---
# Web 应用渗透测试 (Yaklang)

## 执行约束（防止模型遗漏）

获取凭证后必做：带认证重新爬取、越权测试、文件操作测试（download/upload 接口）。发现含 download/file/path/upload 的接口必须优先测路径穿越/任意上传。每个接口每个参数至少尝试 SQL 注入 `'` 初筛。

## 跨平台约定

本 Skill 同时支持 macOS/Linux 和 Windows 环境。执行前需根据操作系统确定以下差异项：

| 项目 | macOS / Linux | Windows (CMD) | Windows (PowerShell) |
|------|--------------|---------------|---------------------|
| 临时目录 | `/tmp/` | `%TEMP%\` | `$env:TEMP\` |
| 写文件 | `cat > file << 'EOF' ... EOF` | 用 Yaklang 脚本 `file.Save` 写入 | 用 Yaklang 脚本 `file.Save` 写入 |
| 追加写文件 | `echo "..." >> file` | 用 Yaklang 脚本追加写入 | 用 Yaklang 脚本追加写入 |
| 删除文件 | `rm -f file` | `del /f file 2>nul` | `Remove-Item file -ErrorAction SilentlyContinue` |
| 清空文件 | `> file` | `type nul > file` | `Set-Content file -Value $null` |

**后续文档中所有 `/tmp/` 路径均为示意**，实际执行时替换为当前系统的临时目录。建议在临时目录下创建 `pentest_work` 子目录集中存放所有中间文件，检测结束后统一清理。

## Yaklang 语法规范

**语法参考文件**：`yaklang-completion.json`（位于 skill 同目录下）包含 Yaklang 全部可用函数和库的定义。编写脚本时如果不确定某个函数是否存在或用法是否正确，必须先查询该文件确认，遇到语法报错时也应查询该文件找到正确写法后修改。

**shell 引号规则（极其重要）**：

在 macOS/Linux 上，`yak -c '...'` 外层使用单引号包裹脚本，因此脚本内部**不能直接出现单引号**，否则 shell 会提前截断导致报错（典型报错：`open OR: no such file or directory`）。

在 Windows CMD 上，`yak -c "..."` 外层使用双引号，脚本内部的双引号需要用 `\"` 转义，单引号无需处理。

**通用解决方案（推荐，跨平台一致）**：当脚本较复杂或 payload 中包含引号时，**一律写入 `.yak` 临时文件再执行**。这种方式在所有平台上行为完全一致，避免 shell 转义差异：

macOS / Linux：
```bash
cat > /tmp/yak_test.yak << 'YAKEOF'
payload := "admin' OR '1'='1"
rsp, req = poc.HTTP(`POST <登录路径> HTTP/1.1
Host: <目标host>
Content-Type: <实际Content-Type>

<将 payload 拼接到实际参数结构中>
`)~
println("Status:", poc.GetStatusCodeFromResponse(rsp))
println("Body:", string(poc.GetHTTPPacketBody(rsp)))
YAKEOF
yak /tmp/yak_test.yak
```

Windows CMD（使用 Yaklang 自身的文件操作，或手动创建 .yak 文件后执行）：
```cmd
yak %TEMP%\yak_test.yak
```

**最佳实践**：优先使用 `yak -c` 执行简短脚本；含引号/多行/复杂 payload 的脚本一律写入文件后用 `yak <文件路径>` 执行。

**写入 .yak 的 Cursor 约束**：覆盖已存在文件会拒绝。规避：先 Read 再 Write、或先删后写（`rm -f`/`del /f`）、或换新文件名。

**关键注意事项**：`s[:10]` 截取前检查长度；整数转字符串用 `sprintf`；排序用 `sort.Sort(slice, less)` 无 `sort.Strings`；路径用 `os.TempDir()`；遇报错查 `yaklang-completion.json`；参数错误时从 JS 确认接口契约。

## 发包格式

所有检测均使用 `yak -c` + `poc.HTTP` 发包：

```bash
yak -c '
rsp, req = poc.HTTP(`<METHOD> <路径> HTTP/1.1
Host: <目标host>
Content-Type: <实际Content-Type>

<根据实际参数结构构造body>
`)~
println("Status:", poc.GetStatusCodeFromResponse(rsp))
println("Body:", string(poc.GetHTTPPacketBody(rsp)))
'
```

具体路径、方法、参数名、Content-Type 均从爬虫结果中动态提取。需要带认证时，在请求头中加入 Cookie 或 Authorization。

## 漏洞输出规范

每发现一个漏洞，必须按以下格式输出，方便用户直接复制请求包进行复测：

```
==================== 漏洞发现 ====================
【漏洞类型】: <类型，如 SQL注入 / 未授权访问 / 弱口令 / 越权 等>
【风险等级】: <严重 / 高危 / 中危 / 低危 / 信息>
【漏洞接口】: <METHOD 路径>
【漏洞描述】: <一句话描述漏洞成因和影响>

--- 复测请求包 ---
<标准 HTTP 请求包，可直接用于 poc.HTTP 发包复测>

--- 响应关键信息 ---
状态码: <响应状态码>
响应体(关键部分): <截取响应中证明漏洞存在的关键内容>

--- 修复建议 ---
<针对该漏洞的修复方案>
==================================================
```

复测请求包的格式要求：
- 必须是标准 HTTP 请求包格式（`METHOD 路径 HTTP/1.1` 开头）
- 包含完整的 Host、Content-Type 等必要请求头
- 如果有 body 则空一行后附上完整 body
- 如果触发漏洞需要认证，请求头中必须包含 Cookie 或 Authorization
- 该请求包可以直接粘贴到 `poc.HTTP()` 中发包复测

**漏洞实时记录机制**：每发现漏洞必须立即追加到 `vuln_found.txt`。检测开始时先清空：`yak -c 'file.Save(os.TempDir()+"/vuln_found.txt","")~'`。追加：`file.Append(tmpDir+"/vuln_found.txt","[严重] SQL注入 | POST /api/auth/login | 描述\n")~`。路径用 `os.TempDir()` 适配系统。

检测过程中触发了漏洞判定条件，必须同时做两件事：
1. **当场输出**完整的漏洞报告（按上面的格式）
2. **追加一行**到 `/tmp/vuln_found.txt`

## 漏洞联动规则

每发现一个漏洞，不要孤立看待，要分析它的产出物（凭证、用户名、ID、文件路径、角色信息等），将产出物作为后续测试的输入，扩大攻击面。

**联动触发表**：

| 发现的漏洞 | 产出物 | 触发的后续测试 |
|-----------|--------|--------------|
| 注册接口可用 | 新账号凭证 | 进入阶段二，执行所有带认证检测（越权、CSRF、JWT 等） |
| 弱口令 | 有效凭证 | 进入阶段二；若为管理员账号，额外注册/获取普通用户凭证做垂直越权对比 |
| 用户枚举 | 有效用户名列表 | 缩小弱口令爆破范围，针对性测试 |
| 信息泄露（用户列表/ID/角色） | 用户 ID 范围、角色字段名 | 水平越权有了具体 ID 可遍历，垂直越权知道了角色参数名可篡改 |
| 文件上传成功 | 上传后的文件路径/URL | 验证是否可直接访问执行、测试路径穿越下载、测试上传 XSS（html/svg） |
| 未授权访问管理接口 | 管理功能直接可用 | 无需凭证直接测试管理功能的所有操作 |
| JWT 弱密钥/算法篡改 | 可伪造任意 token | 伪造管理员 token 做垂直越权，伪造其他用户 token 做水平越权 |
| SQL 注入确认 | 可提取数据 | 尝试提取用户表（用户名、密码哈希），用泄露的凭证登录触发更多测试 |
| CORS 宽松配置 | 可跨域读取 | 结合已登录接口验证是否可跨域获取敏感数据 |
| 密码重置缺陷 | 可重置任意用户密码 | 重置目标用户密码后登录，获取更高权限凭证 |

**执行原则**：每个漏洞发现后立即检查联动触发表；获取凭证后必做带认证爬取、越权测试、文件操作测试（见开头执行约束）；收集到的凭证、ID、角色等持续积累供后续使用；SQL 注入无回显时切换盲注。

## 接口功能分类表

贯穿整个检测流程，每次获取到新接口后，都按此表分类：

| 功能类型 | 路径关键词 | 对应测试项 |
|---------|-----------|-----------|
| 认证类 | `login`, `signin`, `auth`, `token`, `oauth` | 弱口令、用户枚举、暴力破解防护、SQL 注入 |
| 注册类 | `register`, `signup`, `join` | 任意注册、批量注册、参数篡改提权 |
| 密码重置类 | `reset`, `forgot`, `recover`, `password` | 重置流程绕过、任意用户重置、Token 可预测 |
| 用户信息类 | `user`, `profile`, `account`, `info`, `avatar` | 越权（水平/垂直）、信息泄露、未授权修改 |
| 文件操作类 | `upload`, `download`, `file`, `document`, `export`, `import` | 任意文件上传、路径穿越下载、未授权访问 |
| 搜索/查询类 | `search`, `query`, `list`, `filter` | SQL 注入、XSS、翻页越权 |
| 管理后台类 | `admin`, `manage`, `config`, `setting`, `log`, `stat` | 未授权访问、垂直越权 |
| 审批/流程类 | `approval`, `review`, `audit`, `process` | 流程绕过、状态篡改、越权审批 |

## 参数与漏洞触发表（必读）

**发现接口后，根据参数名/路径关键词自动触发对应测试**，不得遗漏。**参数触发表优先级高于接口分类**：即使接口未归类为「文件操作类」，只要出现 `download` 等参数，也必须执行文件下载/路径穿越测试。

| 参数/路径关键词 | 触发的测试项 | 说明 |
|----------------|-------------|------|
| `download`, `file`, `filename`, `path`, `doc`, `url`, `uri` | 文件下载漏洞 | **遇到即测**：路径穿越（`../../etc/passwd`、`....//....//etc/passwd`）、任意文件读取、未授权下载他人文件 |
| `upload`, `file`, `attach`, `attachment` | 文件上传漏洞 | 任意类型上传（.php/.jsp/.html/.svg）、Content-Type 绕过、双写后缀 |
| `id`, `userId`, `uid`, `orderId`, `docId`, `targetId`, `pid` 等含 ID 参数 | 越权（IDOR） | 水平越权：替换为其他用户 ID；垂直越权：用普通用户访问高权限资源 |
| 任意接口的可控输入参数 | SQL 注入快速筛查 | **每个接口的每个参数**都必须尝试 `'`，观察是否有报错、时间延迟或响应差异，不限于搜索/登录等「典型注入点」 |
| `keyword`, `q`, `search`, `query`, `filter`, `sort`, `order` | SQL 注入 + XSS | 搜索/排序类参数，注入 `'`、`"`、`<script>` 等 |
| `xml`, `body`（且 Content-Type 为 application/xml, text/xml） | XXE | 若接口接收 XML，测试 XXE payload |
| `cmd`, `exec`, `command`, `ping`, `ip`, `host` | 命令注入 / RCE | 常见命令注入参数名 |

## 全接口 SQL 注入快速筛查（通用规则）

**对收集到的每个接口，凡有用户可控参数（query、body、path 中的占位符），都必须做注入初筛**：
- 至少对每个参数尝试 `'`（单引号），观察响应是否有 SQL 报错、500、或与基线不同
- 若有异常，再按 6.1 的完整 payload 深入测试
- 不限于认证/搜索接口；注册、重置、用户信息、文档等接口的参数同样需要筛查

## RCE 与 XXE 测试场景

**何时必须测试**：不是所有接口都要测 RCE/XXE。仅当满足下列「触发条件」时执行相应测试，避免盲目全量扫描。

| 场景 | 触发条件 | 测试内容 |
|------|----------|----------|
| **RCE / 命令注入** | 参数名含 `cmd`、`exec`、`command`、`ping`、`ip`、`host`；或功能为「执行」「导入」「转换」等 | 命令注入 payload（`;id`、`|cat /etc/passwd`、`$(whoami)`）；模板注入；反序列化（若发现 Java/PHP 反序列化入口） |
| **RCE / 文件上传** | 存在文件上传接口 | 上传 .php、.jsp、.jspx、.asa、.cer 等可执行扩展；上传后访问返回路径，验证是否可执行 |
| **XXE** | 接口 Content-Type 为 `application/xml`、`text/xml`；或 path 含 `soap`、`xml`、`feed`；或上传 .xml/.svg | 注入 XXE payload（外部实体、参数实体），尝试读取本地文件或 SSRF |

## 越权测试接口覆盖规范（必读）

**越权测试不能只测「用户信息类」，必须系统化覆盖所有带资源标识的接口**：

1. **路径中的 ID**：如 `/api/users/{id}`、`/api/orders/{id}`、`/api/documents/{id}/download`、`/api/approvals/{id}`。逐个替换 `{id}` 为其他用户的 ID，用普通用户 token 请求，检查是否能访问/修改他人数据。
2. **Query 参数中的 ID**：如 `?id=`、`?userId=`、`?orderId=`、`?docId=`。遍历参数，替换为其他 ID 后请求。
3. **Body 中的 ID**：如 `{"userId": 1}`、`{"targetId": 2}`。修改为其他用户 ID 后提交。
4. **从爬虫/响应中收集 ID**：用户列表、订单列表、文档列表等返回的 `id` 字段，作为越权测试的输入，确保至少测试「当前用户 ID」「其他用户 ID」「管理员相关 ID」。
5. **写操作越权**：PUT、PATCH、DELETE 等修改资源的接口，同样需要替换 ID 测试是否可修改他人数据。

**必备凭证**：水平越权测试需同时具备「用户 A」和「用户 B」的 ID（或至少能从接口获取到其他用户 ID）；垂直越权需具备普通用户凭证并尝试访问管理接口。

---

## 检测流程

**检测执行原则（重要）**：每个测试点若首次尝试失败，**不得轻易跳过或判定为无效**。应进行多次尝试，穷尽常见变体后再下结论，否则容易漏掉真实漏洞。

**参数触发表与越权覆盖规范不可省略**：`download`/`file`/`path` 等参数出现时必须测路径穿越；每个可控参数必须测 SQL 注入 `'`；所有带 ID 的接口（路径/query/body）必须按越权覆盖规范替换 ID 测试。不得因「接口看起来不重要」而跳过。

例如：

- **换参数组合**：注册/重置等接口，空 body 得 400 时，尝试补全常见字段（username、password、email 等）后重试
- **换参数名**：搜索类接口，若 `keyword` 无效，尝试 `q`、`search`、`query` 等常见变体
- **换请求格式**：JSON 失败时尝试 form-urlencoded；文件上传 multipart 解析失败时尝试调整 boundary 或字段结构
- **换方法或路径**：GET 返回 405 时尝试 POST，反之亦然；路径可尝试带/不带尾部斜杠、驼峰与下划线等

**参数/格式错误时的正确流程**：当接口返回 400/409/422 且 message 提示参数缺失、格式错误、字段已存在（如 "Email already registered"）时，**应先从前端 JS 中查找该接口的实际调用方式**（参数名、必填字段、数据格式），再按正确格式重新构造请求。不要盲目换随机参数；应到源码中确认接口契约后再重试。例如：409 提示邮箱已注册 → 换一个未使用的邮箱再试，而非直接放弃。

只有多次尝试后仍无进展，或响应明确表示业务限制（如「需要邀请码」「需要管理员审核」），才可判定该点无效。

---

分为两个阶段：未登录状态和登录后状态。每个阶段的接口收集结果都要保留，最终合并为完整接口列表。

### 并行执行建议（提效）

以下任务互相独立时可并行：

- `敏感路径探测`、`响应头检测`、`CORS 检测`
- `用户枚举`、`弱口令`、`注册接口测试`（避免测试账号命名冲突）
- 登录后的 `垂直越权`、`文件操作测试`、`审批流程测试`
- `JWT 安全测试` 与 `CSRF/逻辑漏洞测试`

以下任务建议串行（存在依赖）：

- 爬虫/API 收集 -> 接口分类 -> 定向测试
- 获取凭证 -> 登录后阶段检测
- 漏洞联动链路（SQL 注入 -> 数据提取/凭证获取 -> 越权验证）

---

## 阶段一：未登录状态

### 1. 目标探活

确认目标是否存活、可达：

```bash
curl -v -o /dev/null -s -w "HTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" http://target.com
```

若 curl 不可用，使用 yak：

```bash
yak -c '
rsp, req = poc.HTTP(`GET / HTTP/1.1
Host: <目标host>

`)~
println("Status:", poc.GetStatusCodeFromResponse(rsp))
'
```

### 2. 爬虫获取 API

使用 crawlerx 爬取目标站点。**每次运行前必须先删除旧输出文件**（`rm -f /tmp/crawl_result_noauth.json`，Windows 用 `del /f %TEMP%\crawl_result_noauth.json 2>nul`）：

```bash
rm -f /tmp/crawl_result_noauth.json
yak crawlerx -u http://target.com -o /tmp/crawl_result_noauth.json --max-depth 2 --max-url 50 --concurrent 3 --page-timeout 15 --full-timeout 600 --range-level 0 --repeat-level 2
```
（Windows 将 `/tmp/` 换为 `%TEMP%\`）

提取有效 API 列表（过滤静态资源、JS 前端路由，POST 保留 body）。**跨平台用 Yaklang 解析**：

脚本中路径使用 `os.TempDir()` 自动适配 Windows/macOS/Linux。**Yaklang 无 `sort.Strings`**，需用 `sort.Sort(slice, less)`。crawlerx 输出通常为 JSON 数组；若 `json.loads` 报错 `invalid character '[' after top-level value`，可能是 NDJSON 或文件格式异常，可尝试逐行解析。

```
tmpDir = os.TempDir()
raw = file.ReadFile(tmpDir + "/crawl_result_noauth.json")~
data = json.loads(string(raw))
results = []
for _, item = range data {
    url = item.url
    method = item.request.method
    if str.MatchAnyOfRegexp(url, `\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|ttf|map)$`) { continue }
    if str.Contains(url, "/static/") { continue }
    line = sprintf("%s %s", method, url)
    if method == "POST" && item.request != nil && item.request.body != nil {
        line = sprintf("%s %s BODY: %s", method, url, item.request.body.data)
    }
    results = append(results, line)
}
results = str.RemoveRepeat(results)
sort.Sort(results, func(i, j) { return results[i] < results[j] })
file.Save(tmpDir + "/api_noauth.txt", str.Join(results, "\n"))~
println(sprintf("提取到 %d 个 API", len(results)))
```

注意：输出中可能包含完整 URL（如 `GET http://host/path`），后续使用时需提取路径部分。**爬虫的 -o 输出路径需与上述 tmpDir 一致**（如 `yak crawlerx -u ... -o %TEMP%\crawl_result_noauth.json`）。

### 3. 从 JS 中发现隐藏接口并推断完整 API

**第一步**：从 JS 中提取路径模式（路径用 `os.TempDir()`）：
```
yak -c '
tmpDir = os.TempDir()
raw = file.ReadFile(tmpDir + "/crawl_result_noauth.json")~
data = json.loads(string(raw))
paths = []
for _, item = range data {
    if !str.HasSuffix(item.url, ".js") { continue }
    if item.response == nil || item.response.body == nil { continue }
    jsBody = item.response.body.data
    matched = re.FindAll(jsBody, `"/[a-zA-Z0-9/_-]{2,}"`)
    for _, m = range matched {
        p = str.Trim(m, `"`)
        if str.MatchAnyOfRegexp(p, `\.(js|css|html|png|jpg|svg|ico)`) { continue }
        paths = append(paths, p)
    }
}
paths = str.RemoveRepeat(paths)
sort.Sort(paths, func(i, j) { return paths[i] < paths[j] })
file.Save(tmpDir + "/js_api_noauth.txt", str.Join(paths, "\n"))~
println(sprintf("从 JS 中提取到 %d 个路径", len(paths)))
'
```

**第二步**：API 路径推断。将已知的真实 API 和 JS 中发现的路径进行关联，推断完整 API 列表。推断规则：

1. **前缀匹配**：从已知真实 API 路径中提取公共前缀，将 JS 中发现的短路径补全为完整 API 路径
2. **同级猜测**：JS 中出现的与已知 API 同层级的路径，都应补全相同前缀
3. **方法猜测**：推断出的新路径，应同时尝试 GET 和 POST 方法

**第三步**：根据推断规则，人工/AI 生成补全后的 API 列表，写入 `/tmp/guessed_api_noauth.txt`（每行一个路径，如 `/api/auth/register`）。

**第四步**：合并去重。读 `api_noauth.txt`、`js_api_noauth.txt`、`guessed_api_noauth.txt`，正则提取 `/xxx` 路径，去重排序，输出 `all_api_noauth.txt`：
```
yak -c '
tmpDir = os.TempDir()
files = [tmpDir + "/api_noauth.txt", tmpDir + "/js_api_noauth.txt", tmpDir + "/guessed_api_noauth.txt"]
allPaths = []
for _, f = range files {
    raw, err = file.ReadFile(f)
    if err != nil { continue }
    lines = str.SplitAndTrim(string(raw), "\n")
    for _, line = range lines {
        matched = re.FindAll(line, `/[a-zA-Z0-9/_.\-]+`)
        for _, m = range matched { allPaths = append(allPaths, m) }
    }
}
allPaths = str.RemoveRepeat(allPaths)
sort.Sort(allPaths, func(i, j) { return allPaths[i] < allPaths[j] })
file.Save(tmpDir + "/all_api_noauth.txt", str.Join(allPaths, "\n"))~
println(sprintf("合并去重后共 %d 个路径", len(allPaths)))
'
```

### 4. 接口功能分析 + 未授权访问检测

对 `/tmp/all_api_noauth.txt` 中的接口：

1. 按「接口功能分类表」自动分类
2. **提取每个接口的路径与参数**，对照「参数与漏洞触发表」，识别需触发的测试项（如含 `download` → 路径穿越；含 `id` → 越权；所有参数 → SQL 注入 `'` 初筛）
3. **接口发现时即时动作**：路径或参数含 `download`、`file`、`filename`、`path`、`upload` 的接口，**必须写入待测清单并优先测试**（路径穿越、任意文件读取、任意上传）。从 JS/爬虫发现这类路径后不得搁置，必须在本阶段或阶段二带认证后执行
4. 对所有接口不带认证，**同时用 GET 和 POST 方法**逐个请求，记录响应状态码和响应体。返回 405 的接口说明方法不对，换方法重试

**未授权判断标准**：
- 返回 `401` / `403` / `302`(跳转登录) → 正常，有鉴权
- 返回 `200` / `201` 且响应体有实际业务数据（JSON 格式、含 `id`/`username`/`token` 等字段） → **疑似未授权访问**
- 返回 `200` 但内容为 HTML 页面（含 `<!doctype`/`<html`）且与首页一致 → **SPA 前端路由，非真正未授权**，应忽略
- 返回 `405` → 换 GET/POST 方法重试
- 返回 `500` 且包含错误详情 → **信息泄露**

### 5. 全局安全检测（无需认证部分）

以下检测不依赖登录状态，在阶段一执行：

#### 5.1 敏感路径探测

逐个请求以下常见敏感路径，检查是否可访问：

- `/.env`、`/.git/config`、`/robots.txt`、`/sitemap.xml`
- `/swagger-ui.html`、`/api-docs`、`/graphql`
- `/phpinfo.php`、`/server-status`、`/actuator`、`/health`
- `/backup.sql`、`/.DS_Store`、`/WEB-INF/web.xml`

**SPA 误报排除**：很多前端 SPA 应用会把所有未知路径都返回 200 + 首页 HTML。判断方法：先请求首页获取响应体作为基线，如果敏感路径返回的内容与首页一致（相同的 HTML），则不算敏感路径泄露，应忽略。只有返回非 HTML 的实际文件内容才算真正泄露。

#### 5.2 响应头安全检测

分别检查前端页面和后端 API 接口的响应头（两者可能由不同服务处理，安全配置不同）：

- `X-Frame-Options` 缺失 → 点击劫持风险
- `X-Content-Type-Options` 缺失 → MIME 嗅探风险
- `Content-Security-Policy` 缺失 → XSS 防护不足
- `Strict-Transport-Security` 缺失 → 未强制 HTTPS
- `Server` / `X-Powered-By` 暴露中间件版本信息

#### 5.3 CORS 配置

- 发送带 `Origin: https://evil.com` 的请求，观察 `Access-Control-Allow-Origin` 是否回显为 `https://evil.com`
- 检查 `Access-Control-Allow-Credentials` 是否为 `true`（结合宽松的 Origin → 可跨域窃取数据）
- 检查是否允许 `null` Origin

### 6. 未登录功能测试

仅对不需要认证即可测试的功能类型执行：

#### 6.1 认证类接口

- **用户枚举**：用不同用户名（含不存在的）尝试登录，对比响应差异（提示信息、状态码、响应长度）
- **弱口令**：常见用户名 × 常见密码组合测试，观察是否返回登录成功标志（token、session）
- **SQL 注入**：对每个输入字段分别注入 payload，每次只注入一个字段，另一个保持正常值。payload 必须包含引号闭合：
  - 单引号闭合：`admin' OR '1'='1`、`admin'-- `、`' OR '1'='1'-- `（MySQL 中 `--` 后需有空格才识别为注释，或用 `#`）
  - 双引号闭合：`admin" OR "1"="1`、`" OR "1"="1"--`
  - 时间盲注：`admin' AND SLEEP(5)-- `、`admin" AND SLEEP(5)--`
  - 报错注入：MySQL 用 `admin' AND CONVERT(@@version,SIGNED)-- ` 或 `admin' AND extractvalue(1,concat(0x7e,version()))-- `；SQL Server 用 `admin' AND 1=CONVERT(int,@@version)--`
  - UNION：`' UNION SELECT null,null-- `

  **执行方式**：payload 中含单引号时，`yak -c '...'` 会导致 shell 截断。必须将脚本写入 `.yak` 文件再执行，参见「写入 .yak 文件时的 Cursor 约束」。
  在 JSON body 中传递带双引号的 payload 时，需用反斜杠转义。

  **判断标准**：先记录正常登录失败的响应作为基线：
  - 登录成功（返回 token） → **万能密码**
  - 响应时间比基线多 5s 以上 → **时间盲注**
  - 响应包含数据库错误关键词（`syntax`、`mysql`、`sqlite`、`ORA-`、`postgresql`、`SQLSTATE`） → **报错注入**
  - 响应内容/长度与基线不同但未成功登录 → **可能存在注入点，需进一步验证**

  **UNION 注入补充（列数/类型对齐）**：
  - 先递增测试列数（如 1..20）定位正确列数
  - 若报错 `The used SELECT statements have a different number of columns`，继续调整列数
  - 若报错 `Scan error ... into type *time.Time` 等类型错误，说明列类型不匹配：
    - 时间列用 `NOW()`
    - 数值列用 `0/1`
    - 字符串列用 `database()`、`version()`、`'test'`
  - 若 UNION 不再报 SQL 错误但响应仍为统一业务错误（如 401），判定 SQL 已执行成功，再切换盲注提取

- **暴力破解防护**：连续 20 次错误登录，观察是否有验证码、锁定、限频

#### 6.2 注册类接口

- **任意注册**：直接调用注册接口，检查是否需要邀请码/审核。若返回 400（参数缺失）或 409（邮箱/用户名已存在），**应先从爬虫结果或前端 JS 中查找注册接口的完整参数结构**（如 username、password、email 等），再构造正确请求；409 时换未使用的邮箱/用户名重试，而非直接放弃
- **参数篡改**：注册时在 body 中添加 `role`、`is_admin`、`type` 等字段，尝试提权注册
- **重复注册**：用已知用户名注册，观察是否泄露用户是否存在
- **批量注册**：连续注册多个账户，检查是否有频率限制

#### 6.3 密码重置类接口

- **任意用户重置**：修改重置请求中的用户标识，观察是否能触发其他用户的重置流程
- **Token 可预测**：多次请求重置，观察 Token 是否有规律
- **流程绕过**：跳过验证步骤，直接请求最终的密码修改接口

### 阶段一 → 阶段二衔接

满足以下任一条件即可进入阶段二：
- 弱口令检测成功，获取到凭证
- 注册接口注册成功，获取到凭证
- 用户主动提供了账号凭证（Cookie / Token）

保存凭证，进入阶段二。**必须立刻执行**：带认证重新爬取、越权测试、文件操作测试（见开头执行约束）。

---

## 阶段二：登录后状态

### 7. 带认证重新爬取

用凭证重跑 crawler（先删旧输出）。JWT：`yak crawlerx -u http://target.com -o /tmp/crawl_result_authed.json ... --local-storage "token:<JWT值>;"`。Cookie 用 `--cookie "session_id:value;"`。处理同步骤 2/3，文件名 `noauth`→`authed`。

### 8. 合并完整接口列表

合并 `all_api_noauth.txt`、`api_authed.txt`、`js_api_authed.txt`、`guessed_api_authed.txt`，逻辑同步骤 3 第四步，输出 `all_api_full.txt`。对新增接口按接口功能分类表重新分类。

### 9. 带认证针对性检测

所有请求带上 Cookie / Token，按功能类型执行检测：

#### 9.1 用户信息类接口（含越权覆盖规范）

- **水平越权**：用 A 用户凭证访问 B 用户数据。按「越权测试接口覆盖规范」系统化覆盖：路径中的 `{id}`、query 中的 `id`/`userId`、body 中的 `targetId` 等，替换为其他用户 ID 后请求
- **垂直越权**：用普通用户凭证访问管理员接口
- **信息泄露**：检查响应中是否包含密码哈希、Token、手机号、身份证等敏感字段
- **未授权修改**：尝试修改他人头像、密码、邮箱等（PUT/PATCH 接口同样替换 ID 测试）

#### 9.2 文件操作类接口（含参数触发表）

- **任意文件上传**：上传 `.html`、`.svg`、`.php`、`.jsp` 等危险文件类型；发现 `upload`、`file`、`attach` 等参数即触发
- **路径穿越**：发现 `download`、`file`、`filename`、`path`、`url` 等参数即测试路径穿越（`../../etc/passwd`、`....//....//etc/passwd`）及任意文件读取
- **未授权下载**：替换文件 ID/路径参数，检查是否能获取他人文件

#### 9.3 搜索/查询类接口

- **参数确认（先做）**：先用前端真实请求样本确认参数名和位置（如 `keyword`、`q`、`search`；query 或 JSON body）。若直接测试始终返回 `keyword required`，说明参数名/位置错误，需先修正后再测漏洞
- **SQL 注入**：搜索参数注入 `'`、`" OR "1"="1`、`1 AND SLEEP(5)`、`1 UNION SELECT null--` 等。注意搜索接口的注入点通常是查询关键词，不需要用户名前缀，直接注入即可
- **XSS**：搜索参数注入 `<script>alert(1)</script>`，检查响应中是否原样返回
- **翻页越权**：修改分页参数（page、offset、limit）获取超出权限的数据

#### 9.4 管理后台类接口

- **垂直越权**：用普通用户 Token 访问管理接口，检查是否返回业务数据

#### 9.5 审批/流程类接口

- **状态篡改**：修改审批状态参数（如 `status=approved`），尝试跳过审批
- **越权审批**：用非审批人的凭证调用审批通过接口
- **流程绕过**：跳过前置步骤，直接请求后续流程接口

### 10. 全局安全检测（需认证部分）

#### 10.1 JWT 安全

如果认证方式为 JWT（token 格式为 `xxx.xxx.xxx`）：

- **算法篡改 none**：将 header 中 `alg` 改为 `none`，删除签名部分，观察是否仍被接受
- **算法混淆 RS256→HS256**：如果原始算法是 RS256，改为 HS256 并用公钥作为密钥签名
- **弱密钥**：尝试常见弱密钥（`secret`、`123456`、`password`、`key`、服务名称等）签名验证
- **过期校验**：使用过期的 token 发送请求，检查是否仍有效
- **敏感信息**：解码 payload，检查是否包含密码、内部 IP 等
- **签名校验**：修改 payload 中的用户 ID/角色，保留原签名，观察是否被接受

实现提示（避免函数踩坑）：

- 编写 JWT 伪造/签名脚本前，先查 `yaklang-completion.json` 中当前版本可用函数
- 若不存在一键 JWT 生成函数，不要写死 `codec.JWTGenerate`，改为手工流程：
  1. base64url 编码 header/payload  
  2. 计算 `HMAC-SHA256(secret, header.payload)`  
  3. 对签名结果做 base64url 编码并拼接 token
- 出现 `no such key`、`cannot found variable` 时，立即回查补全文件并替换为存在的函数

#### 10.2 Cookie 安全

检查登录成功后 `Set-Cookie` 的属性：

- **HttpOnly 缺失**：可被 JS 读取 → XSS 可窃取会话
- **Secure 缺失**：HTTP 明文传输会话
- **SameSite 缺失或过宽**：易受 CSRF 攻击
- **会话固定**：登录前后 session ID 是否变化

#### 10.3 CSRF

对所有写操作接口（POST/PUT/DELETE）检测：

- 请求中是否存在 CSRF Token（`csrf_token`、`_token`、`X-CSRF-Token`、`X-XSRF-Token`）
- 去除或置空 Token 后重放，是否仍成功
- 移除或修改 `Referer`/`Origin` 为第三方域名，是否仍成功
- JSON 接口改为 `application/x-www-form-urlencoded` 发送，是否绕过校验

#### 10.4 敏感信息泄露（响应体）

- 接口返回多余字段：密码哈希、内部 IP、数据库连接串、调试信息、堆栈跟踪
- 错误响应泄露技术栈：框架版本、SQL 语句片段、文件路径

#### 10.5 设计缺陷/逻辑漏洞

- **竞态条件**：对同一操作并发发送多次请求（如领取优惠券、点赞），检查是否重复生效
- **参数污染**：同一参数传递多个值（如 `?id=1&id=2`），观察后端取值行为
- **HTTP 方法篡改**：将 POST 改为 GET/PUT/PATCH/DELETE，观察是否绕过权限校验
- **数值篡改**：修改金额、数量、积分等数值参数为负数/零/超大值
- **步骤跳跃**：多步流程中跳过中间步骤，直接请求最后一步

---

## 检测完成

所有步骤执行完毕后，必须执行以下完整汇总流程，**不允许跳过或简化任何一步**：

### 第一步：核对漏洞记录

读取 `vuln_found.txt` 列出所有条目。`yak -c 'raw=file.ReadFile(os.TempDir()+"/vuln_found.txt")~ println(string(raw))'`

### 第二步：完整性自检

逐项核查：记录是否完整、异常是否被忽略；接口收集（含带认证爬取）、参数触发表、全接口 SQL 注入 `'`、越权覆盖（路径/query/body ID）、文件上传、JWT、CSRF、漏洞联动。漏洞类型覆盖：未授权、弱口令、SQL 注入、XSS、越权、CSRF、文件上传、信息泄露、JWT、CORS、暴力破解防护、用户枚举、密码重置、任意注册。有遗漏则补测并记录。

### 第三步：输出最终报告

按以下结构输出完整报告：

**3.1 逐条输出每个漏洞的完整报告**（按漏洞输出规范格式，包含复测请求包），按风险等级排序：严重 > 高危 > 中危 > 低危 > 信息

**3.2 输出漏洞统计表**：

```
==================== 漏洞统计 ====================
严重: X 个
高危: X 个
中危: X 个
低危: X 个
信息: X 个
总计: X 个
==================================================
```

**3.3 输出已测试但未发现漏洞的项目**（证明已测试覆盖）：

```
==================== 未发现漏洞项 ====================
- [已测试] 暴力破解防护：连续 20 次错误登录后出现频率限制
- [已测试] CSRF：所有写操作均携带有效 Token
- ...
==================================================
```

**3.4 输出遗留/建议人工确认的项目**：

对于自动化检测无法 100% 确认的疑似问题，列出并建议人工验证。

### 第四步：报告后审计
对账：vuln_found.txt 与最终报告一一对应、数量一致。每条漏洞必含：类型、等级、接口、描述、复测包、响应关键信息、修复建议。证据至少其一：成功响应、错误详情、时间差、权限差异。报告末尾输出审计结论（通过/不通过、漏洞总数）。审计通过后流程才算完成。
