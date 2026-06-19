# Project Proposal: Secure Cloud-Native TodoList Application

Student: Chen Liu  
Course: Fog and Cloud Computing  
University: University of Trento

## 1. Problem Description

Modern web applications, even when functionally simple, still need to be
deployed in a reliable, secure, and scalable way. A traditional deployment often
mixes application code, configuration, runtime dependencies, and database access
into a single unit, making the system harder to reproduce, maintain, and scale
independently.

This project uses a multi-user TodoList application as a concrete example to
demonstrate a cloud-native deployment. Users can register, log in, and manage
their own todo items. The application logic is intentionally simple, because the
main focus is not the TodoList itself, but the infrastructure around it:
containerization, Kubernetes deployment, persistent storage, security isolation,
CI automation, and horizontal scaling.

The system runs on a virtual machine provisioned through OpenNebula, with k3s
Kubernetes installed on top of it. In this way, the project covers both the IaaS
layer and the PaaS layer discussed in the course.

## 2. Technologies

The project makes use of both IaaS and PaaS layers. At the infrastructure level,
a single virtual machine is provisioned using the course OpenNebula environment.
This VM is used as the only Kubernetes node and hosts a single-node k3s cluster.

The application consists of a React frontend, a Node.js backend API, and a
PostgreSQL database. The frontend and backend are built as separate Docker
images, while PostgreSQL uses the official image. PostgreSQL data is persisted
using a Kubernetes PersistentVolumeClaim backed by the default k3s `local-path`
storage class.

GitHub Actions is used as a CI pipeline to build the Docker images for the
frontend and backend. For security, the project uses Kubernetes Secrets,
NetworkPolicy, container security contexts, and resource limits. The backend API
is also configured with a Horizontal Pod Autoscaler so that Kubernetes can scale
the number of replicas based on CPU usage.

## 3. Architecture

The application is composed of three main components. The frontend provides the
user interface, allowing users to register, log in, create todo items, mark them
as completed, update them, and delete them. External access to the application
is managed through Kubernetes Ingress, while PostgreSQL remains internal to the
cluster.

The backend API is a single Node.js service that handles both user
authentication and todo management. After a successful login, the server issues
a JWT token, which the client includes in later requests for authorization. Each
todo item is associated with a specific user, so users can only access their own
data.

PostgreSQL stores user accounts and todo items. It runs inside the Kubernetes
cluster and is not exposed directly to the external network. The request flow is:

```text
User browser -> Kubernetes Ingress -> Frontend
User browser -> Kubernetes Ingress -> Backend API -> PostgreSQL
```

The infrastructure layers are:

```text
OpenNebula VM -> k3s Kubernetes -> Docker containers -> TodoList application
```

## 4. Security

The project includes both application-level and Kubernetes-level security
mechanisms. At the application level, users must authenticate before accessing
todo data, and the backend enforces that each user can only read or modify their
own items.

At the Kubernetes level, database credentials and the JWT signing secret are
stored as Kubernetes Secrets rather than being hard-coded in application code or
Docker images. A NetworkPolicy restricts database access so that only the
backend API pod can connect to PostgreSQL. Containers are further hardened using
security contexts: services run as non-root users where possible, privilege
escalation is disabled, and CPU and memory limits are defined.

The resulting access rules are:

```text
Backend API to PostgreSQL: allowed
Frontend to PostgreSQL: denied
External network to PostgreSQL: denied
Other pods to PostgreSQL: denied
```

## 5. Expected Outcomes

The final result is a working cloud-native TodoList application deployed on k3s
inside an OpenNebula VM. The submission includes the application source code,
Dockerfiles, Kubernetes manifests, a GitHub Actions CI workflow, and a README
explaining how to deploy and test the system.

During the final demo, I will show the main application features, demonstrate
that data survives a PostgreSQL pod restart, verify that the database is not
directly accessible from unauthorized pods, and trigger the Horizontal Pod
Autoscaler by sending repeated requests to the backend API.
