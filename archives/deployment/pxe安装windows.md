# pxe 安装 windows
## 概览
1. 部署 tftp 服务器
2. 部署 dhcp 服务器
3. 部署 winpe 映像文件

环境：  
- 虚拟机，双网卡，均为桥接模式，ip 分别为 192.168.1.100 和 1921.168.2.1
- 操作系统： ubuntu22.04
- 支持静态路由表的路由器，添加路由规则 192.168.2.0/24 -> 192.168.1.100

## 部署 tftp 服务器
1. 安装
    ```bash
    apt install tftpd-hpa
    ```
2. 配置  
    配置文件 /etc/default/tftpd-hpa  
    用默认配置就够了

3. 启动  
    service tftpd-hpa start

4. 测试下载文件
    ```bash
    echo world > /srv/tftp/hello
    busybox tftp -g -r hello 192.168.x.x
    ```

5. 问题  
    本机测试下载正常，但是到其他机器测试 timeout
    - journalctl -eu tftpd-hpa.service 查看日志，发现 no route to host
    - google 一圈都说是防火墙问题，建议关掉防火墙。关掉后果然解决，但是这种方法太粗暴
    - 于是尝试在客户机上开放源端口为 69 所有通信，还是不行
    - 原因： tftp 服务端发送文件时会随机创建新端口，举例说明：  
        客户端随机端口假设是 56789，连接服务端 69，由于防火墙策略是允许所有出站，通信正常  
        服务端要发送文件，此时随机创建端口 34567，连接客户端 56789，防火墙只允许白名单中的目标端口建立连接，因此连接被拒绝（更像是丢弃）
    - 解决方法，添加服务端 ip 到白名单
        ```
        firewall-cmd --permenant --zone=trusted --add-source=192.168.x.x
        ```

## 部署 dhcp
1. 安装  
    ```bash
    apt install isc-dhcp-server
    ```
2. 配置  
配置文件 /etc/dhcp/dhcpd.conf  
添加或者修改 subnet 配置段
```
subnet 192.168.2.0 netmask 255.255.255.0 {
    range 192.168.2.100 192.168.2.200;
    option routers 192.168.2.1;
    option domain-name-servers 192.168.2.1;
    option tftp-server-name "192.168.2.1";
    option bootfile-name "PXEboot.n12"; 
}
```
