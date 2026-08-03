/** 全情報源を統一する正規化済みフィードアイテム。 */
/**
 * `x` は現在 `disabled`（実装・設定とも温存）。それ以外は稼働中のソース。
 * かつて存在した `hatena`（はてなブックマーク）/ `layerx` / `workspace` / `gcloud` は
 * セキュリティ用途に合わないため削除済み（詳細は削除前のコミット c5c9547 を参照）。
 */
export type FeedSource =
  | "x"
  | "zenn"
  | "qiita"
  | "hatenablog"
  | "thehackernews"
  | "darkreading";

export interface FeedItem {
  /** 一意キー（X: tweet id / 記事系(zenn/qiita/hatenablog): `<source>-<記事URL>`） */
  id: string;
  source: FeedSource;
  /** X は本文先頭、その他は記事タイトル（原文） */
  title: string;
  /** 外部リンク（新規タブで開く） */
  url: string;
  /** ISO 8601 */
  publishedAt: string;
  summary?: string;
  /** title の日本語訳（原文が日本語なら未設定）。集約時に Gemini で補完。 */
  titleJa?: string;
  /** summary の日本語訳（原文が日本語 or summary 無しなら未設定）。 */
  summaryJa?: string;
  thumbnail?: string;
  /** X の screen name / 記事の配信元サイト名 */
  author?: string;
  /** X のプロフィール画像URL（_400x400 版）。集約時に syndication / X API で補完。 */
  avatarUrl?: string;
  /** X の表示名（@handle とは別。例 "NotebookLM"）。集約時に補完。 */
  authorName?: string;
  /**
   * X ツイート本文中の t.co リンク先の OGP プレビュー（リンクカード）。集約時に enrichXLinks が解決し、
   * title/description は translate ステップで日本語補完（titleJa/descriptionJa）。表示は TweetCard。
   */
  linkPreview?: XLinkCard & { titleJa?: string; descriptionJa?: string };
  /**
   * 集約中のみの一時フィールド。記事ページから抽出した本文プレーンテキスト（要約の入力に使う）。
   * `aggregate.ts` が feed.json 書き出し前に削除するので、永続化された feed.json には残らない。
   */
  contentText?: string;
}

/**
 * X ツイート本文リンク（t.co）の解決結果 = リンクプレビューカード（原文のみ・日本語訳は別途）。
 * enrichXLinks が resolvePage + OGP / syndication で解決し `state.xLinkCards` にキャッシュする。
 */
export interface XLinkCard {
  /** リダイレクト解決後の最終 URL（カードのタップ遷移先） */
  url: string;
  /** og:title / twitter:title（原文） */
  title?: string;
  /** og:description / twitter:description（原文） */
  description?: string;
  /** og:image / twitter:image */
  image?: string;
  /** 表示用ホスト（www. 除去） */
  domain: string;
}

/** X ツイートの著者メタ（syndication 解決結果のキャッシュ）。 */
export interface XAuthorMeta {
  /** 表示名 */
  name: string;
  /** screen name（@なし） */
  handle: string;
  /** プロフィール画像URL（_400x400 版）。無ければ未設定 */
  avatar?: string;
}

/** aggregate.ts が書き出す feed.json のトップレベル構造。 */
export interface FeedData {
  /** 最終更新時刻 ISO 8601 */
  updatedAt: string;
  items: FeedItem[];
  /** ソースごとの状態（X 外部アカウントの since_id 等） */
  state?: {
    /** 外部アカウント username -> 前回取得済み最新ツイートID（since_id＝重複課金回避） */
    xAccountSinceIds?: Record<string, string>;
    /** 外部アカウント username -> userId の解決結果キャッシュ */
    xAccountUserIds?: Record<string, string>;
    /** X ブックマーク等 tweet id(`x-<id>`) -> OGP画像URL / ""(確認済み・画像なし) */
    xOgImages?: Record<string, string>;
    /**
     * X item id(`x-<id>`) -> 著者メタ（syndication 解決）/ null(確認済み・著者なしの負キャッシュ)。
     * ブックマーク等で元ツイートの著者・アイコンを復元するための永続化。
     * fetch 失敗（transient/CIブロック）時は記録せず次回 run で再試行する。
     */
    xAuthors?: Record<string, XAuthorMeta | null>;
    /** X以外（zenn/qiita/hatenablog）item id -> OGP画像URL / ""(確認済み・画像なし) */
    ogImages?: Record<string, string>;
    /**
     * X item id(`x-<id>`) -> リンクプレビューカード（原文）/ null(確認済み・カードなしの負キャッシュ)。
     * 毎回フレッシュ取得される X 項目にも再適用するための永続化。fetch 失敗も null で記録し再取得を抑制。
     */
    xLinkCards?: Record<string, XLinkCard | null>;
    /**
     * item id -> 翻訳/要約キャッシュ（毎回フレッシュ取得されるソースでも再翻訳しないための永続化）。
     * titleJa は原文が日本語なら未設定、summaryJa は記事系=3行要約 / その他=翻訳。
     * linkTitleJa/linkDescJa は linkPreview（X リンクカード）の title/description の日本語訳。
     */
    translations?: Record<
      string,
      { titleJa?: string; summaryJa?: string; linkTitleJa?: string; linkDescJa?: string }
    >;
    /** translations の生成ロジック版。ENRICH_VERSION と不一致なら作り直す。 */
    enrichVersion?: string;
  };
}

