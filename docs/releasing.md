# Releasing `@adeli/sdk`

Releasing is three clicks. Workflows do the version bump, the tag, the build and the publish. A person still reviews the release PR and approves the publish.

> **Never run `npm publish` locally or with a token.** Every release after `0.1.0` goes through the Release SDK workflow's `publish` job.

## Before you release: add changesets

Every PR that should appear in the release adds a changeset:

```sh
npx changeset
```

Pick `patch`, `minor` or `major` and write one line for the changelog. Commit the generated `.changeset/*.md` file with the PR.

## Release in three clicks

### 1. Prepare the release

**Actions → Prepare release → Run workflow** (from `main`).

It turns the pending changesets into the next version (`package.json`, `CHANGELOG.md`, lockfile), runs `release:check`, and opens a **chore(release): X.Y.Z** PR from `release/X.Y.Z`. It stops with an error if there are no changesets.

### 2. Review and merge the release PR

Check the version and `CHANGELOG.md`, wait for **SDK checks** to pass, and merge.

Merging tags the merge commit `vX.Y.Z` and starts **Release SDK** on that tag automatically ([`tag-release.yml`](../.github/workflows/tag-release.yml)).

### 3. Approve the publish

Open the **Release vX.Y.Z** run under **Actions → Release SDK**. When **Validate** passes, **Publish approved tarball** waits for an `npm-release` reviewer. Click **Review deployments → Approve**.

Then confirm it's live (the registry can take a few minutes):

```sh
npm view @adeli/sdk@X.Y.Z version
```

## Doing it by hand

Use this when a workflow is unavailable. Each step replaces the matching click above.

**Prepare** (on a `release/X.Y.Z` branch off `main`, then open a PR and merge it):

```sh
npx changeset version            # bumps package.json, writes CHANGELOG.md, deletes used changesets
npm install --package-lock-only  # keeps package-lock.json's version in sync
npm run release:check
```

**Tag** the merge commit:

```sh
git fetch origin
git tag -a vX.Y.Z origin/main -m vX.Y.Z
git push origin vX.Y.Z
```

The tag must match the `version` in `package.json`, or Release SDK stops before building anything.

**Run Release SDK** on the tag: **Actions → Release SDK → Run workflow → Use workflow from → Tags → `vX.Y.Z`**, or:

```sh
gh workflow run release.yml --ref vX.Y.Z
```

Then approve the publish as in step 3.

## If validation fails

If the failure was a flaky runner, use **Re-run all jobs** on the run in GitHub Actions.

If the code needs a fix, merge it to `main` with a normal PR. Then, **only if nothing was published**, move the tag and run Release SDK again on it (see **Doing it by hand**):

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
- **No accidental re-releases.** Tag release skips versions that are already tagged, and fails if the version is already on npm.
- **Human approval.** The `npm-release` environment requires a reviewer before `publish` runs.
- **Pinned toolchain.** Both jobs run Node 24.22.1, whose bundled npm 11.19.1 meets the trusted-publishing minimum. The workflow checks that exact npm version instead of upgrading npm.

External prerequisites (configured outside this repo): **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** (Prepare release opens the PR with the workflow token); the `npm-release` environment with required reviewers and allowed tag refs, `@adeli` scope ownership on npm, and the npm trusted publisher (`kingscrosslabs/adeli-sdk`, workflow `release.yml`, environment `npm-release`) with token publishing disabled.

## History: the `0.1.0` bootstrap

npm trusted publishing only works for a package that already exists on the registry. So `0.1.0` was published once by hand: the workflow (then started manually with version inputs) ran on `v0.1.0`, its `publish` job was rejected at the environment gate, and the validated CI tarball was downloaded, checked against `artifact.sha256`, and published byte for byte with `npm publish --access public` from an interactive 2FA login. This was a one-time step and is not repeatable.
