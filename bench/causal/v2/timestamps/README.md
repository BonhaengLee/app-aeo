# Time stamps of the v2 registration

`../MANIFEST.sha256` lists the sha256 of every registered file. Its own sha512 was time-stamped by two RFC 3161 authorities on 2026-10-12, before any v2 data was collected:

| Authority | Token | Time (GMT) |
|---|---|---|
| FreeTSA (freetsa.org) | `manifest.freetsa.tsr` | 2026-10-12 08:37:29 |
| DigiCert (timestamp.digicert.com) | `manifest.digicert.tsr` | 2026-10-12 08:37:31 |

To verify (OpenSSL 3), from this directory:

```sh
openssl ts -verify -in manifest.freetsa.tsr -data ../MANIFEST.sha256 -CAfile freetsa-cacert.pem -untrusted freetsa-tsa.crt
openssl ts -verify -in manifest.digicert.tsr -data ../MANIFEST.sha256 -CAfile /etc/ssl/cert.pem   # any bundle with DigiCert roots
openssl ts -reply -in manifest.freetsa.tsr -text   # shows the time
cd .. && shasum -a 256 -c MANIFEST.sha256          # the files still match the manifest
```

`freetsa-cacert.pem` and `freetsa-tsa.crt` were downloaded from freetsa.org at the same time. Fetch them yourself to check them.
