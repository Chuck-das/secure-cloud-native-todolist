# Demo Script

Use this as a short presentation guide.

## 1. OpenNebula

Show the OpenNebula VM and explain:

- one VM is used as the IaaS resource;
- the VM acts as one Kubernetes node;
- k3s is installed on top of the VM;
- the VM network/IP is used to expose the application.

Useful commands:

```bash
hostname -I
sudo kubectl get nodes -o wide
```

## 2. Kubernetes Application

Show all resources:

```bash
sudo kubectl get all -n todolist
sudo kubectl get pvc -n todolist
sudo kubectl get ingress -n todolist
```

Explain:

- frontend and backend are separate Docker images;
- PostgreSQL runs inside the cluster;
- PostgreSQL uses a PVC with k3s local-path storage.

## 3. Application Features

In the browser:

1. Register a new user.
2. Log in.
3. Add Todo items.
4. Complete and delete items.
5. Optionally create another user to show data isolation.

## 4. Persistence

Create a Todo, then restart PostgreSQL:

```bash
sudo kubectl delete pod -n todolist -l app=postgres
sudo kubectl get pods -n todolist -w
```

Refresh the application and show that the Todo data is still present.

## 5. Security

Show the Secret:

```bash
sudo kubectl get secret todolist-secrets -n todolist
```

Show the NetworkPolicy:

```bash
sudo kubectl describe networkpolicy postgres-backend-only -n todolist
```

Explain that only pods labeled `app=backend` can reach PostgreSQL on TCP 5432.

## 6. HPA

Show HPA:

```bash
sudo kubectl get hpa -n todolist
```

Generate load:

```bash
for i in $(seq 1 2000); do curl -s http://<VM-IP>/api/load > /dev/null & done
```

Watch scaling:

```bash
sudo kubectl get hpa -n todolist -w
sudo kubectl get pods -n todolist -w
```

## 7. CI

Open GitHub Actions and show the workflow building Docker images.

Explain that CI packages source code into frontend and backend container images,
while Kubernetes uses those images to run the application.
