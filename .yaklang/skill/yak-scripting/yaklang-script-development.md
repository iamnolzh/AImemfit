---
name: yaklang-script-development
description: Yaklang 漏洞检测脚本开发实战经验总结，包含 API 使用、检测逻辑设计、阈值调优等核心知识
---

# Yaklang 漏洞检测脚本开发技能

## 核心原则

### 1. 必须参考的资源（不可跳过）
- **语法补全**: 本技能目录下 `语法/yaklang-completion.json`
- **风险类型**: 本技能目录下 `语法/risktype.txt`
- **现有脚本**: 本技能目录下 `script/*.yak`

### 2. 开发流程
```
1. 设计检测思路（分阶段、从快到慢）
2. 查阅手册确认 API 用法
3. 参考现有脚本结构
4. 实现核心逻辑
5. 手动测试验证
6. 真实环境调优
```

---

## 常见 API 陷阱与正确用法

### ❌ 错误 1: 使用不存在的 timeout 参数
```yak
// ❌ 错误
res, err = freq.ExecFirst(fuzz.timeout(5))
// 报错: no such key `timeout` in map
```

```yak
// ✅ 正确
res, err = freq.ExecFirst()
```

**教训**: 不要凭经验猜测 API，必须查手册或参考现有代码。

---

### ❌ 错误 2: 正则匹配返回值混淆
```yak
// ❌ 错误: str.MatchAllOfRegexp 返回 bool，不是数组
matches = str.MatchAllOfRegexp(body, pattern)
if len(matches) > 0 {  // 崩溃: len(bool) 不合法
    ...
}
```

```yak
// ✅ 正确: re.FindAll 返回 []string
matches = re.FindAll(body, pattern)
if len(matches) > 0 {
    for _, match = range matches {
        println(match)
    }
}
```

**教训**: 
- 字符串匹配判断用 `str.MatchAnyOfRegexp()` → 返回 `bool`
- 提取匹配内容用 `re.FindAll()` → 返回 `[]string`

---

### ❌ 错误 3: 参数 Fuzz 只处理 GET
```yak
// ❌ 错误: FuzzGetParams 只处理 GET 参数
results = freq.FuzzGetParams(param.Name(), payload).ExecFirst()
// 会遗漏 POST 参数！
```

```yak
// ✅ 正确: param.Fuzz() 自动识别参数类型
for param in freq.GetCommonParams() {  // GET/POST/Cookie 全部获取
    results = param.Fuzz(payload).ExecFirst()  // 自动处理
}
```

**教训**: 使用 `GetCommonParams()` + `param.Fuzz()` 处理所有参数类型。

---

### ❌ 错误 4: 响应对象字段错误
```yak
// ❌ 错误: res 没有 StatusCode 字段
statusCode = res.StatusCode
// 报错: no such field or method: StatusCode
```

```yak
// ✅ 正确: 使用 poc.GetStatusCodeFromResponse()
statusCode = poc.GetStatusCodeFromResponse(res.ResponseRaw)

// 或者从原始响应提取 Body
body, _ = str.ExtractBodyFromHTTPResponseRaw(res.ResponseRaw)
```

**教训**: Fuzz 响应对象的可用字段:
- `res.RequestRaw` - 请求原始字节
- `res.ResponseRaw` - 响应原始字节
- `res.Url` - 请求 URL
- `res.DurationMs` - 响应时间

---

### ❌ 错误 5: DNSLog API 调用错误
```yak
// ❌ 错误: dnslog 模块没有此方法
dnslogDomain, err = dnslog.NewDNSLogDomain()
```

```yak
// ✅ 正确: 使用 risk 模块
server, token, err := risk.NewDNSLogDomain()
if err != nil { return nil }

// 发送 Payload...
sleep(3)

records, _ := risk.CheckDNSLogByToken(token)
if len(records) > 0 {
    // 检测到带外回调
}
```

**教训**: DNSLog 功能在 `risk` 模块，不是 `dnslog` 模块。

---

## 检测逻辑设计原则

### 1. 分层检测（快 → 慢）
```yak
// 阶段1: 快速检测（报错注入、特征匹配）
result = testErrorBased(param)
if result != nil { return result }

// 阶段2: 中速检测（布尔盲注）
result = testBooleanBased(param)
if result != nil { return result }

// 阶段3: 慢速检测（时间盲注、DNSLog）
result = testTimeBased(param)
if result != nil { return result }
```