export interface SourceMeta {
  key: FeedSource;
  label: string;
  /** Tailwind 用のアクセントクラス（バッジ等） */
  badgeClass: string;
  /** about ページに出す1行説明。何を取ってくるソースかを利用者向けに書く。 */
  description: string;
}

// 並び順がそのままフィルタチップの表示順（先頭に「すべて」が付く）＝
// 説明文やフッターのソース名の並び順にもなる。
//
// ★★ このサイトで「今どのソースを集めているか」の唯一の正（single source of truth）。
// フィルタチップ・カード描画に加え、**説明文／フッター／about／RSS／OGP 画像のソース名も
// すべてこの配列から自動生成される**（下の sourceListText()）。
// → ソースを増減するときはここだけ直せば、表示テキストは全部追従する。
//    ただし OGP 画像（public/og-default.png）だけは生成済み PNG をコミットする運用なので、
//    `npx tsx scripts/generateOgImage.ts` の再実行が別途必要。
//
// 収集を止めたソースは 0 件のチップだけが並んで邪魔になるため、いったん外している。
// 将来復活させる場合はこの配列に該当行を戻すこと（FeedSource 型・badgeClass の CSS・
// feeds.config.ts の設定はいずれも残してあるので、行を戻すだけで表示に復帰する）:
//   { key: "x", label: "X", badgeClass: "src-x", description: "特定の X(Twitter) アカウントの投稿。" },
export const SOURCES: SourceMeta[] = [
  {
    key: "zenn",
    label: "Zenn",
    badgeClass: "src-zenn",
    description: "Zenn「Security」トピックの新着記事。",
  },
  {
    key: "qiita",
    label: "Qiita",
    badgeClass: "src-qiita",
    description: "Qiita「Security」タグ・「認証」タグの新着記事。",
  },
  {
    key: "hatenablog",
    label: "はてなブログ",
    badgeClass: "src-hatenablog",
    description: "セキュリティ専門ブログ（piyolog / Fox on Security / GMO Flatt Security）の新着記事。",
  },
  {
    // ⚠️ Y Combinator の Hacker News（news.ycombinator.com）とは**別サービス**。
    // 混同しないよう key は thehackernews（hackernews にしない）。
    key: "thehackernews",
    label: "The Hacker News",
    badgeClass: "src-thehackernews",
    description: "The Hacker News（英語）の脆弱性・インシデント速報。",
  },
  {
    key: "darkreading",
    label: "Dark Reading",
    badgeClass: "src-darkreading",
    description: "Dark Reading（英語）のセキュリティ解説・分析記事。",
  },
];

/**
 * SOURCES のラベルを連結した「ソース一覧」テキスト。
 *
 * 説明文・フッター・about・RSS・OGP 画像が**同じ配列から文言を組み立てる**ための共通ヘルパー。
 * ソースを足したのに説明文が古いまま、という取りこぼしを構造的に防ぐのが目的。
 *
 * @param separator 日本語の文中は "・"、フッターのような記号区切りは " / " を使う。
 *
 * ソースが0件のときは "各種フィード" を返す（"" だと「 から自動集約。」と主語が消えて
 * 文章が壊れるため）。1件のときは単にその名前になる＝区切り文字が余らない。
 */
export function sourceListText(separator: "・" | " / " = "・"): string {
  if (SOURCES.length === 0) return "各種フィード";
  return SOURCES.map((s) => s.label).join(separator);
}

/**
 * 原文と日本語訳の両方があり、実際に切り替わるか。
 *
 * `BilingualText.astro` が2つの span を出すかどうかの判定であり、
 * 「日本語 / 原文」トグルを出すかどうかの判定でもある。**両者がズレると
 * 「押しても何も変わらないトグル」ができる**ので、ここに一本化している。
 * 訳が原文と同一（＝翻訳しても変わらなかった）ケースは切替の意味がないので false。
 */
