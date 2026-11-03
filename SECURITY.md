# Security policy

OpenVTT is self-hosted: whoever runs an instance is responsible for keeping it updated and behind HTTPS. The server is authoritative, and it must never send hidden tokens, walls, whispers or other players' sheets to a client that cannot see them. Bugs that break that promise are treated as security bugs.

## Supported versions

Only the latest commit on `main` is supported while the project is on 0.x.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through [GitHub's private vulnerability reporting](https://github.com/zerobertoo/OpenVTT/security/advisories/new) and include:

- what you found and which version or commit it affects;
- steps to reproduce, or a proof of concept;
- the impact you expect (for example, a player seeing hidden information).

This is a personal project, so there is no fixed response time. Reports are read and answered as soon as possible, and a fix is credited to the reporter unless they prefer otherwise.

## Out of scope

- Instances exposed without HTTPS, or with `OPENVTT_SECURE_COOKIES` unset behind a TLS proxy.
- Anything that needs administrator access to the installation, which already controls the data.
- Denial of service from a signed-in user uploading files within the documented limits.
