# today.security — セキュリティ情報フィード集約サイト

**Zenn**「security」トピックと **Qiita**「Security」「認証」タグからセキュリティ関連情報を
自動集約し、時系列の統合タイムラインとして表示する静的サイト（GitHub Pages）。

- 公開URL: <https://tomoraku5.github.io/todaysec/>
- 基盤: Astro 5 + Tailwind v4 + TypeScript
- 更新: GitHub Actions（6時間ごと）でフィード取得 → `src/data/feed.json` をコミット → Pages へデプロイ

> 個人の学習目的で運用しているサイトであり、特定の組織を代表するものではありません。
> 掲載内容は各情報源の見出し・抜粋であり、正確性を保証するものではありません。

## トークン・API キーは不要です

**このサイトの運用に費用はかかりません（完全に 0 円）。**
取得元はどちらも**公開 RSS** なので、アカウント登録も API キーも認証も要りません。

```bash
git clone https://github.com/tomoraku5/todaysec.git
cd todaysec
npm install
npm run aggregate   # RSS を取得して src/data/feed.json を生成
npm run dev         # http://localhost:4321/todaysec/
```

`.env` の用意は不要です。`npm run aggregate` を実行しなくても、リポジトリに含まれる
`src/data/feed.json` の内容で `npm run dev` の表示確認ができます。

> このリポジトリは [satory074/todayai](https://github.com/satory074/todayai)（AI 情報の集約サイト）を
> ベースに、セキュリティ情報向けへ改造したものです。X API・Gmail API・Gemini API を使う機能が
> 実装として残っていますが、**すべて無効化**しており、有効化しない限り動きません。

## コマンド

| コマンド | 内容 |
|------|------|
| `npm run aggregate` | 有効なソースを取得して `src/data/feed.json` を再生成 |
| `npm run dev` | 開発サーバー（<http://localhost:4321/todaysec/>） |
| `npm run build` | 本番ビルド（Astro グラフの型チェック込み） |
| `npm run typecheck` | `astro check`。`scripts/` も型検査される |
| `npx tsx scripts/generateOgImage.ts` | OGP 画像 `public/og-default.png` を再生成（下記） |

テストフレームワークはありません。検証は `npm run typecheck` / `npm run build` と、
`npm run aggregate` の実行ログで行います。

> **`scripts/` を変更したら `npm run typecheck` を実行してください。**
> `npm run build` は Astro が読み込むファイルしか型検査せず、`scripts/` は対象外のためです。

## OGP 画像の作り直し

SNS やチャットに URL を貼ったときに表示される画像（`public/og-default.png`・1200x630）は、
**コードから生成**しています。画像編集ソフトは不要です。

```bash
npx tsx scripts/generateOgImage.ts
```

文言や色を変えたいときは `scripts/generateOgImage.ts` の冒頭にある `CONTENT`（文言）と
`C`（配色）を編集して、上のコマンドを実行し直してください。生成された PNG はリポジトリに
コミットするので、普段は再生成不要です。

> 画像内の文字は**実行した PC にインストールされているフォント**で描画されます。
> 別の PC で再生成すると字形が少し変わることがあります。

## 収集しているソース

`feeds.config.ts` で設定します。

### 有効（2ソース）

| source | 取得元 | 設定 |
|------|------|------|
| `zenn` | `zenn.dev/topics/security/feed` | `zenn.rssUrls` |
| `qiita` | `qiita.com/tags/security/feed`<br>`qiita.com/tags/認証/feed` | `qiita.rssUrls` |

**`rssUrls` は配列**なので、タグやトピックを増やしたいときは URL を足すだけです。

- URL ごとに個別にエラー処理するため、**1本が落ちても残りは取り込まれます**
- `limit` は「**1 URL あたり**」の取得件数です（合計ではありません）。URL を足しても
  既存フィードの取り込み量は減りません
- 日本語のタグ URL（`.../tags/認証/feed`）は**そのまま書いて構いません**。
  プログラム側で自動的にエンコードされます
- 同じ記事が複数のタグに出ても、記事 URL をキーに重複排除されて 1 件になります

### 無効（`disabled: true`）

コードは残してあるので、設定を戻せば復活できます。

| source / 機能 | 停止理由 |
|------|------|
| `x` | 取得元がフォーク元作者の公開データ。X API も有料のため使わない |
| `layerx` | Gmail OAuth が必要 |
| `hatena` | 後日セキュリティ向けに差し替えて復活予定 |
| `gcloud` | GCP 全製品のリリースノートで用途に合わない |
| `workspace` | Workspace の機能更新情報で用途に合わない |
| `translate` | Gemini API キー未設定（原文のまま表示されます） |

> ⚠️ `hatena` を有効化するときは、`rssUrl` が IT 人気エントリーのままなので
> **先にセキュリティ向けの URL へ差し替えてください。**

無効なソースを画面のフィルタから隠すため、`src/lib/feed.ts` の `SOURCES` 配列からも
外してあります。復活させるときは、同ファイルのコメントに書かれた行を配列に戻してください。

## 保持ポリシー

各ソースは**前回の `feed.json` を土台に蓄積**します（全期間アーカイブ）。RSS は最新数十件しか
返さないため、この仕組みがないと過去記事が消えてしまうためです。

上限はソースごとの `retentionMax`（件数）だけで、古さによる削除はしません。ソース別の枠なので、
記事数の多いソースが他を押し出すことはありません。

> **`disabled: true` にしても、蓄積済みの記事は残り続けます。** 消したい場合は
> `src/data/feed.json` の `items` を明示的に空にしてください。

## デプロイ

1. リポジトリ **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. **Actions** タブ → 「Update feeds & Deploy」→ **Run workflow** で初回実行
3. 以降は6時間ごとに自動で更新・デプロイされます

Secrets の設定は不要です（公開 RSS のみを使うため）。

- 集約が走るのは `schedule`（cron）と `workflow_dispatch`（手動実行）のときだけです。
  `push` では既存の `feed.json` でビルドするだけなので、「コミット → push → 再集約 → …」の
  無限ループになりません
- 任意: アクセス解析に Cloudflare Web Analytics を使う場合のみ、リポジトリ**変数**（Secrets ではない）に
  `PUBLIC_CF_BEACON_TOKEN` を設定します。未設定なら解析タグは出力されません

## 構成

```
feeds.config.ts            ソース定義（URL / 取得件数 / 保持件数 / 有効・無効）
scripts/aggregate.ts       集約オーケストレータ（取得→正規化→マージ→重複排除→トリム→書き出し）
scripts/sources/           ソース別の取得処理（rss.ts が Zenn/Qiita 共通）
src/data/feed.json         集約結果（CI がコミット）
src/lib/feed.ts            FeedItem 型・SOURCES レジストリ・表示ヘルパ
src/components/            Layout / FeedCard / TweetCard / SourceFilter
src/pages/                 index / about / rss.xml
src/styles/globals.css     配色トークン（@theme）
.github/workflows/         update-and-deploy.yml
docs/gcs-storage-setup.md  GCS 保管モードの手順（現在は未使用）
```

設計の詳細・過去の障害記録は [`CLAUDE.md`](./CLAUDE.md) を参照してください。
