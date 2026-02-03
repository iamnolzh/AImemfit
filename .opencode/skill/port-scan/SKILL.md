---
name: port-scan
description: 端口扫描与指纹识别，使用 yak scan-service / yak synscan 对目标进行 TCP/UDP 端口扫描和服务指纹识别
---

# 端口扫描技能（Yak scan-service / synscan）

当用户需要扫描目标主机的开放端口和服务指纹时使用此技能。可选：
- **scan-service**：建立 TCP/UDP 连接做指纹识别，适合详细服务识别。
- **synscan**：仅发 SYN 包、不建连，适合快速发现开放端口，可配合 `--fingerprint` 做指纹。

## 用法顺序（正确写法）

**先写 `--hosts` 指定目标，再按需加 `--port` 指定端口及其他参数。**

```bash
yak scan-service --hosts <目标> [--port <端口>] [其他选项...]
```

- 不写 `--port` 时使用默认 TCP 端口：`22,80,443,3389,3306,8080-8082,9000-9002,7000-7002`
- 要指定端口时：在 `--hosts` 后面加 `--port <端口>`，例如 `--port 80,443,8080`

## 常用用法

### 1. 只扫默认端口（只写 --hosts）
```bash
yak scan-service --hosts 192.168.0.68
yak scan-service -t 192.168.1.0/24
yak scan-service -t 10.1.1.2,192.168.1.1-23
```

### 2. 指定端口（先 --hosts 再 --port）
```bash
yak scan-service --hosts 192.168.0.68 --port 80,443,8080
yak scan-service --hosts 192.168.1.100 --port 21-25,80,443
yak scan-service -t 192.168.1.0/24 -p 80,443,8080-8090
```

### 3. UDP 端口
```bash
yak scan-service --hosts 192.168.0.68 --udp-port 53,161
```

### 4. 开启 Web 指纹
```bash
yak scan-service --hosts 192.168.0.68 --web
yak scan-service --hosts 192.168.0.68 --port 80,443,8080 --web
```

### 5. 输出到 JSON
```bash
yak scan-service --hosts 192.168.0.68 -o result.json
yak scan-service --hosts 192.168.0.68 --port 80,443 --web -o result.json
```

### 6. 并发与超时
```bash
yak scan-service --hosts 192.168.0.68 --concurrent 60 --request-timeout 10
```

### 7. 自定义指纹规则
```bash
yak scan-service --hosts 192.168.0.68 --rule-path /path/to/rules
yak scan-service --hosts 192.168.0.68 --rule-path /path/to/rules --only-rule
```

## 参数速查

| 参数 | 说明 | 示例 |
|------|------|------|
| `--hosts` / `-t` | 扫描目标，逗号分隔，支持 CIDR、范围 | `192.168.1.1/24`, `10.1.1.2,192.168.1.1-23` |
| `--port` / `-p` | TCP 端口，单个或范围 | `80,443,21-25,8080-8082` |
| `--udp-port` | UDP 端口 | 同上 |
| `--web` | 开启 Web 指纹扫描 | - |
| `--concurrent` / `-c` | 并发数，默认 60 | `-c 80` |
| `--request-timeout` | 单请求超时（秒），默认 10 | `--request-timeout 5` |
| `--json` / `-o` | 结果输出到 JSON 文件 | `-o result.json` |
| `--rule-path` / `-r` | 加载规则文件/目录 | `-r ./rules` |

---

## SYN 扫描（yak synscan）

不建立完整 TCP 连接，仅发 SYN 包，适合快速发现开放端口。参数用 `--target`/`--host`/`-t` 和 `--port`/`-p`。

### 基本用法
```bash
yak synscan --target 192.168.0.68
yak synscan -t 192.168.1.0/24 -p 80,443,8080-8090
yak synscan --host 10.1.1.2 --port 22,80,443 --fingerprint
```

### 常用参数（synscan）
| 参数 | 说明 | 默认 |
|------|------|------|
| `--target` / `--host` / `-t` | 目标主机或网段 | - |
| `--port` / `-p` | TCP 端口 | 22,80,443,3389,3306,8080-8082,9000-9002,7000-7002 |
| `--fingerprint` / `-x` | 开启指纹扫描 | 关 |
| `--wait` | SYN 发送后等待收尾时间（秒） | 5 |
| `--request-timeout` | 单请求超时（秒） | 10 |
| `--output` | 开放端口输出到文件 | - |
| `--fp-json` | 指纹详细结果输出 JSON | - |
| `--rule-path` / `-r` | 手动加载规则文件/目录 | - |
| `--fingerprint-concurrent` / `--fc` | 指纹扫描并发数 | 60 |

### 输出行前缀（便于后续请求）
```bash
yak synscan -t 192.168.0.68 --output-line-prefix "https://"
```

---

## 输出与报告

扫描完成后，从输出或 `-o` 生成的 JSON 中总结：
- 开放端口列表（TCP/UDP）
- 识别到的服务/指纹
- 若使用 `--web`，可包含 Web 应用信息
- 建议的下一步渗透或加固方向

## 相关工具

- **Yakit**：公司自研抓包与流量分析工具，可与 scan-service 配合做请求重放、流量分析等。

## 注意事项

- **若在执行 auto-pentest 全流程**：请使用 auto-pentest 阶段0 的 `tools/port_scan/scan_tcp_port.yak`，本技能为**独立**端口扫描（`yak scan-service` / `yak synscan`）参考。
- 扫描前确认已获得授权
- 大网段或高并发时注意 `--concurrent` 与 `--request-timeout`，避免对目标造成压力
- 重要结果可用 `-o` 保存 JSON 便于报告
