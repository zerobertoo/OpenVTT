# Contributing

Thanks for helping! A few rules:

- Code, comments, commit messages and branch names are in English. Keep comments sparse and only where the code is not self-explanatory.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(auth): add password login`).
- Do not use or copy code, assets or formats from proprietary VTTs.
- Run `pnpm check:i18n && pnpm typecheck && pnpm test` before opening a PR. Any new UI text must exist in both `en.json` and `pt-br.json`.

## Developer Certificate of Origin

Contributions are licensed under the project licenses (AGPL-3.0 for the core, MIT for the SDK and schemas). There is no CLA; instead, sign off every commit to certify the [DCO](https://developercertificate.org/):

```sh
git commit -s -m "feat(scope): describe the change"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line.