export function hasBilingual(orig?: string, ja?: string): boolean {
  return Boolean(ja && orig && ja !== orig);
}

/**
 * フィード全体に「切り替えられる二言語テキスト」が1件でもあるか。
 * 言語トグルを表示するかどうかの判定に使う（1件も無ければトグルは無意味なので隠す）。
 *
 * 翻訳（Gemini）を有効化して titleJa/summaryJa が入れば自動で true に戻り、
 * トグルが復活する＝手作業での復旧が要らない。
 */
export function hasAnyTranslation(items: FeedItem[]): boolean {
  return items.some(
    (i) =>
      hasBilingual(i.title, i.titleJa) ||
      hasBilingual(i.summary, i.summaryJa) ||
      // X のリンクプレビュー（TweetCard が BilingualText で描画する）
      hasBilingual(i.linkPreview?.title, i.linkPreview?.titleJa) ||
      hasBilingual(i.linkPreview?.description, i.linkPreview?.descriptionJa),
  );
}

export function sourceLabel(source: FeedSource): string {
  return SOURCES.find((s) => s.key === source)?.label ?? source;
}

/** feed.json の source が SOURCES に登録済みか（外部 JSON 由来の未知値を弾く用）。 */
export function isKnownSource(source: string): source is FeedSource {
  return SOURCES.some((s) => s.key === source);
}

/** source のメタ。未登録なら中立フォールバック（バッジ色なし・ラベルは生の source）。 */
export function sourceMeta(source: FeedSource): SourceMeta {
  return (
    SOURCES.find((s) => s.key === source) ?? {
      key: source,
      label: source,
      badgeClass: "",
      description: "",
    }
  );
}

/** 相対時刻（"3分前" / "2時間前" / "5日前" / 日付）。 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.floor((now.getTime() - then) / 1000);
  if (diffSec < 60) return "たった今";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}日前`;
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** 絶対時刻（X 埋め込み風"14:32 · 2026年6月7日"）。JST 固定。 */
export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const date = d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${time} · ${date}`;
}

/** タイムレール用の時刻のみ（"06:50"）。JST 固定。パース不可なら空文字。 */
export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ===== X 由来アイテムのアバター/著者表示ヘルパー =====

/** X の author は "@handle"（自投稿・外部アカウント）か カテゴリラベル（いいね/ブックマーク/投稿）。 */
export interface XAuthor {
  kind: "handle" | "category";
  /** kind="handle" のとき "@" を除いたハンドル名 */
  handle?: string;
  /** kind="category" のときの表示ラベル（"いいねした投稿" 等） */
  label?: string;
}

const CATEGORY_DISPLAY: Record<string, string> = {
  いいね: "いいねした投稿",
  ブックマーク: "ブックマークした投稿",
  投稿: "投稿",
};

export function parseXAuthor(author?: string): XAuthor {
  const a = (author ?? "").trim();
  if (a.startsWith("@")) return { kind: "handle", handle: a.slice(1) };
  return { kind: "category", label: CATEGORY_DISPLAY[a] ?? a ?? "投稿" };
}

/** seed 文字列から表示用イニシャル（日本語1字 / 英数2字）。 */
export function avatarInitials(seed: string): string {
  const s = seed.replace(/^@+/, "").replace(/[^\p{L}\p{N}]/gu, "");
  if (!s) return "X";
  // 英数なら2字、それ以外（日本語等）は先頭1字
  if (/^[A-Za-z0-9]/.test(s)) return s.slice(0, 2).toUpperCase();
  return [...s][0];
}

/** seed 文字列をハッシュした安定色（HSL）。同じハンドルは常に同じ色。 */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return `hsl(${hash} 55% 45%)`;
}

/** 日付ヘッダ用のキー（JST 暦日 "2026-06-03"）。パース不可なら空文字。 */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA は "YYYY-MM-DD" 形式。JST 暦日でグループ化する。
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 日付ヘッダの表示（"今日" / "昨日" / "6月1日 (月)"）。JST 暦日基準。 */
export function dayLabel(key: string, now: Date = new Date()): string {
  const todayKey = dayKey(now.toISOString());
  const yestKey = dayKey(new Date(now.getTime() - 86400000).toISOString());
  if (key === todayKey) return "今日";
  if (key === yestKey) return "昨日";
  // key は JST 暦日。UTC 正午に置けば JST でフォーマットしても同じ日付。
  const d = new Date(key + "T12:00:00Z");
  return d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
