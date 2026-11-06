---
"@adeli/sdk": minor
---

`apiKey` now accepts a resolver, `string | (() => string | Promise<string>)`, exported as the `ApiKey` and `ApiKeyResolver` types. The SDK calls a resolver before every request attempt, retries included, and never caches its result, so a rotated key is used on the next attempt. Each resolved value is validated before it is sent: an empty, blank, non-string or invalid header value throws `ConfigurationError`, and a resolver that throws or rejects surfaces as `ConfigurationError` with the original error as `cause`. Neither is retried. Static string keys behave as before.
