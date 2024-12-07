# openwrt 旁路网关
基于 iptables 的透明代理性能可能比较好，但配置较多，有些配置的意义也不太理解，可能存在错误，导致本地使用时经常出现刷新多次才能打开网页的问题。遂决定另外安装一个 openwrt 作为旁路网关，并且使用 tun 解决透明代理。

1. 下载 [penwrt-23.05.5-x86-64-generic-ext4-combined.img.gz](https://mirrors.aliyun.com/openwrt/releases/23.05.5/targets/x86/64/openwrt-23.05.5-x86-64-generic-ext4-combined.img.gz)，然后在 vmware 创建虚拟机
2. 启动后按 enter 进入 shell，输入 passwd 创建密码
3. 修改 /etc/config/network 文件，设置 ip 和 gateway，然后重启 network 服务
    ```shell
    service network restart
    ```
4. 修改 /etc/config/opkg 配置，设置 opkg 代理（自行找一台内网设备运行代理设备）
    ```
        config http_proxy http://<代理ip>:<代理端口>
    ```
5. 安装以下包
    ```shell
    opkg update
    opkg install kmod-inet-diag kmod-netlink-diag kmod-tun kmod-tcp-bbr
    ```
6. 到 sb 仓库下载 pre-built 二进制文件，放到 /usr/bin
7. 创建配置文件 /etc/\<sb全称>/config.json
    ```json
    {
        "log": {
            "level": "info",
            "timestamp": true
        },
        "dns": {
            "servers": [
                {
                    "tag": "dns_proxy",
                    "address": "https://1.1.1.1/dns-query",
                    "address_resolver": "dns_resolver",
                    "strategy": "ipv4_only",
                    "detour": "proxy"
                },
                {
                    "tag": "dns_direct",
                    "address": "https://dns.alidns.com/dns-query",
                    "address_resolver": "dns_resolver",
                    "strategy": "ipv4_only",
                    "detour": "direct"
                },
                {
                    "tag": "dns_resolver",
                    "address": "223.5.5.5",
                    "strategy":"ipv4_only",
                    "detour": "direct"
                }
            ],
            "rules": [
                {
                    "outbound": "any",
                    "server": "dns_resolver"
                },
                {
                    "rule_set": "geosite-geolocation-!cn",
                    "server": "dns_proxy"
                }
            ],
            "final": "dns_direct"
        },
        "route": {
            "rule_set": [
                {
                    "tag": "geosite-geolocation-!cn",
                    "type": "remote",
                    "format": "binary",
                    "url": "https://<sb的geosite仓库>/rule-set/geosite-geolocation-!cn.srs",
                    "download_detour": "proxy"
                },
                {
                    "tag": "geoip-cn",
                    "type": "remote",
                    "format": "binary",
                    "url": "https://<sb的geoip仓库>/rule-set/geoip-cn.srs",
                    "download_detour": "proxy"
                }
            ],
            "rules": [
                {
                    "protocol": "dns",
                    "outbound": "dns-out"
                },
                {
                    "type": "logical",
                    "mode": "and",
                    "rules": [
                        {
                            "rule_set": "geoip-cn",
                            "invert": true
                        },
                        {
                            "rule_set": "geosite-geolocation-!cn"
                        }
                    ],
                    "outbound": "proxy"
                },
                {
                    "rule_set": "geoip-cn",
                    "outbound": "direct"
                },
                {
                    "ip_is_private": true,
                    "outbound": "direct"
                }
            ],
            "final": "proxy",
            "auto_detect_interface": true
        },
        "inbounds": [
            {
                "type": "tun",
                "interface_name":"tun0",
                "tag": "tun-in",
                "address": ["172.19.0.1/30"],
                "mtu": 1492,
                "auto_route": true,
                "strict_route": true,
                "stack": "system",
                "sniff": true,
                "sniff_override_destination": false
            }
        ],
        "outbounds": [
            {
                // 你的代理服务器配置
            },
            {
                "type": "direct",
                "tag": "direct"
            },
            {
                "type": "block",
                "tag": "block"
            },
            {
                "type": "dns",
                "tag": "dns-out"
            }
        ],
        "experimental": {
            "cache_file": {
                "enabled": true,
                "path": "cache.db"
            }
        }
    }
    ```
8. 配置 sb 服务 /etc/init.d/\<sb全称>
    ```shell
    #!/bin/sh /etc/rc.common                                
                                                        
    USE_PROCD=1                                             
    START=99                                            
                                                
    script=$(readlink "$initscript")                        
    NAME="$(basename ${script:-$initscript})"           
    PROG="/usr/bin/<sb文件>"                                         
                                                        
    start_service() {                                                
            config_load "$NAME"                         
                                                
            local enabled user group conffile workdir ifaces         
            config_get_bool enabled "main" "enabled" "0"
            [ "$enabled" -eq "1" ] || return 0                              
                                            
            config_get user "main" "user" "root"                            
            config_get conffile "main" "conffile"
            config_get ifaces "main" "ifaces"               
            config_get workdir "main" "workdir" "/usr/share/<sb全称>"       
                                            
            mkdir -p "$workdir"                                             
            local group="$(id -ng $user)"   
            chown $user:$group "$workdir"                                   
                                                            
            procd_open_instance "$NAME.main"                
            procd_set_param command "$PROG" run -c "$conffile" -D "$workdir"
                                            
            # Use root user if you want to use the TUN mode.  
            procd_set_param user "$user"
            procd_set_param file "$conffile" 
            [ -z "$ifaces" ] || procd_set_param netdev $ifaces
            procd_set_param stdout 1         
            procd_set_param stderr 1                                                             
            procd_set_param respawn 
                                                                                                
            procd_close_instance            
    }
    service_triggers() {                                      
            local ifaces                                      
            config_load "$NAME"                               
            config_get ifaces "main" "ifaces"
            procd_open_trigger                                
            for iface in $ifaces; do         
                    procd_add_interface_trigger "interface.*.up" $iface /etc/init.d/$NAME restart
            done                    
            procd_close_trigger                                                                  
            procd_add_reload_trigger "$NAME"                                                     
    }
    ```
9. 添加配置 /etc/config/\<sb全称>
    ```
    config <sb全称> 'main'
        option enabled '1'
        option user 'root'
        option conffile '/etc/<sb全称>/config.json'
        option workdir '/usr/share/<sb全称>'
    ```
9. 添加服务并启动
    ```shell
    /etc/init.d/<sb全称> enable
    /etc/init.d/<sb全称> start
    ```
10. 内网设备访问 luci 管理界面，network - interfaces，编辑 br-lan，dhcp server 勾选 ignore interface 禁用 dhcp
11. 继续 network - interfaces，add new interface，创建 name=tun0，protocol=unmanaged，device=tun0
12. 编辑新创建的 tun0，fireall settings 分配 zone 为自定义，起名为 proxy
13. sae and apply
13. 转到 network -firewall，zones 编辑 proxy，input output forward 全部允许，foward destination 选中所有
14. zones 编辑 lan，forward destination 选中所有
15. save and apply