**优势**: 早期终止，提高效率。

---

### 2. 无回显场景处理
```yak
// ❌ 错误: 阶段1失败就退出
mathResult = testMathExpression(param)
if mathResult == nil {
    return nil  // 错误：无回显时永远检测不到
}

// ✅ 正确: 即使阶段1失败，也尝试带外检测
if mathResult == nil {
    // 无回显，使用常见引擎列表
    potentialEngines = ["Jinja2", "Twig", "FreeMarker"]
} else {
    potentialEngines = mathResult.engines
}

// 继续 DNSLog 检测
for _, engine = range potentialEngines {
    result = testDNSLog(param, engine)
    if result != nil { return result }
}
```

**教训**: 不要因为一个阶段失败就放弃，尝试其他检测方法。

---

### 3. 阈值调优（最重要！）

#### 案例: XPath 布尔盲注阈值问题

**问题**: 
- 设定阈值: 响应差异 > 30%
- 实际漏洞: 响应差异仅 3.7%
- 结果: **漏报**

**修复前**:
```yak
// 单一严格阈值
threshold = trueFalseDiff > max(trueLen, falseLen) * 0.3
```

**修复后**:
```yak
// 1. 降低百分比阈值
threshold1 = trueFalseDiff > max(trueLen, falseLen) * 0.03  // 3%

// 2. 增加绝对值判断
threshold2 = trueFalseDiff > 20  // 至少 20 bytes

// 3. 关键词智能检测
hasSuccessKeyword = str.MatchAnyOfRegexp(trueBody, 
    `(?i)(success|welcome|login.*ok)`)
hasFailureKeyword = str.MatchAnyOfRegexp(falseBody, 
    `(?i)(invalid|error|fail|denied)`)
threshold3 = (hasSuccessKeyword || hasFailureKeyword) && trueFalseDiff > 10

// 综合判断
if (threshold1 && threshold2) || threshold3 {
    // 检测到漏洞
}
```

**阈值设计原则**:
| 场景 | 推荐阈值 | 原因 |
|------|---------|------|
| 响应差异（%） | 3-5% | 太高会漏报 |
| 响应差异（bytes） | 20-50 | 绝对值更可靠 |
| 时间盲注（秒） | 0.8-1.5 | 考虑网络延迟 |
| 关键词匹配 | 配合差异 > 10 bytes | 减少误报 |

---

### 4. 多维度判断
```yak
// ❌ 错误: 仅依赖单一维度
if trueFalseDiff > 50 {
    return true  // 容易误报或漏报
}

// ✅ 正确: 多维度综合判断
判断1 = 响应长度差异 > 3% 且 > 20 bytes
判断2 = 真条件包含成功关键词 且 假条件不包含
判断3 = 假条件包含失败关键词 且 真条件不包含
判断4 = 响应时间差异 > 阈值

if (判断1 && (判断2 || 判断3)) || 判断4 {
    return true
}
```

---

## 风险上报规范

### 1. risk.type() 必须合法
```yak
// ❌ 错误: 使用自定义类型
risk.type("xpath-injection")  // risktype.txt 中不存在

// ✅ 正确: 使用 risktype.txt 中的类型
risk.type("sqli")  // XPath 注入归类为 sqli
```

**检查清单**:
- 查看本技能目录下 `语法/risktype.txt`
- SQL 注入: `sqli`, `sql-injection`
- XSS: `xss`, `xss-reflected`, `xss-stored`
- RCE: `rce`, `rce-command`, `rce-code`
- 文件操作: `lfi`, `file-read`, `file-upload`
- 其他: `xxe`, `ssti`, `ssrf`

---

### 2. 必需字段
```yak
risk.NewRisk(
    url,
    risk.title("XPath 注入 (布尔盲注): " + url),           // ✅ 必需
    risk.titleVerbose("XPath 注入漏洞"),                   // ✅ 必需
    risk.type("sqli"),                                     // ✅ 必需
    risk.severity("high"),                                 // ✅ 必需
    risk.payload(payload),                                 // ✅ 必需
    risk.request(res.RequestRaw),                          // ✅ 必需
    risk.response(res.ResponseRaw),                        // ✅ 必需
    risk.description("参数 xxx 存在漏洞..."),               // 推荐
    risk.solution("1. 使用参数化查询\n2. 白名单验证..."),    // 推荐
    risk.details({"key": "value"}),                        // 可选
)
```

---

## 参数过滤策略

