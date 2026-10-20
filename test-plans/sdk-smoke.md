# SDK smoke runbook

This is an opt-in runbook, not an automated release claim. Record Node version (22 or 24), package version or local tarball filename, SDK revision, the contract provenance from `openapi/provenance.json` (do not hardcode a future/stale hash), test-account identifiers (never credentials), timestamps, each scenario's result, and cleanup evidence. After every aborted write/upload, record the remote outcome as confirmed-success, confirmed-failure, or unknown before considering resubmission.

## Offline package gate

Run from the standalone SDK checkout:

```sh
npm ci
npm run generate
npm run generate:api-reference
npm run check:generated
npm run check:contract
npm run lint
npm run typecheck
npm test
npm run build
npm run check:package
npm run test:package
npm run typecheck:examples
npm audit --audit-level=high
```

The packed consumer test must load root, helpers, and uploads through both ESM and CommonJS, invoke `waitForConnection` with a fake client and tiny timeout, verify the resulting `TimeoutError` is the root error class, and compile `.mts`/`.cts` NodeNext plus bundler TypeScript consumers. It must install offline with lifecycle scripts disabled and must not use source aliases. Missing helpers/uploads or examples are blocked gates, not skipped tests.

## Read-only runtime smoke (approval required for any key)

Approval: named owner, server-side test key, disposable/test profile, and no production credentials. Cleanup: none beyond recording the tested profile/account scope.


With an explicitly approved server-side test key, call `getMe`, list profiles, and list accounts. Confirm API keys are absent from logs and errors. Do not use browser code or production credentials. Check that nullable identity/capability fields and partial account results are preserved.

## Publishing and connection smoke (separate approval)

Approval: named owner, dedicated provider accounts, registered redirect URI, and an explicit media cleanup plan. Cleanup: remove only the approved disposable posts/accounts after remote outcomes are recorded.


Use dedicated disposable accounts only. Start a connection with a registered redirect URI and complete the browser/dashboard handoff. Publish one synchronous image and one asynchronous video only after approval; observe 201/202 and poll typed status endpoints without reposting. Treat a local timeout as an unknown remote outcome and investigate before any resubmission. Confirm YouTube processing/privacy semantics and TikTok inbox delivery are not represented as public visibility.

## Destructive and billed scenarios (separate approval)

Approval: separate named owner and budget/destructive-action confirmation. Cleanup: confirm target IDs, retain provider receipts/results, and execute the pre-approved cleanup plan.


- **Destructive:** profile/account disconnect, post deletion, campaign deletion. Confirm target IDs and cleanup plan before each call.
- **X usage ledger:** `getXUsage` is a read of Adeli's stored ledger, not an X provider call; record the reported millionths-of-USD units and account/organization scope. It is distinct from actual X post or analytics calls.
- **Billed provider/Ads scenarios:** X posts/analytics and Ads reads or mutations may incur provider cost. Record budget/quota approval, units, account scope, and owner. Do not manufacture partial failures in production.
- **Publishing:** never retry ambiguous writes automatically; document cleanup if the remote result is unknown.

No live provider calls, publication, deployment, or smoke approval is implied by this document. Return results to the private owner handoff without private links or customer data in public package artifacts.
