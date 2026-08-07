/**
 * Qiita のタグ別新着記事を **Qiita API v2** で取得する（`fetch` のみ・依存追加なし）。
 *
 * ## なぜ他の記事系ソースと違って専用実装があるのか（＝ `rss.ts` に相乗りしない理由）
 *
 * **Qiita のタグフィード（`qiita.com/tags/<tag>/feed`）は 4 件しか返さない。**
 * タグを問わず固定（security / 認証 / python / aws / javascript すべて 4 件）で、
 * `?page` / `?per_page` は**無視される**（実アクセスで確認）。
 * ＝ `feeds.config.ts` の `limit: 20` は **Qiita に対しては一度も効いたことがない**。
 *
 * Security タグは 14〜23 件/日 投稿されるため、4 件の窓は**実測で中央値 3.3 時間**しかない。
 * cron は 6 時間ごと（実測 5.4〜7.1 時間間隔）なので窓を常時超過し、
 * **実測 47%（5.8 日で 132 件中 62 件）を取りこぼしていた**。
 * feed.json のコミット履歴でも Qiita は**毎 run きっちり +4 件**しか増えていなかった。
 *
 * API は **1 リクエストで最大 100 件**返るので、窓を「時間」から「日」の単位にできる。
 * さらに API の一覧には**後からタグを追加された過去記事も現れる**（created_at 厳密降順ではない）
 * ＝ created_at 順の RSS では構造的に拾えなかった分も入る。
 *
 * ## 認証・レート制限
 *
 * **認証なしで動く（トークン不要）。** レート制限は **60 回/時・IP 単位**
 * （レスポンスヘッダ `Rate-Limit` / `Rate-Remaining` で確認できる）。
 * 使うのは 1 run あたり `apiTags` の数だけ（＝2 回）なので余裕は大きいが、
 * ⚠️ **CI（GitHub Actions）は共有データセンター IP なので、他の利用者と合算されて
 * 制限に当たる可能性が残る**。そのため 429/403 を検出して呼び出し側（`aggregate.ts`）が
 * **RSS 経路へフォールバックできる**ようにしてある（`rateLimited` フラグ）。
 * 恒常的に当たるなら Qiita のアクセストークン（無料・1000 回/時）を Secrets に足す。
 */
import type { FeedItem } from "../../src/lib/feed";
import { truncateSafe } from "./util";

const API_BASE = "https://qiita.com/api/v2";
// 外部に送信する名乗り。末尾の +URL は「このクローラーの説明ページ」を示す慣習（ogp.ts と同じ方針）。
const UA =
  "Mozilla/5.0 (compatible; todaysec-aggregator/1.0; +https://tomoraku5.github.io/todaysec/)";
// RSS（15 秒）より長め。1 リクエストで 0.8〜1.4MB 返るため。
const TIMEOUT_MS = 20000;

/** API レスポンスのうちこのプロジェクトが使う項目だけ（他は無視する）。 */
interface QiitaApiItem {
  title?: string;
  url?: string;
  created_at?: string;
  /** Markdown 本文（`rendered_body` が無いときのフォールバック） */
  body?: string;
  /** HTML 本文。抜粋の素材はこちらを優先する（下記 snippet の説明） */
  rendered_body?: string;
  user?: { id?: string };
}

/** 取得するタグ1つぶんの設定（`feeds.config.ts` の `qiita.apiTags`）。 */
export interface QiitaApiTagConfig {
  /** タグ名。日本語のまま書いてよい（ここで URL エンコードする） */
  tag: string;
  /** 1 リクエストで取る件数（API の上限は 100）。投稿ペースから「何日分遡れるか」が決まる */
  perPage: number;
}

/** タグ1つぶんの取得結果（ログ・診断用）。失敗したタグは `error` を持ち `count` は 0。 */
export interface QiitaTagResult {
  tag: string;
  count: number;
  error?: string;
  /** レスポンスヘッダ `Rate-Limit`（＝上限。認証なしは 60） */
  rateLimit?: string;
  /** レスポンスヘッダ `Rate-Remaining`（＝この時間枠の残り） */
  rateRemaining?: string;
}

