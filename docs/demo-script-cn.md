# 中文演示流程

这份文档是演示时可以照着走的中文流程。目标不是把每个命令都背下来，而是知道每一步在证明什么。

项目主线可以这样讲：

本项目把一个多用户 TodoList 应用部署在 OpenNebula 创建的虚拟机上。OpenNebula 提供 IaaS 层，k3s Kubernetes 提供容器编排层。应用由 React 前端、Node.js 后端和 PostgreSQL 数据库组成，并使用 Kubernetes Secret、NetworkPolicy、PersistentVolumeClaim 和 HPA 展示安全、持久化和自动扩缩容能力。

## 0. 演示前准备

建议准备三个终端。

第一个终端在 Windows 上开 OpenNebula 管理页面隧道：

```powershell
ssh -L 8081:127.0.0.1:80 labvm
```

含义：把你本地 Windows 的 `localhost:8081` 转发到 lab VM 自己的 `127.0.0.1:80`。OpenNebula FireEdge/Sunstone 跑在 lab VM 的 80 端口，所以浏览器访问 `http://localhost:8081/fireedge/sunstone` 就能打开 OpenNebula 面板。

第二个终端在 Windows 上开 TodoList 应用隧道：

```powershell
ssh -L 8082:172.16.100.4:31600 labvm
```

含义：把你本地 Windows 的 `localhost:8082` 转发到 OpenNebula 内部 VM `172.16.100.4` 的 `31600` 端口。`31600` 是 k3s 里 Traefik 暴露出来的 NodePort，所以浏览器访问 `http://localhost:8082` 就能看到 TodoList。

第三个终端 SSH 到 lab VM，再进入 OpenNebula VM：

```bash
ssh labvm
ssh ubuntu@172.16.100.4
```

含义：先进入课程给你的 lab VM，再从 lab VM 进入 OpenNebula 创建出来的 Ubuntu VM。之后大部分 Kubernetes 命令都在 `ubuntu@localhost` 这个 OpenNebula VM 里执行。

## 1. 展示 OpenNebula IaaS 层

先打开浏览器：

```text
http://localhost:8081/fireedge/sunstone
```

在 OpenNebula 面板里展示 VM：`todolist-k3s-node`。

你可以这样说：

这里展示的是项目使用的 IaaS 层。我通过 OpenNebula 创建了一台 Ubuntu Minimal 22.04 虚拟机，配置是 2 vCPU、4 GB RAM，并连接到 `vnet` 网络。这个 VM 的 IP 是 `172.16.100.4`，它作为单节点 Kubernetes 集群运行 k3s。

在 OpenNebula VM 终端里执行：

```bash
hostname
whoami
cat /etc/os-release
ip addr
lsblk
df -h
```

含义：

`hostname` 显示当前机器名，证明你现在是在 OpenNebula VM 里。

`whoami` 显示当前用户，通常是 `ubuntu`。

`cat /etc/os-release` 显示操作系统版本，证明这是 Ubuntu 22.04。

`ip addr` 显示网络接口和 IP，重点看 `172.16.100.4`。

`lsblk` 显示虚拟磁盘。这里应该能看到小的系统盘 `vda`，以及额外的 20 GB 数据盘 `sda`。

`df -h` 显示磁盘挂载情况，重点看 `/dev/sda` 是否挂载到 `/var/lib/rancher`。

期待结果：

`/dev/sda` 是 20 GB，并挂载在 `/var/lib/rancher`。这点很重要，因为 k3s 和它的 local-path storage 会把运行时数据和持久卷放在这里。

## 2. 展示 k3s Kubernetes 集群

执行：

```bash
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl get pods -A
```

含义：

`sudo k3s kubectl get nodes -o wide` 查看 Kubernetes 节点。这里应该只有一个节点，因为我们做的是单节点 k3s 集群。

`sudo k3s kubectl get pods -A` 查看所有 namespace 里的 Pod，包括 Kubernetes 系统组件。

期待结果：

节点状态是 `Ready`。系统组件里应该能看到 `coredns`、`local-path-provisioner`、`metrics-server`、`traefik` 等都是 `Running`。

你可以这样解释：

k3s 是轻量级 Kubernetes 发行版。它还是 Kubernetes，只是更适合单节点或资源有限的环境。这里我选择 k3s，是因为项目重点是展示 Kubernetes 的部署、安全、持久化和扩缩容机制，而不是搭建复杂的多节点集群。

接着看 Traefik：

```bash
sudo k3s kubectl get svc traefik -n kube-system
```

含义：

Traefik 是 k3s 默认安装的 Ingress Controller。它负责接收外部 HTTP 请求，再按照 Ingress 规则转发到 frontend 或 backend。

期待结果：

