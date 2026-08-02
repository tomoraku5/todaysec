/**
 * 公開 RSS フィードを rss-parser で直接取得する汎用フェッチャ。
 *
 * Zenn トピック / Qiita タグのように「公開 RSS をそのまま取り込む」ソースで共用する
 * （トークン・課金・失効なし）。`source` で FeedItem.source と id 接頭辞を切り替えるだけで
 * 中身は同一なので、ソースごとにファイルを分けず1関数にまとめている。
 *
 * **1ソース＝複数 URL**（例: Qiita の Security タグ＋認証タグ）を受け取り、URL ごとに
 * 個別 try/catch する＝1本が落ちても残りは取り込む（graceful degradation を URL 単位まで
 * 細かくしたもの）。全滅しても throw せず errors を返すだけで、呼び出し側（aggregate.ts）は
 * ブロック先頭で積んだ前回キャッシュをそのまま保持する。
 */
import Parser from "rss-parser";
import type { FeedItem, FeedSource } from "../../src/lib/feed";
import { truncateSafe } from "./util";

type RssItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  enclosure?: { url?: string };
  mediaThumbnail?: { $?: { url?: string } };
  mediaContent?: { $?: { url?: string } };
};

const parser: Parser<{ title?: string }, RssItem> = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (todayai feed aggregator)" },
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
    ],
  },
});

function snippet(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const text = s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return truncateSafe(text, 200, 197);
}

function thumbnail(it: RssItem): string | undefined {
  return it.enclosure?.url ?? it.mediaThumbnail?.$?.url ?? it.mediaContent?.$?.url ?? undefined;
}

function publishedAt(it: RssItem): string {
  if (it.isoDate) return it.isoDate;
  if (it.pubDate) {
    const d = new Date(it.pubDate);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * URL をリクエスト可能な形（パーセントエンコード済み）に正規化する。
 *
 * Qiita の日本語タグ（例 `https://qiita.com/tags/認証/feed`）をそのまま渡すと rss-parser は
 * Node の http クライアント経由で `Request path contains unescaped characters` を投げて失敗する。
 * WHATWG URL に通すと非 ASCII のパスが自動でパーセントエンコードされる
 * （`.../tags/%E8%AA%8D%E8%A8%BC/feed`）ので、設定ファイル側は人が読める生の日本語のままで書ける。
 * パースできない文字列はそのまま返し、エラーは parseURL 側で表面化させる。
 */
function toRequestUrl(rssUrl: string): string {
  try {
    return new URL(rssUrl).toString();
  } catch {
    return rssUrl;
  }
}

/** URL 1本ぶんの取得結果（ログ・診断用）。失敗した URL は `error` を持ち `count` は 0。 */
export interface RssUrlResult {
  url: string;
  count: number;
  error?: string;
}

export interface RssFetchResult {
  /** 全 URL 分を連結したアイテム（source 内の重複は後段の id dedup で1件に集約される） */
  items: FeedItem[];
  /** URL ごとの取得件数／失敗理由 */
  perUrl: RssUrlResult[];
  /** 失敗した URL の理由（呼び出し側の errors に積む用） */
  errors: string[];
}

/** RSS 1本を取得して FeedItem に正規化する（失敗は呼び出し元の fetchRss が URL 単位で握る）。 */
async function fetchOne(rssUrl: string, source: FeedSource, limit?: number): Promise<FeedItem[]> {
  const feed = await parser.parseURL(toRequestUrl(rssUrl));
  const feedName = feed.title?.trim();
  const items: FeedItem[] = [];
  for (const it of feed.items) {
    if (limit !== undefined && items.length >= limit) break;
    const link = it.link ?? it.guid;
    if (!link) continue;
    items.push({
      // id は記事 URL ベース＝同じ記事が複数タグ（例 Security と 認証）に跨って出ても
      // 同一 id になり、aggregate.ts の dedup で1件にまとまる。
      id: `${source}-${link}`,
      source,
      title: it.title?.trim() || link,
      url: link,
      publishedAt: publishedAt(it),
      summary: snippet(it.contentSnippet ?? it.content),
      thumbnail: thumbnail(it),
      author: feedName,
    });
  }
  return items;
}

export async function fetchRss(opts: {
  /** 取得する RSS の URL 一覧（1ソースに複数タグ／トピックを束ねられる） */
  rssUrls: string[];
  source: FeedSource;
  /**
   * 取り込む最大件数。**1 URL あたり**の取得窓（合計ではない）。
   * URL を増やしても既存フィードの取り込み量が痩せないようにするため。未指定なら全件。
   */
  limit?: number;
}): Promise<RssFetchResult> {
  const items: FeedItem[] = [];
  const perUrl: RssUrlResult[] = [];
  const errors: string[] = [];
  // 逐次実行（フィードは数本なので並列化の利得より、相手サーバへの行儀と失敗切り分けを優先）。
  for (const rssUrl of opts.rssUrls) {
    try {
      const got = await fetchOne(rssUrl, opts.source, opts.limit);
      items.push(...got);
      perUrl.push({ url: rssUrl, count: got.length });
    } catch (e) {
      const message = (e as Error).message;
      perUrl.push({ url: rssUrl, count: 0, error: message });
      errors.push(`${rssUrl}: ${message}`);
    }
  }
  return { items, perUrl, errors };
}
