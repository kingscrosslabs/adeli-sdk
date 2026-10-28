# Releasing `@adeli/sdk`

Releases are published to npm by the manual [`release.yml`](../.github/workflows/release.yml) workflow, using npm trusted publishing (OIDC) with provenance.

> **Never run `npm publish` locally or with a token.** Every release after `0.1.0` goes through the workflow's `publish` job.

## Checklist

Replace `X.Y.Z` with the version you're releasing.

### 1. Add changesets as you go

Every PR that should appear in the release adds a changeset:

```sh
npx changeset
```

### 2. Open the release PR

From a `release/X.Y.Z` branch off `main`:

```sh
npx changeset version            # bumps package.json, writes CHANGELOG.md, deletes used changesets
npm install --package-lock-only  # keeps package-lock.json's version in sync
npm run release:check
```

Open a PR, get it reviewed, and merge it.

### 3. Tag the merge commit

```sh
git fetch origin
git tag -a vX.Y.Z origin/main -m vX.Y.Z
git push origin vX.Y.Z
```

### 4. Run the release workflow on the tag

```sh
gh workflow run release.yml --ref vX.Y.Z -f reviewed_version=X.Y.Z -f release_tag=vX.Y.Z
```

`--ref` must be the tag, not a branch.

### 5. Approve the publish

When the **Validate** job passes, **Publish approved tarball** waits for a reviewer on the `npm-release` environment. Open the run in GitHub Actions and approve it.

### 6. Confirm it's live

```sh
npm view @adeli/sdk@X.Y.Z version
```

The registry can take a few minutes to show a new version.

## If validation fails

Fix the problem on `main` with a normal PR. Then, **only if nothing was published**, move the tag and run the workflow again:

```sh
git push origin :refs/tags/vX.Y.Z   # delete the remote tag
git tag -d vX.Y.Z
git fetch origin
git tag -a vX.Y.Z origin/main -m vX.Y.Z
git push origin vX.Y.Z
gh workflow run release.yml --ref vX.Y.Z -f reviewed_version=X.Y.Z -f release_tag=vX.Y.Z
```

**Never move a tag or reuse a version number once it has been published.** Release a new patch version instead.

## How the workflow protects a release

- **Tag only.** It rejects branch dispatches, mismatched refs, HEAD/SHA mismatches, and package/version/tag mismatches before any package work.
- **Validate, then publish the same bytes.** `validate` runs the full gate (generation drift, contract, lint, typecheck, tests, audit, build, package checks) and packs the tarball with its SHA-256 and identity. `publish` re-checks that identity and publishes only that tarball. It never rebuilds.
- **Human approval.** The `npm-release` environment requires a reviewer before `publish` runs.
- **Pinned toolchain.** Both jobs run Node 24.22.1, whose bundled npm 11.19.1 meets the trusted-publishing minimum. The workflow checks that exact npm version instead of upgrading npm.

External prerequisites (configured outside this repo): the `npm-release` environment with required reviewers and allowed tag refs, `@adeli` scope ownership on npm, and the npm trusted publisher (`kingscrosslabs/adeli-sdk`, workflow `release.yml`, environment `npm-release`) with token publishing disabled.

## History: the `0.1.0` bootstrap

npm trusted publishing only works for a package that already exists on the registry. So `0.1.0` was published once by hand: the workflow ran on `v0.1.0`, its `publish` job was rejected at the environment gate, and the validated CI tarball was downloaded, checked against `artifact.sha256`, and published byte for byte with `npm publish --access public` from an interactive 2FA login. This was a one-time step and is not repeatable.
