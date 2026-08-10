# フォーク元（satory074/todayai）からの変更点

> 改造で加えた変更の**履歴記録**。常時ロードから外すため `CLAUDE.md` の同名の節から移した
> （元は `8018a2e` 時点の `CLAUDE.md` 224〜244 行目）。
>
> ⚠️ **下の表だけをここに置いてある。** 元の節にあった以下は `CLAUDE.md` 側に残した＝
> 履歴ではなく「今どうなっているか」「今後どうするか」であり、常時読まれる必要があるため。
> **二重に書かないこと**（この方針は `CLAUDE.md` 全体で徹底されている）:
>
> - 「同種の残骸を見つけたら自分のリポジトリを指すよう直す」という**生きている指示**
> - cron が現在有効であること、`feed.json` を一度リセット済みであることという**現状の事実**

| ファイル | 変更内容 |
| --- | --- |
| `astro.config.mjs` | `repoName` を `todayai` → `todaysec`、`ghUser` の既定値を `satory074` → `tomoraku5` |
| `src/lib/url.ts` | `SITE_ORIGIN` のハードコード（`https://satory074.github.io`）を廃止し、`import.meta.env.SITE`（＝ `astro.config.mjs` の `site`）を参照する形に変更＝二重管理の解消。`.ts` なので `Astro.site` は使えず `import.meta.env` 経由 |
| `public/robots.txt` | Sitemap URL を `https://tomoraku5.github.io/todaysec/sitemap-index.xml` に修正（静的配信ファイルなので config は参照できず直接記述） |
| `feeds.config.ts` | `qiita` / `zenn` を `rssUrl`（単一）→ **`rssUrls`（配列）** に拡張。1ソースに複数タグ/トピックを束ねられる。**`limit` は「1 URL あたり」**の取得窓（合計ではない）＝ URL を足しても既存フィードの取り込みが痩せない |
| `scripts/sources/rss.ts` | 複数 URL 対応。**URL ごとに個別 try/catch**（1本落ちても残りは取り込む）。日本語タグ URL を `toRequestUrl()` で正規化（gotcha は `CLAUDE.md`） |
| `src/lib/feed.ts` | `SOURCES` から無効ソースを除外（現在は `x` のみ温存）。`FeedSource` のユニオン型・CSS・`feeds.config.ts` は残してあるので、**配列に行を戻すだけで復活する**（戻し方は `SOURCES` 直上のコメント） |
| `src/styles/globals.css` | **ロゴ専用の CSS 変数** `--color-logo` 系（エメラルドグリーン `#0f9b6c`）を追加。サイト全体のアクセント `--color-accent`（コバルト `#2f5fff`）は**変更していない**＝フィルタチップ・hover は青のまま |
| `scripts/sources/*.ts` | 外部へ送信する **User-Agent** を `todayai` → `todaysec` に変更。特に `ogp.ts` は `+https://satory074.github.io/todayai/`（クローラー説明ページを示す慣習）が他人のサイトを指していたため自サイトへ修正 |
| 表示系（`Layout` / `index` / `about` / `rss.xml.ts` / `package.json`） | サイト名を `today.ai` → `today.security`、見出しを「セキュリティ情報フィード」に。フッターにあったフォーク元作者サイト（`satory074.com/apps`）への固定逆リンクバーを削除し、その分の下部余白を圧縮 |
