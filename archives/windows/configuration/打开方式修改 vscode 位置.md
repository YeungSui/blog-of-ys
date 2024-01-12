## 问题描述：
下载了一个非安装版本的 vs code，打开 txt 等文本文件时通过 右键 - 打开方式 - 选择其他应用 - 更多应用 - 在这台电脑上查找更多应用，选中 vs code 解压目录下的 code.exe。  
后来又下载了一个 新版本的 vs code，正常应该是解压覆盖旧版本文件就行了，但是一时想不起来就另外建了个目录解压。此时通过打开方式选择的 vs code 继续是旧版本的。
## 解决方法
修改注册表
HKEY_CURRENT_USER\Software\Classes\Applications\Code.exe\shell\open\command  
右侧 默认 项对应的数据就是 vs code 的路径  
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.xml\OpenWithList  
表示扩展名为 .xml 的打开方式列表，右侧包含多个小写字母表示的项  
如果曾今选择过 vs code 打开 .xml，那么就会有一项的数据为 Code.exe，Code.exe 可以理解为引用，系统会到 Classes\Applications 下寻找 Code.exe 对应的程序路径
## 待完善
这里只是解决了替换路径的问题，但是如果我不用 vs code 了，右键 - 打开方式 - 选择其他应用 列表中还是会包含 vs code 的选项，暂时未找到删除的方法。  