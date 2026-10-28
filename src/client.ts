import { resolveConfig } from './core/config.js';
import type { ApiResponse, ClientOptions, RequestOptions } from './core/types.js';
import { Transport } from './core/transport.js';
import { AccountsResource } from './resources/accounts.js';
import { ProfilesResource, type PublicPlatform } from './resources/profiles.js';
import { operations } from './operations.js';
import { PostsResource } from './resources/posts.js';
import { CommentsResource } from './resources/comments.js';
import { MessagesResource } from './resources/messages.js';
import { AnalyticsResource } from './resources/analytics.js';
import { AdsResource } from './resources/ads.js';
import { UsageResource } from './resources/usage.js';
import { WebhooksResource } from './resources/webhooks.js';

/** Wire alias for the object serialized by apps/web/lib/public-api/me.ts. */
export interface Identity {
  readonly message: string;
  readonly you: {
    readonly name: string | null;
    readonly organization: string | null;
    readonly profile: { readonly id: string; readonly name: string };
  };
  readonly apiKey: { readonly label: string | null; readonly prefix: string; readonly createdAt: string };
  readonly accountsConnected: readonly { readonly accountId: string; readonly platform: PublicPlatform; readonly username: string | null }[];
  readonly docs: string;
}
export interface GetMeQuery { readonly profileId?: string; }

export class Adeli {
  readonly profiles: ProfilesResource;
  readonly accounts: AccountsResource;
  readonly posts: PostsResource;
  readonly comments: CommentsResource;
  readonly messages: MessagesResource;
  readonly analytics: AnalyticsResource;
  readonly ads: AdsResource;
  readonly usage: UsageResource;
  readonly webhooks: WebhooksResource;
  private readonly transport: Transport;
  constructor(options: ClientOptions = {}) {
    this.transport = new Transport(resolveConfig(options));
    this.profiles = new ProfilesResource(this.transport);
    this.accounts = new AccountsResource(this.transport);
    this.posts = new PostsResource(this.transport);
    this.comments = new CommentsResource(this.transport);
    this.messages = new MessagesResource(this.transport);
    this.analytics = new AnalyticsResource(this.transport);
    this.ads = new AdsResource(this.transport);
    this.usage = new UsageResource(this.transport);
    this.webhooks = new WebhooksResource(this.transport);
  }
  /** Do not serialize client internals or its API key. */
  toJSON(): Record<string, never> { return {}; }
  getMe(args: { readonly query?: GetMeQuery } = {}, options: RequestOptions = {}): Promise<ApiResponse<Identity>> {
    return this.transport.request({ operation: operations.getMe, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs });
  }
}
