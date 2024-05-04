# windows 不使用外部存储安装 kubuntu
## 前言
**非双系统**，本人是要铲掉 windows 安装 kubuntu，但是没有合适的 u盘。**注意备份数据**
## 环境
1. windows 11
2. 一块硬盘，剩余空间大于 8g，分区表类型 gpt
3. UEFI 引导
4. 已关闭 secure boot
## 步骤
1. 下载 kubuntu iso 安装镜像
2. windows 通过 parted 创建一个 efi 启动分区
    1. 需要以管理员身份启动 cmd
    2. 示例里面的 x 替换为自己的硬盘号，n1, n2 替换为实际的分区号, b 是盘符可以替换为其他没有使用的字母
    3. 示例中会重启资源管理器，注意保存文件。重启的目的是为了让资源管理器以管理员身份启动，以显示 efi 分区
```bash
diskpart
list disk
select disk x
list partition
select partition n1
shrink desired=8000
create partition efi size=8000
list partition
select partition n2
format fs=fat32 quick
active
assign letter=b
exit
taskkill /im explorer.exe /f
explorer.exe
```
3. 将安装镜像解压到新建的 efi 分区
4. shift + 重启，进入 bios，启动顺序 ``Linpus lite`` 设置为第一
5. 重启进入 kubuntu 安装界面，如果不需要 lvm，直接安装。如果要 lvm（挂载为根目录，方便以后扩容）
    0. kubuntu 安装程序虽然有个创建卷组的选项，但其实是用不了的，创建完之后是没法选择卷组创建分区，更不用说选择挂载点了。只能先自己建好逻辑卷和分区
    1. 选择 Try kubuntu 进入预览系统
    2. 通过 parted 删除不需要的分区，然后重新创建（注意预留 8～10g 空间给 efi 和 swap 分区），标记为 lvm
    3. 使用 lvm 相关命令创建逻辑卷
    ```bash
    # x 替换为自己的块设备（硬盘分区）
    pvcreate /dev/x
    vgcreate vg_kubuntu_root /dev/x
    lvcreate -l 100%VG -n lv_kubuntu_root vg_kubuntu_root
    ```
    4. 格式化为 xfs，这里可以自行选择文件系统
    ```bash
    mkfs.xfs /dev/vg_kubuntu_root/lv_kubuntu_root
    ```
    5. 开始菜单搜索 install，进入安装程序，在分区相关设置时选择手动分区
        1. 在顶部可以选择操作的硬盘，这里应该会有两个选项，一个是物理硬盘，一个是前面建的逻辑卷
        2. 先操作物理硬盘，从未分配的空间中划分 1g 空间，格式化为 fat32，选中 boot 标记，挂载点设为 /boot/efi
        3. 从未分配的空间划分 4g 空间，格式化为 linuxswap
        4. 顶部选择 lvm 逻辑卷，选中唯一的分区，挂载点设为 /。选择保留，不要选择格式化，否则后面安装会出错
    6. 本人在物理盘建分区挂载到 /boot 安装时也会出错，不知道什么原因。只能放弃单独挂载
    7. 后面自己设置安装即可
6. 安装后进入 bios，启动设置里将 ubuntu 设为第一，大功告成