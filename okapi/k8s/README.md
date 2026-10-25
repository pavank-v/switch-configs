# Okapi on k3s: Handwritten Kubernetes Deployment Guide

This guide explains how the Okapi application is deployed to a single-node k3s cluster. It follows the manifests in this directory in deployment order and explains every Kubernetes field used by them.

The source code and Docker images are built on the local development machine. Kubernetes runs on a remote Ubuntu VM. Only the YAML manifests and built image archives need to be copied to the VM; the source code does not need to live there.

## Architecture

```text
Local development machine                    Ubuntu VM
-------------------------                    ---------
React and Spring source                      k3s
Docker builds                                containerd image store
Kubernetes YAML  --------------------------> Kubernetes API
Docker image archive ----------------------> containerd

                                                Browser
                                                   |
                                                   v
                                           Traefik Ingress
                                           /              /api
                                          v                  v
                                  frontend Service    backend Service
                                          |                  |
                                          v                  v
                                    nginx + React       Spring Boot
                                                               |
                                                               v
                                                        postgres Service
                                                               |
                                                               v
                                                       PostgreSQL + PVC
```

Traefik sends `/api` requests to Spring Boot and all other paths to the React frontend. PostgreSQL and the two application Services are private `ClusterIP` Services; they are not exposed directly outside the cluster.

## Manifest order

The numeric prefixes document the dependency order:

| File | Creates | Depends on |
| --- | --- | --- |
| `00-namespace.yml` | Application namespace | Nothing |
| `10-postgres-secret.yml` | Database credentials | Namespace |
| `11-postgres-service.yml` | Stable database DNS name | Namespace |
| `12-postgres-statefulset.yml` | PostgreSQL Pod and persistent volume | Secret and Service |
| `20-backend-secret.yml` | JWT signing secret | Namespace |
| `21-backend-configmap.yml` | Non-secret backend configuration | Namespace |
| `22-backend-deployment.yml` | Spring Boot Pod | Database, ConfigMap, Secrets, backend image |
| `23-backend-service.yml` | Stable backend endpoint | Backend Deployment |
| `30-frontend-deployment.yml` | nginx and React Pod | Frontend image |
| `31-frontend-service.yml` | Stable frontend endpoint | Frontend Deployment |
| `40-ingress.yml` | External HTTP routing | Both application Services and Traefik |

## Kubernetes YAML fundamentals

Every manifest has the same top-level shape:

```yaml
apiVersion: v1       # API group and version containing this resource type.
kind: Service        # Type of Kubernetes object to create.
metadata:            # Identity and searchable metadata for the object.
  name: example      # Object name, unique within its namespace.
  namespace: okapi   # Namespace in which the object lives.
spec:                # Desired state specific to this resource type.
  # ...
```

YAML indentation is structural. Use spaces, never tabs. A list item begins with `-`. Values such as `true` are quoted in ConfigMaps because ConfigMap data values must be strings.

Labels do not create relationships automatically. A Service finds Pods only when its `spec.selector` matches labels under the Pod template. A Deployment or StatefulSet likewise owns Pods whose labels match its `spec.selector.matchLabels`.

The labels in this project follow Kubernetes' recommended naming convention:

- `app.kubernetes.io/name` identifies the component, such as `backend`.
- `app.kubernetes.io/part-of` groups every component into the `okapi` application.
- `app.kubernetes.io/component` describes the role, such as `api`, `web`, or `database`.

## 1. Namespace

File: `00-namespace.yml`

```yaml
apiVersion: v1                         # Namespace is part of the core v1 API.
kind: Namespace                        # Creates a logical cluster boundary.

metadata:                              # Identifies the Namespace object.
  name: okapi                          # All namespaced Okapi resources use this value.
  labels:                              # Searchable metadata for the Namespace.
    app.kubernetes.io/name: okapi      # Associates the Namespace with this application.
```

A Namespace itself is cluster-scoped, so it does not have a `metadata.namespace` field. It must be created before any manifest that specifies `namespace: okapi`.

Validate and apply on the VM:

```bash
sudo kubectl apply --dry-run=client --filename ~/okapi/k8s/00-namespace.yml
sudo kubectl apply --filename ~/okapi/k8s/00-namespace.yml
sudo kubectl get namespace okapi
```

`--dry-run=client` parses and constructs the object locally without changing the cluster. It catches many syntax and schema errors, but it does not prove that referenced objects exist or that the application will work.

## 2. PostgreSQL Secret

File: `10-postgres-secret.yml`

The real file is ignored by Git. Generate its password locally with:

```bash
openssl rand -hex 24
```

Its safe template is:

