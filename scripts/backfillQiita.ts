/**
 * Qiita の取りこぼし記事を Qiita API v2 の履歴から復元する**単発スクリプト**。
 *
 * ## なぜ必要か
 *
 * Qiita のタグフィードが4件しか返さないため、API へ切り替えるまでの間
 * **投稿の 47% を取りこぼしていた**（詳細は `scripts/sources/qiitaApi.ts` の冒頭と
 * `docs/decisions.md` 項目19）。API 化以降の新着は取れるが、**既に落ちた過去分は戻らない**。
 * このスクリプトは API のページ送りで過去に遡り、`feed.json` に無い記事だけを追加する。
 *
 * ## 使い方
 *
 * ```bash
 * npm run backfill:qiita -- --since 2026-07-31            # 既定は dry-run（件数を出すだけ）
 * npm run backfill:qiita -- --since 2026-07-31 --apply    # 実際に feed.json へ書き込む
 * ```
 *
 * ⚠️ **`--since` は必須。** 「feed.json の qiita 最古日」を既定にしてはいけない
 * （設計時にこの案を採ろうとして危険だと分かった）。API の一覧には**後からタグを追加された
 * 過去記事**が混ざるため、最古が数ヶ月前になっていることがある（実測で 2025-12-25 が入っていた）。
 * それを既定にすると **数千件を復元しようとする**。
 *
 * ## ⚠️ 実行上の注意
 *
 * - **`feed.json` を書き換えてコミットする**＝通常の「動作確認後に `git checkout --` で破棄する」
 *   ルールの例外。**cron（6時間ごと）と重ならない時間に実行し、実行後すぐ push する。**
 *   衝突したら **origin 側を採用してこのスクリプトを再実行する**のが安全（このスクリプトは
 *   id で重複排除するので**何度実行しても同じ結果になる**＝冪等）。
 * - 復元分にサムネは付かない。**次回の cron で `enrichArticles` が og:image を補完する。**
 * - 復元分は日本語記事なので **Gemini（翻訳）の消費は増えない**（`summarizeSources` が空のため）。
 */
import { config as loadEnv } from "dotenv";

import { feedsConfig } from "../feeds.config";
import type { FeedData, FeedItem, FeedSource } from "../src/lib/feed";
import { readFeed } from "../src/lib/feedStore";
import { writeFeed } from "./lib/feedWrite";
import { fetchQiitaTagPage } from "./sources/qiitaApi";

loadEnv();

/** ページ送りの上限（タグごと）。1ページ100件なので既定で最大1000件まで遡る。 */
const DEFAULT_MAX_PAGES = 10;
/**
 * 一度に追加する件数の上限（安全弁）。これを超えたら書き込まずに中断する
 * ＝ `--since` の指定ミスで数千件を流し込む事故を防ぐ。意図的に超えたいときは `--max-add` で上げる。
 */
const DEFAULT_MAX_ADD = 300;
/** API のページサイズ（上限100）。復元は単発なので上限を使う＝リクエスト数を最小にする。 */
const PAGE_SIZE = 100;

interface Args {
  since: string;
  apply: boolean;
  maxPages: number;
  maxAdd: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    return eq?.slice(name.length + 3);
  };
  const since = get("since");
  if (!since) {
    console.error(
      "❌ --since が必要です（例: --since 2026-07-31）\n" +
        "   ⚠️ 既定値をあえて設けていません。API の一覧には後からタグを追加された過去記事が\n" +
        "      混ざるため、「feed.json の最古日」を起点にすると数千件を復元しようとします。",
    );
    process.exit(1);
  }
  const sinceIso = new Date(since).toISOString();
  if (Number.isNaN(new Date(since).getTime())) {
    console.error(`❌ --since を日付として解釈できません: ${since}`);
    process.exit(1);
  }
  return {
    since: sinceIso,
    apply: argv.includes("--apply"),
    maxPages: Number(get("max-pages")) || DEFAULT_MAX_PAGES,
    maxAdd: Number(get("max-add")) || DEFAULT_MAX_ADD,
  };
}

/** ソース別の保持上限件数（`aggregate.ts` の retentionMaxFor と同じ規則）。 */
function retentionMaxFor(source: FeedSource): number {
  const cfg = feedsConfig[source] as { retentionMax?: number } | undefined;
  return cfg?.retentionMax ?? 1000;
}

/**
 * タグ1つを `since` まで遡って取得する。
 *
 * ⚠️ **停止条件は「そのページに `since` 以降の記事が1件も無いこと」。**
 * 「`since` より古い記事が1件出たら打ち切る」は**誤り**＝ API の一覧は created_at の
 * 厳密降順ではなく、後からタグを追加された古い記事が途中に混ざるため、
 * 1ページ目で打ち切られて取りこぼす（設計時にこの誤りを実測で確認した）。
 */
