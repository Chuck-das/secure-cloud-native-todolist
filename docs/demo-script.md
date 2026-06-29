# Demo Script

This file is a short guide for the live project presentation. The demo focuses on how the TodoList application is deployed on an OpenNebula-provisioned VM, managed by k3s Kubernetes, and protected with Kubernetes security mechanisms.

## 1. OpenNebula Infrastructure

Open the OpenNebula Sunstone interface and show the VM named `todolist-k3s-node`.

Explain that OpenNebula is used as the IaaS layer. The project provisions one Ubuntu Minimal 22.04 VM with 2 vCPU, 4 GB RAM, one network interface on `vnet`, and an additional 20 GB disk. This VM is the single Kubernetes node used by the project.

Useful commands inside the OpenNebula VM:

```bash
hostname
whoami
cat /etc/os-release
ip addr
lsblk
df -h
```

Expected result: the VM is Ubuntu 22.04, has IP `172.16.100.4`, and the 20 GB disk `/dev/sda` is mounted on `/var/lib/rancher`.

Why this matters: `/var/lib/rancher` is where k3s stores its runtime data and where the `local-path` storage provisioner creates local persistent volumes.

## 2. k3s Kubernetes Cluster

Show that k3s is running on the OpenNebula VM:

```bash
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl get pods -A
```

Expected result: one Kubernetes node is `Ready`, and system pods such as `coredns`, `metrics-server`, `local-path-provisioner`, and `traefik` are running.

Explain that k3s is a lightweight Kubernetes distribution. It is still Kubernetes, but it is easier to run on a small single-node VM than a full kubeadm-based cluster.

Show the Traefik service:

```bash
sudo k3s kubectl get svc traefik -n kube-system
```

Expected result: Traefik is exposed as a `NodePort`, for example `80:31600/TCP`. The left side, `80`, is the internal service port. The right side, `31600`, is the port exposed on the VM.

## 3. Application Deployment

Show all application resources:

```bash
sudo k3s kubectl get all -n todolist
sudo k3s kubectl get ingress -n todolist
sudo k3s kubectl describe ingress todolist -n todolist
```

Expected result: frontend, backend, and PostgreSQL pods are running. The Ingress routes browser traffic to the frontend and API traffic to the backend.

Explain the application structure:

The frontend is a React application served by Nginx. The backend is a Node.js API that handles authentication and Todo operations. PostgreSQL stores users and Todo items. Only the frontend and backend are reachable through Ingress; PostgreSQL stays internal.

To access the application from the local machine, keep this SSH tunnel open on Windows:

```powershell
ssh -L 8082:172.16.100.4:31600 labvm
```

Then open:

```text
http://localhost:8082
```

## 4. Application Features

In the browser, demonstrate the user-facing part:

1. Register a user.
2. Log in.
3. Add Todo items.
4. Mark an item as completed.
5. Delete an item.
6. Optionally create another user to show that each user sees only their own Todo items.

This part shows that the deployed application is functional, but the main focus of the project is the cloud-native deployment around it.

## 5. Persistent Storage

Show the PostgreSQL persistent volume claim:

```bash
sudo k3s kubectl get pvc -n todolist
```

Expected result: `postgres-data` is `Bound`, uses the `local-path` storage class, and has size `2Gi`.

Then create a Todo item in the browser and delete the PostgreSQL pod:

```bash
sudo k3s kubectl delete pod -n todolist -l app=postgres
sudo k3s kubectl get pods -n todolist
```

Expected result: Kubernetes creates a new PostgreSQL pod automatically. After refreshing the application, the Todo item is still present.

Explain that this works because the data is stored in a PVC, not only inside the temporary filesystem of the old PostgreSQL pod.

## 6. Security

Show that credentials are stored as a Kubernetes Secret:

```bash
sudo k3s kubectl get secret todolist-secrets -n todolist
```

Show the NetworkPolicy:

```bash
sudo k3s kubectl describe networkpolicy postgres-backend-only -n todolist
```

Then test that a random pod cannot directly access PostgreSQL:

```bash
sudo k3s kubectl run denied-client -n todolist --image=postgres:16-alpine --restart=Never --rm -i --command -- sh -c "timeout 5 pg_isready -h postgres -p 5432; echo exit:$?"
```

Expected result: the direct database connection should fail or time out.

Then show that the backend can still use PostgreSQL through the normal API:

```bash
curl -X POST http://127.0.0.1:31600/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"dbtest","password":"test123"}'

curl -X POST http://127.0.0.1:31600/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dbtest","password":"test123"}'
```

Expected result: the backend returns a token and user information. This means the backend can reach PostgreSQL, while unauthorized pods cannot.

## 7. Horizontal Pod Autoscaler

Show the HPA and current resource usage:

```bash
sudo k3s kubectl get hpa -n todolist
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl top pods -n todolist
```

Explain that HPA means Horizontal Pod Autoscaler. It watches CPU usage and changes the number of backend replicas between 1 and 3.

Generate load:

```bash
for round in $(seq 1 5); do
  for i in $(seq 1 600); do curl -s http://127.0.0.1:31600/api/load > /dev/null & done
  sleep 5
done
```

While or after the load runs, repeat:

```bash
sudo k3s kubectl get hpa -n todolist
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl top pods -n todolist
```

Expected result: CPU usage increases, and HPA scales the backend deployment from 1 replica up to 2 or 3 replicas.

It is not necessary to wait for scale-down during the presentation. Kubernetes intentionally waits before scaling down to avoid unstable replica changes.

## 8. CI

Open GitHub Actions and show the `Build Docker Images` workflow.

Explain that when code is pushed to GitHub, GitHub Actions builds the frontend and backend Docker images. On pushes to the main branch, the workflow also pushes the images to GitHub Container Registry.

This is CI for building and packaging the application. Deployment to the OpenNebula VM is still done manually by pulling the repository and applying the Kubernetes manifests.

## 9. Closing Explanation

Summarize the main points:

The project uses OpenNebula for the IaaS layer, k3s Kubernetes for orchestration, Docker images for application packaging, PostgreSQL with persistent Kubernetes storage, NetworkPolicy and Secrets for security, and HPA for automatic backend scaling.