```yaml
apiVersion: v1                              # Secret belongs to the core v1 API.
kind: Secret                                # Stores sensitive key/value configuration.

metadata:                                   # Identifies this Secret.
  name: postgres-secret                     # Name referenced by the StatefulSet and backend.
  namespace: okapi                          # Makes it available only in the okapi namespace.
  labels:                                   # Organizes the Secret for queries and tooling.
    app.kubernetes.io/name: postgres        # Associates it with PostgreSQL.
    app.kubernetes.io/part-of: okapi        # Associates it with the complete application.

type: Opaque                                # Generic user-defined key/value Secret.

stringData:                                 # Accepts plain strings when the object is applied.
  POSTGRES_DB: todoapp                      # Database created by the PostgreSQL entrypoint.
  POSTGRES_USER: okapi                      # Database owner created by the entrypoint.
  POSTGRES_PASSWORD: "replace-this-value"   # Password; replace locally and never commit it.
```

Kubernetes converts `stringData` values into base64-encoded `data`. Base64 is not encryption. Anyone authorized to read the Secret from the cluster can recover its original values.

Protect and apply it:

```bash
chmod 600 okapi/k8s/10-postgres-secret.yml
scp okapi/k8s/10-postgres-secret.yml <user>@<vm-ip>:~/okapi/k8s/

# Run on the VM:
chmod 600 ~/okapi/k8s/10-postgres-secret.yml
sudo kubectl apply --filename ~/okapi/k8s/10-postgres-secret.yml
sudo kubectl --namespace okapi describe secret postgres-secret
```

`describe secret` displays key names and byte counts, not their values.

## 3. PostgreSQL Service

File: `11-postgres-service.yml`

```yaml
apiVersion: v1                                  # Service belongs to the core v1 API.
kind: Service                                   # Creates stable discovery for matching Pods.

metadata:                                       # Identifies the Service.
  name: postgres                                # Also becomes the DNS name `postgres`.
  namespace: okapi                              # Places the Service beside the database Pod.
  labels:                                       # Metadata attached to the Service itself.
    app.kubernetes.io/name: postgres            # Component name.
    app.kubernetes.io/part-of: okapi            # Parent application.
    app.kubernetes.io/component: database       # Component role.

spec:                                           # Desired Service behavior.
  clusterIP: None                               # Makes this a headless Service with no virtual IP.

  selector:                                     # Selects the Pods that receive database traffic.
    app.kubernetes.io/name: postgres            # Must match the Pod template label exactly.
    app.kubernetes.io/part-of: okapi            # Further restricts the selected Pods.

  ports:                                        # Ports published by this Service.
    - name: postgres                            # Symbolic port name used by other resources.
      protocol: TCP                             # PostgreSQL communicates over TCP.
      port: 5432                                # Port clients use on the Service.
      targetPort: postgres                      # Named port exposed by the PostgreSQL container.
```

Because this is a headless Service, DNS resolves directly to the ready PostgreSQL Pod. The Spring datasource URL is therefore `jdbc:postgresql://postgres:5432/todoapp`.

The Service can exist before the Pod. It will have no endpoints until a ready Pod has matching labels.

## 4. PostgreSQL StatefulSet and storage

File: `12-postgres-statefulset.yml`

