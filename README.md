# Evil Yaklang

基于上游项目的 fork：去掉安全护栏，并强化为**渗透测试 / 安全研究**用途的 AI 助手。

---

## 特色与亮点

- **无护栏**：系统提示词中与“拒绝写恶意代码 / 仅防御性安全”等相关的限制已移除，便于授权渗透测试与漏洞研究。
- **Yak 安全助手**：默认角色为 Yak（渗透测试与安全研究专家），支持漏洞利用、Payload 编写、权限提升、横向移动等。
- **中文回复**：所有模型提示词要求以简体中文回复，便于本地使用。
- **全流程自动渗透技能**：内置 `auto-pentest` 技能，一句话触发「端口扫描 → 指纹 → 爬虫 → 漏洞脚本 → 弱口令 → 报告」全流程，报告输出为 `.md` 并给出路径。
- **敏感操作约束**：在提示词层面约定：发现垂直越权等敏感漏洞时仅报告与修复建议，不实际执行敏感操作。
- **本地可打包**：支持单平台 `--single` 与全平台构建，可选 `--skip-install` 跳过依赖安装以加快重复构建。

---

## 安装与使用

### 从 Release 安装 CLI

从 [Releases](https://github.com/WinMin/evil-opencode/releases) 下载对应平台二进制，或：

```bash
# macOS Apple Silicon
curl -L https://github.com/WinMin/evil-opencode/releases/latest/download/yaklang-darwin-arm64 -o /usr/local/bin/yaklang && chmod +x /usr/local/bin/yaklang

# macOS Intel
curl -L https://github.com/WinMin/evil-opencode/releases/latest/download/yaklang-darwin-x64 -o /usr/local/bin/yaklang && chmod +x /usr/local/bin/yaklang

# Linux x64 / ARM64
curl -L https://github.com/WinMin/evil-opencode/releases/latest/download/yaklang-linux-x64 -o /usr/local/bin/yaklang && chmod +x /usr/local/bin/yaklang
# 或 yaklang-linux-arm64
```

Windows：下载 `yaklang-windows-x64.exe` 放入 PATH。

**技能包（auto-pentest 等）**：二进制不内置 skill，需把 `.yaklang` 放到 `~/.config/yaklang` 或项目根对应位置。
- **不经过 GitHub、只用本机**：见下文「本地迁移技能到另一台机器」。
- **从 Release 下载**：在 Release 页下载 `yaklang-skills.zip`，解压到用户目录，例如 `unzip yaklang-skills.zip -d ~`。

### 在 Linux 上使用（含 auto-pentest）

换到一台 **Linux** 机器时，按下面做即可用我们的 skill（含全流程渗透）：

1. **装 yaklang（Linux 二进制）**
   ```bash
   # x64
   curl -L https://github.com/WinMin/evil-opencode/releases/latest/download/yaklang-linux-x64 -o /usr/local/bin/yaklang && chmod +x /usr/local/bin/yaklang
   # 或 ARM64：yaklang-linux-arm64
   ```

2. **装技能包**  
   任选其一即可：
   - **从本机迁移（不经过 GitHub）**：在**有本仓库的那台机器**上打包并拷到 Linux，见下文「本地迁移技能到另一台机器」。
   - **从 Release 下载**：`curl -L -o /tmp/yaklang-skills.zip https://github.com/WinMin/evil-opencode/releases/latest/download/yaklang-skills.zip`，然后 `unzip /tmp/yaklang-skills.zip -d /root`。  
   解压后应有 `/root/.yaklang/skill/auto-pentest/`。若报 No such file or directory，说明还没装技能包，需先完成上述任一步骤，不要单独 `mkdir`（空目录无技能文件）。

3. **装 Yak（必装）**  
   auto-pentest 里端口扫描、爬虫、漏洞脚本等都是 **Yak** 脚本（`.yak`），需要本机有 **YakRunner** 且 `yak` 在 PATH。未装时执行「全流程测试」会报 `yak: command not found`。
   - 安装：见 [yaklang.com](https://yaklang.com) 或 [YakRunner 发行版](https://github.com/yaklang/yakrunner/releases)，按官方文档在 Linux 上安装并确保 `yak` 可用。
   - 校验：终端执行 `yak version` 能输出版本即可。

4. **使用**  
   在任意目录执行 `yaklang`，在会话里输入「全流程测试 \<目标 URL\>」或「自动渗透 \<URL\>」即可跑全流程；报告会写在技能目录下的 `reports/` 里（路径会在回复中给出）。

### 本地迁移技能到另一台机器（不经过 GitHub）

只用本机仓库里的 `.yaklang`，不依赖 Release 或 GitHub：

1. **在有本仓库的那台机器上**（例如你开发的 Mac）打包：
   ```bash
   cd /path/to/evil-opencode-main
   zip -r yaklang-skills.zip .yaklang -x "*.git*"
   ```

2. **把 `yaklang-skills.zip` 拷到 Linux**（任选一种）：
   - `scp yaklang-skills.zip root@cyber:/tmp/`
   - 或 U 盘、网盘、内网共享等

3. **在 Linux 上解压到用户目录**：
   ```bash
   unzip -o /tmp/yaklang-skills.zip -d /root
   ```
   解压后若没有 `/root/.yaklang`，可能是 zip 里目录名被存成 `yaklang`（无点），会变成 `/root/yaklang`，需要改成点目录：
   ```bash
   [ -d /root/yaklang ] && [ ! -d /root/.yaklang ] && mv /root/yaklang /root/.yaklang
   ls -la /root/.yaklang/skill/auto-pentest/
   ```

**若仍然 No such file or directory**：在 Linux 上先看当前有什么：
   ```bash
   ls -la /root/.yaklang 2>/dev/null || true
   ls -la /root/ | grep -E 'yaklang|\.yaklang'
   ```
   - 若没有 `yaklang-skills.zip`：回到本机执行步骤 1～2，把 zip 拷到 `/tmp/` 再解压。
   - 若有 `/root/yaklang` 没有 `/root/.yaklang`：执行上面的 `mv /root/yaklang /root/.yaklang`。

也可以不打包，直接 rsync 整个 `.yaklang` 目录：
```bash
rsync -avz /path/to/evil-opencode-main/.yaklang/ root@cyber:/root/.yaklang/
```

### 桌面版

从同一 Release 页下载对应平台的 `.dmg`（macOS）、`.msi`/`.exe`（Windows）、`.AppImage`/`.deb`（Linux）。macOS 未签名，首次运行需：

```bash
xattr -cr /Applications/Yaklang.app
# 或：系统设置 → 隐私与安全性 → 仍要打开
```

### 日常使用

- **开发模式**（在项目内）：`bun dev`（需在 `packages/yaklang` 或项目根配置好 `bun`）。
- **全流程自动渗透**：在会话中说「全流程测试 \<URL\>」或「自动渗透 \<URL\>」，会依次执行端口扫描、指纹、爬虫、漏洞脚本、弱口令，并生成简洁的 `.md` 报告到技能目录下 `reports/`。

---

## 本地构建（打包）

环境要求：Bun（建议 1.3.x），且已 `bun install` 过项目根目录。

```bash
cd packages/yaklang
OPENCODE_CHANNEL=latest OPENCODE_VERSION=1.1.4 bun run build --single
```

- **`--single`**：只打当前平台（如 macOS arm64），速度快。
- **全平台**：去掉 `--single`，会依次打 Linux / macOS / Windows 多架构（依赖安装会拉全平台可选依赖，较慢）。
- **跳过依赖安装**：若依赖已装过，可加 `--skip-install`，只做编译：

```bash
OPENCODE_CHANNEL=latest OPENCODE_VERSION=1.1.4 bun run build --single --skip-install
```

产物在 `packages/yaklang/dist/yaklang-<平台>-<架构>/bin/yaklang`（Windows 为 `yaklang.exe`）。

如需在 CI 中手动触发全平台构建与 Release：

```bash
gh workflow run build-release.yml -f opencode_version=1.1.6 -f release_tag=v1.1.6-unguarded
```

---

## 与本项目无关的内容说明

- 不提供、不维护上游的安装脚本、Discord、npm 包、官方文档链接。
- 默认分支为 `dev`；Release 与 CI 以本仓库为准。

---

## 免责与许可

仅供**教育与授权安全研究**使用，请遵守当地法律与授权范围。  
MIT License，与上游一致。
