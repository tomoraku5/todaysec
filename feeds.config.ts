/**
 * フィード情報源の設定。
 *
 * ★ 実運用前に以下を埋めること:
 *   - x.username : 取得したい X(Twitter) アカウントのユーザー名（@ なし）
 *   - zenn/qiita.rssUrls : 集約したいトピック／タグの RSS フィード URL（配列。複数可）
 *
 * トークン類（X_* / GEMINI_API_KEY）は .env / GitHub Secrets に置く（このファイルには書かない）。
 * 記事系（Zenn / Qiita / はてなブログ）は公開 RSS を rss-parser で直接取得する
 * （トークン・課金・失効なし）＝現在の構成はトークン無しで完結する。
 *
 * かつて存在した hatena（はてなブックマーク）/ layerx / workspace / gcloud は
 * セキュリティ用途に合わないため削除済み（詳細は削除前のコミット c5c9547 を参照）。
 * x と translate は使っていないが **削除せず disabled: true で温存**している。
 */

import type { FeedSource } from "./src/lib/feed";

export type XCategory = "post" | "like" | "bookmark";

export interface FeedsConfig {
  x: {
    /**
     * basecamp が公開している x-tweets.json の URL。
     * これを読むことで X API・トークン・追加課金が不要になり、
     * basecamp の X feed とトークンが競合しない。
     */
    sourceUrl: string;
    /** 取得対象アカウントのユーザー名（@ なし）。リンク生成・表示に使う */
    username: string;
    /** basecamp公開JSONから取り込むカテゴリ。post=自分の投稿 / like=いいね / bookmark=ブックマーク */
    categories: XCategory[];
    /**
     * 外部アカウントのポスト（@なしのユーザー名の配列）。
     * X API App-only Bearer Token（env: X_BEARER_TOKEN）で取得し、
     * since_id 増分で新着のみ課金（重複課金回避）。
     */
    accounts: string[];
    /** 外部アカウント1件あたり1回に取得する最大件数（5〜100） */
    accountMaxResults: number;
    /** このソースの保持上限件数（newest を残す）。全ソース共通の全期間アーカイブ安全弁（後述 retentionMax）。 */
    retentionMax: number;
    /** true の場合、X取得を完全にスキップ */
    disabled?: boolean;
  };
  /**
   * Zenn トピックの公開 RSS（rss-parser で直接取得。トークン不要）。
   * 複数トピックを束ねられる（URL ごとに個別 try/catch＝1本落ちても残りは取り込む）。
   */
  zenn: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  /**
   * Qiita タグの公開 RSS（rss-parser で直接取得。トークン不要）。
   * 複数タグを束ねられる。複数タグに跨る記事は id（= source-記事URL）が同一になるので
   * 集約時の dedup で1件にまとまる。
   */
  qiita: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  /**
   * はてなブログのセキュリティ系ブログ（公開フィードを直接取得。トークン不要）。
   *
   * ⚠️ はてなブログには「全ブログ横断で特定タグの新着を取る」フィードが**存在しない**
   * （`hatenablog.com/tag/<tag>` は `hatena.blog/tag/<tag>` へ 301 したうえで 404。
   * `/feed`・`?mode=rss`・`/tags/`・`/topic/`・検索ページもすべて 404。実アクセスで確認済み）。
   * 横断で取れるのは**はてなブックマーク**の検索 RSS だけだが、それはブログ記事ではなく
   * ブックマーク（＝別サービス）なので用途に合わない。
   * → **個別のブログのフィードを `rssUrls` に列挙して束ねる**方式を採る。
   */
  hatenablog: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  /**
   * The Hacker News（英語のセキュリティ専門ニュースサイト）の公開 RSS。トークン不要。
   *
   * ⚠️ Y Combinator の Hacker News（news.ycombinator.com）とは**別サービス**。
   *
   * サイト側の `/rss.xml`・`/atom.xml`・`/feeds/posts/default` はいずれも
   * **FeedBurner（`feeds.feedburner.com/TheHackersNews`）へリダイレクトする**ので、
   * 実質フィードは1本。リダイレクトを1回減らすため最終URLを直接指定している。
   */
  thehackernews: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  /**
   * Dark Reading（英語のセキュリティ専門メディア）の公開 RSS。トークン不要。
   *
   * **全体フィード `/rss.xml` の1本だけ**を使う。セクション別フィード
   * （`/rss/<section>.xml` 形式）は 404 で存在せず、旧 `/rss_simple.asp` は 403、
   * `/feed` はトップページへ飛ぶ（いずれも実アクセスで確認）。
   */
  darkreading: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  translate: {
    /**
     * 集約時の機械翻訳（原文→日本語）。Gemini REST API を使う。
     * 認証は env / GitHub Secrets（GEMINI_API_KEY）。未設定なら翻訳をスキップし、
     * カードは原文のまま表示される（graceful degradation）。
     * 原文が日本語のアイテムは検出して翻訳しない（コスト削減）。
     */
    model: string;
    /** 1回の API 呼び出しで翻訳するアイテム数 */
    batchSize: number;
    /** バッチを並列実行する数 */
    concurrency: number;
    /**
     * 概要を「翻訳」ではなく「生成AIで3行要約」に切り替えるソース。
     * ここに含まれるソースは原文が日本語でも要約する（記事系を想定）。
     * それ以外のソース（X 等）は従来どおり summary を翻訳する。
     */
    summarizeSources: FeedSource[];
    /** この文字数未満の summary は要約せず翻訳扱い（短すぎる抜粋の無駄要約を防ぐ） */
    summaryMinLen: number;
    disabled?: boolean;
  };
}