```yaml
apiVersion: apps/v1                             # StatefulSet belongs to the apps/v1 API.
kind: StatefulSet                               # Manages a stateful Pod with stable identity/storage.

metadata:                                       # Identifies the StatefulSet.
  name: postgres                                # Produces a Pod named `postgres-0`.
  namespace: okapi                              # Places it in the application namespace.
  labels:                                       # Labels on the StatefulSet object.
    app.kubernetes.io/name: postgres            # Component name.
    app.kubernetes.io/part-of: okapi            # Parent application.
    app.kubernetes.io/component: database       # Component role.

spec:                                           # Desired StatefulSet state.
  serviceName: postgres                         # Governing headless Service for stable network identity.
  replicas: 1                                   # Runs exactly one PostgreSQL Pod.

  selector:                                     # Defines which Pods belong to this StatefulSet.
    matchLabels:                                # Every listed label must match.
      app.kubernetes.io/name: postgres          # Matches the Pod template below.
      app.kubernetes.io/part-of: okapi           # Prevents accidental ownership of unrelated Pods.

  template:                                     # Template used to create each Pod.
    metadata:                                   # Metadata placed on each generated Pod.
      labels:                                   # These must satisfy `selector.matchLabels`.
        app.kubernetes.io/name: postgres        # Allows StatefulSet and Service selection.
        app.kubernetes.io/part-of: okapi         # Associates the Pod with Okapi.
        app.kubernetes.io/component: database   # Describes the Pod's role.

    spec:                                       # Pod-level desired state.
      containers:                               # Containers run by the Pod.
        - name: postgres                        # Container name used by logs and exec commands.
          image: postgres:16.15-alpine          # Exact PostgreSQL image version.
          imagePullPolicy: IfNotPresent         # Reuses a cached image when available.

          ports:                                # Ports exposed by the container.
            - name: postgres                    # Name referenced by the Service targetPort.
              containerPort: 5432               # Port PostgreSQL listens on inside the Pod.
              protocol: TCP                     # Network transport.

          envFrom:                              # Imports multiple environment values at once.
            - secretRef:                        # Source is a Secret.
                name: postgres-secret           # Imports all three POSTGRES_* keys.

          volumeMounts:                         # Attaches declared volumes to the container filesystem.
            - name: postgres-data               # Matches the volumeClaimTemplates name below.
              mountPath: /var/lib/postgresql/data # PostgreSQL stores its database files here.

          startupProbe:                         # Allows slow first-time database initialization.
            exec:                               # Runs a command inside the container.
              command:                          # Command expressed as an argument list.
                - sh                            # Starts a shell.
                - -c                            # Tells the shell to evaluate the next string.
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" # Checks server availability.
            periodSeconds: 2                    # Checks every two seconds.
            failureThreshold: 30                # Allows 30 failures: about 60 seconds total.

          readinessProbe:                       # Controls whether the Service may send traffic here.
            exec:                               # Executes inside the database container.
              command:
                - sh                            # Shell executable.
                - -c                            # Evaluate the following command string.
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" # Checks this configured DB/user.
            periodSeconds: 5                    # Rechecks readiness every five seconds.
            failureThreshold: 3                 # Marks unready after three failures.

          livenessProbe:                        # Detects a database process that needs restarting.
            exec:                               # Executes inside the container.
              command:
                - sh                            # Shell executable.
                - -c                            # Evaluate the following command string.
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" # Checks server responsiveness.
            periodSeconds: 10                   # Checks every ten seconds.
            failureThreshold: 3                 # Restarts after three consecutive failures.

          resources:                            # Scheduler reservations and runtime limits.
            requests:                           # Minimum capacity reserved for scheduling.
              cpu: 100m                         # One tenth of a CPU core.
              memory: 256Mi                     # 256 mebibytes of memory.
            limits:                             # Maximum resources the container may consume.
              cpu: 500m                         # One half of a CPU core.
              memory: 512Mi                     # Exceeding this memory limit causes an OOM kill.

  volumeClaimTemplates:                         # Creates one PVC for each StatefulSet Pod.
    - metadata:                                 # Metadata for each generated PVC.
        name: postgres-data                     # Produces `postgres-data-postgres-0`.
        labels:                                 # Metadata placed on the PVC.
          app.kubernetes.io/name: postgres      # Associates storage with PostgreSQL.
          app.kubernetes.io/part-of: okapi       # Associates storage with Okapi.

      spec:                                     # Requested persistent storage properties.
        accessModes:                            # How the volume can be mounted.
          - ReadWriteOnce                       # Writable by a node; appropriate for one-node PostgreSQL.
        storageClassName: local-path            # Uses k3s's local-path dynamic provisioner.

        resources:                              # Storage capacity request.
          requests:
            storage: 2Gi                        # Requests a two-gibibyte persistent volume.
```

Deleting or replacing `postgres-0` does not delete its PVC. The replacement Pod mounts the same data. The `local-path` volume is tied to this VM and is not a backup; VM disk loss still loses the database.

Useful checks:

```bash
sudo kubectl --namespace okapi get pods,pvc
sudo kubectl --namespace okapi logs postgres-0
sudo kubectl --namespace okapi get endpointslice --selector kubernetes.io/service-name=postgres
sudo kubectl --namespace okapi exec postgres-0 -- \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(), current_user;"'
```

## 5. Backend Secret

File: `20-backend-secret.yml`

Generate an independent JWT signing key locally:

```bash
openssl rand -base64 64 | tr -d '\n'
```

```yaml
apiVersion: v1                              # Secret belongs to the core v1 API.
kind: Secret                                # Stores the JWT signing material.

metadata:                                   # Identifies the Secret.
  name: backend-secret                      # Referenced by the backend Deployment.
  namespace: okapi                          # Available to workloads in this namespace.
  labels:                                   # Metadata for organization.
    app.kubernetes.io/name: backend         # Component name.
    app.kubernetes.io/part-of: okapi        # Parent application.
    app.kubernetes.io/component: api        # Component role.

type: Opaque                                # Generic user-managed Secret.

stringData:                                 # Plain input converted to Secret data on apply.
  JWT_BASE64_SECRET: "replace-this-value"    # Base64-formatted random key used to sign JWTs.
```

If this value changes, all existing login tokens become invalid. Keep the same value across backend restarts and replicas.

## 6. Backend ConfigMap

File: `21-backend-configmap.yml`

