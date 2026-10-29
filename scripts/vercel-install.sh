#!/bin/bash
# Vercel Install Command
#
# Vercel restores node_modules from the previous deploy's build cache. pnpm's
# incremental install trusts that tree's own record of what is installed, so a
# patch added since then never reaches the package: the new patch_hash
# directory keeps the unpatched files, and even --force leaves it. Only a fresh
# tree applies every patch.

set -e

rm -rf node_modules
pnpm install --frozen-lockfile
