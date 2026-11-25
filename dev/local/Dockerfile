# AWS Emulator for macOS/Windows/CI. It only runs natively on Linux, so we run
# the Linux package in a container. Built by up.sh.
# Always the latest release (see
# https://docs.aws.amazon.com/emulator/latest/userguide/): up.sh rebuilds with
# --pull --no-cache so the newest package is downloaded.
FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal
ARG TARGETARCH
# Optional corporate CA certificates (e.g. a TLS-intercepting proxy such as
# Zscaler), see certs/README.md. The directory always exists, so this is a no-op
# when it holds no certificates.
COPY certs/ /tmp/extra-certs/
RUN set -e; \
    for f in /tmp/extra-certs/*.pem /tmp/extra-certs/*.crt; do \
      if [ -e "$f" ]; then \
        cp "$f" "/etc/pki/ca-trust/source/anchors/$(basename "${f%.*}").crt"; \
        trust_changed=1; \
      fi; \
    done; \
    if [ -n "${trust_changed:-}" ]; then update-ca-trust; fi; \
    rm -rf /tmp/extra-certs
RUN case "$TARGETARCH" in arm64) a=aarch64 ;; amd64) a=x86_64 ;; *) exit 1 ;; esac \
    && curl -fsSLo /tmp/aws-emulator.rpm \
       "https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-$a.rpm" \
    && rpm -i /tmp/aws-emulator.rpm && rm /tmp/aws-emulator.rpm \
    && mkdir -p /home/emulator && chown 1000 /home/emulator
USER 1000
ENV HOME=/home/emulator
ENV PATH=/opt/aws-emulator/bin:$PATH
EXPOSE 9297
ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0"]
