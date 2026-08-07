/**
 * フィード情報源の設定。
 *
 * **記事の収集はすべてトークン不要**（課金・失効なし）。取得方式は2種類:
 * - 公開 RSS / Atom を `rss-parser` で直接取得（`rssUrls` を持つソース）
 * - **Qiita だけ Qiita API v2**（認証不要）。理由はフィードが4件しか返さないため（下の `qiita` 参照）
 *
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
import type { QiitaApiTagConfig } from "./scripts/sources/qiitaApi";
import type { RssItemFilter } from "./scripts/sources/rss";

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
   *
   * ⚠️ **このフィードは CDN で最大12時間キャッシュされる**（`Cache-Control: public, s-maxage=43200`。
   * 実測で `Age: 13712`＝3.8時間前の内容が返った）。そのため**サイトへの掲載が最大12時間遅れる**。
   * ただし 20件の窓が約1.5日分あるので**記事の損失は 0%**（遅れて必ず入る）。
   * **キャッシュバスター（`?_=<run id>`）は意図的に採用していない**＝理由は
   * `docs/decisions.md` 項目20（サイレント停止リスクと行儀）。
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
   * Qiita のタグ別新着。**このソースだけ公開 RSS ではなく Qiita API v2 を主経路にする**
   * （認証不要・トークン不要。`scripts/sources/qiitaApi.ts`）。
   *
   * ⚠️ **理由: Qiita のタグフィードは 4 件しか返さない**（タグを問わず固定。`?page`/`?per_page` は
   * 無視される）。Security タグは 14〜23件/日 投稿されるため窓が**中央値 3.3 時間**しかなく、
   * 6時間ごとの cron では**実測 47% を取りこぼしていた**。詳しい経緯は `qiitaApi.ts` の
   * 冒頭コメントと `docs/decisions.md` 項目19。
   *
   * 複数タグに跨る記事は id（= `qiita-<記事URL>`）が同一になるので集約時の dedup で1件にまとまる。
   */
  qiita: {
    /** 主経路: API v2 で取得するタグと件数。日本語タグは生のまま書いてよい */
    apiTags: QiitaApiTagConfig[];
    /**
     * フォールバック用の公開 RSS（API が 429/403 等で失敗したときだけ使う）。
     * ⚠️ **4 件しか返さないので、これが常用されると取りこぼしが再発する**
     * （発動したら aggregate のログと末尾の警告に出る）。
     */
    rssUrls: string[];
    /**
     * RSS フォールバック時の 1 URL あたり取得件数。
     * ⚠️ **Qiita に対しては効いたことがない**（フィードが 4 件しか返さないため上限に届かない）。
     */
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
   * ⚠️ **フィードが 15 件しか返さない**（他ソースは 20〜50 件）。実測 6.3件/日 なので
   * **約2.4日分**しか遡れない。6時間ごとの cron なら十分だが、**CI が2日以上止まると取りこぼす**
   * （HackRead 約1.8日分に次いで余裕が薄い。ソース別の一覧は CLAUDE.md の表）。
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
   * ⚠️ **フィードが 10 件しか返さない**。実測 5.6件/日 なので**約1.8日分**しか遡れず、
   * **全ソースで最も余裕が薄い**（BleepingComputer 15件＝約2.4日分がその次）。
   * ＝ CI が2日ほど止まると記事が消える。ソース別の余裕は CLAUDE.md の
   * 「フィードから何日分遡れるか」の表が正。
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
  /**
   * CloudNative BLOGs（クラウドネイティブ社の技術ブログ・日本語）の公開 RSS。トークン不要。
   *
   * ⚠️ **カテゴリ別フィードは存在しない。** 依頼時の URL
   * `blog.cloudnative.co.jp/category/security/` はカテゴリページ（HTML）で、
   * `/category/security/feed/` も **HTML へリダイレクトする**（`/rss.xml`・`/atom.xml` は 404）。
   * サイトが `<link rel="alternate">` で示す唯一のフィードが `/feed.xml`（全体・50件）。
   *
   * ⚠️ **そのため全体フィードを `filter.includeCategories` で絞っている。**
   * 実測のカテゴリ内訳は セキュリティ 32% / SaaS 20% / コラム 16% / AI 14% / その他 18% で、
   * 絞らないと「PMが娘のランドセル選びで学んだこと」のような**話題が違う記事が7割**入る
   * （質は高いがこのサイトの目的から外れる。判断は `docs/decisions.md` 項目24）。
   *
   * フィードは `<category>` を1件だけ持つ（実測: 複数カテゴリの記事は 0件）。
   * `enclosure` にサムネがあり（50/50）、`dc:creator` に著者名が入る。
   * 抜粋は中央124字と短く、**空のものもある**（カードの概要が空になるが表示は崩れない）。
   */
  cloudnative: {
    rssUrls: string[];
    /** 1回に取り込む最大件数（**1 URL あたり**・**絞り込み後**の件数に対する窓） */
    limit?: number;
    /** 保持上限件数（全期間アーカイブの安全弁） */
    retentionMax: number;
    /** ソース別の絞り込み（このソースが初の利用者。`scripts/sources/rss.ts` 参照） */
    filter?: RssItemFilter;
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
    // 実測 12.7件/日・フィードは20件（約1.5日分）返す。CDN の12時間キャッシュ（上の注記）を
    // 差し引いても cron 6時間に対して余裕があるので損失は 0%（遅延のみ）。
    limit: 20,
    retentionMax: 1000, // 取りこぼしが激しかった主対象。数ヶ月〜相当
    disabled: false,
  },
  qiita: {
    // 主経路（API v2）。タグを増やしたいときはこの配列に足す。日本語タグは生のままでよい。
    //
    // perPage の決め方 = 「投稿ペース」と「1リクエストのサイズ」のバランス。
    // 上限は 100 だが、100 は 2.8MB になり Qiita 側への負荷が大きい（RSS は 3KB だった）。
    // cron 6時間＋GitHub の遅延に対して 2 日分あれば十分な余裕があるので抑えている。
    apiTags: [
      // 実測 14〜23件/日 → 50件で約2.2日分・1.3MB。
      { tag: "security", perPage: 50 },
      // 実測 1.6件/日 → 20件で約17日分・0.8MB（security と同じ 50 にしても無駄に重いだけ）。
      { tag: "認証", perPage: 20 },
    ],
    // フォールバック専用（API が 429/403 のときだけ使う）。4件しか返らないので常用は不可。
    rssUrls: [
      "https://qiita.com/tags/security/feed", // Qiita Securityタグ
      "https://qiita.com/tags/認証/feed", // Qiita 認証タグ
    ],
    limit: 20, // ⚠️ RSS フォールバック用。Qiita のフィードは4件しか返さないので実際には効かない
    // 取りこぼしが激しかった主対象。API 化で取り込みが 4件/run → 実質全件になり、
    // Security タグだけで 14〜23件/日 入る＝1000件は約 50 日分。
    retentionMax: 1000,
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
  cloudnative: {
    // ⚠️ カテゴリ別フィードは存在しない（上のコメント参照）。全体フィードを filter で絞る。
    rssUrls: ["https://blog.cloudnative.co.jp/feed.xml"],
    // 全体で 1.70件/日・フィードは50件（約29日分）返す＝全ソースで最も余裕がある。
    // 「セキュリティ」に絞ると 0.55件/日 なので、limit 20 は実質「条件に合う全件」。
    limit: 20,
    // 絞り込み後 0.55件/日 → 1000件 ≒ 5年分。既定のままで十分。
    retentionMax: 1000,
    // ⚠️ この値はサイトのカテゴリ名と完全一致で照合する。サイト側が改名すると 0 件になるが、
    // その場合は aggregate が「⚠️ 絞り込みで全件落ちた」と警告を出す（静かに止まらない）。
    filter: { includeCategories: ["セキュリティ"] },
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