```yaml
apiVersion: v1                                      # ConfigMap belongs to the core v1 API.
kind: ConfigMap                                     # Stores non-sensitive configuration.

metadata:                                           # Identifies the ConfigMap.
  name: backend-config                              # Referenced by the backend Deployment.
  namespace: okapi                                  # Places it in the same namespace as the Pod.
  labels:                                           # Organizational metadata.
    app.kubernetes.io/name: backend                 # Component name.
    app.kubernetes.io/part-of: okapi                # Parent application.
    app.kubernetes.io/component: api                # Component role.

data:                                               # String-valued configuration entries.
  SPRING_PROFILES_ACTIVE: "prod"                    # Activates Spring's production profile.
  SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/todoapp" # Uses Service DNS.
  APPLICATION_REGISTRATION_AUTO_ACTIVATE: "true"    # Activates registrations without SMTP email.
```

Spring Boot relaxed binding maps uppercase underscore-separated environment variables to configuration properties. For example, `APPLICATION_REGISTRATION_AUTO_ACTIVATE` becomes `application.registration.auto-activate`.

ConfigMap changes do not automatically restart existing Pods. After changing it, restart the Deployment:

```bash
sudo kubectl --namespace okapi rollout restart deployment/backend
sudo kubectl --namespace okapi rollout status deployment/backend
```

## 7. Backend Deployment

File: `22-backend-deployment.yml`

```yaml
apiVersion: apps/v1                             # Deployment belongs to the apps/v1 API.
kind: Deployment                                # Manages replaceable, stateless backend Pods.

metadata:                                       # Identifies the Deployment.
  name: backend                                 # Deployment name used by rollout commands.
  namespace: okapi                              # Places it in the application namespace.
  labels:                                       # Labels on the Deployment object.
    app.kubernetes.io/name: backend             # Component name.
    app.kubernetes.io/part-of: okapi            # Parent application.
    app.kubernetes.io/component: api            # Component role.

spec:                                           # Desired Deployment state.
  replicas: 1                                   # Keeps one backend Pod running.

  selector:                                     # Defines which Pods this Deployment owns.
    matchLabels:
      app.kubernetes.io/name: backend           # Must match the Pod template.
      app.kubernetes.io/part-of: okapi           # Narrows ownership to this application.

  strategy:                                     # Controls updates between image/config revisions.
    type: RollingUpdate                         # Replaces Pods gradually.
    rollingUpdate:
      maxUnavailable: 0                         # Keeps the existing ready Pod during an update.
      maxSurge: 1                               # Permits one temporary additional Pod.

  template:                                     # Template for generated backend Pods.
    metadata:
      labels:                                   # Must satisfy the Deployment and Service selectors.
        app.kubernetes.io/name: backend         # Selected by the backend Service.
        app.kubernetes.io/part-of: okapi         # Associates the Pod with Okapi.
        app.kubernetes.io/component: api        # Describes its role.

    spec:                                       # Pod-level desired state.
      terminationGracePeriodSeconds: 30         # Gives Spring 30 seconds for graceful shutdown.

      securityContext:                          # Defaults applied at the Pod level.
        runAsNonRoot: true                      # Rejects a container that attempts to run as root.
        runAsUser: 10001                        # Matches the user created in the backend Dockerfile.
        seccompProfile:
          type: RuntimeDefault                  # Enables the runtime's standard syscall filter.

      containers:                               # Containers in this Pod.
        - name: backend                         # Name used by logs, exec, and status output.
          image: docker.io/library/okapi-backend:0.1.0 # Imported local image and version.
          imagePullPolicy: IfNotPresent         # Uses containerd's imported copy when present.

          ports:
            - name: http                        # Symbolic name referenced by probes and Service.
              containerPort: 8080               # Spring Boot's listening port.
              protocol: TCP                     # HTTP runs over TCP.

          envFrom:                              # Imports all entries from a configuration object.
            - configMapRef:
                name: backend-config            # Adds the three ConfigMap keys as environment variables.

          env:                                  # Defines individually mapped environment variables.
            - name: SPRING_DATASOURCE_USERNAME  # Environment name understood by Spring Boot.
              valueFrom:                        # Reads instead of embedding the value.
                secretKeyRef:                   # Source is one Secret key.
                  name: postgres-secret         # Database Secret name.
                  key: POSTGRES_USER            # Database username key.

            - name: SPRING_DATASOURCE_PASSWORD  # Spring datasource password variable.
              valueFrom:
                secretKeyRef:
                  name: postgres-secret         # Reuses the database Secret.
                  key: POSTGRES_PASSWORD        # Selects only the password value.

            - name: JHIPSTER_SECURITY_AUTHENTICATION_JWT_BASE64_SECRET # JHipster JWT property.
              valueFrom:
                secretKeyRef:
                  name: backend-secret          # JWT Secret object.
                  key: JWT_BASE64_SECRET        # JWT key inside that Secret.

          startupProbe:                         # Prevents liveness checks during slow startup/Liquibase.
            httpGet:
              path: /management/health/liveness # Publicly permitted internal actuator endpoint.
              port: http                        # Resolves to the named container port 8080.
            periodSeconds: 2                    # Checks every two seconds.
            failureThreshold: 60                # Allows about 120 seconds to start.

          readinessProbe:                       # Controls whether Services send requests to this Pod.
            httpGet:
              path: /management/health/readiness # Includes application and database readiness.
              port: http                        # Named container port.
            periodSeconds: 5                    # Rechecks every five seconds.
            failureThreshold: 3                 # Marks unready after three failures.

          livenessProbe:                        # Restarts a running but unhealthy application.
            httpGet:
              path: /management/health/liveness # Checks that Spring remains alive.
              port: http                        # Named container port.
            periodSeconds: 10                   # Checks every ten seconds.
            failureThreshold: 3                 # Restarts after three failures.

          resources:                            # Scheduling requests and runtime limits.
            requests:
              cpu: 250m                         # Reserves one quarter of a CPU.
              memory: 256Mi                     # Reserves 256 mebibytes.
            limits:
              cpu: "1"                          # Allows at most one CPU core.
              memory: 1Gi                       # OOM-kills the container above one gibibyte.

          securityContext:                      # Container-specific restrictions.
            allowPrivilegeEscalation: false     # Prevents gaining more privileges at runtime.
            capabilities:
              drop:
                - ALL                           # Removes all Linux process capabilities.
```

