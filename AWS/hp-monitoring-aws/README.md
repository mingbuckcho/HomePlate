# aws-eks

HomePlate EKS observability / operations repository.

## Structure

### helm/
Third-party install values only.

- `helm/kps/` - kube-prometheus-stack values
- `helm/alloy/` - alloy collector / logs values
- `helm/loki/` - loki values
- `helm/tempo/` - tempo values
- `helm/yace/` - YACE values

### kustomize/
Operational manifests managed by our team.

- `kustomize/base/apps/aiops/` - AIOps app manifests
- `kustomize/base/monitors/` - ServiceMonitor + metrics Service
- `kustomize/base/exporters/` - mysqld / redis exporter manifests
- `kustomize/base/grafana/` - Grafana dashboard ConfigMap generator
- `kustomize/overlays/prod/` - prod-only secret generation and overrides

### origins/
Archive / reference only. Not an active deployment source.

## Source of truth

Active deployment source is only:

- `helm/`
- `kustomize/`

`origins/` is for archive/reference only.

## Operational rule

- **Helm** = install third-party components
- **Kustomize** = manage our operational resources
- **origins** = keep old / reference files only

## Validation

### Helm
Use values files as the source of truth.

Examples:
- `helm lint ...`
- `helm template ... -f <values-file>`

### Kustomize
Validate before apply.

- `kubectl kustomize kustomize/base`
- `kubectl kustomize kustomize/overlays/prod`
- `kubectl apply --dry-run=server -k kustomize/overlays/prod`

## Apply

Apply only from:

- `kubectl apply -k kustomize/overlays/prod`

## Secrets

Do not commit real secret values.

Current rule:
- real `.env` files are local-only
- raw Secret YAML is not an active source
- Secret Manager / external secret integration can replace local `.env` later

## Current scope

Included in active structure:
- aiops app manifests
- ServiceMonitor / metrics Service
- mysqld / redis exporters
- grafana main dashboards

Deferred / archived for now:
- legacy custom Helm charts
- old patch/reference files
- PrometheusRule / AlertmanagerConfig work not yet activated