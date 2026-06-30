# Secure Cloud-Native TodoList Application

Final project for the Fog and Cloud Computing course.

This project implements a small multi-user TodoList web application and deploys
it using cloud-native technologies. The application itself is intentionally
simple: users can register, log in, and manage their own Todo items. The main
focus is the infrastructure around the application: OpenNebula, Docker,
Kubernetes, persistent storage, security controls, CI, and autoscaling.

## Project Overview

The system is composed of three application components:

- **Frontend:** React web interface served by Nginx.
- **Backend API:** Node.js/Express REST API for authentication and Todo CRUD.
- **Database:** PostgreSQL database storing users and Todo items.

The deployment follows this structure:

```text
OpenNebula VM
  -> k3s Kubernetes cluster
    -> Docker containers
      -> Frontend, Backend API, PostgreSQL
```

Only the frontend and backend API are exposed through Kubernetes Ingress.
PostgreSQL stays internal to the cluster and is reachable only by the backend
API.

## Repository Structure

```text
.
├── backend/                  Node.js backend API
├── frontend/                 React frontend
├── k8s/                      Kubernetes manifests
├── docs/                     Demo and presentation notes
├── .github/workflows/        GitHub Actions CI workflow
├── docker-compose.yml        Local development setup
└── README.md                 This document
```

The `k8s/` directory contains standard Kubernetes manifests. The project is
deployed on k3s, which is a lightweight Kubernetes distribution, so the same
Kubernetes YAML resources are used.

## OpenNebula Infrastructure

The final deployment runs on a virtual machine provisioned through the course
OpenNebula environment.

The VM used for the final demo is:

```text
Name: todolist-k3s-node
Operating system: Ubuntu Minimal 22.04
CPU: 2 vCPU
Memory: 4 GB
Network: OpenNebula vnet
VM IP: 172.16.100.4
Extra disk: 20 GB
```

The extra OpenNebula disk is mounted at:

```text
/var/lib/rancher
```

This location is used by k3s for its runtime data and by the default k3s
`local-path` storage provisioner. This means that the Kubernetes persistent
volume used by PostgreSQL is backed by the additional disk attached to the
OpenNebula VM.

## Kubernetes Deployment

The project uses k3s as a single-node Kubernetes cluster running inside the
OpenNebula VM.

The Kubernetes resources are:

- `Namespace` for isolating project resources.
- `Deployment` and `Service` for the frontend.
- `Deployment` and `Service` for the backend API.
- `Deployment`, `Service`, and `PersistentVolumeClaim` for PostgreSQL.
- `Ingress` for external HTTP access.
- `Secret` for database credentials and JWT secret.
- `NetworkPolicy` for database access control.
- `HorizontalPodAutoscaler` for backend autoscaling.

Apply all manifests with:

```bash
sudo k3s kubectl apply -f k8s/
```

Check the deployed resources:

```bash
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl get svc -n todolist
sudo k3s kubectl get ingress -n todolist
sudo k3s kubectl get hpa -n todolist
```

Expected result: frontend, backend, and PostgreSQL pods should all be
`Running`.

## Accessing the Application

Traefik is used as the k3s Ingress Controller. In the final deployment, Traefik
is exposed through a NodePort instead of using the OpenNebula VM port 80
directly.

Check the Traefik NodePort:

```bash
sudo k3s kubectl get svc traefik -n kube-system
```

In the final deployment, the HTTP NodePort is:

```text
31600
```

From the local machine, open an SSH tunnel through the lab VM:

```powershell
ssh -L 8082:172.16.100.4:31600 labvm
```

Then open:

```text
http://localhost:8082
```

The path routing is:

```text
/      -> frontend service
/api   -> backend service
```

## Local Development

For local development without Kubernetes, Docker Compose can be used.

Requirements:

- Docker
- Docker Compose

Run:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

The local backend API is available at:

```text
http://localhost:3000/api
```

## CI Pipeline

GitHub Actions is used as the CI pipeline.

The workflow is defined in:

```text
.github/workflows/docker-build.yml
```

On each push or pull request, the workflow builds the Docker images for:

```text
backend
frontend
```

On pushes to the `main` branch, the images are also pushed to GitHub Container
Registry:

```text
ghcr.io/chuck-das/todolist-backend:latest
ghcr.io/chuck-das/todolist-frontend:latest
```

The Kubernetes manifests reference these images. Deployment to the OpenNebula VM
is performed manually by pulling the repository and applying the Kubernetes
manifests.

This project implements CI, but not automatic CD to the VM.

