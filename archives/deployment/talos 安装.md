# talos 安装
## 准备工作
1. 准备一个稳定连接外网的路由：talos 安装时需要下载 k8s 相关组件，下载地址可能被污染
2. vmware 安装 promox 虚拟化平台
3. 下载 talos 镜像（自行选择版本）：https://github.com/siderolabs/talos/releases/download/v1.8.3/metal-amd64.iso

## 步骤
1. vmware 启动 promox
2. promox 或者其他 linux 机器上安装 talosctl 和 kubectl
2. promox 创建 image，选择准备工作下载的 talos 镜像文件
3. promox 创建两个 vm，后面选择其中一个作为 control plane 角色，一个作为 worker node 角色，需要注意
    1. 选择前面创建的 talos image
    2. cpu 核数，根据可能运行的程序决定，一般至少 2 核
    3. 内存，实测 control plane 完成安装后核心组件占用约 700MB，woker 约 400MB，加上要运行的程序估算最终大小
    4. 硬盘，实测 control plane 完成安装后占用约 5GB，worker 占用约 3GB
4. 创建完成后启动上述两个 vm
5. 进入 promox 或其他 linux 终端，开始执行命令安装 talos，基本上 talosctl 命令是在调用 talos api
6. 生成配置安装配置文件，该命令会在输出目录生成 controlplane.yaml, worker.yaml 和 talosconfig 三个文件
```shell
export CONTROL_PLANE_IP=<control plane ip 地址>
export WORKER_NODE_IP=<worker node ip 地址>
talosctl gen config <集群名称> https://$CONTROL_PLANE_IP:6443 --output-dir <配置文件输出目录>
```
7. 将 control plane 配置应用到节点，后续扩展 control plane 也可以使用该命令
```shell
talosctl apply-config --insecure --nodes $CONTROL_PLANE_IP --file <配置文件输出目录>/controlplane.yaml
```
8. 将 work node 配置应用到节点，后断扩展 worker node 也可以使用该命令
```shell
talosctl apply-config --insecure --nodes $WORKER_NODE_ID --file <配置文件输出目录>/worker.yaml
```
9. 配置 control plane 节点的 k8s api server
```shell
export TALOSCONFIG="<配置文件输出目录>/talosconfig"
talosctl config endpoint $CONTROL_PLANE_IP
talosctl config node $CONTROL_PLANE_IP
```
10. 启动 etcd
```shell
talosctl bootstrap
```
11. 生成 kubeconfig 文件，后续使用 kubectl 时需要使用该配置文件确定节点信息，否则 kubectl 会直接访问 localhost
```shell
talosctl kubeconfig "<配置文件输出目录>"
```
12. 等待一段时间后（talos 安装完成后），使用 kubectl 确认节点状态
```shell
kubectl get nodes --kubeconfig="<配置文件输出目录>/kubeconfig"
```
13. 至此 talos 的基础安装完成

## 组件、配置
### metrics-server
1. 参考 kubernetes 文档 [为容器和 Pod 分配内存资源](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/assign-memory-resource/)，我们需要运行 metric-server 服务。此时我们再参考 talos 文档 [Deploying Metrics Server](https://www.talos.dev/v1.8/kubernetes-guides/configuration/deploy-metrics-server/) 发现第一段就说 talos 部署到节点的证书默认是无法通过 metrics-server 校验的

    >Metrics Server enables use of the Horizontal Pod Autoscaler and Vertical Pod Autoscaler. It does this by gathering metrics data from the kubelets in a cluster. By default, the certificates in use by the kubelets will not be recognized by metrics-server. This can be solved by either configuring metrics-server to do no validation of the TLS certificates, or by modifying the kubelet configuration to rotate its certificates and use ones that will be recognized by metrics-server.
2. 解决的方法有两种：配置 metrics-server 关闭证书校验或者让节点自动生成能被 metrics-server 识别的证书。这里选择第二种，需要配置 talos 开启 rotate-server-certificates。
    
    ```yaml
    machine:
      kubelet:
        extraArgs:
          rotate-server-certificates: true
    ```
3. 如何将以上配置更新到已部署的 talos 节点就涉及 talos 的配置补丁（[configuration patches](https://www.talos.dev/v1.8/talos-guides/configuration/patching/)）。将以上配置写到一个文件，例如 patch-cert-rotation.yaml，然后执行
    ```shell
    talosctl patch mc --nodes $CONTROL_PLANE_IP,$WORKER_NODE_IP --patch @patch-cert-rotation.yaml
    ```
4. 完成以上操作后会发现 talos 节点终端会输出一些 ``tls: internal error`` 的错误信息，一般是因为自动生成的证书在等待审核。可以执行以下命令检查是否有等待签发的证书
    ```shell
    kubectl get csr --kubeconfig=<kubeconfig配置文件> | grep -i pending
    ```
    如果存在，可以使用以下脚本批量通过证书签发
    ```shell
    for i in $(kubectl get csr --kubeconfig=<kubeconfig配置文件> | grep -i pending | awk -F '{print $1}'); do kubectl certifate approve "$i" --kubeconfig=<kubeconfig文件>; done
    ```
5. 现在可以继续按照 talos 文档安装 metric-server 服务
    ```shell
    kubectl apply -f https://raw.githubusercontent.com/alex1989hu/kubelet-serving-cert-approver/main/deploy/standalone-install.yaml

    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

    ```
### TODO 部署 pod
### TODO 使用 helm