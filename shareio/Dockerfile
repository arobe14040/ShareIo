ARG BUILD_FROM=ghcr.io/hassio-addons/base

# https://github.com/hassio-addons/app-base/releases
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# https://github.com/eikek/sharry/releases
ARG SHARRY_VERSION=1.17.0

# Add Sharry and java
# Package versions follow the Alpine release of the base image
# hadolint ignore=DL3018
RUN set -eux; \
    apk update; \
    \
    apk add --no-cache --virtual .build-deps \
        unzip \
        ; \
    mkdir -p /opt; \
    curl -s -J -L -o /tmp/sharry.zip \
        "https://github.com/eikek/sharry/releases/download/v${SHARRY_VERSION}/sharry-restserver-${SHARRY_VERSION}.zip"; \
    unzip /tmp/sharry.zip -d /opt; \
    mv /opt/sharry-restserver-${SHARRY_VERSION} /opt/sharry; \
    rm /tmp/sharry.zip; \
    apk del .build-deps; \
    \
    apk add --no-cache \
        mariadb-client \
        netcat-openbsd \
        openjdk17-jre-headless \
        ; \
    java -version; \
    \
    echo "Add user for Sharry"; \
    mkdir -p /data/sharry; \
    addgroup -S abc; \
    adduser -u 12345 -h /data/sharry -D -S abc -G abc; \
    chown -R abc:abc /opt/sharry;
    
COPY --chown=abc:abc rootfs /
WORKDIR /data/sharry

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version=${BUILD_VERSION} \
    maintainer="ShareIo contributors" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="ShareIo" \
    org.opencontainers.image.authors="ShareIo contributors" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}
