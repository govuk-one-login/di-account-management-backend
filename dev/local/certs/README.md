# Extra CA certificates for the emulator image build

If your network re-signs HTTPS traffic (for example a Zscaler proxy), the build
fails with `curl: (60) SSL certificate ... unable to get local issuer certificate`
when downloading the emulator package.

Put your organisation's CA certificates here as PEM files (`*.pem` or `*.crt`),
the root **and** any intermediate. `npm run local:up` bakes them into the image's
trust store, so TLS verification stays on. They are git-ignored.

On macOS, Zscaler's certificates can usually be exported from the keychain:

    security find-certificate -a -p -c "Zscaler" /Library/Keychains/System.keychain \
      > dev/local/certs/zscaler.pem

or pass any PEM file: `EXTRA_CA_CERT=/path/to/ca.pem npm run local:up`.
