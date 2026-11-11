ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.10

# https://github.com/hassio-addons/app-base/releases
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# File sharing server (upstream release, MIT/GPL credits in README)
# https://github.com/eikek/sharry/releases
ARG SERVER_VERSION=1.17.0

# Add the ShareIo server and java
# Package versions follow the Alpine release of the base image
# hadolint ignore=DL3018
RUN set -eux; \
    apk update; \
    \
    apk add --no-cache --virtual .build-deps \
        unzip \
        ; \
    mkdir -p /opt; \
    curl -fsSL -o /tmp/server.zip \
        "https://github.com/eikek/sharry/releases/download/v${SERVER_VERSION}/sharry-restserver-${SERVER_VERSION}.zip"; \
    unzip /tmp/server.zip -d /opt; \
    mv "/opt/sharry-restserver-${SERVER_VERSION}" /opt/shareio; \
    rm /tmp/server.zip; \
    apk del .build-deps; \
    \
    apk add --no-cache \
        mariadb-client \
        netcat-openbsd \
        nginx \
        openjdk17-jre-headless \
        ; \
    rm -f /etc/nginx/http.d/default.conf; \
    java -version; \
    \
    echo "Add user for ShareIo"; \
    mkdir -p /data/shareio; \
    addgroup -S abc; \
    adduser -u 12345 -h /data/shareio -D -S abc -G abc; \
    chown -R abc:abc /opt/shareio;

COPY --chown=abc:abc rootfs /

# QR code library for friend links (MIT, https://github.com/kazuhiko-arase/qrcode-generator)
ARG QRCODE_VERSION=1.4.4
ARG QRCODE_SHA1=63f771224854759329a99048806a53ed278740e7
RUN set -eux; \
    curl -fsSL -o /tmp/qrcode.tgz \
        "https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-${QRCODE_VERSION}.tgz"; \
    echo "${QRCODE_SHA1}  /tmp/qrcode.tgz" | sha1sum -c -; \
    mkdir -p /usr/share/shareio/ui/vendor; \
    tar -xzf /tmp/qrcode.tgz -C /tmp package/qrcode.js; \
    mv /tmp/package/qrcode.js /usr/share/shareio/ui/vendor/qrcode.js; \
    rm -rf /tmp/qrcode.tgz /tmp/package

WORKDIR /data/shareio

# The server (Java + database migrations) can take a while to start
HEALTHCHECK --interval=30s --timeout=10s --start-period=3m --retries=3 \
    CMD ["curl", "--fail", "--silent", "--output", "/dev/null", "http://127.0.0.1:9091/api/v2/open/info/version"]

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
