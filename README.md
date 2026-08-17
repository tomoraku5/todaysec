# today.security — セキュリティ情報フィード集約サイト

国内外のセキュリティ情報を公開フィードから自動集約し、時系列の統合タイムラインとして表示する
静的サイト（GitHub Pages）。**集めているソースは下の「有効なソース」の表が正です**
（⚠️ ここにサイト名を並べないこと。ソースを増減するたび、この列挙だけが取り残されるため）。

- 公開URL: <https://tomoraku5.github.io/todaysec/>
- 基盤: Astro 5 + Tailwind v4 + TypeScript
- 更新: GitHub Actions（6時間ごと）でフィード取得 → `src/data/feed.json` をコミット → Pages へデプロイ

> 個人の学習目的で運用しているサイトであり、特定の組織を代表するものではありません。
> 掲載内容は各情報源の見出し・抜粋であり、正確性を保証するものではありません。

**なぜそうなっているかの判断記録は [`docs/decisions.md`](docs/decisions.md) を参照してください。**
ソースの取捨選択・Astro のバージョン据え置き・翻訳の使い方など、主要な決定について
「理由」「却下した案」「どうなったら覆るか」を記録しています。

## API キーは必須ではありません（翻訳を使うときだけ必要）

**このサイトの運用に費用はかかりません（完全に 0 円）。**

- **記事の収集に API キーは要りません。** 取得元は**公開 RSS / Atom** と、Qiita だけ
  **Qiita API v2（認証不要）** です。どちらもアカウント登録も認証も不要です。
  - Qiita の API は**認証なしで 60回/時（IP 単位）** の制限があります。使うのは1回の更新で
    2リクエストなので余裕がありますが、制限に当たった場合は自動で RSS に切り替わります
    （そのときはログに警告が出ます。詳細は [`CLAUDE.md`](./CLAUDE.md) の Qiita の節）
- **英語記事の日本語訳（Gemini）を動かすときだけ `GEMINI_API_KEY` が必要です。**
  無料枠の範囲で使っており、課金は有効にしていません。キーが無ければ翻訳は
  スキップされ、カードは原文のまま表示されます（動作は壊れません）。

```bash
git clone https://github.com/tomoraku5/todaysec.git
cd todaysec
npm install
npm run aggregate   # RSS を取得して src/data/feed.json を生成
npm run dev         # http://localhost:4321/todaysec/
```

**ローカルでは `.env` を用意しません。** 翻訳は CI（GitHub Actions）でだけ走らせる方針で、
API キーはローカルに置きません（理由は [`docs/decisions.md`](docs/decisions.md) 項目6）。
ローカルの `npm run aggregate` はキーが無いまま動き、翻訳だけがスキップされます。
`npm run aggregate` を実行しなくても、リポジトリに含まれる `src/data/feed.json` の内容で
`npm run dev` の表示確認ができます。

