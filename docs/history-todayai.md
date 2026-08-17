# 補足: todayai 時代のスナップショット（2026-07-14 に CLAUDE.md から移動）

> このファイルは `CLAUDE.md` の「補足（親インデックス `../CLAUDE.md` から移行、2026-07-14）」節を
> そのまま移してきたものです。**常時ロードから外すために移動しただけで、内容は変更していません。**
> 元は `8018a2e` 時点の `CLAUDE.md` 578〜608 行目にありました。

---

> ⚠️ **この節はフォーク元 todayai 時代のスナップショット**（7ソース・AI 情報・トークン利用前提）。
> 上の節と内容が重複しており、**現状と食い違う場合は上の記述が正**
> （例: この節は Qiita を「公開 RSS で取得」と書いているが、**現在は Qiita API v2 が主経路**）。
> 個々のソースの設計理由・障害記録として価値があるため削除せず残している。
> **現在のソース構成・トークンの要否をここに書き写さないこと**（二重管理になり、実際にズレた）＝
> 冒頭の「現在有効なソース」表と「Commands」節を見る。公開 URL は
> `https://tomoraku5.github.io/todaysec/`（ローカルは `http://localhost:4321/todaysec/`）。

Astro 5, Tailwind v4, TypeScript, GitHub Pages 静的サイト。

（todayai 時代）X・Zenn「AI」・Qiita「AI」・はてなブックマーク・Google Workspace Updates・LayerX Newsletter(Gmail経由)・Google Cloud リリースノート の7ソースから AI 関連情報を集約していた。**現在はこのうち Zenn / Qiita のみ残してセキュリティ向けに差し替え、はてなブログと英語ニュースサイトを追加している**（現行の一覧は冒頭の「現在有効なソース」表）。

```bash
npm install
npm run aggregate  # 7ソースを取得して src/data/feed.json を生成（トークン無いソースは自動スキップ）
npm run dev        # http://localhost:4321/todayai/   ← 現在は /todaysec/
npm run build      # 本番ビルド（型チェック込み）
```

**アーキテクチャ**: GitHub Actions（cron 6時間ごと、`.github/workflows/update-and-deploy.yml`）が `scripts/aggregate.ts` を実行→7ソースを `FeedItem` に正規化→`src/data/feed.json` をコミット→Pages デプロイ。各ソースは個別 try/catch で、失敗時は前回キャッシュを維持（graceful degradation）。ソース定義は `feeds.config.ts`。

**Gotcha**:
- X取得は2系統（`feeds.config.ts` の `x`）: (a) **自分のデータ**は basecampの公開JSON（`storage.googleapis.com/basecamp-feeds/x-tweets.json`）から `x.categories`（post/like/bookmark、既定は bookmark）で取得＝トークン・課金不要。(b) **外部アカウントのポスト**は `x.accounts` に列挙し、X API **App-only Bearer Token**（Secret `X_BEARER_TOKEN`）+ `since_id` 増分取得（`state.xAccountSinceIds` に永続化）で新着のみ課金（Non-owned Read $0.005/件）。App-only Bearer は固定トークンなので basecamp の OAuth2 refresh token と競合しない。aggregate は外部アカウント分のみ前回キャッシュを保持し、ブックマークは毎回フレッシュ置換。
- **Zenn / Qiita はトークン不要**: Zenn「AI」トピック（`zenn.dev/topics/ai/feed`）と Qiita「AI」タグ（`qiita.com/tags/ai/feed`）の公開 RSS を、共有ヘルパー `scripts/sources/rss.ts` の `fetchRss({rssUrl, source, limit})` が rss-parser で直接取得（`limit` で件数を抑制、取得失敗時は前回キャッシュへフォールバック）。それぞれ独立タブ `source: "zenn"` / `"qiita"` で表示。設定は `feeds.config.ts` の `zenn` / `qiita`。（かつての「Feedly」= AI 関連 RSS 8本まとめ集約は廃止。この2フィードだけ独立ソース化した）
- **機械翻訳／3行要約（原文→日本語）**: 集約時に各アイテムの `title`/`summary` を Gemini REST API（`scripts/sources/translate.ts` の `enrichTranslations`、`fetch` のみ）で1回のバッチ呼び出しで日本語補完。`titleJa`=非日本語タイトルの翻訳。`summaryJa` はソースで分岐し、記事系（`translate.summarizeSources`。**現在は空**）の十分な長さの抜粋は**原文の言語を問わず生成AIで3行要約**、その他（X 等）は summary を翻訳。日本語判定は `isJapanese()`。`state.translations` に永続キャッシュ、生成ロジック変更時は `aggregate.ts` の `ENRICH_VERSION`↔`state.enrichVersion` 不一致で旧キャッシュを破棄して再生成。表示はフィルタバー右端の「日本語／原文」一括トグル（`:root.show-orig` クラス＋`localStorage`、`BilingualText.astro`。日本語＝AI要約／原文＝元の抜粋）。
- Secret: `GEMINI_API_KEY`（機械翻訳。**現在有効**。未設定ならスキップされ原文表示になる）、`X_BEARER_TOKEN`（X 用。現在は無効化中の機能向け）。記事の取得元はすべて公開 RSS なのでトークン不要。
- `push` 時は取得＋コミットをスキップ（既存キャッシュでビルド）しコミットループを回避。
- Tailwind v4 + Astro 型不一致は `astro.config.mjs` で `any` キャスト。内部リンクは `src/lib/url.ts` の `siteLink()` 必須（base path は現在 `/todaysec`）。

---

## 削除した4ソースの実装上の要点（2026-08-10 に CLAUDE.md から移動）

**削除コミットは `0e43fa2`**。実装・設計の詳細はその直前のコミットから読める
（`git show 0e43fa2^:scripts/sources/<name>.ts`。`0e43fa2^` = `c5c9547`）。
⚠️ **`git show c5c9547` 単体は OGP 画像の再生成コミット**なので、削除差分を見るなら `git show 0e43fa2`。

削除の**判断と理由**は [`decisions.md` 項目2](decisions.md) にある。ここには**実装固有の落とし穴**だけ残す。

| 削除ソース | 実装上の要点 |
| --- | --- |
| `hatena`（はてなブックマーク） | 人気エントリー RSS は**「今まさに人気の約30件」しか返さない**。フレッシュ取得分だけだとランキングから外れた記事が消えるため、**前回分を土台に蓄積する設計が必須**だった。この蓄積方式は今も全ソース共通の仕組みとして残っている |
| `layerx` | Substack の公開 RSS が invite-only で取得不可 → 毎週届くメールを **Gmail REST API**（`GMAIL_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`、scope `gmail.readonly`）で読み、本文の各トピックリンクを1アイテム化していた。OAuth のリフレッシュトークンは失効しうる運用コストがあった |
| `workspace` | Google Workspace Updates ブログ（Blogger Atom）。**`?redirect=false` を付けないと FeedBurner（http）へ 302 する**落とし穴があった |
| `gcloud` | Google Cloud リリースノート Atom。**1エントリ＝1日**でタイトルが日付だけ・本文に全製品の更新がまとまるため、専用パーサで製品名を抽出して見出しにしていた |