你会看到类似：

```text
80:31600/TCP
```

这里 `80` 是 Kubernetes Service 内部端口，`31600` 是暴露在 VM 上的 NodePort。我们访问 TodoList 用的是 `31600`。

## 3. 展示应用部署状态

执行：

```bash
cd /var/lib/rancher/work/secure-cloud-native-todolist
sudo k3s kubectl get all -n todolist
sudo k3s kubectl get ingress -n todolist
sudo k3s kubectl describe ingress todolist -n todolist
```

含义：

`cd /var/lib/rancher/work/secure-cloud-native-todolist` 进入项目代码目录。

`sudo k3s kubectl get all -n todolist` 查看 `todolist` namespace 里的主要资源，包括 Pod、Service、Deployment 等。

`sudo k3s kubectl get ingress -n todolist` 查看应用入口。

`sudo k3s kubectl describe ingress todolist -n todolist` 查看详细路由规则。

期待结果：

应该能看到 frontend、backend、postgres 三个 Pod 都是 `Running`。Ingress 里应该能看到流量会被转发到 frontend 和 backend。

你可以这样解释：

应用拆成三个主要组件。Frontend 是 React 页面，由 Nginx 提供静态文件。Backend 是 Node.js API，处理登录注册和 Todo 操作。PostgreSQL 存储用户和 Todo 数据。PostgreSQL 没有暴露给外部，只能通过后端访问。

## 4. 展示 TodoList 功能

浏览器打开：

```text
http://localhost:8082
```

演示顺序：

注册一个用户，登录，添加 Todo，勾选完成，删除 Todo。可以再注册另一个用户，说明每个用户只能看到自己的 Todo。

你可以这样解释：

TodoList 本身功能比较简单，因为项目重点不是做复杂业务，而是展示一个真实应用如何被容器化并部署到 Kubernetes 中。

## 5. 展示 PostgreSQL 持久化

先在浏览器里创建一个 Todo，比如：

```text
persistence test
```

然后执行：

```bash
sudo k3s kubectl get pvc -n todolist
```

含义：

`pvc` 是 PersistentVolumeClaim，也就是应用向 Kubernetes 申请的持久存储。PostgreSQL 使用这个 PVC 保存数据库数据。

期待结果：

能看到 `postgres-data`，状态是 `Bound`，大小是 `2Gi`，StorageClass 是 `local-path`。

接着删除 PostgreSQL Pod：

```bash
sudo k3s kubectl delete pod -n todolist -l app=postgres
sudo k3s kubectl get pods -n todolist
```

含义：

第一条命令删除带有 `app=postgres` 标签的 PostgreSQL Pod。

第二条命令查看 Pod 状态。

期待结果：

旧的 PostgreSQL Pod 被删除后，Kubernetes 会自动创建一个新的 PostgreSQL Pod。然后刷新网页，刚才创建的 Todo 还在。

你可以这样解释：

如果数据只存在旧 Pod 的临时文件系统里，删除 Pod 后数据就没了。但现在数据还在，说明 PostgreSQL 数据写入了 PVC。这个 PVC 由 k3s 的 `local-path` provisioner 创建，并最终落在 OpenNebula VM 的 `/var/lib/rancher` 下面。

## 6. 展示安全机制

先展示 Secret：

```bash
sudo k3s kubectl get secret todolist-secrets -n todolist
```

含义：

Kubernetes Secret 用来保存数据库密码和 JWT secret，而不是把敏感信息写死在代码或镜像里。

然后展示 NetworkPolicy：

```bash
sudo k3s kubectl describe networkpolicy postgres-backend-only -n todolist
```

含义：

NetworkPolicy 限制 Pod 之间的网络访问。这里的策略是：只有 backend Pod 可以访问 PostgreSQL 的 5432 端口，frontend 或其他普通 Pod 不能直接访问数据库。

测试一个普通 Pod 直接访问数据库：

```bash
sudo k3s kubectl run denied-client -n todolist --image=postgres:16-alpine --restart=Never --rm -i --command -- sh -c "timeout 5 pg_isready -h postgres -p 5432; echo exit:$?"
```

含义：

这条命令临时创建一个名为 `denied-client` 的 Pod，使用 PostgreSQL 客户端工具去访问 `postgres:5432`。因为这个 Pod 不是 backend，所以 NetworkPolicy 应该阻止它访问数据库。

期待结果：

连接失败、超时，或者显示 `no response`。这说明普通 Pod 不能直接访问 PostgreSQL。

再测试后端可以正常访问数据库：

```bash
curl -X POST http://127.0.0.1:31600/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"dbtest","password":"test123"}'

curl -X POST http://127.0.0.1:31600/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dbtest","password":"test123"}'
```

含义：

