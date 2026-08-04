/**
 * フィード情報源の設定。
 *
 * **記事の収集は公開 RSS / Atom のみでトークン不要**（`rss-parser` で直接取得。課金・失効なし）。
 * どのソースが有効かは、このファイルの各キーの `disabled` と `src/lib/feed.ts` の `SOURCES` が正
 * ＝ここにソース名を列挙しない（列挙は取り残されて実態とズレる）。
 *
 * **キーが必要なのは翻訳（`translate`）だけ**で、`GEMINI_API_KEY` を使う。
 * トークン類（`X_*` / `GEMINI_API_KEY`）はこのファイルには書かず **GitHub Secrets に置く**
 * （ローカルの `.env` には常設しない方針。`docs/decisions.md` 項目6）。
 * 未設定なら翻訳をスキップして原文のまま表示する（graceful degradation）。
 *
 * かつて存在した hatena（はてなブックマーク）/ layerx / workspace / gcloud は
 * セキュリティ用途に合わないため削除済み。**削除コミットは 0e43fa2**
 * （差分は `git show 0e43fa2`、削除前の実装は `git show 0e43fa2^:scripts/sources/<name>.ts`）。
 * x は使っていないが **削除せず disabled: true で温存**している（`translate` は有効）。
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
  /**
   * BleepingComputer（英語のセキュリティ／IT ニュース）の公開 RSS。トークン不要。
   *
   * **全体フィード `/feed/` の1本だけ**。カテゴリ別（`/news/<cat>/feed/`）は 404 で存在しない。
   * Cloudflare 配下（`cf-ray` ヘッダあり）だが、フィードは **UA を問わず 200**（UA 無しでも通る）
   * ＝ CI（datacenter IP）でもボット判定される可能性は低い。実アクセスで確認済み。
   *
   * ⚠️ **フィードが 15 件しか返さない**（他ソースは 20〜50 件）。平日は約8件/日なので
   * 約2日分しか遡れない。6時間ごとの cron なら十分だが、**CI が2日以上止まると取りこぼす**。
   */
  bleepingcomputer: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  /**
   * The Register の**セキュリティセクション限定**の公開 Atom。トークン不要。
   *
   * ⚠️ The Register は総合 IT メディア（クラウド・ハードウェア・企業ニュース・宇宙開発まで扱う）
   * なので、**全体フィードは使わない**。`/security/headlines.atom` がセクション限定で、
   * 実測 50 件すべてがセキュリティ関連だった。
   *
   * このURLは内部的に API（`api.theregister.com/...?query=tag:security`）へリダイレクトするが、
   * **リダイレクト先ではなくこの人が読めるURLを設定に書く**。転送先は `site_id=2` /
   * `remapper=rss` といった内部パラメータを含み、サイト側の実装変更で壊れやすいため。
   * （The Hacker News は逆に最終URLを直接指定している。あちらの転送先は FeedBurner という
   * 安定した公開エンドポイントなので判断が違う。）
   *
   * セクション別フィードの他の形（`/security/feed/`・`/security/rss`・`/security/atom.xml`・
   * `/security/index.atom`）はすべて 404。`/security/headlines.rss` は同内容を返す。
   */
  theregister: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**の取得窓。蓄積は retentionMax まで） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    disabled?: boolean;
  };
  /**
   * HackRead（英語のセキュリティニュース）の公開 RSS。トークン不要。
   *
   * ⚠️ **PR配信・SEO記事が混ざる。** 実測10件のうちセキュリティ報道は4件程度で、
   * 「Top 10 Companies to Hire Power BI Developers」のようなセキュリティ無関係の SEO 記事や、
   * 著者 `dc:creator` が `CyberNewswire`（プレスリリース転載）の広報記事が並ぶ。
   * **ノイズを承知の上で採用**しており、除外の仕組みは意図的に作っていない
   * （1週間ほど運用して実態を見てから判断する方針。詳細は CLAUDE.md）。
   *
   * ⚠️ **フィードが 10 件しか返さない**（約3日分）。BleepingComputer（15件・約2日分）と
   * 並んで取りこぼしリスクが高い部類＝CI が3日以上止まると記事が消える。
   *
   * Cloudflare 配下だがフィードは UA を問わず 200（UA 無しでも通る）。
   * サムネはフィードに無く、`enrichArticles` の og:image 補完に依存する。
   */
  hackread: {
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
  bleepingcomputer: {
    rssUrls: [
      // カテゴリ別フィードは存在しないので全体フィードのみ。
      "https://www.bleepingcomputer.com/feed/",
    ],
    // フィード自体が 15 件しか返さないので limit 20 は実質上限なし（全件取り込む）。
    // 平日 約8件/日・6時間ごとの cron なら 1 run あたり ~2件で余裕がある。
    limit: 20,
    // 平日 約8件/日 → 1000 件 ≒ 4〜6ヶ月分。既定のままで足りる。
    retentionMax: 1000,
    disabled: false,
  },
  theregister: {
    rssUrls: [
      // セキュリティセクション限定。全体フィード（/headlines.atom）は使わない。
      "https://www.theregister.com/security/headlines.atom",
    ],
    // 実測 約3.7件/日・フィードは50件（約13日分）返す＝取りこぼしリスクは最も低い部類。
    // 1 run あたり ~1件なので 20 で十分。
    limit: 20,
    // 約3.7件/日なので 1000 件 ≒ 9ヶ月分。既定のままで足りる。
    retentionMax: 1000,
    disabled: false,
  },
  hackread: {
    rssUrls: ["https://hackread.com/feed/"],
    // フィードが10件しか返さないので limit 20 は実質上限なし（全件取り込む）。
    // 約3.3件/日・6時間ごとの cron なら 1 run あたり ~1件。
    limit: 20,
    // 約3.3件/日なので 1000 件 ≒ 10ヶ月分。既定のままで足りる。
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
     *   summarizeSources: ["zenn", "qiita", "hatenablog", "thehackernews", "darkreading", "bleepingcomputer", "theregister", "hackread"],
     * ⚠️ 戻すときは `aggregate.ts` の `ENRICH_VERSION` も上げること。上げないと
     *    「翻訳」として保存済みのキャッシュが再生成されず、要約に切り替わらない。
     */
    summarizeSources: [],
    summaryMinLen: 40,
    disabled: false,
  },
};
