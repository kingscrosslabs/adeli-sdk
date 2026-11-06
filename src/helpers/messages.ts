import { ConfigurationError } from '@adeli/sdk';
import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { MessagesQuery, MessagesResponse } from '../resources/messages.js';
import { abortError, isRecord, makeDeadline, malformed, requestPage, validateOptions } from './paging.js';
import type { PageIteratorOptions } from './paging.js';

/** One conversation: a message's `conversationKey` and the account it belongs to. `cursor` starts from an older page. */
export type ConversationIteratorQuery = Omit<MessagesQuery, 'accountId' | 'conversationKey'> & {
  readonly accountId: string;
  readonly conversationKey: string;
};

export interface MessagesClient {
  readonly messages: {
    listMessages(args: { readonly query?: MessagesQuery }, options?: RequestOptions): Promise<ApiResponse<MessagesResponse>>;
  };
}

export type ConversationIteratorOptions = PageIteratorOptions;

function validateQuery(query: ConversationIteratorQuery): void {
  if (typeof query.accountId !== 'string' || query.accountId.length === 0) {
    throw new ConfigurationError('Conversation iteration requires accountId');
  }
  if (typeof query.conversationKey !== 'string' || query.conversationKey.length === 0) {
    throw new ConfigurationError('Conversation iteration requires conversationKey');
  }
}

function assertPage(value: unknown, query: MessagesQuery): asserts value is MessagesResponse {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw malformed('The messages endpoint returned a malformed page');
  }
  if (value.nextCursor !== undefined && value.nextCursor !== null && typeof value.nextCursor !== 'string') {
    throw malformed('The messages endpoint returned an invalid cursor');
  }
  for (const message of value.messages) {
    if (!isRecord(message) || typeof message.id !== 'string' || message.id.length === 0) {
      throw malformed('The messages endpoint returned a malformed message');
    }
    if (message.accountId !== query.accountId) {
      throw malformed('The messages endpoint changed the requested account scope');
    }
    if (message.conversationKey !== undefined && message.conversationKey !== null && message.conversationKey !== query.conversationKey) {
      throw malformed('The messages endpoint changed the requested conversation');
    }
  }
}

async function* pages(
  client: MessagesClient,
  args: { readonly query: ConversationIteratorQuery },
  options: ConversationIteratorOptions,
): AsyncGenerator<ApiResponse<MessagesResponse>> {
  const checked = validateOptions(options);
  validateQuery(args.query);
  let query: MessagesQuery = { ...args.query };
  const deadline = makeDeadline(checked.timeoutMs);
  const seenCursors = new Set<string>();
  if (query.cursor !== undefined) seenCursors.add(query.cursor);

  for (let pageNumber = 0; pageNumber < checked.maxPages; pageNumber += 1) {
    if (checked.signal?.aborted) throw abortError();
    const pageQuery = query;
    const response = await requestPage(requestOptions => client.messages.listMessages({ query: pageQuery }, requestOptions), deadline, checked.signal);
    assertPage(response.data, pageQuery);
    yield response;
    const nextCursor = response.data.nextCursor;
    if (nextCursor === null || nextCursor === undefined || nextCursor === '') return;
    if (seenCursors.has(nextCursor)) return;
    seenCursors.add(nextCursor);
    query = { ...query, cursor: nextCursor };
  }
}

/**
 * Yield one conversation's pages, newest page first, following `nextCursor`
 * toward older messages. Messages within a page are oldest first, as the API
 * returns them.
 */
export function iterateConversationPages(
  client: MessagesClient,
  args: { readonly query: ConversationIteratorQuery },
  options: ConversationIteratorOptions = {},
): AsyncGenerator<ApiResponse<MessagesResponse>> {
  return pages(client, args, options);
}

/**
 * Yield one conversation's messages newest first, walking back through older
 * pages. Records are the API's own, not normalized.
 */
export async function* iterateConversation(
  client: MessagesClient,
  args: { readonly query: ConversationIteratorQuery },
  options: ConversationIteratorOptions = {},
): AsyncGenerator<MessagesResponse['messages'][number]> {
  for await (const page of pages(client, args, options)) {
    for (let index = page.data.messages.length - 1; index >= 0; index -= 1) yield page.data.messages[index]!;
  }
}
