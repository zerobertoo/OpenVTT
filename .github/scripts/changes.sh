#!/usr/bin/env bash
# Reads changed file paths on stdin (one per line) and prints which CI jobs they require as
# `key=value` lines, ready to append to $GITHUB_OUTPUT.
#   code   - check and e2e: anything that is not documentation, the landing page or repo metadata
#   docker - docker build: only files the Dockerfile copies, plus the Dockerfile and compose files
# An empty file list (diff failed or nothing changed) is treated as "run everything".
set -euo pipefail

code=false
docker=false
seen=false

while IFS= read -r file; do
  [ -n "$file" ] || continue
  seen=true
  case "$file" in
    .github/workflows/* | .github/scripts/*)
      code=true
      docker=true
      ;;
    docs/* | site/* | .github/ISSUE_TEMPLATE/* | .github/CODEOWNERS | .github/PULL_REQUEST_TEMPLATE.md | \
      .github/labels.yml | .github/dependabot.yml | LICENSE | CITATION.cff | .editorconfig | .gitattributes)
      ;;
    */*) # nested paths: only docs/ and site/ above are skipped
      code=true
      case "$file" in
        packages/* | systems/*) docker=true ;;
      esac
      ;;
    *.md) ;;
    Dockerfile | .dockerignore | compose*.yaml) docker=true ;;
    package.json | pnpm-lock.yaml | pnpm-workspace.yaml | tsconfig.base.json)
      code=true
      docker=true
      ;;
    *)
      code=true
      ;;
  esac
done

if [ "$seen" = false ]; then
  code=true
  docker=true
fi

echo "code=$code"
echo "docker=$docker"