The fully qualified image name matches the name imported into containerd. `IfNotPresent` is essential for this local-image workflow; `Always` would attempt a registry pull and fail because this image is not published.

Check rollout and logs:

```bash
sudo kubectl --namespace okapi rollout status deployment/backend
sudo kubectl --namespace okapi get pods --selector app.kubernetes.io/name=backend
sudo kubectl --namespace okapi logs deployment/backend
```

## 8. Backend Service

File: `23-backend-service.yml`

```yaml
apiVersion: v1                                  # Service is part of core v1.
kind: Service                                   # Creates a stable virtual endpoint.

metadata:
  name: backend                                 # DNS name `backend` within the namespace.
  namespace: okapi                              # Same namespace as the selected Pods.
  labels:                                       # Labels on the Service object itself.
    app.kubernetes.io/name: backend             # Component name.
    app.kubernetes.io/part-of: okapi            # Parent application.
    app.kubernetes.io/component: api            # Component role.

spec:
  type: ClusterIP                               # Reachable only inside the cluster.

  selector:                                     # Finds ready backend Pods.
    app.kubernetes.io/name: backend             # Matches Pod template label.
    app.kubernetes.io/part-of: okapi             # Matches Pod template label.

  ports:
    - name: http                                # Symbolic name for this Service port.
      protocol: TCP                             # HTTP transport.
      port: 8080                                # Port exposed by the Service.
      targetPort: http                          # Named port 8080 in the backend container.
```

Test it without exposing it publicly:

```bash
sudo kubectl --namespace okapi port-forward service/backend 18080:8080

# In a second VM SSH session:
curl --fail --silent --show-error http://127.0.0.1:18080/management/health/readiness
```

The expected response is `{"status":"UP"}`.

## 9. Frontend Deployment

File: `30-frontend-deployment.yml`

