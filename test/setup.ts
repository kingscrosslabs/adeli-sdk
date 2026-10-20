const realFetch = globalThis.fetch;

/** Default tests may not contact providers or arbitrary Internet hosts. */
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '[::1]' && url.hostname !== '::1') {
    throw new Error(`Network access is disabled in tests: ${url.origin}`);
  }
  // A permitted loopback URL must not redirect a test onto the Internet.
  return realFetch(input, { ...init, redirect: 'error' });
}) as typeof globalThis.fetch;
