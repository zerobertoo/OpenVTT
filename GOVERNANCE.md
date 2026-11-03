# Governance

OpenVTT is a small project with a single maintainer. This page says how decisions are made so contributors know what to expect.

## Maintainers

| Maintainer | GitHub | Scope |
|---|---|---|
| José Roberto | [@zerobertoo](https://github.com/zerobertoo) | Everything: roadmap, reviews, releases, security |

## How decisions are made

- The maintainer has the final say, guided by [PRODUCT.md](PRODUCT.md) (who the product is for) and the [roadmap](docs/ROADMAP.md).
- Features are discussed in an issue before the code is written. Silence is not a "no", but a large pull request that was never discussed may be declined, politely and with the reason.
- Non-negotiables: the server stays authoritative (see [ARCHITECTURE.md](docs/ARCHITECTURE.md)), hidden information never reaches clients that cannot see it, and nothing proprietary is copied from other tools.
- Anything affecting the license, the data format or the protocol is documented in the changelog.

## Becoming a maintainer

Not open yet. Regular contributors with a record of good reviews and fixes may be invited to become maintainers; this page will be updated when that happens.

## Releases

The project is on 0.x: the data format, protocol and APIs can change between commits, and only `main` is supported. Versioning will follow [Semantic Versioning](https://semver.org/) from 1.0.0. Notable changes are listed in the [changelog](CHANGELOG.md).