### 通用跳过模式
```yak
shouldSkipParam = func(paramName) {
    skipPatterns = [
        "(?i)^(page|limit|offset|sort|order)$",      // 分页排序
        "(?i)^(csrf|token|timestamp|nonce)$",        // Token 类
        "(?i)^(lang|locale|theme)$",                 // 配置类
        "(?i)^(PHPSESSID|JSESSIONID|_ga|_gid)$",    // Session
    ]
    
    for _, pattern = range skipPatterns {
        if str.MatchAnyOfRegexp(paramName, pattern) {
            return true
        }
    }
    return false
}
```

---

## 测试验证流程

### 1. 语法检查
```bash
yak script/xxx.yak --help
# 无报错 = 语法正确
```

### 2. 核心逻辑测试
```yak
// 创建简化测试脚本
rawRequest = `GET /test?param=value HTTP/1.1
Host: 127.0.0.1:8888

`

freq, _ = fuzz.HTTPRequest(rawRequest, fuzz.https(false))
params = freq.GetCommonParams()

// 测试检测逻辑
result = testVulnerability(params[0])
if result != nil {
    println("✓ 检测逻辑正常")
}
```

### 3. 真实环境测试
```bash
# 通过 Yakit 获取 HTTPFlowID
yak script/xxx.yak --httpflow-id 5743

# 验证:
# 1. 有漏洞的端点能检测到
# 2. 无漏洞的端点不误报
# 3. 风险成功上报到数据库
```

---

## 常见问题 FAQ

### Q1: 为什么脚本能检测到有回显的漏洞，但检测不到无回显的？
**A**: 检查是否在阶段1失败时直接 `return nil`，应该继续尝试带外检测。

### Q2: 为什么手动测试有漏洞，脚本检测不到？
**A**: 
1. 检查阈值是否太严格（降低到 3-5%）
2. 增加关键词检测
3. 手动对比响应差异，调整判断逻辑

### Q3: 如何减少误报？
**A**:
1. 多维度判断（长度 + 内容 + 时间）
2. 提高绝对值阈值（如 > 20 bytes）
3. 增加关键词白名单/黑名单

### Q4: DNSLog 总是超时怎么办？
**A**:
1. 检查是否开了代理（关闭代理重试）
2. 检查服务器是否能访问外网
3. 响应中如果包含 nslookup 输出，也可确认漏洞

---

## 脚本模板

```yak
__DESC__ = "漏洞检测工具，支持 xxx 检测方法"
__VERBOSE_NAME__ = "XXX 漏洞检测"
__KEYWORDS__ = "xxx,detection,security"

// CLI 参数
flowIDStr = cli.String("httpflow-id", cli.setRequired(true))
cli.check()

// 辅助函数
aiOut = msg => {
    try { yakit.AIOutput(msg) }
    catch { println(msg) }
}

// Payload 定义
payloads = [
    {"payload": "xxx", "desc": "描述"},
]

// 检测函数
testVulnerability = func(param) {
    // 阶段1: 快速检测
    // 阶段2: 中速检测
    // 阶段3: 慢速检测
    return result
}

// 风险上报
reportVulnerability = func(url, param, result) {
    risk.NewRisk(
        url,
        risk.type("sqli"),  // 使用 risktype.txt 中的类型
        risk.request(result.request),
        risk.response(result.response),
        // ...
    )
}

// 主程序
flowID = parseInt(flowIDStr)
flow = db.QueryHTTPFlowsByID(flowID) |> first
if flow == nil { return }

reqBytes = flow.GetRequest()
freq, _ := fuzz.HTTPRequest(reqBytes, fuzz.https(flow.IsHTTPS))

for param in freq.GetCommonParams() {
    if shouldSkipParam(param.Name()) { continue }
    
    result = testVulnerability(param)
    if result != nil {
        reportVulnerability(flow.Url, param, result)
    }
}
```

---

## 总结

### ✅ 必须做到
1. 查手册确认 API
2. 参考现有脚本结构
3. 分层检测（快→慢）
4. 手动测试验证
5. 真实环境调优阈值

### ❌ 避免错误
1. 凭经验猜测 API
2. 阈值设置太严格
3. 单一维度判断
4. 阶段失败直接退出
5. 使用非法 risk.type

### 🎯 优化方向
1. 降低阈值 + 增加智能判断
2. 多维度综合评分
3. 关键词语义分析
4. 基线对比优化

---

**实战出真知，迭代出精品！** 🚀