async function fetchTagSince(
  tag: string,
  since: string,
  maxPages: number,
): Promise<{ items: FeedItem[]; pages: number; error?: string }> {
  const items: FeedItem[] = [];
  let pages = 0;
  for (let page = 1; page <= maxPages; page++) {
    const r = await fetchQiitaTagPage({ tag, perPage: PAGE_SIZE, page });
    if (!r.ok) return { items, pages, error: r.error };
    pages++;
    if (r.items.length === 0) break;
    items.push(...r.items.filter((i) => i.publishedAt >= since));
    const anyInRange = r.items.some((i) => i.publishedAt >= since);
    const rate = r.rateLimit ? `（レート残 ${r.rateRemaining ?? "?"}/${r.rateLimit}）` : "";
    console.log(
      `  [${tag}] page${page}: ${r.items.length} 件 / 範囲内 ${r.items.filter((i) => i.publishedAt >= since).length} 件${rate}`,
    );
    if (!anyInRange) break;
    if (page === maxPages) {
      console.warn(
        `  ⚠️ [${tag}] --max-pages (${maxPages}) に達したので打ち切りました。` +
          "まだ遡れる可能性があります（必要なら --max-pages を上げる）",
      );
    }
  }
  return { items, pages };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `Qiita 取りこぼし復元: since=${args.since} / ${args.apply ? "★書き込みモード (--apply)" : "dry-run（書き込まない）"}`,
  );

  const cache = await readFeed<FeedData>({
    updatedAt: new Date(0).toISOString(),
    items: [],
    state: {},
  });
  if (!Array.isArray(cache.items)) cache.items = [];
  const existingIds = new Set(cache.items.map((i) => i.id));
  const beforeQiita = cache.items.filter((i) => i.source === "qiita").length;

  const missing: FeedItem[] = [];
  const errors: string[] = [];
  for (const { tag } of feedsConfig.qiita.apiTags) {
    const r = await fetchTagSince(tag, args.since, args.maxPages);
    if (r.error) {
      errors.push(`tag:${tag}: ${r.error}`);
      console.error(`  ❌ [${tag}] ${r.error}`);
    }
    // 同一タグ内・タグ間の重複も id で潰す（複数タグに跨る記事があるため）。
    const seen = new Set([...existingIds, ...missing.map((i) => i.id)]);
    const fresh = r.items.filter((i) => !seen.has(i.id));
    missing.push(...fresh);
    console.log(`  [${tag}] ${args.since} 以降で feed.json に無いもの: ${fresh.length} 件`);
  }

  if (missing.length === 0) {
    console.log("\n✅ 復元対象はありません（取りこぼしなし）");
    return;
  }

  const dates = missing.map((i) => i.publishedAt).sort();
  console.log(`\n★ 復元対象: ${missing.length} 件（${dates[0]} 〜 ${dates[dates.length - 1]}）`);
  console.log("  新しい順に最大10件:");
  for (const i of [...missing].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 10)) {
    console.log(`    ${i.publishedAt} ${i.author ?? "(著者なし)"} ${i.title.slice(0, 40)}`);
  }

  if (missing.length > args.maxAdd) {
    console.error(
      `\n❌ 復元件数 ${missing.length} が上限 --max-add (${args.maxAdd}) を超えました。書き込みません。\n` +
        "   --since の指定が古すぎないか確認してください（意図的なら --max-add を上げる）。",
    );
    process.exit(1);
  }

  if (!args.apply) {
    console.log("\n（dry-run のため書き込みませんでした。実行するには --apply を付けてください）");
    return;
  }

  // ---- マージ → dedup → ソート → ソース別トリム（aggregate.ts と同じ順序）----
  const byId = new Map<string, FeedItem>();
  for (const item of [...cache.items, ...missing]) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  let items = [...byId.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const bySource = new Map<FeedSource, FeedItem[]>();
  for (const item of items) {
    const arr = bySource.get(item.source);
    if (arr) arr.push(item);
    else bySource.set(item.source, [item]);
  }
  items = [...bySource.entries()]
    .flatMap(([source, arr]) => arr.slice(0, retentionMaxFor(source)))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  await writeFeed({ updatedAt: new Date().toISOString(), items, state: cache.state ?? {} });

  const afterQiita = items.filter((i) => i.source === "qiita").length;
  console.log(`\n✅ feed.json を更新: Qiita ${beforeQiita} → ${afterQiita} 件（計 ${items.length} 件）`);
  console.log(
    "   ⚠️ サムネは付いていません。次回の cron で enrichArticles が og:image を補完します。\n" +
      "   ⚠️ cron と衝突しないよう、確認したら早めに push してください。",
  );
  if (errors.length) {
    console.warn(`⚠️  ${errors.length} 件のエラー:\n  - ${errors.join("\n  - ")}`);
  }
}

run().catch((e) => {
  console.error("致命的エラー:", e);
  process.exit(1);
});
