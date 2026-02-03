#!/usr/bin/env python3
# SSH 弱口令检测脚本

import paramiko
import socket
import sys

target = "192.168.0.8"
port = 22

# 常见用户名
usernames = ["root", "admin", "test", "user", "guest", "oracle", "mysql"]

# 常见弱密码
passwords = [
    "123456", "password", "12345678", "qwerty", "123456789",
    "root", "admin", "1234567890", "123123", "111111",
    "test", "guest", "1234567", "12345678901", "123456789012",
    "password123", "admin123", "root123", "123qwe", "qwe123",
    "1q2w3e", "1qaz2wsx", "1234qwer", "qwer1234", "P@ssw0rd"
]

def test_ssh_login(host, port, username, password):
    """测试 SSH 登录"""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, port=port, username=username, password=password, timeout=5)
        client.close()
        return True
    except paramiko.AuthenticationException:
        return False
    except socket.timeout:
        return False
    except Exception as e:
        return False

print(f"开始检测 SSH 弱口令: {target}:{port}")
print(f"测试 {len(usernames)} 个用户名 x {len(passwords)} 个密码 = {len(usernames) * len(passwords)} 种组合\n")

found = []

for user in usernames:
    for pwd in passwords:
        if test_ssh_login(target, port, user, pwd):
            print(f"✓ 发现弱口令: {user}:{pwd}")
            found.append((user, pwd))

if found:
    print(f"\n=== 检测完成，发现 {len(found)} 个弱口令 ===")
    for user, pwd in found:
        print(f"  - {user}:{pwd}")
else:
    print("\n=== 检测完成，未发现弱口令 ===")
