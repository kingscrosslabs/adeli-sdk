# Releasing `@adeli/sdk`

Releasing is one click: **Release SDK** bumps the version, runs every check, tags the release and publishes it to npm.

> **Never run `npm publish` locally or with a token.** Every release after `0.1.0` goes through Release SDK, which publishes with npm trusted publishing (OIDC) and provenance.

## Before you release: add changesets

Every PR that should appear in the release adds a changeset:

```sh
npx changeset
```

Pick `patch`, `minor` or `major` and write one line for the changelog. Commit the generated `.changeset/*.md` file with the PR.

## Release

**Actions → Release SDK → Run workflow** (from `main`), or:

```sh
gh workflow run release.yml --ref main
```

That's it. You'll see two runs:

1. **Release from main.** It turns the pending changesets into the next version (`package.json`, `CHANGELOG.md`, lockfile) and runs every check: generation drift, contract, lint, typecheck, tests, audit, build and package checks. **Only if all of them pass** does it commit **chore(release): X.Y.Z** to `main` and tag it `vX.Y.Z`, in one atomic push. If anything fails, nothing is pushed. Then it starts the second run.
2. **Publish vX.Y.Z.** It starts automatically on the new tag, rebuilds from that exact commit, checks the tag matches `package.json`, and publishes to npm.

The first run stops with an error if there are no changesets, or if the version is already tagged or on npm.

Publishing happens in a separate run on the tag so that npm's provenance points at the exact release commit.

Then confirm it's live (the registry can take a few minutes):

```sh
npm view @adeli/sdk@X.Y.Z version
```

## If something fails

**Release from main failed:** nothing was pushed. Fix the problem on `main` with a normal PR and run Release SDK again.

**Publish vX.Y.Z failed:** the tag exists but nothing is on npm yet.

- For a flaky runner, use **Re-run all jobs** on that run.
- To retry without changes, run Release SDK on the tag: **Run workflow → Use workflow from → Tags → `vX.Y.Z`**, or `gh workflow run release.yml --ref vX.Y.Z`.
- If the code needs a fix, merge it to `main`, then delete the tag (`git push origin :refs/tags/vX.Y.Z`) and retag the fixed commit **only if nothing was published**. Then run Release SDK on the tag as above.

**Never move a tag or reuse a version number once it has been published.** Release a new patch version instead.

## Doing it by hand

If the bump-and-tag run can't be used, do its work locally, then run Release SDK on the tag:

```sh
git switch main && git pull
npx changeset version            # bumps package.json, writes CHANGELOG.md, deletes used changesets
npm install --package-lock-only  # keeps package-lock.json's version in sync
npm run build && npm run release:check
git commit -am "chore(release): X.Y.Z"
git tag -a vX.Y.Z -m vX.Y.Z
git push --atomic origin main vX.Y.Z
gh workflow run release.yml --ref vX.Y.Z
```

## How the workflow protects a release

- **Checked before it's tagged.** The run on `main` runs the full gate before anything reaches `main`, and refuses versions that are already tagged or on npm.
- **Publish from the tag only.** The publish run checks that the tag matches `package.json` and the checked-out commit before any package work.
- **Validate, then publish the same bytes.** `validate` runs the full gate again and packs the tarball with its SHA-256 and identity. `publish` re-checks that identity and publishes only that tarball. It never rebuilds.
- **Who can release.** Anyone who can run workflows (write access) can publish. The `npm-release` environment has no reviewers; it only allows tags, and npm's trusted publisher is bound to it.
- **Pinned toolchain.** Every job runs Node 24.22.1, whose bundled npm 11.19.1 meets the trusted-publishing minimum. The workflow checks that exact npm version instead of upgrading npm.

External prerequisites (configured outside this repo): the `npm-release` environment limited to `v*` tags, `@adeli` scope ownership on npm, and the npm trusted publisher (`kingscrosslabs/adeli-sdk`, workflow `release.yml`, environment `npm-release`) with token publishing disabled. The run on `main` pushes directly to `main`; if `main` gets a protection ruleset, add GitHub Actions as a bypass actor.

## History: the `0.1.0` bootstrap

npm trusted publishing only works for a package that already exists on the registry. So `0.1.0` was published once by hand: the workflow (then started manually with version inputs) ran on `v0.1.0`, its `publish` job was rejected at what was then an approval gate on `npm-release`, and the validated CI tarball was downloaded, checked against `artifact.sha256`, and published byte for byte with `npm publish --access public` from an interactive 2FA login. This was a one-time step and is not repeatable.
