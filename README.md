# Secure Cloud-Native TodoList Application

This repository contains the final project for the Fog and Cloud Computing course.
It implements a small multi-user TodoList application and focuses on the
cloud-native deployment around it: Docker, Kubernetes, persistent storage,
security isolation, CI, and autoscaling.

## Architecture

The system contains three main components:

- **Frontend:** React web interface served by Nginx.
- **Backend API:** Node.js/Express service for authentication and Todo CRUD.
- **Database:** PostgreSQL with Kubernetes persistent storage.

Infrastructure layout:

```text
OpenNebula VM (IaaS)
  -> k3s Kubernetes single-node cluster (PaaS)
    -> Docker containers
      -> React frontend, Node.js backend API, PostgreSQL
```

The backend is the only application component allowed to access PostgreSQL.
Database credentials and the JWT secret are stored with Kubernetes Secrets.

## OpenNebula Usage

The project uses OpenNebula as the IaaS layer. The intended deployment uses:

- one OpenNebula VM;
- one Kubernetes node, because k3s is installed as a single-node cluster;
- Ubuntu 24.04 Server as the VM operating system;
- the VM network interface/IP (`10.0.0.15` in the deployed lab environment) to expose the application through k3s Ingress;
- SSH access to install k3s, apply Kubernetes manifests, and inspect the demo.

This keeps the infrastructure simple while still showing how an application
platform can be built on top of an IaaS-provisioned virtual machine.

## Persistent Storage

PostgreSQL uses a Kubernetes `PersistentVolumeClaim`.

Because this is a single-node k3s cluster, the project uses the default k3s
`local-path` storage class. The PostgreSQL data directory is mounted on the PVC,
so Todo data survives PostgreSQL pod restarts.

The relevant file is:

```text
k8s/02-postgres.yaml
```

## Local Development

Requirements:

- Docker
- Docker Compose

Run locally:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

The backend API is available at:

```text
http://localhost:3000/api
```

## GitHub Actions CI

The workflow in `.github/workflows/docker-build.yml` builds the frontend and
backend Docker images on every push. On pushes to the repository, it also pushes
the images to GitHub Container Registry:

```text
ghcr.io/chuck-das/todolist-frontend:latest
ghcr.io/chuck-das/todolist-backend:latest
```

The Kubernetes manifests already reference these image names:

```text
k8s/03-backend.yaml
k8s/04-frontend.yaml
```

## k3s Deployment on the OpenNebula VM

Install k3s on the VM:

```bash
curl -sfL https://get.k3s.io | sh -
sudo k3s kubectl get nodes
```

Apply the manifests:

```bash
sudo k3s kubectl apply -f k8s/
sudo k3s kubectl get pods -n todolist
sudo k3s kubectl get ingress -n todolist
```

In the deployed lab environment, k3s Traefik Ingress exposes the application on
the VM IP. If the VM is only reachable through SSH, use a local tunnel from the
development machine:

```powershell
ssh -L 8080:10.0.0.15:80 labvm
```

Then open `http://localhost:8080`.

## Security Verification

Check that the backend can access PostgreSQL through the application.

Then verify that another pod cannot connect directly to PostgreSQL:

```bash
sudo k3s kubectl run denied-client -n todolist --image=postgres:16-alpine --restart=Never --rm -i --command -- sh -c "timeout 5 pg_isready -h postgres -p 5432; echo exit:$?"
```

This connection should be denied by the `NetworkPolicy` unless the test pod has
the backend label.

Security mechanisms used:

- Kubernetes Secrets for database credentials and JWT signing key;
- NetworkPolicy allowing only backend pods to access PostgreSQL;
- non-root containers where possible;
- disabled privilege escalation;
- CPU and memory requests/limits.

## HPA Demo

The backend deployment defines CPU requests and limits, and `k8s/07-hpa.yaml`
configures the Horizontal Pod Autoscaler.

Install or verify metrics-server:

```bash
sudo k3s kubectl top pods -n todolist
```

Generate repeated requests to the backend load endpoint:

```bash
for i in $(seq 1 2000); do curl -s http://10.0.0.15/api/load > /dev/null & done
```

Watch HPA and pods:

```bash
sudo k3s kubectl get hpa -n todolist -w
sudo k3s kubectl get pods -n todolist -w
```

Expected behavior: the backend deployment scales from 1 replica up to 2 or 3
replicas while CPU usage is high.

## Demo Checklist

During the presentation, show:

1. The application running in the browser.
2. User registration and login.
3. Creating, completing, and deleting Todo items.
4. The OpenNebula VM used for the deployment.
5. k3s node and Kubernetes pods.
6. PostgreSQL data persistence after pod restart.
7. NetworkPolicy restricting PostgreSQL access.
8. HPA scaling the backend under load.
9. GitHub Actions building Docker images.

## Final Submission Package

The Moodle submission requires one `.tar.gz` archive containing the source code,
README, and updated proposal.

From the parent directory of this repository, create the archive with:

```bash
tar --exclude='node_modules' --exclude='.git' -czf Liu.tar.gz dear-students-here-is-important-information
```

If the instructors require the two-surname naming format despite the individual
project approval, rename the archive according to their instruction before
uploading it.

## Use of LLM Tools

OpenAI ChatGPT/Codex was used as an assistant for code generation, debugging,
documentation drafting, and demo preparation. It was used to clarify concepts,
discuss design choices, help draft parts of the code and documentation, and
troubleshoot deployment issues. All suggestions were reviewed, adapted, tested,
and validated in the final project environment before submission.