## Persistent Storage

PostgreSQL uses a Kubernetes `PersistentVolumeClaim`:

```text
postgres-data
```

The PVC requests:

```text
2 Gi
```

The storage class is:

```text
local-path
```

In k3s, `local-path` stores persistent volume data on the node filesystem. Since
`/var/lib/rancher` is mounted on the additional 20 GB OpenNebula disk, the
PostgreSQL data is backed by that OpenNebula-attached disk.

Check the PVC:

```bash
sudo k3s kubectl get pvc -n todolist
```

Expected result:

```text
postgres-data   Bound   ...   2Gi   RWO   local-path
```

To test persistence, create Todo data in the web application, then delete the
PostgreSQL pod:

```bash
sudo k3s kubectl delete pod -n todolist -l app=postgres
sudo k3s kubectl get pods -n todolist
```

Kubernetes will create a new PostgreSQL pod automatically. After the new pod is
running, refresh the web application. The Todo data should still be present.

## Security Controls

The project includes both application-level and Kubernetes-level security.

At the application level:

- users must register and log in;
- each user receives a JWT token;
- each Todo item belongs to a specific user;
- users can only access their own Todo items.

At the Kubernetes level:

- database credentials and JWT secret are stored in a Kubernetes `Secret`;
- PostgreSQL is exposed only as an internal `ClusterIP` service;
- a `NetworkPolicy` allows only backend pods to connect to PostgreSQL;
- containers use security contexts where possible;
- privilege escalation is disabled;
- CPU and memory requests and limits are defined.

Check the Secret:

```bash
sudo k3s kubectl get secret todolist-secrets -n todolist
```

Check the NetworkPolicy:

```bash
sudo k3s kubectl describe networkpolicy postgres-backend-only -n todolist
```

Expected access rules:

```text
Backend API -> PostgreSQL: allowed
Frontend -> PostgreSQL: denied
External network -> PostgreSQL: denied
Other pods -> PostgreSQL: denied
```

To verify that an unauthorized pod cannot directly access PostgreSQL:

```bash
sudo k3s kubectl run denied-client -n todolist \
  --image=postgres:16-alpine \
  --restart=Never \
  --rm -i \
  --command -- sh -c "timeout 5 pg_isready -h postgres -p 5432; echo exit:$?"
```

Expected result: the connection should time out or report no response.

To verify that the backend can access PostgreSQL, use the application API:

```bash
curl -X POST http://127.0.0.1:31600/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"dbtest","password":"test123"}'

curl -X POST http://127.0.0.1:31600/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dbtest","password":"test123"}'
```

Expected result: the backend returns a JWT token and user information.

## Autoscaling

The backend API is configured with a Horizontal Pod Autoscaler.

The HPA manifest is:

```text
k8s/07-hpa.yaml
```

The HPA monitors backend CPU usage and scales the backend deployment between:

```text
minimum replicas: 1
maximum replicas: 3
target CPU usage: 50%
```

Check the HPA:

```bash
sudo k3s kubectl get hpa -n todolist
```

Check pod status and resource usage:

```bash
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl top pods -n todolist
```

Generate load:

```bash
for round in $(seq 1 5); do
  for i in $(seq 1 600); do curl -s http://127.0.0.1:31600/api/load > /dev/null & done
  sleep 5
done
```

Then check HPA and pods again:

```bash
sudo k3s kubectl get hpa -n todolist
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl top pods -n todolist
```

Expected result: when CPU usage goes above the target, the backend deployment
scales from one replica to two or three replicas.

## Useful Demo Commands

Show OpenNebula VM evidence from the lab VM:

```bash
sudo -u oneadmin onevm list
sudo -u oneadmin onehost list
sudo -u oneadmin onevnet list
```

Show the OpenNebula VM system:

```bash
hostname
cat /etc/os-release
free -h
df -h
lsblk
ip addr
```

Show k3s:

```bash
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl get pods -A
```

Show project resources:

```bash
sudo k3s kubectl get all -n todolist
sudo k3s kubectl describe ingress todolist -n todolist
sudo k3s kubectl get pvc -n todolist
```

## Known Notes

After rebooting the OpenNebula VM, the backend may restart while PostgreSQL is
still becoming ready. This is expected during startup. Wait until all pods are
ready:

```bash
sudo k3s kubectl get pods -n todolist
```

If needed, restart the backend deployment:

```bash
sudo k3s kubectl rollout restart deployment/backend -n todolist
sudo k3s kubectl rollout status deployment/backend -n todolist
```



