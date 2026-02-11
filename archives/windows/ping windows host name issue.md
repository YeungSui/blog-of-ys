# 无法 ping windows 计算机名
## 前置知识
1. 当在命令行输入 ping your_computer_name 会先触发操作系统域名解析，取得 ip 地址后才能继续发送 icmp
2. 解析域名
    1. 从缓存获取。缓存有多处，例如 dns 缓存、netbios 缓存等，缓存之间优先级未了解
    2. 从 hosts 获取
    3. 请求 dns 服务器
    4. mDns
    5. LLMnr
    6. NetBIOS
## 解决问题
1. wireshark 抓包 ping 计算机名
2. 可以看到由 mDns 包，且请求和响应均正常，说明 win11 优先使用 mDns
3. 从 mDns 包请求可以看到解析域名多了 .local 后缀
4. ping your_computer_name.local 正常
5. 可能是某个更新后 windows 禁用了 LLMnr 或者修改了 mDns 限制（必须要 .local 后缀）