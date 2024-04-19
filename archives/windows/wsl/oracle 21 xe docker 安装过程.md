# oracle 21 xe docker 安装过程：

官方说明文档：https://container-registry.oracle.com/ords/f?p=113:4:103220856404881:::4:P4_REPOSITORY,AI_REPOSITORY,AI_REPOSITORY_NAME,P4_REPOSITORY_NAME,P4_EULA_ID,P4_BUSINESS_AREA_ID:803,803,Oracle%20Database%20Express%20Edition,Oracle%20Database%20Express%20Edition,1,0&cs=3vdYR-JWEKIHbhSnrsg_VZOEyYbr5_TF0ISI-EVgdObeOQTGMlXKmmNiedUnAoMQd61C4XxpJxvoxAIm4Ns_G-g

## 步骤
1. 获取镜像并运行
    ```bash
    docker pull container-registry.oracle.com/database/express:21.3.0-xe
    docker run --network mac1 --ip 192.168.45.129 --name oracle21 \
    #-p <host port>:1521 -p <host port>:5500 #映射端口，视网络配置而定 \
    -e ORACLE_PWD=mail112233 \
    #-e ORACLE_CHARACTERSET=<your character set> #默认为 AL32UTF8 \
    #-v [<host mount point>:]/opt/oracle/oradata #挂载数据目录到本地 \
    container-registry.oracle.com/database/express:21.3.0-xe
    ```
2. 创建用户及表空间
    ```bash
    docker exec -it <name> sqlplus '/as sysdba'
    ```
    inside sqlplus
    ```sql
    show pdbs;
    alter session set container = XEPDB1;
    create tablespace TDEMO datafile 'TDEMO.dbf' size 128M autoextend on next 5M maxsize unlimited;
    create user tdemo identified by mail112233 default tablespace TDEMO temporary tablespace TEMP profile DEFAULT;
    grant connect, resource, dba to tdemo; 
    ```
    关于 alter session 见 https://stackoverflow.com/questions/33330968/error-ora-65096-invalid-common-user-or-role-name-in-oracle-database
3. 从外部连接 oracle
    - 获取 SID（实例标识），进入容器 bash 执行
        ```bash
        echo $ORACLE_SID
        ```
        结果为 XE，但默认只能使用 cdb，无法使用 sys 或 sysdba 以外的用户连接
    - 普通用户需要以 SERVICE_NAME 方式连接，例如 jdbc:oracle:thin:@//192.168.45.129:1521/XEPDB1