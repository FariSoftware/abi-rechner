# Deploying abi-rechner-mcp

## Build & push

Build from the **repo root** (so `abi-core.js` is in context):

```bash
docker build -f mcp/Dockerfile -t ghcr.io/farisoftware/abi-rechner-mcp:$(git rev-parse --short HEAD) .
docker push ghcr.io/farisoftware/abi-rechner-mcp:<tag>
```

The runtime image is distroless, non-root (uid 65532), ~no shell.

## Deploy (Kustomize)

```bash
kubectl kustomize mcp/deploy/k8s/overlays/production   # preview
kubectl apply -k mcp/deploy/k8s/overlays/production
```

Before applying, fill the placeholders:

- `overlays/production/kustomization.yaml` → `newTag` = the pushed immutable tag.
- `overlays/production/hostname-patch.yaml` → real hostname (3 places).
- `base/httproute.yaml` → `parentRefs` Gateway name + HTTPS `sectionName`.
- `base/certificate.yaml` → `issuerRef` ClusterIssuer name.
- `imagePullSecrets: ghcr` must exist in the `abi-rechner` namespace.

## What's included

Deployment (2 replicas, hardened securityContext, `/healthz` probes), Service,
HTTPRoute (+HTTP→HTTPS redirect), cert-manager Certificate, HPA (2→6), PDB.

## Abuse bounds (open endpoint)

The endpoint is intentionally unauthenticated (the calculator has no secrets).
Bounds in place: small per-pod resource limits + HPA `maxReplicas: 6` cap the
cost/blast radius.

**Gateway rate limiting is NOT in these manifests** — it is NGINX Gateway Fabric
specific and not expressible in the portable HTTPRoute spec. Add it at the gateway,
e.g. an NGF `SnippetsFilter` injecting `limit_req`, or front the route with your
existing edge rate-limit. Wire this before announcing the public URL.

## Connecting ChatGPT / Claude

Add `https://<hostname>/mcp` as a remote MCP connector. No auth step required
with the open configuration.
