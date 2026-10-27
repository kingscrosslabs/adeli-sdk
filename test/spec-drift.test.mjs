import { describe, expect, it } from 'vitest';
import { compareOpenApiDocuments, parseOpenApi } from '../scripts/check-spec-drift.mjs';

const baseline = JSON.stringify({ openapi: '3.1.0', info: { title: 'Adeli', version: '1' }, paths: { '/api/v1/me': { get: { operationId: 'getMe' } } }, components: { schemas: { Identity: { type: 'object' } } } });

describe('canonical OpenAPI drift comparison', () => {
  it('treats key order and formatting changes as formatting-only', () => {
    const candidate = '{\n  "components": {"schemas": {"Identity": {"type": "object"}}},\n  "paths": {"/api/v1/me": {"get": {"operationId": "getMe"}}},\n  "info": {"version": "1", "title": "Adeli"},\n  "openapi": "3.1.0"\n}\n';
    const result = compareOpenApiDocuments(baseline, candidate);
    expect(result.status).toBe('formatting-only');
    expect(result.baselineRawSha256).not.toBe(result.candidateRawSha256);
    expect(result.baselineCanonicalSha256).toBe(result.candidateCanonicalSha256);
  });

  it('detects meaningful schema/content changes', () => {
    const candidate = baseline.replace('getMe', 'getOther');
    const result = compareOpenApiDocuments(baseline, candidate);
    expect(result.status).toBe('changed');
    expect(result.changedSections).toContain('paths');
  });

  it.each(['<html>not json</html>', '{}', JSON.stringify({ openapi: '3.0.3', paths: {} })])('rejects malformed or non-OpenAPI input: %s', candidate => {
    expect(() => parseOpenApi(candidate, 'candidate')).toThrow();
  });
});