```yaml
apiVersion: apps/v1                              # Deployment belongs to apps/v1.
kind: Deployment                                 # Manages replaceable frontend Pods.

metadata:
  name: frontend                                 # Deployment name.
  namespace: okapi                               # Application namespace.
  labels:
    app.kubernetes.io/name: frontend             # Component name.
    app.kubernetes.io/part-of: okapi              # Parent application.
    app.kubernetes.io/component: web             # Component role.

spec:
  replicas: 1                                    # Keeps one frontend Pod running.

  selector:
    matchLabels:                                 # Defines Pods owned by this Deployment.
      app.kubernetes.io/name: frontend           # Must match the Pod template.
      app.kubernetes.io/part-of: okapi            # Must match the Pod template.

  strategy:
    type: RollingUpdate                          # Gradually replaces frontend versions.
    rollingUpdate:
      maxUnavailable: 0                          # Keeps the old ready Pod during rollout.
      maxSurge: 1                                # Allows one temporary additional Pod.

  template:
    metadata:
      labels:                                    # Used by Deployment and Service selectors.
        app.kubernetes.io/name: frontend         # Frontend identity.
        app.kubernetes.io/part-of: okapi          # Application identity.
        app.kubernetes.io/component: web         # Web-serving role.

    spec:
      terminationGracePeriodSeconds: 10          # Gives nginx time to stop cleanly.

      securityContext:
        seccompProfile:
          type: RuntimeDefault                   # Applies the runtime's standard syscall filter.

      containers:
        - name: frontend                         # Container name used by Kubernetes commands.
          image: docker.io/library/okapi-frontend:0.1.0 # Imported nginx/React image.
          imagePullPolicy: IfNotPresent          # Uses the local containerd image.

          ports:
            - name: http                         # Port name used by probes and Service.
              containerPort: 80                  # nginx listens on port 80.
              protocol: TCP                      # HTTP transport.

          startupProbe:                          # Gives nginx time to initialize.
            httpGet:
              path: /                            # Requests the frontend root.
              port: http                         # Named container port 80.
            periodSeconds: 2                     # Checks every two seconds.
            failureThreshold: 30                 # Allows about 60 seconds to start.

          readinessProbe:                        # Controls Service traffic eligibility.
            httpGet:
              path: /                            # A successful root response means it is ready.
              port: http                         # Named container port.
            periodSeconds: 5                     # Rechecks every five seconds.
            failureThreshold: 3                  # Marks unready after three failures.

          livenessProbe:                         # Detects nginx that is no longer responding.
            httpGet:
              path: /                            # Requests a known static route.
              port: http                         # Named container port.
            periodSeconds: 10                    # Checks every ten seconds.
            failureThreshold: 3                  # Restarts after three failures.

          resources:
            requests:
              cpu: 25m                           # Reserves 2.5 percent of one CPU.
              memory: 32Mi                       # Reserves 32 mebibytes.
            limits:
              cpu: 200m                          # Limits it to one fifth of a CPU.
              memory: 128Mi                      # Memory ceiling.

          securityContext:
            allowPrivilegeEscalation: false      # Prevents acquiring additional privileges.
```

The frontend makes requests to relative URLs such as `/api`. It does not need the backend's Kubernetes DNS name in browser code. The browser sends `/api` to the same public origin, and Traefik routes it to the backend.

The nginx configuration uses `try_files $uri $uri/ /index.html;`. Consequently, refreshing a client-side route such as `/settings` returns React's `index.html` instead of an nginx 404.

## 10. Frontend Service

File: `31-frontend-service.yml`

```yaml
apiVersion: v1                                  # Service belongs to core v1.
kind: Service                                   # Creates stable discovery for frontend Pods.

metadata:
  name: frontend                                # DNS name inside the okapi namespace.
  namespace: okapi                              # Same namespace as the frontend Pods.
  labels:
    app.kubernetes.io/name: frontend            # Component name.
    app.kubernetes.io/part-of: okapi             # Parent application.
    app.kubernetes.io/component: web            # Component role.

spec:
  type: ClusterIP                               # Internal-only virtual IP.

  selector:
    app.kubernetes.io/name: frontend            # Selects frontend Pods.
    app.kubernetes.io/part-of: okapi             # Avoids selecting similarly named Pods elsewhere.

  ports:
    - name: http                                # Symbolic Service port name.
      protocol: TCP                             # HTTP transport.
      port: 80                                  # Service listening port.
      targetPort: http                          # Named port 80 in the frontend container.
```

## 11. Traefik Ingress

File: `40-ingress.yml`

```yaml
apiVersion: networking.k8s.io/v1                # Stable Kubernetes Ingress API.
kind: Ingress                                   # Declares external HTTP routing rules.

metadata:
  name: okapi                                   # Ingress object name.
  namespace: okapi                              # Backends are resolved in this namespace.
  labels:
    app.kubernetes.io/name: okapi               # Identifies the whole application.
    app.kubernetes.io/part-of: okapi             # Groups it with other Okapi resources.

spec:
  ingressClassName: traefik                     # Asks k3s's Traefik controller to implement it.

  rules:                                        # HTTP host/path routing rules.
    - http:                                     # No host means the rule accepts any Host header.
        paths:                                  # Ordered list of URL path backends.
          - path: /api                          # API prefix used by the React application.
            pathType: Prefix                    # Matches `/api` and paths below it.
            backend:
              service:                          # Routes to a Kubernetes Service.
                name: backend                   # Backend Service name.
                port:
                  number: 8080                  # Backend Service port.

          - path: /                             # Catch-all route for frontend pages/assets.
            pathType: Prefix                    # Matches every path beginning with `/`.
            backend:
              service:
                name: frontend                  # Frontend Service name.
                port:
                  number: 80                    # Frontend Service port.
```

Ingress controllers choose the most specific matching path, so `/api/tasks` goes to the backend even though `/` also matches it. Management endpoints are intentionally absent and remain private inside the cluster.

## Build the application images locally

