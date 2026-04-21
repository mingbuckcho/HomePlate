FROM lachlanevenson/k8s-kubectl:v1.25.4

# 빌드 단계에서만 root
USER root

# openssl + ca-certificates 설치
RUN apk add --no-cache jq openssl ca-certificates \
    && addgroup -g 1000 appgroup \
    && adduser -D -u 1000 -G appgroup appuser

# 런타임은 non-root
USER 1000
