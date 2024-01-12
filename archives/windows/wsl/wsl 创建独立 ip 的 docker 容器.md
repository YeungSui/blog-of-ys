# wsl 创建独立 ip 的 docker 容器
## 环境
- win11 23h2
- wsl 2.0.9（先安装 wsl 1.x，然后 wsl --update，然后 wsl --update --pre-release）
- wsl 发行版 ubuntu-22.04
## 步骤
1. 执行以下脚本（参考 [https://www.zhaowenyu.com/linux-doc/kernel/namespaces/net-namespace.html]），ip 可以自行替换
    ```
    ip netns add netns0
    ip link add veth0 type veth peer name ceth0
    ip link set ceth0 netns netns0
    ip link set veth0 up
    ip netns exec netns0 ip link set ceth0 up
    ip netns exec netns0 ip addr add 192.168.45.2/24 dev ceth0
    ip link add br0 type bridge
    ip link set br0 up
    ip link set veth0 master br0
    ip addr add 192.168.45.1/24 dev br0
    ip netns exec netns0 ip route add default via 192.168.45.1
    iptables -t nat -A POSTROUTING -s 192.168.45.0/24 ! -o br0 -j MASQUERADE
    iptables -P FORWARD ACCEPT
    ```
    简略说明：
    1. 建立一个 net namepace：netns0
    2. 建立一对 veth：veth0 和 ceth0，其中将 ceth0 分配到 netns0
    3. ceth0 分配 IP：192.168.45.2
    4. 创建网桥 br0，并将 veth0 连到网桥
    5. br0 分配 IP：192.168.45.1
    6. netns0 添加默认网关为 192.168.45.1
    7. 防火墙添加 nat 规则：所有 192.168.45.0/24 网段发出并且下一跳地址不是 br0 的包做 snat 转换（发出时源地址改为网关地址，返回时防火墙自动将网关目标地址映射回真实的目标地址）
    8. 允许所有 IP 转发请求
2. 修改 docker 服务配置，在 Service 段加上 ``NetworkNamespacePath=/run/netns/netns0``。在我的环境中配置文件为 /lib/systemd/system/docker.service，可以通过 ``systemctl status docker`` 输出的 loaded 一栏找到。该配置作用为将 docker 的网络空间指定为自己创建的 netns0。默认的网络空间是与宿主隔离的，外部主机（windows）无法访问
3. docker 创建 macvlan 类型的网络
    ```
    docker network create -d macvlan --subnet=192.168.45.0/24 --gateway=192.168.45.1 -o parent=ceth0 mac1
    ```
4. windows 路由表添加路由：
    ```
    route add 192.168.45.1 <wsl 网关地址>
    route add 192.168.45.0 mask 255.255.255.0 192.168.45.1
    ```
5. 创建容器时只需要将 network 指定为 mac1，就能在 windows 上通过 IP 访问该容器