> このリポジトリは [satory074/todayai](https://github.com/satory074/todayai)（AI 情報の集約サイト）を
> ベースに、セキュリティ情報向けへ改造したものです。**X API を使う機能は実装として残っていますが
> 無効化**しており、有効化しない限り動きません。**Gemini API（翻訳）は有効です**
> （Gmail API を使っていた LayerX ソースは実装ごと削除済みです）。

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

### 有効なソース

| source | 取得元 | 設定 |
|------|------|------|
| `zenn` | `zenn.dev/topics/security/feed` | `zenn.rssUrls` |
| `qiita` | **`qiita.com/api/v2/tags/security/items`**<br>**`qiita.com/api/v2/tags/認証/items`**<br>（⚠️ このソースだけ RSS ではなく **Qiita API v2**。認証不要） | `qiita.apiTags`<br>（フォールバック用に `qiita.rssUrls` も残してあります） |
| `hatenablog` | `piyolog.hatenadiary.jp/feed`（piyolog）<br>`foxsecurity.hatenablog.com/feed`（Fox on Security）<br>`blog.flatt.tech/feed`（GMO Flatt Security） | `hatenablog.rssUrls` |
| `cloudnative` | `blog.cloudnative.co.jp/feed.xml`（CloudNative BLOGs）<br>⚠️ **全体フィードを「セキュリティ」カテゴリで絞り込み** | `cloudnative.rssUrls`<br>`cloudnative.filter` |
| `thehackernews` | `feeds.feedburner.com/TheHackersNews`（The Hacker News・英語） | `thehackernews.rssUrls` |
| `darkreading` | `www.darkreading.com/rss.xml`（Dark Reading・英語） | `darkreading.rssUrls` |
| `bleepingcomputer` | `www.bleepingcomputer.com/feed/`（BleepingComputer・英語） | `bleepingcomputer.rssUrls` |
| `theregister` | `www.theregister.com/security/headlines.atom`（The Register・英語・**セキュリティセクション限定**） | `theregister.rssUrls` |

**`rssUrls` は配列**なので、トピック・ブログを増やしたいときは URL を足すだけです
（Qiita はタグ名を `apiTags` に足します）。

- URL ごとに個別にエラー処理するため、**1本が落ちても残りは取り込まれます**
- `limit` は「**1 URL あたり**」の取得件数です（合計ではありません）。URL を足しても
  既存フィードの取り込み量は減りません
- 日本語のタグ名（`認証`）は**そのまま書いて構いません**。プログラム側で自動的にエンコードされます
- 同じ記事が複数のタグに出ても、記事 URL をキーに重複排除されて 1 件になります

> **CloudNative だけ「カテゴリで絞り込んで」取り込んでいます。** このブログには
> カテゴリ別のフィードが無く（`/category/security/feed/` はページ本体へ転送されます）、
> 全体フィードにはセキュリティ以外（SaaS 運用・AI・コラムなど）が7割含まれるためです。
> `cloudnative.filter.includeCategories` で「セキュリティ」だけを残しています。
> ⚠️ **絞り込みで何件除外されたかは更新ログに出ます**（例:「フィード 50 件中 34 件を
> 絞り込みで除外」）。サイト側がカテゴリ名を変えて0件になった場合も警告が出ます。
> 判断の経緯は [`docs/decisions.md`](docs/decisions.md) 項目24。

> ⚠️ **Qiita だけ RSS を使っていません。** Qiita のタグフィードは**4件しか返さず**
> （タグを問わず固定・件数を増やすパラメータも効きません）、Security タグは投稿が多いため
> **記事の 47% を取りこぼしていました**（実測）。そのため Qiita API v2（認証不要・1リクエストで
> 最大100件）に切り替えています。経緯は [`docs/decisions.md`](docs/decisions.md) 項目19、
> 仕組みは [`CLAUDE.md`](./CLAUDE.md) の Qiita の節にあります。

> **上の表で「英語」と書かれているものは英語のニュースサイト**です。
> 日本語記事に混じって英語の見出しが並びますが、**Gemini による翻訳が有効なので日本語訳が
> 併記されます**（フィルタバー右端の「日本語 / 原文」で切り替え）。
> ⚠️ **`limit` を 20 にしていても「取りこぼさない」とは限りません**＝相手のフィードが
> 何件返すかと投稿ペースの兼ね合いで決まります（Qiita はこれで失敗しました）。
> **ソースごとに「何日分遡れるか」を実測した表を [`CLAUDE.md`](./CLAUDE.md) に置いています。**
> The Register だけ**セキュリティセクション限定のフィード**があるのでそれを使い
> （総合IT メディアなので全体フィードは使わない）、**他の英語サイトはカテゴリ別フィードが
> 無いため全体フィード1本ずつ**です（The Hacker News はサイトの各 URL が FeedBurner に
> 転送されるので転送先を直接指定）。
>
> ⚠️ BleepingComputer は**フィードが15件しか返しません**（多くのソースは20〜50件）。実測で
> **約2.4日分**にあたるので、CI が2日以上止まると取りこぼす可能性があります。

> **はてなブログだけ「個別ブログのURLを並べる」方式**にしています。はてなブログには
> Zenn/Qiita のような「全ブログ横断で特定タグの新着を取るフィード」が存在せず、
> タグページは 404 を返すことを実アクセスで確認したためです（試した URL と結果は
> [`CLAUDE.md`](./CLAUDE.md) に記録しています）。ブログを追加したいときは
> `hatenablog.rssUrls` に足してください。

### 無効（`disabled: true`）— 削除せず温存

コードも設定も残してあるので、フラグを戻せば復活できます。

| source | 停止理由 |
|------|------|
| `x` | 取得元がフォーク元作者の公開データ。X API も有料のため使わない |
| `hackread` | **2026-08-06 以降、サイト側にアクセスを拒否されている**（`403`）。2026-08-17 に停止 |

⚠️ **この2つは扱いが違います。**

- **`x` は画面からも隠しています**（`src/lib/feed.ts` の `SOURCES` 配列からも外してあります）。
  復活させるときは、同ファイルのコメントに書かれた行を配列に戻してください
  （`disabled: false` だけでは取得は再開しても画面に出ません）。
- **`hackread` は画面に残しています**（`SOURCES` にあるまま）。**停止前に集めた記事は
  そのまま表示され続けます。** 復活は `disabled: false` に戻すだけです。

> ⚠️ **HackRead は「取得できなくなった」ので止めました**（品質を理由に外したのではありません）。
> サイト側が **JavaScript の実行を求める関門**を出しており、プログラムからは通れません
> （フィードだけでなくトップページも同じ）。**User-Agent を変えても通らないことは実測済みです。**
> **回避策を思いつく前に [`docs/decisions.md`](docs/decisions.md) 項目22 を読んでください。**
> 何を試して何が駄目だったかが記録してあります（同じ調査を繰り返さないため）。
>
> なお HackRead には **PR配信・SEO記事が混ざる**問題（実測10件中セキュリティ報道は4件程度）も
> あり、除外するかは未決のままです。**403 で運用が止まったため判断材料が溜まっていません。**

> **翻訳（`translate`）は無効ではなく有効です。** かつて無効化していましたが、英語ソースが
> 増えたため有効化しました（`e29e520`）。ただし3行要約は使わず翻訳だけに絞っています
> （`summarizeSources` は空。理由は [`docs/decisions.md`](docs/decisions.md) 項目5）。

### 削除したソース

以下の4つはセキュリティ用途に合わないため**コードごと削除**しました。
削除したコミットは `0e43fa2`（`refactor: 使わない4ソース（hatena/layerx/workspace/gcloud）を削除`）で、
差分は `git show 0e43fa2`、削除前の実装は `git show 0e43fa2^:scripts/sources/hatena.ts` のように読めます。

| 削除ソース | 概要と、覚えておく価値のある点 |
|------|------|
| `hatena`（はてなブックマーク） | 人気エントリー RSS。**約30件しか返さない**ため、前回分に積み上げる蓄積方式が必要だった（この方式は今も全ソース共通で使っています） |
| `layerx` | Substack の RSS が非公開のため、届いたメールを **Gmail API** で読む構成だった。OAuth の管理コストが高い |
| `workspace` | Google Workspace の機能更新ブログ |
| `gcloud` | Google Cloud リリースノート。1エントリが1日分にまとまる特殊な形式 |

> はてなブックマークと**はてなブログ（`hatenablog`）は別のサービス**です。
> 現在稼働しているのは後者だけです。

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

**Secrets には `GEMINI_API_KEY`（英語記事の翻訳用）だけを登録しています。**
記事の取得は公開 RSS と認証不要の Qiita API v2 だけなので、収集自体に Secrets は要りません。

- **キーが未設定でもワークフローは成功します。** 翻訳がスキップされ、カードが原文のまま
  表示されるだけです（graceful degradation）。翻訳が急に出なくなったときは、キーではなく
  Gemini 側の HTTP 4xx を疑ってください（モデル提供終了で 429 になった前例があります）
- **無料枠の範囲で運用しており、課金は有効にしていません**（英語ソースのみ・1日4〜6リクエスト程度）
- **キーは Secrets にのみ置き、ローカルの `.env` には置きません。** このリポジトリは Public で、
  「置かなければ漏れない」という構造的な排除を選んでいます
  （理由と却下した案は [`docs/decisions.md`](docs/decisions.md) 項目6）
- 集約が走るのは `schedule`（cron）と `workflow_dispatch`（手動実行）のときだけです。
  `push` では既存の `feed.json` でビルドするだけなので、「コミット → push → 再集約 → …」の
  無限ループになりません
- 任意: アクセス解析に Cloudflare Web Analytics を使う場合のみ、リポジトリ**変数**（Secrets ではない）に
  `PUBLIC_CF_BEACON_TOKEN` を設定します。未設定なら解析タグは出力されません

## 構成

```
feeds.config.ts            ソース定義（URL / 取得件数 / 保持件数 / 有効・無効）
scripts/aggregate.ts       集約オーケストレータ（取得→正規化→マージ→重複排除→トリム→書き出し）
scripts/sources/           ソース別の取得処理（rss.ts が記事系ソース共通。qiitaApi.ts が Qiita
                           API v2。translate.ts が翻訳）
src/data/feed.json         集約結果（CI がコミット）
src/lib/feed.ts            FeedItem 型・SOURCES レジストリ・表示ヘルパ
src/components/            Layout / FeedCard / TweetCard / SourceFilter / BilingualText
src/pages/                 index / about / rss.xml
src/styles/globals.css     配色トークン（@theme）
.github/workflows/         update-and-deploy.yml
docs/gcs-storage-setup.md  GCS 保管モードの手順（現在は未使用）
```

設計の詳細・過去の障害記録は [`CLAUDE.md`](./CLAUDE.md) を参照してください。