/**
 * 保持ポリシー（全ソース共通）:
 * 集約は各ソースとも「前回分を土台に蓄積」し、id で重複排除する（全期間アーカイブ）。
 * 年齢による一律トリム（旧 maxAgeDays）は行わず、各ソースの `retentionMax`（newest を残す件数上限）が
 * 唯一の上限＝ソース別枠なので、物量の多いソースが他ソースを押し出さない。
 * feed.json 肥大を抑える安全弁なので、無制限に近づけたいソースは値を大きくする。
 */

export const feedsConfig: FeedsConfig = {
  x: {
    sourceUrl: "https://storage.googleapis.com/basecamp-feeds/x-tweets.json",
    username: "satory074",
    categories: ["bookmark"], // 自分のデータからはブックマークのみ取り込む
    // X API を今後一切使わないため空にする（外部アカウント取得＝課金対象を停止）。
    accounts: [],
    accountMaxResults: 20,
    retentionMax: 1000,
    // sourceUrl が他人（basecamp）の公開ブックマーク JSON のため停止。
    disabled: true,
  },
  zenn: {
    // トピックを増やしたいときはこの配列に URL を足すだけ（1本落ちても他は取り込まれる）。
    rssUrls: [
      "https://zenn.dev/topics/security/feed", // Zenn Securityトピック
    ],
    limit: 20,
    retentionMax: 1000, // 取りこぼしが激しかった主対象。数ヶ月〜相当
    disabled: false,
  },
  qiita: {
    // タグを増やしたいときはこの配列に URL を足すだけ。複数タグに跨る記事は dedup で1件になる。
    // 日本語タグは生のまま書いてよい（rss.ts の toRequestUrl がパーセントエンコードする）。
    rssUrls: [
      "https://qiita.com/tags/security/feed", // Qiita Securityタグ
      "https://qiita.com/tags/認証/feed", // Qiita 認証タグ
    ],
    limit: 20,
    retentionMax: 1000, // 取りこぼしが激しかった主対象。数ヶ月〜相当
    disabled: false,
  },
  hatenablog: {
    // セキュリティ専門のはてなブログ。ブログを増やしたいときはこの配列に足すだけ
    // （1本落ちても他は取り込まれる）。いずれも実アクセスで取得を確認済み。
    rssUrls: [
      "https://piyolog.hatenadiary.jp/feed", // piyolog（セキュリティインシデントまとめ）
      "https://foxsecurity.hatenablog.com/feed", // Fox on Security（日次セキュリティニュース）
      "https://blog.flatt.tech/feed", // GMO Flatt Security Blog（脆弱性の技術解説・独自ドメインだが基盤ははてなブログ）
    ],
    limit: 20,
    retentionMax: 1000,
    disabled: false,
  },
  thehackernews: {
    rssUrls: [
      // サイトの /rss.xml 等はすべてここへリダイレクトするので最終URLを直接指定。
      "https://feeds.feedburner.com/TheHackersNews",
    ],
    // 実測 約10件/日。cron は6時間ごと（＝1 run あたり ~2.5件）なので 20 で十分な余裕。
    // フィード自体は50件（約5日分）返すため、数 run 落ちても取りこぼさない。
    limit: 20,
    retentionMax: 1000,
    disabled: false,
  },
  darkreading: {
    rssUrls: [
      // セクション別フィードは存在しないので全体フィードのみ。
      "https://www.darkreading.com/rss.xml",
    ],
    // 実測 約4.6件/日。cron は6時間ごと（＝1 run あたり ~1.2件）なので 20 で十分。
    // フィード自体は50件（約11日分）返すため、数日止まっても取りこぼさない。
    limit: 20,
    // 約4.6件/日なので 1000 件 ≒ 7ヶ月分。既定のままで足りる。
    retentionMax: 1000,
    disabled: false,
  },
  translate: {
    // gemini-2.0-flash は 2026-06-01 に提供終了（無料枠撤廃で 429 になる）。
    // 後継の Flash-Lite に切替（無料枠あり・翻訳/簡易処理向け）。memory: todayai-gemini-quota-429。
    model: "gemini-3.1-flash-lite",
    batchSize: 10, // 要約入力に記事本文(~3000字)を載せるので1コールが過大にならないよう小さめ
    concurrency: 3,
    /**
     * 3行要約に切り替えるソース。**意図的に空**にしている＝どのソースも「要約」ではなく
     * 「非日本語のときだけ翻訳」になる（方針: 日本語記事はそのまま、英語記事だけ翻訳）。
     *
     * 空にしている理由:
     * 1. **日本語記事は API を呼ばずに済む。** ここが空なら `summarize=false` になり、
     *    `translate.ts` は `isJapanese()` で日本語の title/summary を弾いて対象から外す
     *    （＝Zenn/Qiita/はてなブログのほとんどはリクエストが発生しない）。
     *    逆にここへ入れると「原文の言語を問わず要約する」ので日本語記事まで API を消費する。
     * 2. **トークン消費が桁違い。** 要約の入力は記事本文（`contentText`・最大2000字）で、
     *    翻訳の入力は抜粋（120字前後）。1件あたりおよそ16倍のトークンを食う。
     *
     * 3行要約を使いたくなったらここに入れる（記事系の全ソース）:
     *   summarizeSources: ["zenn", "qiita", "hatenablog", "thehackernews", "darkreading"],
     * ⚠️ 戻すときは `aggregate.ts` の `ENRICH_VERSION` も上げること。上げないと
     *    「翻訳」として保存済みのキャッシュが再生成されず、要約に切り替わらない。
     */
    summarizeSources: [],
    summaryMinLen: 40,
    disabled: false,
  },
};