这不是直接访问数据库，而是通过 backend API 注册和登录用户。注册和登录需要 backend 读写 PostgreSQL，所以如果返回 token，就说明 backend 到数据库的通信正常。

期待结果：

返回 JSON，里面有 `token` 和 `user`。这证明数据库不是完全被封死，而是只允许合法的 backend 访问。

## 7. 展示 HPA 自动扩缩容

先看当前状态：

```bash
sudo k3s kubectl get hpa -n todolist
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl top pods -n todolist
```

含义：

`get hpa` 查看 Horizontal Pod Autoscaler，也就是水平 Pod 自动扩缩容器。

`get pods` 查看当前有几个 backend Pod，以及它们是否 Running。

`top pods` 查看每个 Pod 的 CPU 和内存使用量。

你可以这样解释：

HPA 会根据 metrics-server 提供的 CPU 指标调整 backend 的副本数。这个项目里 backend 的副本数最少是 1，最多是 3，目标 CPU 使用率是 50%。

运行测压：

```bash
for round in $(seq 1 5); do
  for i in $(seq 1 600); do curl -s http://127.0.0.1:31600/api/load > /dev/null & done
  sleep 5
done
```

含义：

外层循环跑 5 轮。每一轮发送 600 个后台请求到 `/api/load`。这个接口会让 backend 做一些 CPU 工作，从而提高 CPU 使用率。`> /dev/null` 表示丢掉输出，只保留压力。

测压时或测压后重复执行：

```bash
sudo k3s kubectl get hpa -n todolist
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl top pods -n todolist
```

期待结果：

HPA 的 `TARGETS` 从低 CPU 变成高 CPU，比如超过 `50%/50%`。然后 backend Pod 从 1 个变成 2 个或 3 个。

如果演示时已经成功看到 3 个 backend Pod，就可以停，不需要等它缩回 1 个。Kubernetes 默认会等一段时间再缩容，这是为了避免负载波动时频繁创建和删除 Pod。

## 8. 展示 CI

打开 GitHub 仓库的 Actions 页面，展示 `Build Docker Images` workflow。

你可以这样说：

这个项目使用 GitHub Actions 做 CI。每次 push 到 GitHub 后，workflow 会自动构建 frontend 和 backend 的 Docker image。对 main 分支的 push，还会把镜像推送到 GitHub Container Registry。

注意这里实现的是 CI，不是完整 CD。也就是说，GitHub 会自动 build image，但 OpenNebula VM 上的 Kubernetes 部署仍然是手动执行 `git pull` 和 `kubectl apply`。

如果要测试 CI，可以在 Windows 本地执行：

```powershell
git status
git add README.md docs/demo-script.md docs/demo-script-cn.md
git commit -m "Update OpenNebula demo documentation"
git push
```

含义：

`git status` 查看当前有哪些文件改动。

`git add ...` 把要提交的文件加入暂存区。

`git commit -m ...` 创建一次本地提交。

`git push` 把提交推到 GitHub，触发 GitHub Actions。

期待结果：

GitHub Actions 自动开始运行，最后显示成功。

## 9. 结束总结

最后可以这样总结：

这个项目展示了一个简单 Web 应用在 cloud-native 环境中的完整部署流程。OpenNebula 提供底层虚拟机和网络资源，k3s 在这个 VM 上提供 Kubernetes 编排能力。应用通过 Docker 镜像运行，PostgreSQL 使用 PVC 实现持久化，Secret 和 NetworkPolicy 提供安全控制，HPA 展示了根据 CPU 使用率自动扩展 backend 副本的能力。CI 部分则通过 GitHub Actions 自动构建应用镜像。

如果教授问为什么只用一个节点，可以回答：

由于这是课程项目和单人实现，我选择了单节点 k3s 集群来控制复杂度。它仍然展示了 Kubernetes 的核心机制，包括 Deployment、Service、Ingress、PVC、Secret、NetworkPolicy 和 HPA。如果要扩展到生产环境，可以把 OpenNebula 用来创建多个 VM，再组成多节点 Kubernetes 集群。

如果教授问为什么用 k3s 而不是完整 Kubernetes，可以回答：

k3s 是 CNCF 生态中的轻量级 Kubernetes 发行版，API 和资源对象仍然是 Kubernetes。它适合资源有限的 VM 和教学 demo，可以更快搭建并专注展示课程相关概念。

如果教授问持久化到底在哪里，可以回答：

PostgreSQL 使用 Kubernetes PVC，StorageClass 是 k3s 默认的 `local-path`。因为我把 OpenNebula VM 的额外 20 GB 磁盘挂载到了 `/var/lib/rancher`，所以 PVC 实际上落在这个 OpenNebula 提供的虚拟磁盘上。