Run these commands on the development machine, from the repository root:

```bash
sudo docker build --tag okapi-backend:0.1.0 ./backend
sudo docker build --tag okapi-frontend:0.1.0 ./frontend
```

Verify their configured users and ports:

```bash
sudo docker image inspect okapi-backend:0.1.0 \
  --format 'backend user={{.Config.User}} ports={{json .Config.ExposedPorts}}'
sudo docker image inspect okapi-frontend:0.1.0 \
  --format 'frontend user={{.Config.User}} ports={{json .Config.ExposedPorts}}'
```

The image architecture must match the VM:

```bash
# Local machine
sudo docker image inspect okapi-backend:0.1.0 --format '{{.Os}}/{{.Architecture}}'

# VM
uname -m
```

`linux/amd64` corresponds to `x86_64`; `linux/arm64` corresponds to `aarch64`.

## Transfer images into k3s

k3s uses containerd, so an image in the local Docker daemon is not automatically available to the VM or Kubernetes.

On the local machine:

```bash
sudo docker save \
  --output /tmp/okapi-images-0.1.0.tar \
  okapi-backend:0.1.0 \
  okapi-frontend:0.1.0

sha256sum /tmp/okapi-images-0.1.0.tar
scp /tmp/okapi-images-0.1.0.tar <user>@<vm-ip>:~/
```

On the VM:

```bash
sha256sum ~/okapi-images-0.1.0.tar
sudo k3s ctr --namespace k8s.io images import ~/okapi-images-0.1.0.tar
sudo k3s ctr --namespace k8s.io images list | sed -n '/okapi/p'
sudo k3s crictl images | sed -n '/okapi/p'
```

Compare the two SHA-256 values before importing. Matching hashes prove the archive was transferred intact.

## Copy and apply manifests

Keep editing locally. Copy the manifest directory to the VM whenever it changes:

```bash
# Run locally. The destination directory should already exist.
scp -r okapi/k8s <user>@<vm-ip>:~/okapi/
```

Secret files are copied because the cluster needs them, but they must remain excluded from Git:

```gitignore
k8s/*-secret.yml
```

On the VM, apply in dependency order:

```bash
sudo kubectl apply --filename ~/okapi/k8s/00-namespace.yml
sudo kubectl apply --filename ~/okapi/k8s/10-postgres-secret.yml
sudo kubectl apply --filename ~/okapi/k8s/11-postgres-service.yml
sudo kubectl apply --filename ~/okapi/k8s/12-postgres-statefulset.yml
sudo kubectl apply --filename ~/okapi/k8s/20-backend-secret.yml
sudo kubectl apply --filename ~/okapi/k8s/21-backend-configmap.yml
sudo kubectl apply --filename ~/okapi/k8s/22-backend-deployment.yml
sudo kubectl apply --filename ~/okapi/k8s/23-backend-service.yml
sudo kubectl apply --filename ~/okapi/k8s/30-frontend-deployment.yml
sudo kubectl apply --filename ~/okapi/k8s/31-frontend-service.yml
sudo kubectl apply --filename ~/okapi/k8s/40-ingress.yml
```

Once the Namespace exists, `kubectl apply --filename ~/okapi/k8s/` can reconcile the entire directory. The explicit sequence remains useful while learning and troubleshooting dependencies.

## Verify the deployment

Check the complete application state:

```bash
sudo kubectl --namespace okapi get all
sudo kubectl --namespace okapi get ingress
sudo kubectl --namespace okapi get pvc
sudo kubectl --namespace okapi get configmap
sudo kubectl --namespace okapi get secret
```

Expected important states:

- `postgres-0` is `Running` and ready `1/1`.
- The backend and frontend each have one ready Pod.
- `postgres-data-postgres-0` is `Bound`.
- Both application Deployments show desired, current, and ready replica counts of one.
- The Ingress uses class `traefik`.

Find the VM address:

```bash
hostname -I
```

From the local machine:

```bash
curl --head http://<vm-ip>/
curl --head http://<vm-ip>/settings
curl --include http://<vm-ip>/api/authenticate
```

The first two requests should return `200`. The unauthenticated API request should return `401`, proving `/api` reached Spring Boot rather than the React fallback.

## Understand probes

The probes answer different questions:

| Probe | Question | Failure result |
| --- | --- | --- |
| Startup | Has this container finished starting? | Kubernetes keeps waiting; liveness/readiness remain disabled |
| Readiness | May this Pod receive Service traffic now? | Pod stays running but is removed from Service endpoints |
| Liveness | Is this running process stuck or broken? | Kubelet restarts the container |

Avoid using liveness as a dependency check. For example, a temporary database outage should generally make the backend unready rather than force it into an endless restart loop.

## Update and roll back an application image

