import type { operations as GeneratedOperations } from '../generated/api.js';

/** Operation request/response aliases used by handwritten resources. Keep contract extraction in one place. */
export type OperationJsonBody<K extends keyof GeneratedOperations> = GeneratedOperations[K] extends { requestBody: { content: infer C } }
  ? C extends { 'application/json': infer B } ? B : never
  : never;
export type OperationQuery<K extends keyof GeneratedOperations> = GeneratedOperations[K] extends { parameters: { query?: infer Q } } ? Q : never;
export type OperationPath<K extends keyof GeneratedOperations> = GeneratedOperations[K] extends { parameters: { path?: infer P } } ? P : never;
export type OperationSuccessBody<K extends keyof GeneratedOperations> = GeneratedOperations[K] extends { responses: infer R }
  ? { [S in keyof R]: S extends 200 | 201 | 202 | 204 | 205 | 206 | 207 | 208 | 226
      ? R[S] extends { content: infer C }
        ? C extends { 'application/json': infer B } ? B : undefined
        : undefined
      : never }[keyof R]
  : never;
