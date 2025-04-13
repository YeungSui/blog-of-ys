# ssh 配置
## 生成 ssh key
1. 生成
    - 直接用 ssh-keygen -t
    - 可以先用 openssl 生成 rsa key pair，再用 ssh-keygen 转换（很蠢的一个方法，既然有 ssh-keygen 直接用它生成就好）  
    本质都是 rsa key pair，只是内容格式的差别，具体命令：
        ```sh
        openssl genrsa -out certs/subject.pem # 私钥
        openssl rsa -pubout -in certs/subject.pair -out certs/subject.pub.tmp # 提取（计算？）出公钥
        ssh-keygen -i -f certs/subject.pub.tmp -m PKCS8 > certs/subject.pub # 转换为 ssh 格式的公钥
        ```
        需要留意 windows 中虽然提供了 openssh 的 ssh-keygen 命令，但是 -i 选项没有任何输出，可以使用如下命令（区别在于 -y 需要密钥文件）
        ```sh
        ssh-keygen -y -f certs/subject/subject.pair > certs/subject.pub
        ```
1. `` cat certs/subject.pub > ~/.ssh/authorized_keys``  
~/.ssh/authorized_keys 是 openssh 默认的 key 文件，根据配置修改输出的文件路径

## 配置 sshd
1. google 出来的默认配置文件都在 /etc/ssh/sshd_config，但是 opensuse 不知道为什么是在 /usr/etc/ssh/sshd_config（猜测在 /etc/ssh/sshd_config.d/ 放自定义的配置来覆盖 /usr/etc/ssh/sshd_config）
2. 修改端口号
3. PasswordAuthentication 设置为 no
4. ``systemctl restart sshd``
---
补充一下如何找到配置文件位置的
```sh
strace -e trace=file /usr/sbin/sshd |& grpe '^openat' | grep sshd_config
```
参考 https://unix.stackexchange.com/questions/179396/which-config-file-is-openssh-sshd-using  
原文是 grep '^open('，这里改为 '^openat'，可能是 strace 版本差异  

## 开放端口
1. iptables --list -4 得到 INPUT chain 是空的，默认策略是放行，但实际上连不上  
    可能是同时安装了 nftables 和 iptables 导致的（后续把 iptables 移除）
1. firewalld 配置
    ```sh
    cp /usr/lib/firewalld/services/ssh.xml /etc/firewalld/services
    vi /etc/firewalld/services
    # port 修改为自定义的端口
    # ...
    firewall-cmd --add-service=ssh
    firewall-cmd --reload
    ```

## 测试
1. ``ssh -i certs/subject.pem $user_name@127.0.0.1 -p $sshd_port``  
这里有可能提示 permissions are too open，需要将密钥文件拥有者改为 $user_name，并且权限改为组内成员及其他用户无权限即可

## 备注
1. host key 是主机privkey，猜测可以在 ssh 客户端保存 host pubkey 来避免中间人攻击（私钥不泄露的情况下）
2. github ssh 无法通过类似 ssh -i 这样指定私钥，默认使用 ~/.ssh/id_rsa，这时候有几种方法可以指定私钥文件：
    - 修改 git 内置变量 core.sshCommand 来更改默认的 ssh 连接命令  
    见 https://stackoverflow.com/questions/4565700/how-to-specify-the-private-ssh-key-to-use-when-executing-shell-command-on-git/38474137#38474137
    - ``ssh-agent bash -c 'ssh-add /path/to/private/key; git ...'`` 需要了解 ssh-agent 的原理，粗略看了下，应该是 ssh-agent 新建一个 shell 之类，然后将 ssh-add 添加的 key 都作为候选 key，后面的脚本命令执行用到 ssh 时会通过 ssh-agent 做身份验证和连接
    - 创建（修改）配置文件 ~/.ssh/config，添加如下内容
        ```
        Host gitremote
            HostName github.com
            IdentityFile /path/to/private/key
            IdentitiesOnly yes
        ```
        执行 git 命令时
        ```sh
        git clone git@gitremote:/path/to/repo .
        ```
        注意是 git@gitremote 对应配置文件 Host 后面的名称