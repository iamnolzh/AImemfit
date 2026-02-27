---
name: fuzz
description: Fuzztag 模板生成模糊测试字符串，使用 yak fuzz 生成 int、rand、日期等占位符的测试数据
---

# Fuzztag 技能（Yak fuzz）

当用户需要生成模糊测试字符串、占位符替换、批量测试数据时使用此技能。`yak fuzz` 根据 Fuzztag 模板（如 `{{int(1-10)}}`）生成多组结果，用于参数爆破、边界测试、漏洞 PoC。

## 基本用法

```bash
yak fuzz -t "<Fuzztag 模板>"
yak fuzz --target "{{int(1-10)}}"
```

模板中可包含多个标签，例如 `{{int(1-100)}}`、`{{randstr(8)}}` 等，输出为多行，每行为一次替换结果。

## 常见 Fuzztag 示例

### 整数范围
```bash
yak fuzz -t "id={{int(1-10)}}"
yak fuzz -t "page={{int(1-100)}}"
```

### 随机字符串
```bash
yak fuzz -t "token={{randstr(16)}}"
```

### 组合使用
```bash
yak fuzz -t "user={{int(1-5)}}&role={{int(0-2)}}"
```

具体支持的标签以 `yak fuzz --help` 及 Yak 文档为准（如 `int`、`randstr`、`date` 等）。

## 典型场景

1. **参数枚举**：对 `id`、`page`、`type` 等参数生成 1–N 的取值。
2. **边界/越界测试**：大整数、负数、零等。
3. **与 HTTP 工具配合**：将生成结果作为 Burp/Yakit 的 payload 列表或脚本输入。
4. **与 auto-pentest / manual-pentest 衔接**：先 fuzz 出参数再交给漏洞脚本检测。

## 注意事项

- 输出行数可能很多，可重定向到文件：`yak fuzz -t "{{int(1-1000)}}" > ids.txt`。
- 仅在授权范围内对目标使用。
