# SDK maintenance and release handoff

This repository is a standalone npm package. The pinned contract in `openapi/` is the only normal build input; builds do not fetch the live API document. `openapi/provenance.json` records whether a snapshot is a deployed public document or an unreleased working-tree candidate. A local candidate must never be described as deployed.

## Reciprocal API/SDK workflow

1. Change the API implementation and response/request contract together in the private core repository, including serialized-handler contract tests and public documentation.
2. Export a deterministic candidate OpenAPI document from that working tree. In the SDK checkout, use `npm run sync:openapi -- --file <export> --source-label adeli-core-working-tree`, inspect the diff, then run `npm run generate`, `npm run generate:api-reference`, and `npm run check:generated`. The last command checks both generated types and the API reference.
3. Update affected handwritten resources, serializers, helpers, package tests, examples, and the Changeset. `check:contract` must report missing operations or weak success schemas; do not replace it with a count or an always-green stub. It performs local structural checks only (including local references and compositions) and never fetches references. It is not a second semantic compatibility comparator: core's coordinated compatibility review and drift reporting remain required.
4. Run generation, contract, typecheck, lint, and tests on Node 24. Validate a real tarball with `npm run build`, `npm run check:package`, `npm run test:package`, and `npm run typecheck:examples`. Consumers must resolve only packed files, never monorepo aliases or source paths. The packed gate runs offline with lifecycle scripts disabled, publint, Are the Types Wrong (`--profile node16` against the existing tarball), ESM/CJS imports, and NodeNext/bundler TypeScript consumers.
5. Helpers and uploads must import shared runtime errors through the `@adeli/sdk` self-reference. `tsup` externalizes that self-reference so `splitting: false` cannot duplicate error classes; development typechecking resolves it through the explicit `tsconfig` path aliases. Do not add error-class re-exports to the helper public API.
6. When core's per-environment feature availability changes, update [`availability.md`](availability.md) in the same companion change. The OpenAPI contract does not carry availability, so no generated check catches this drift.
7. From the core checkout, validate SDK-tagged public MDX against that same tarball with `node scripts/check-sdk-doc-examples.mjs --sdk-package <tarball>`. The full coordinated gate is `yarn sdk:check --sdk-dir <sdk-checkout> --sdk-ref <full-reviewed-commit>` and requires a clean immutable candidate; read-only local preparation uses `yarn sdk:prepare --sdk-dir <sdk-checkout> --working-tree`.
8. Return the tested SDK revision, candidate contract hash, package version, tarball filename/hash, exact commands, blocked gates, and unresolved remote-write outcomes to the private change record. Do not copy private PR links, customer data, credentials, or internal implementation details into this repository.

The reverse handoff from the SDK to core includes the public method/type changes, compatibility classification, migration guidance, and the candidate provenance. A behavioral API change with no OpenAPI diff still requires review. A required-field, status, error, nullability, or union change requires explicit breaking-change handling.

## Compatibility and rollout

The supported runtime is Node.js 24. The package has zero runtime dependencies and exposes ESM and CommonJS entry points. Additive API changes deploy and are verified before a new SDK method is advertised. Breaking changes require a compatibility window or staged API migration; releasing a new SDK major alone does not protect existing API consumers. If publication is delayed, leave the private handoff open and keep existing clients supported.

The release workflow is manual and targets the `npm-release` environment; required reviewers, allowed tag refs, and repository protections must be configured and verified externally. Dispatch it on the exact reviewed tag, not its branch: `gh workflow run release.yml --ref v0.1.0 -f reviewed_version=0.1.0 -f release_tag=v0.1.0`. It rejects branch dispatches, mismatched refs, checked-out HEAD/SHA mismatches, package/version/tag mismatches, and artifact metadata/hash mismatches before creating a publish artifact. Validation and OIDC publication retain the same event ref/SHA; the publish job consumes only the tokenless validated tarball. Both jobs run Node 24.22.1, whose bundled npm 11.19.1 meets the trusted-publishing minimum; the workflow checks that exact npm version instead of upgrading npm. Registry configuration, repository protection, npm scope ownership, environment approval, and test-account setup are external prerequisites. The package is MIT-licensed.

npm trusted publishing only works for a package that already exists on the registry, so `0.1.0` was published once by hand as a bootstrap: the release workflow ran on the `v0.1.0` tag, its `publish` job was rejected at the environment gate, and the validated CI tarball was downloaded, checked against `artifact.sha256`, and published byte for byte with `npm publish --access public` from an interactive 2FA login. The trusted publisher (`kingscrosslabs/adeli-sdk`, workflow `release.yml`, environment `npm-release`) was then registered and token publishing disabled. That bootstrap is not repeatable: every later release goes through the workflow's OIDC `publish` job only, never a local or token-based `npm publish`.

The scheduled/manual drift workflow preserves raw SHA evidence but compares parsed canonical OpenAPI JSON. Formatting/key-order-only changes are reported without failing; meaningful canonical changes and malformed/non-OpenAPI responses fail with review evidence. Fetching is bounded and workflow-only; no drift update, publication, or auto-merge occurs.

## Releasing

Every release after `0.1.0` goes through `release.yml` and its OIDC `publish` job. Never run `npm publish` locally or with a token.

1. Each change that should ship adds a changeset in its own PR: `npx changeset`.
2. Open a release PR from `release/X.Y.Z`: run `npx changeset version`, which bumps `package.json`, writes `CHANGELOG.md` and deletes the consumed changesets. Then run `npm install --package-lock-only` so the lockfile version matches, and `npm run release:check`. Merge after review.
3. Tag the merge commit and push the tag:
   `git fetch origin && git tag -a vX.Y.Z origin/main -m vX.Y.Z && git push origin vX.Y.Z`
4. Dispatch the workflow on that tag:
   `gh workflow run release.yml --ref vX.Y.Z -f reviewed_version=X.Y.Z -f release_tag=vX.Y.Z`
5. When `validate` passes, the `publish` job waits for an `npm-release` reviewer. Approve it in the Actions run to publish with provenance.
6. Confirm the release: `npm view @adeli/sdk@X.Y.Z version`. The registry can take a few minutes to show a new version.

If `validate` fails, fix it on `main` with a normal PR. As long as nothing was published, delete the tag (`git push origin :refs/tags/vX.Y.Z`), retag the new merge commit and dispatch again. Never move a tag or reuse a version number once it has been published.

## Evidence format

Record the exact SDK revision, package version, contract SHA-256, source label, commands and results, tarball filename/hash, known blocked gates, release owner, and follow-up owner. A successful local build is not release readiness, API deployment, npm publication, or runtime smoke evidence. Close the private handoff only after an authorized publication, API availability, public documentation/migration notes, and verified tag/version are confirmed.
