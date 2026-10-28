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

That's it. The run has three jobs, one after another:

1. **Bump, check and tag.** It turns the pending changesets into the next version (`package.json`, `CHANGELOG.md`, lockfile) and runs every check: generation drift, contract, lint, typecheck, tests, audit, build and package checks. **Only if all of them pass** does it commit **chore(release): X.Y.Z** to `main` and tag it `vX.Y.Z`, in one atomic push. If anything fails, nothing is pushed. It also stops if there are no changesets, or if the version is already tagged or on npm.
2. **Build tarball from the tag.** It checks out `vX.Y.Z`, verifies it is exactly the version bump on top of the commit the run started from (only `package.json`, `package-lock.json`, `CHANGELOG.md` and consumed changesets may change), and packs the tarball.
3. **Publish to npm.** It rechecks the tarball and publishes it with provenance.

npm's provenance names the commit the run started from, the one just before the version bump. Job 2's check guarantees the published code is that commit's code plus only the version bump.

Then confirm it's live (the registry can take a few minutes):

```sh
npm view @adeli/sdk@X.Y.Z version
```

## If something fails

**Bump, check and tag failed:** nothing was pushed. Fix the problem on `main` with a normal PR and run Release SDK again.

**Build or Publish failed:** the tag exists but nothing is on npm yet.

- If the failure was flaky, or a setting outside the repo needed fixing, use **Re-run failed jobs** on that run. It reuses the same tag.
- If the code needs a fix, undo the release so the next run starts clean, **only if nothing was published**:

  ```sh
  git push origin :refs/tags/vX.Y.Z   # delete the unpublished tag
  git revert <the chore(release): X.Y.Z commit>   # restores the changesets and the old version; merge via PR
  ```

  Merge the fix and the revert, then run Release SDK again.

**Never move a tag or reuse a version number once it has been published.** Release a new patch version instead.

## Doing it by hand

Don't publish by hand: every release goes through this workflow. If Release SDK is broken, fix it with a PR and run it again.

## How the workflow protects a release

- **Checked before it's tagged.** The first job runs the full gate before anything reaches `main`, and refuses versions that are already tagged or on npm.
- **The tag is only the version bump.** The build and publish jobs check that the tag is the commit directly on top of the run's starting commit, that it matches `package.json`, and that it changes nothing but release files.
- **Validate, then publish the same bytes.** The build job packs the tarball and records its SHA-256 and identity. `publish` re-checks that identity and publishes only that tarball. It never rebuilds.
- **Who can release.** Anyone who can run workflows (write access) can publish. The `npm-release` environment has no reviewers; it only allows `main`, and npm's trusted publisher is bound to it.
- **Pinned toolchain.** Every job runs Node 24.22.1, whose bundled npm 11.19.1 meets the trusted-publishing minimum. The workflow checks that exact npm version instead of upgrading npm.

External prerequisites (configured outside this repo): the `npm-release` environment limited to `main`, `@adeli` scope ownership on npm, and the npm trusted publisher (`kingscrosslabs/adeli-sdk`, workflow `release.yml`, environment `npm-release`) with token publishing disabled. The first job pushes directly to `main`; if `main` gets a protection ruleset, add GitHub Actions as a bypass actor.

## History: the `0.1.0` bootstrap

npm trusted publishing only works for a package that already exists on the registry. So `0.1.0` was published once by hand: the workflow (then started manually with version inputs) ran on `v0.1.0`, its `publish` job was rejected at what was then an approval gate on `npm-release`, and the validated CI tarball was downloaded, checked against `artifact.sha256`, and published byte for byte with `npm publish --access public` from an interactive 2FA login. This was a one-time step and is not repeatable.