export interface QiitaApiFetchResult {
  /** 全タグ分を連結したアイテム（タグ間の重複は後段の id dedup で1件に集約される） */
  items: FeedItem[];
  perTag: QiitaTagResult[];
  /** 失敗理由（呼び出し側の errors に積む用） */
  errors: string[];
  /** 429/403 に当たったか。true なら「レート制限」が原因だと表示・対処を切り替える */
  rateLimited: boolean;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * HTML 実体参照を戻す。`rendered_body` からタグを落とすだけだと `&amp;` などが残り、
 * カードの概要に生の実体参照が出てしまう（rss-parser は自前でデコードしてくれていた）。
 */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref.startsWith("#x") || ref.startsWith("#X")) {
      const cp = Number.parseInt(ref.slice(2), 16);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    }
    if (ref.startsWith("#")) {
      const cp = Number.parseInt(ref.slice(1), 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    }
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/**
 * 本文 → カードの概要（200 字）。**`rss.ts` の `snippet()` と同じ仕様に揃えてある**
 * ＝ RSS フォールバックが動いたときや、RSS 時代に蓄積した過去分と見た目が変わらない。
 *
 * 素材は `rendered_body`（HTML）を優先する。RSS の `contentSnippet` と同じ素材なので、
 * `body`（Markdown）を使うと概要に `#` や `**` といった記法が混ざるのを避けられる。
 */
function snippet(raw: QiitaApiItem): string | undefined {
  const source = raw.rendered_body ?? raw.body;
  if (!source) return undefined;
  const text = decodeEntities(source.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return truncateSafe(text, 200, 197);
}

function toFeedItem(raw: QiitaApiItem): FeedItem | undefined {
  const url = raw.url?.trim();
  if (!url) return undefined;
  const published = new Date(raw.created_at ?? "");
  if (Number.isNaN(published.getTime())) return undefined;
  return {
    // ⚠️ id は RSS 経路と**同一形式**（`qiita-<記事URL>`）にする。ここを変えると
    // RSS 時代に蓄積した過去分・フォールバック取得分が別アイテム扱いになり全件二重になる。
    id: `qiita-${url}`,
    source: "qiita",
    title: raw.title?.trim() || url,
    url,
    publishedAt: published.toISOString(),
    summary: snippet(raw),
    // サムネは API にも RSS にも無い＝ enrichArticles の og:image 補完に任せる
    // （Qiita は記事ごとに OGP 画像を自動生成するので、ほぼ必ず解決する）。
    // 著者はフィード名（RSS 時代は「Securityタグが付けられた新着記事 - Qiita」）ではなく投稿者。
    // RSS 時代の表記は 2 タグ取得しているのに常に「Securityタグ」と出ており既に不正確だった。
    author: raw.user?.id ? `@${raw.user.id}` : undefined,
  };
}

/** タイムアウト付き fetch（ogp.ts と同じ AbortController 方式）。 */
async function fetchJson(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `apiTags` を順に取得して `FeedItem[]` に正規化する。
 *
 * タグごとに個別 try/catch する（`rss.ts` が URL 単位でそうしているのと同じ）＝
 * 1 タグが落ちても残りは取り込む。全滅しても throw せず結果を返すだけで、
 * 呼び出し側（`aggregate.ts`）が RSS フォールバックと前回キャッシュ保持を判断する。
 */
export async function fetchQiitaApi(opts: {
  apiTags: QiitaApiTagConfig[];
}): Promise<QiitaApiFetchResult> {
  const items: FeedItem[] = [];
  const perTag: QiitaTagResult[] = [];
  const errors: string[] = [];
  let rateLimited = false;

  // 逐次実行（タグは数個なので、並列化の利得より相手サーバへの行儀と失敗の切り分けを優先）。
  for (const { tag, perPage } of opts.apiTags) {
    const url = `${API_BASE}/tags/${encodeURIComponent(tag)}/items?per_page=${perPage}&page=1`;
    try {
      const res = await fetchJson(url);
      const rateLimit = res.headers.get("rate-limit") ?? undefined;
      const rateRemaining = res.headers.get("rate-remaining") ?? undefined;

      // 403 / 429 はレート制限（Qiita はどちらの形で返すこともある）。
      // 呼び出し側がフォールバックの理由として区別できるよう rateLimited を立てる。
      if (res.status === 403 || res.status === 429) {
        rateLimited = true;
        const message = `HTTP ${res.status}: レート制限（認証なしは 60回/時・IP単位。残り ${rateRemaining ?? "不明"}）`;
        perTag.push({ tag, count: 0, error: message, rateLimit, rateRemaining });
        errors.push(`tag:${tag}: ${message}`);
        continue;
      }
      if (!res.ok) {
        const message = `HTTP ${res.status}`;
        perTag.push({ tag, count: 0, error: message, rateLimit, rateRemaining });
        errors.push(`tag:${tag}: ${message}`);
        continue;
      }

      const json: unknown = await res.json();
      if (!Array.isArray(json)) throw new Error("配列以外のレスポンスが返った");
      const got = (json as QiitaApiItem[])
        .map(toFeedItem)
        .filter((i): i is FeedItem => i !== undefined);
      items.push(...got);
      perTag.push({ tag, count: got.length, rateLimit, rateRemaining });
    } catch (e) {
      const message = (e as Error).name === "AbortError" ? `タイムアウト(${TIMEOUT_MS}ms)` : (e as Error).message;
      perTag.push({ tag, count: 0, error: message });
      errors.push(`tag:${tag}: ${message}`);
    }
  }

  return { items, perTag, errors, rateLimited };
}
