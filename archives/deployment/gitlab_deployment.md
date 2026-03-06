# Gitlab 部署
## 环境
1. Fedora 42
2. Podman

## 步骤
1. 添加环境变量 `GITLAB_HOME`，这个主要是方便写 podman 命令挂载目录。不添加变量可以自行将 podman 启动命令里的变量替换为相应目录路径。
2. `vi gitlab.sh`
    ```bash
    podman run -d \
    --hostname your.gitlab.host \
    --env GITLAB_OMNIBUS_CONFIG="external_url 'http://your.gitlab.host:1280'; gitlab_rails['gitlab_shell_ssh_port'] = 1222;" \
    -p 1280:1280 \
    -p 1222:22 \
    --name gitlab \
    --volume $GITLAB_HOME/config:/etc/gitlab:Z,U \
    --volume $GITLAB_HOME/logs:/var/log/gitlab:Z,U \
    --volume $GITLAB_HOME/data:/var/opt/gitlab:Z,U \
    --shm-size 256m \
    docker.io/gitlab/gitlab-ce:latest
    ```

    - 1280 为 http 端口，可以自行改为其他。
    - -p 1280:1280，容器内部端口为 1280 而不是 80，因为前面 external_url 里有端口号。
    - external_url 可以不加端口号，只不过 gitlab 页面提示的项目地址取自 external_url，提示地址也会没有端口。
    - -p 1222:22，将容器内 ssh 端口号映射到主机的 1222
2. `./gitlab.sh`
3. smtp 配置是 gitlab 发送通知的关键。gitlab 管理员创建用户不能设置初始密码，而是通过发送重置密码邮件给新用户，新用户访问链接设置。`docker exec -it gitlab bash` 进入容器编辑 smtp 配置：
    ```toml
    gitlab_rails['smtp_enable'] = true
    gitlab_rails['smtp_address'] = "smtp.gmail.com"
    gitlab_rails['smtp_port'] = 587
    gitlab_rails['smtp_domain'] = "smtp.gmail.com"
    gitlab_rails['smtp_authentication'] = "login"
    gitlab_rails['smtp_enable_starttls_auto'] = true
    gitlab_rails['smtp_tls'] = false
    gitlab_rails['smtp_openssl_verify_mode'] = 'peer'
    gitlab_rails['gitlab_email_enabled'] = true
    ```
    - 以上配置项已存在，只不过被注释了，去掉对应配置项的注释符号，然后修改配置值
    - 本人用的 gmail，可以自行阅读 [SMTP配置文档](https://docs.gitlab.com/omnibus/settings/smtp/)，里面有很多其他邮件提供商的配置示例及注意事项说明
    - 这里没有 smtp_user 和 smtp_password 配置，因为可以参考 [Using encrypted credentials](https://docs.gitlab.com/omnibus/settings/smtp/#using-encrypted-credentials) 这一节说明配置，避免明文存储身份凭证
    - 配置完成后，文档只是让我们执行 `gitlab-ctl reconfigure`，但是实际使用发现，仅仅 reconfigure，创建用户后并没有发送重置密码邮件，重启容器后才能正常发送。
4. 管理员账号：root，初始密码在容器内的 `/etc/gitlab/initial_root_password`，或者主机的 `$GITLAB_HOME/config/initial_root_password`。注意尽快登录修改密码，据说初始密码有效期仅为24小时。
5. 由于本人将容器的 ssh 端口映射到 1222,而 git 访问仓库默认端口为 22。本人的解决方法为配置 ~/.ssh/config，这样顺便解决本人 ssh 私钥文件名不是 id_xxx 的问题：
    ```
    Host gitlab
        Hostname 192.168.1.99
        Port 1222
        User git
        IdentityFile ~/.ssh/gitlab_demo
    ```
    git 命令使用示例:
    ```bash
    # 拉取 group/project 仓库代码
    git clone gitlab:group/project.git
    # 设置远程仓库地址
    git remote add origin gitlab:group/project.git
    ```
    总的来说就是把 ssh://git@192.168.1.99:1222/group/project.git 用 gitlab 这个别名（config 文件里的 Host）替换掉了