Build a new immutable tag locally rather than overwriting `0.1.0`:

```bash
sudo docker build --tag okapi-backend:0.1.1 ./backend
sudo docker save --output /tmp/okapi-backend-0.1.1.tar okapi-backend:0.1.1
scp /tmp/okapi-backend-0.1.1.tar <user>@<vm-ip>:~/
```

Import on the VM:

```bash
sudo k3s ctr --namespace k8s.io images import ~/okapi-backend-0.1.1.tar
```

Change the Deployment YAML locally to `0.1.1`, copy it, and apply it. Then observe the rollout:

```bash
sudo kubectl apply --filename ~/okapi/k8s/22-backend-deployment.yml
sudo kubectl --namespace okapi rollout status deployment/backend
sudo kubectl --namespace okapi rollout history deployment/backend
```

Roll back if the new revision fails:

```bash
sudo kubectl --namespace okapi rollout undo deployment/backend
sudo kubectl --namespace okapi rollout status deployment/backend
```

## Test self-healing and persistence

Create a task through the UI, then delete the backend Pod:

```bash
sudo kubectl --namespace okapi delete pod \
  --selector app.kubernetes.io/name=backend
sudo kubectl --namespace okapi get pods --watch
```

The Deployment creates a replacement. Then delete `postgres-0`:

```bash
sudo kubectl --namespace okapi delete pod postgres-0
sudo kubectl --namespace okapi get pods --watch
```

The StatefulSet recreates `postgres-0` and reattaches its existing PVC. When the application becomes ready again, the task should still exist.

## Troubleshooting sequence

Work from Kubernetes scheduling toward the application:

```bash
# 1. Current state
sudo kubectl --namespace okapi get pods,pvc,service,ingress

# 2. Events and probe failures
sudo kubectl --namespace okapi describe pod <pod-name>

# 3. Application logs
sudo kubectl --namespace okapi logs <pod-name>
sudo kubectl --namespace okapi logs <pod-name> --previous

# 4. Service selection
sudo kubectl --namespace okapi get endpointslice

# 5. Rollout state
sudo kubectl --namespace okapi rollout status deployment/backend
sudo kubectl --namespace okapi rollout status deployment/frontend

# 6. Traefik and Ingress
sudo kubectl --namespace okapi describe ingress okapi
sudo kubectl --namespace kube-system get pods,service --selector app.kubernetes.io/name=traefik
```

Common symptoms:

| Symptom | Likely cause | Check |
| --- | --- | --- |
| `ImagePullBackOff` | Image not imported, name mismatch, or `Always` pull policy | `k3s ctr --namespace k8s.io images list` |
| `CreateContainerConfigError` | Missing Secret or ConfigMap/key | `kubectl describe pod` |
| Backend restarts during startup | Database unavailable, invalid JWT secret, or memory limit | Backend logs and Pod events |
| Service has no endpoints | Selector mismatch or Pods are unready | Compare Service selector and Pod labels |
| PostgreSQL PVC is `Pending` | Missing/default storage provisioner issue | `kubectl describe pvc` and `get storageclass` |
| `/settings` returns nginx 404 | Missing SPA `try_files` fallback | `frontend/nginx.conf` |
| `/api` returns React HTML | Ingress API path absent or misrouted | `kubectl describe ingress okapi` |
| Browser cannot reach VM | Traefik Service or VM firewall/network problem | Traefik Service, `curl` on VM, firewall status |

## Security and production limitations

This is a learning deployment, not a production-ready platform. Before public exposure:

1. Add a DNS hostname and TLS certificate.
2. Remove or change generated demo credentials.
3. Store images in a registry instead of manually importing archives.
4. Use an external secret manager or encrypted-at-rest Secret workflow.
5. Back up PostgreSQL outside the VM and test restoration.
6. Add NetworkPolicies restricting Pod-to-Pod communication.
7. Pin container images by immutable digest and scan them.
8. Configure monitoring, log collection, and alerting.
9. Review resource sizes with real measurements.
10. Use multiple nodes or an external managed database if availability matters.

The current `local-path` volume protects data from Pod replacement, not from disk failure, VM deletion, or accidental database corruption.

## Cleanup behavior

Deleting a Deployment or Pod is reversible by reapplying the manifest. Deleting the PostgreSQL PVC destroys the Kubernetes reference to persistent database storage and can cause data loss, so do not delete it casually.

To remove only the application routing and stateless workloads while retaining PostgreSQL:

```bash
sudo kubectl --namespace okapi delete ingress okapi
sudo kubectl --namespace okapi delete service frontend backend
sudo kubectl --namespace okapi delete deployment frontend backend
```

Do not delete the `okapi` Namespace as a routine cleanup step: namespace deletion cascades to its namespaced resources, including the PostgreSQL PVC.
