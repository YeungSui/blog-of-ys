# tproxy 透明代理（v2ray 客户端）
## iptables 和路由表设置
1. 环境说明：ubuntu 24.04，内网网段 192.168.31.0/24
2. 本机已开启 ipv4 转发，并且禁用 ufw（不清楚是否会有影响）
3. 脚本如下，原理见注释
```bash
# 新建一个 mangle 目标，名为 V2RAY，与本机在同一网段的机器以本机 ip 作为网关时也能使用代理
iptables -t mangle -N V2RAY
# 以下 ip / 网段 不需要 tproxy，比如回环地址、内网网段、广播地址、多播网段等
iptables -t mangle -A V2RAY -d 127.0.0.1/8 -j RETURN
iptables -t mangle -A V2RAY -d 192.168.31.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 192.168.95.0/24 -j RETURN
iptables -t mangle -A V2RAY -d 255.255.255.255/32 -j RETURN
iptables -t mangle -A V2RAY -d 224.0.0.0/4 -j RETURN
# 带有 0xff(255) 标记的包也不进行代理，后面配置 v2ray 时会将已经处理的包加上 255 标记，避免重复回环
iptables -t mangle -A V2RAY -j RETURN -m mark --mark 0xff 
# 剩余的包全部由 127.0.0.1:12345（v2ray 任意门） 代理，端口号会在 v2ray 配置
iptables -t mangle -A V2RAY -p tcp -j TPROXY --on-ip 127.0.0.1 --on-port 12345 --tproxy-mark 1
iptables -t mangle -A V2RAY -p udp -j TPROXY --on-ip 127.0.0.1 --on-port 12345 --tproxy-mark 1
# 将这些 mangle 规则应用到 PREROUTING
iptables -t mangle -A PREROUTING -j V2RAY

# 本机向外发出的流量并不会经过 PREROUTING，本机访问外网时并不会走代理。需要增加以下规则让流量走回 PREROUTING，这些规则要结合后面的 ip 命令理解
iptables -t mangle -N V2RAY_MASK
# 本机、内网、v2ray 发出的包等不需要走代理
iptables -t mangle -A V2RAY_MASK -d 127.0.0.1/8 -j RETURN
iptables -t mangle -A V2RAY_MASK -d 255.255.255.255/32 -j RETURN
iptables -t mangle -A V2RAY_MASK -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A V2RAY_MASK -d 192.168.31.0/24 -j RETURN
iptables -t mangle -A V2RAY_MASK -d 192.168.95.0/24 -j RETURN
iptables -t mangle -A V2RAY_MASK -d 192.168.1.0/24 -j RETURN
#iptables -t mangle -A V2RAY_MASK -m cgroup --path system.slice/v2ray.service -j RETURN
iptables -t mangle -A V2RAY_MASK -j RETURN -m mark --mark 0xff
# 剩余流量打上标记 1，后面设置路由表，在 OUTPUT 阶段将标记 1 的流量重定向回本机，这样就会进入 PREROUTING，应用上面设置的 v2ray 规则
iptables -t mangle -A V2RAY_MASK -p tcp -j MARK --set-mark 1
iptables -t mangle -A V2RAY_MASK -p udp -j MARK --set-mark 1
iptables -t mangle -A OUTPUT -j V2RAY_MASK

# 出口流量打标记 1
ip rule add fwmark 1 table 100
# 将出口流量重定向回本机（走代理）
ip route add local 0.0.0.0/0 dev lo table 100
```
## v2ray 客户端配置
1. [配置文档](https://www.v2ray.com/chapter_02/01_overview.html)
2. [tproxy 配置教程](https://guide.v2fly.org/app/tproxy.html)
3. 配置示例
```json
{
  "log": {
    "access": "/var/log/v2ray/access.log",
    "error": "/var/log/v2ray/error.log",
    "loglevel": "info"
  },
  "inbounds": [
   {
     "port": 12345,
     "listen": "127.0.0.1",
     "protocol": "dokodemo-door",
     "settings": {
       "network": "tcp,udp",
       "followRedirect":true
     },
     "sniffing":{
       "enabled":true,
       "destOverride": ["http","tls"]
     },
     "tag":"transparent",
     "streamSettings": {
       "sockopt": {
         "tproxy":"tproxy",
         "mark":255
       }
     }
   } 
  ],
  "outbounds": [{
    "tag":"proxy",
    "protocol": "vmess",
    "settings": {
      "vnext": [{
        "address": "xxx", // 服务器地址，请修改为你自己的服务器 ip 或域名
        "port": xxx,  // 服务器端口
        "users": [{ "id": "xxx" }] // 用户 id
      }]
    },
    "streamSettings": {
      "sockopt": {
        "mark":255
      }
    },
    "mux": {"enabled":true}
  },{
    "protocol": "freedom",
    "tag": "direct",
    "settings": {},
    "streamSettings": {
      "sockopt" : { "mark":255 }
    }
  },
  {
    "tag": "dns-out",
    "protocol":"dns",
    "streamSettings": {
      "sockopt":{
        "mark":255
      }
    }
  }],
  "dns": {
    "servers": [
      {
        "address": "223.5.5.5",
        "port": 53,
        "domains": [
          "ext:dlc.dat:geolocation-cn",
          "ntp.org",
          "will-no3-mavis.edwina.cc"
        ]
      },
      {
        "address": "1.1.1.1",
        "port": 53,
        "domains": ["ext:dlc.dat:geolocation-!cn"]
      }
    ]
  },
  "routing": {
    "domainStrategy": "IPOnDemand",
    "rules": [
    {
      "type":"field",
      "inboundTag": ["transparent"],
      "port":53,
      "network":"udp",
      "outboundTag": "dns-out"
    },
    {
      "type":"field",
      "port": 123,
      "inboundTag":"transparent",
      "network": "udp",
      "outboundTag":"direct"
    },
    {
      "type":"field",
      "ip":["223.5.5.5"],
      "outboundTag":"direct"
    },
    {
      "type":"field",
      "ip":["1.1.1.1"],
      "outboundTag":"proxy"
    },
    {
      "type": "field",
      "ip": ["geoip:private"],
      "outboundTag": "direct"
    },
    {
      "type": "field",
      "outboundTag": "direct",
      "domain": [
        "ext:dlc.dat:private",
        "ext:dlc.dat:tld-cn",
        "ext:dlc.dat:category-games@cn"
      ]
    },
    {
      "type": "field",
      "outboundTag": "proxy",
      "domain": ["ext:dlc.dat:geolocation-!cn"]
    },
    {
      "type":"field",
      "outboundTag":"direct",
      "domain": ["ext:dlc.dat:geolocation-cn"]
    },
    {
      "type":"field",
      "outboundTag":"direct",
      "network":"tcp"
    }]
  }
}
```
4. 对于透明代理比较重要的配置 inbounds[?].protocol="dokodemo-door"，端口要和前面配置规则时的端口一致
5. 示例里面的 ext:dlc.dat 是自定义的外部资源文件，需要准备 dlc.dat。不了解的话直接替换成 geosite
5. 注意事项
    1. 所有 inbounds，尤其是后期增加时，要加上 streamSettings，避免 iptables 再次发回代理
    ```json
    {
        "inbounds": [
            {
                "protocol": "xxx",
                "streamSettings": {
                    "sockopt": {
                        "mark": 255
                    }
                }
            }
        ]
    }
    ```
    2. 留意 ``"destOverride": ["http","tls"]``，尝试将 ip 重新转回域名再处理，不设置可能影响透明代理。不清楚原理，但是自己尝试不加这个访问不了网络
