# Releasing `@adeli/sdk`

Releasing is two clicks: **Prepare release** bumps the version, checks it and tags it, then **Release SDK** publishes that tag to npm.

> **Never run `npm publish` locally or with a token.** Every release after `0.1.0` goes through Release SDK, which publishes with npm trusted publishing (OIDC) and provenance.

## Before you release: add changesets

Every PR that should appear in the release adds a changeset:

```sh
npx changeset
```

Pick `patch`, `minor` or `major` and write one line for the changelog. Commit the generated `.changeset/*.md` file with the PR.

## Release in two clicks

### 1. Prepare release

**Actions → Prepare release → Run workflow** (from `main`).

It turns the pending changesets into the next version (`package.json`, `CHANGELOG.md`, lockfile) and runs every check: generation drift, contract, lint, typecheck, tests, audit, build and package checks. **Only if all of them pass** does it commit **chore(release): X.Y.Z** to `main` and tag it `vX.Y.Z`, in one atomic push. If anything fails, nothing is pushed.

It stops with an error if there are no changesets, or if the version is already tagged or on npm.

### 2. Release SDK

**Actions → Release SDK → Run workflow → Use workflow from → Tags → `vX.Y.Z` → Run workflow**, or:

```sh
gh workflow run release.yml --ref vX.Y.Z
```

It validates the tag again, builds the tarball and publishes it. There's no approval step: running the workflow is the approval.

Then confirm it's live (the registry can take a few minutes):

```sh
npm view @adeli/sdk@X.Y.Z version
```

## Doing it by hand

If Prepare release is unavailable, do its work locally, then run Release SDK as in step 2:

```sh
git switch main && git pull
npx changeset version            # bumps package.json, writes CHANGELOG.md, deletes used changesets
npm install --package-lock-only  # keeps package-lock.json's version in sync
npm run build && npm run release:check
git commit -am "chore(release): X.Y.Z"
git tag -a vX.Y.Z -m vX.Y.Z
git push --atomic origin main vX.Y.Z
```

The tag must match the `version` in `package.json`, or Release SDK stops before building anything.

## If Release SDK fails

If the failure was a flaky runner, use **Re-run all jobs** on the run in GitHub Actions.

If the code needs a fix, merge it to `main` with a normal PR. Then, **only if nothing was published**, move the tag and run Release SDK again on it:

```sh
git push origin :refs/tags/vX.Y.Z   # delete the remote tag
git tag -d vX.Y.Z
git fetch origin
git tag -a vX.Y.Z origin/main -m vX.Y.Z
git push origin vX.Y.Z
```

**Never move a tag or reuse a version number once it has been published.** Release a new patch version instead.

## How the workflow protects a release

- **Tag only.** It rejects runs started from a branch, and stops before any package work if the tag doesn't match `package.json` or the checked-out commit doesn't match the tag.
- **Validate, then publish the same bytes.** `validate` runs the full gate (generation drift, contract, lint, typecheck, tests, audit, build, package checks) and packs the tarball with its SHA-256 and identity. `publish` re-checks that identity and publishes only that tarball. It never rebuilds.
- **Checked before it's tagged.** Prepare release runs the full gate before anything reaches `main`, and refuses versions that are already tagged or on npm.
- **Who can release.** Anyone who can run workflows (write access) can publish. The `npm-release` environment has no reviewers; it only allows tags, and npm's trusted publisher is bound to it.
- **Pinned toolchain.** Both jobs run Node 24.22.1, whose bundled npm 11.19.1 meets the trusted-publishing minimum. The workflow checks that exact npm version instead of upgrading npm.

External prerequisites (configured outside this repo): the `npm-release` environment limited to `v*` tags, `@adeli` scope ownership on npm, and the npm trusted publisher (`kingscrosslabs/adeli-sdk`, workflow `release.yml`, environment `npm-release`) with token publishing disabled.

## History: the `0.1.0` bootstrap

npm trusted publishing only works for a package that already exists on the registry. So `0.1.0` was published once by hand: the workflow (then started manually with version inputs) ran on `v0.1.0`, its `publish` job was rejected at what was then an approval gate on `npm-release`, and the validated CI tarball was downloaded, checked against `artifact.sha256`, and published byte for byte with `npm publish --access public` from an interactive 2FA login. This was a one-time step and is not repeatable.
