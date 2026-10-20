import type { ApiResponse, RequestOptions } from '../core/types.js';
import type { OperationQuery as JsonQuery, OperationSuccessBody as SuccessBody } from '../core/generated.js';
import type { Transport } from '../core/transport.js';
import { operations } from '../operations.js';

export type InstagramAccountInsightsQuery = JsonQuery<'getInstagramAccountInsights'>;
export type FacebookPageMetricsQuery = JsonQuery<'getFacebookPageMetrics'>;
export type TikTokAccountAnalyticsQuery = JsonQuery<'getTikTokAccountAnalytics'>;
export type TikTokAccountInsightsQuery = JsonQuery<'getTikTokAccountInsights'>;
export type TikTokVideoInsightsQuery = JsonQuery<'getTikTokVideoInsights'>;
export type YouTubeChannelInsightsQuery = JsonQuery<'getYouTubeChannelInsights'>;
export type YouTubeVideoInsightsQuery = JsonQuery<'getYouTubeVideoInsights'>;
export type InstagramAccountInsightsResponse = SuccessBody<'getInstagramAccountInsights'>;
export type FacebookPageMetricsResponse = SuccessBody<'getFacebookPageMetrics'>;
export type TikTokAccountAnalyticsResponse = SuccessBody<'getTikTokAccountAnalytics'>;
export type TikTokAccountInsightsResponse = SuccessBody<'getTikTokAccountInsights'>;
export type TikTokVideoInsightsResponse = SuccessBody<'getTikTokVideoInsights'>;
export type YouTubeChannelInsightsResponse = SuccessBody<'getYouTubeChannelInsights'>;
export type YouTubeVideoInsightsResponse = SuccessBody<'getYouTubeVideoInsights'>;

export class AnalyticsResource {
  constructor(private readonly transport: Transport) {}
  getInstagramAccountInsights(args: { readonly query: InstagramAccountInsightsQuery }, options: RequestOptions = {}): Promise<ApiResponse<InstagramAccountInsightsResponse>> { return this.transport.request({ operation: operations.getInstagramAccountInsights, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getFacebookPageMetrics(args: { readonly query?: FacebookPageMetricsQuery }, options: RequestOptions = {}): Promise<ApiResponse<FacebookPageMetricsResponse>> { return this.transport.request({ operation: operations.getFacebookPageMetrics, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getTikTokAccountAnalytics(args: { readonly query: TikTokAccountAnalyticsQuery }, options: RequestOptions = {}): Promise<ApiResponse<TikTokAccountAnalyticsResponse>> { return this.transport.request({ operation: operations.getTikTokAccountAnalytics, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getTikTokAccountInsights(args: { readonly query: TikTokAccountInsightsQuery }, options: RequestOptions = {}): Promise<ApiResponse<TikTokAccountInsightsResponse>> { return this.transport.request({ operation: operations.getTikTokAccountInsights, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getTikTokVideoInsights(args: { readonly query: TikTokVideoInsightsQuery }, options: RequestOptions = {}): Promise<ApiResponse<TikTokVideoInsightsResponse>> { return this.transport.request({ operation: operations.getTikTokVideoInsights, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getYouTubeChannelInsights(args: { readonly query: YouTubeChannelInsightsQuery }, options: RequestOptions = {}): Promise<ApiResponse<YouTubeChannelInsightsResponse>> { return this.transport.request({ operation: operations.getYouTubeChannelInsights, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
  getYouTubeVideoInsights(args: { readonly query: YouTubeVideoInsightsQuery }, options: RequestOptions = {}): Promise<ApiResponse<YouTubeVideoInsightsResponse>> { return this.transport.request({ operation: operations.getYouTubeVideoInsights, query: args.query, signal: options.signal, timeoutMs: options.timeoutMs }); }
}
