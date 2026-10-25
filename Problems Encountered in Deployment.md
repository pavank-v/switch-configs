1. Firewall interaction issue between libvirt and docker
	- Docker drops packets in host machine unless specifically told so
	- So added explicit rules to docker user like this
		```
		sudo iptables -I DOCKER-USER 1 \
		  -o virbr0 \
		  -m conntrack --ctstate RELATED,ESTABLISHED \
		  -j ACCEPT
		```
	- This means allow reply traffic going back to vm over virbr0
	```
		sudo iptables -I DOCKER-USER 2 \
		  -i virbr0 \
		  -j ACCEPT
	```
	- This means allow traffic originating from vm

# Kubernetes Cluster Architecture Diagram

```
Cluster
├── Control Plane
│   ├── API Server
│   ├── Scheduler
│   ├── Controller Manager
│   └── etcd
│
└── Nodes
    ├── Node 1
    │   ├── kubelet
    │   ├── kube-proxy
    │   ├── container runtime
    │   └── Pods
    │       ├── Pod
    │       │   └── Container(s)
    │       └── Pod
    │           └── Container(s)
    │
    └── Node 2
        ├── kubelet
        ├── kube-proxy
        ├── container runtime
        └── Pods
```

## More About Pods
- High level objects to manage pods.
	1. Deployment
	2. ReplicaSet
- We expose pods using Service.

# Each buzzwords in K8S

## Cluster
- Cluster is the entire kubernetes environment.
- It contains Control Plane and Nodes.
- We don't create the clusters. It's created by things like k3s, minikube, kind etc.

```
# Useful Command

kubectl cluster-info
```

## Node
- A node is a machine running in kubernetes. It can be Physical Server, VM, Cloud VM, etc.
- A node has these things
	- kubelet
	- container runtime
	- pods
	- networking components
	
	```
	# To check what nodes are in the cluster
	kubectl get nodes -A
	```
- One machine my act as both Control Plane and Worker Node, but in production they are seperated.

- AGAIN NO .yml NODES ARE REGISTERED AUTOMATICALLY.

## Control Plane
- It is the brain of the kubernetes cluster. 
- Key Components
	- API Server
	- Control Manager
	- Scheduler
	- etcd

#### API Server
- It is the entry point of k8s, when we do ```kubectl get nodes``` it goes to the API Server.
- The request can then go through the other things like CM, Scheduler, etcd.

```
	# When you do 
	kubectl apply -f deployment.yml
		
	# The flow goes like this
		kubectl
			|
			API Server
				|
				--> etcd
				--> scheduler
				--> controllers
```

### etcd
- etcd is kubernetes database.
- It stores the state of the cluster.

### Scheduler
- Scheduler decides which node should a pod run on.
- Suppose we have a pod that requires 4GB RAM and we have 2 nodes which has 2GB and 100 GB. The pod will run on the 2nd Node. 
- It considers
	- CPU
	- Memory
	- affinity -> Opposite to taints: "attract"
	- labels
	- taints -> Taints are properties applied to nodes to repel some pods.
	- node constraints

### Controller
- It keeps the cluster in desired state.
- In simpler terms
	- if we say "I want 3 instances of this app running" and one crashed, the controller will run a new instance
- AGAIN WE DON'T NEED TO WRITE A .YML FILE FOR THIS. IT IS A KUBERNETES FEATURE.

### Kubelet
- It is the agent running in the node.
- If we tell to run something, it will see it and tell the containerd to run it.
- It monitors
	- Container health
	- Pod Status
	- resource usage
	- monted volumes

### Containerd
- It is the container runtime.
- this is the software that actually 
	- pulls images
	- creates containers
	- starts containers
	- stops containers
	- manages containers file system
### Pod
- Pod is the smallest deployable unit in k8s.
- It contains one or more containers.
- Containers in the pod share
	- Network namespaces
	- Volume
	- Localhost
	- Ip addresses
	
- Basic config
```
apiVersion: v1
kind: Pod

metadata:
  name: nginx-pod

spec:
  containers:
    - name: nginx
      image: nginx:latest
      ports:
        - containerPort: 80
```

- To apply this
	```kubectl apply -f pod.yml```

- We don't necessarily create pod ourselves. Let's say a pod dies and k8s can't recreate it. Which is why we use "Deployment"

### Deployment
- Instead of saying "Create this exact Pod" we say "I want 3 copies of this application"
- It gives us
	- replicas
	- rollback
	- self-healing
	- scaling
	- rolling updates

- Example Config:
```
	apiVersion: apps/v1
	kind: Deployment
	
	metadata:
	  name: todo-api
	
	spec:
	  replicas: 3
	
	  selector:
	    matchLabels:
	      app: todo-api
	
	  template:
	    metadata:
	      labels:
	        app: todo-api
	
	    spec:
	      containers:
	        - name: todo-api
	          image: myusername/todo-api:1.0
	          ports:
	            - containerPort: 8080
```


### Service
- Pods have a networking problem. 
- Pods are temporary, meaning it can die so we can't use the ip for communication like we do in local development.
- This where service comes in
- Simple Config
```
apiVersion: v1
kind: Service

metadata:
  name: todo-service

spec:
  selector:
    app: todo-api

  ports:
    - port: 80
      targetPort: 8080

  type: NodePort
```

- Here type: NodePort is Scope. Other type is ClusterPort (self-explanatory)



## Mental model
- There are roughly two categories.
#### Kubernetes infrastructure

```
Cluster
Node
Control Plane
kubelet
containerd
```
- These are part of the machinery running Kubernetes.
- We usually **install/configure** them.
#### Kubernetes resources

```
Pod
Deployment
Service
```

- These are things **you declare**, usually through YAML.
- That's why you commonly write:

```
pod.yaml
deployment.yaml
service.yaml
```

- but we usually don't write:

```
kubelet.yaml
containerd.yaml
cluster.yaml
```