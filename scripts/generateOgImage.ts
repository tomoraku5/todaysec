/**
 * OGP 画像（`public/og-default.png`・1200x630）を SVG から生成する。
 *
 * SNS やチャットに URL を貼ったときに表示される「看板」画像。手描きの PNG を差し替えると
 * 差分が追えず作り直しもできないので、**SVG をコードで組み立てて sharp で PNG 化**する。
 * 文言や配色を変えたいときはこのファイルを編集して再実行すればよい。
 *
 * 実行:
 *   npx tsx scripts/generateOgImage.ts
 *
 * ⚠️ sharp について: `package.json` の直接依存ではなく astro の推移的依存として入っている。
 * 将来 astro が sharp を落とすと解決できなくなるので、その場合は `npm i -D sharp` する。
 *
 * ⚠️ フォントについて: SVG のテキストは**生成した PC にインストールされているフォント**で
 * ラスタライズされる（サイトが使う Space Grotesk / IBM Plex Mono は Web フォントなのでここでは載らない）。
 * 別の PC で再生成すると字形が変わることがある。出力 PNG はリポジトリにコミットしてあるので、
 * 文言を変えないかぎり再生成は不要。
 */
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

import { sourceListText } from "../src/lib/feed";

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = path.join(process.cwd(), "public", "og-default.png");

/** サイトの配色トークン（src/styles/globals.css の @theme と揃える）。 */
const C = {
  bg: "#f6f7f9",
  card: "#ffffff",
  border: "#e4e7ec",
  text: "#14161b",
  muted: "#5b616e",
  subtle: "#8a909c",
  logo: "#0f9b6c", // globals.css の color-logo（エメラルドグリーン）
};

/**
 * フォントスタック。サイト本体の Web フォントは使えないので、Windows / macOS に
 * 標準で入っている近いものへフォールバックさせる。
 */
const F = {
  sans: "'Segoe UI', 'Yu Gothic UI', 'Hiragino Sans', sans-serif",
  jp: "'Yu Gothic UI', 'Yu Gothic', 'Hiragino Sans', Meiryo, sans-serif",
  mono: "Consolas, 'SFMono-Regular', Menlo, monospace",
};

/** SVG に文字列を埋めるときのエスケープ（& や < がそのまま入ると XML が壊れる）。 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 掲載する文言。ここだけ直せば内容を変えられる。
 * **ソース名は `src/lib/feed.ts` の SOURCES から自動生成**するのでここには書かない
 * （ソースを増やしたのに OGP 画像だけ古い、を防ぐ）。
 */
const CONTENT = {
  wordmarkHead: "today",
  wordmarkTail: ".security",
  kicker: "SECURITY BRIEFING",
  headline: "セキュリティ情報フィード",
  description: `${sourceListText()} からセキュリティ関連情報を自動集約。`,
  sources: sourceListText(" / "),
  url: "tomoraku5.github.io/todaysec",
};

function buildSvg(): string {
  const pad = 48; // 用紙の余白
  const cx = pad; // カード左端
  const cy = pad; // カード上端
  const cw = WIDTH - pad * 2;
  const ch = HEIGHT - pad * 2;
  const inner = cx + 56; // カード内のテキスト左端
  const right = cx + cw - 56; // カード内の右端

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>

  <!-- カード面。サイトのカードに合わせて角は丸めない（globals.css の rounded-none） -->
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>

  <!-- ヘッダー: ロゴバッジ ＋ ワードマーク / 右にキッカー -->
  <rect x="${inner}" y="96" width="46" height="46" rx="11" fill="${C.logo}"/>
  <text x="${inner + 23}" y="127" font-family="${F.sans}" font-size="19" font-weight="700" text-anchor="middle" fill="#ffffff">sec</text>
  <text x="${inner + 62}" y="127" font-family="${F.sans}" font-size="29" font-weight="700" fill="${C.text}">${esc(
    CONTENT.wordmarkHead,
  )}<tspan fill="${C.logo}">${esc(CONTENT.wordmarkTail)}</tspan></text>
  <text x="${right}" y="127" font-family="${F.mono}" font-size="15" letter-spacing="3" text-anchor="end" fill="${C.subtle}">${esc(
    CONTENT.kicker,
  )}</text>
  <line x1="${inner}" y1="166" x2="${right}" y2="166" stroke="${C.border}" stroke-width="1"/>

  <!-- 主役: 見出し ＋ アクセントバー ＋ 説明文 -->
  <text x="${inner}" y="312" font-family="${F.jp}" font-size="74" font-weight="700" fill="${C.text}">${esc(
    CONTENT.headline,
  )}</text>
  <rect x="${inner}" y="350" width="128" height="8" fill="${C.logo}"/>
  <text x="${inner}" y="424" font-family="${F.jp}" font-size="29" fill="${C.muted}">${esc(
    CONTENT.description,
  )}</text>

  <!-- フッター: ソース名 / 公開URL -->
  <line x1="${inner}" y1="486" x2="${right}" y2="486" stroke="${C.border}" stroke-width="1"/>
  <text x="${inner}" y="530" font-family="${F.mono}" font-size="21" fill="${C.muted}">${esc(
    CONTENT.sources,
  )}</text>
  <text x="${right}" y="530" font-family="${F.mono}" font-size="19" text-anchor="end" fill="${C.subtle}">${esc(
    CONTENT.url,
  )}</text>
</svg>`;
}

async function main(): Promise<void> {
  const svg = buildSvg();
  const out = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT);
  const rel = path.relative(process.cwd(), OUT);
  console.log(`✅ ${rel} を生成: ${out.width}x${out.height} (${fs.statSync(OUT).size} bytes)`);
  if (out.width !== WIDTH || out.height !== HEIGHT) {
    throw new Error(`サイズが想定と違う: ${out.width}x${out.height}（期待 ${WIDTH}x${HEIGHT}）`);
  }
}

main().catch((e) => {
  console.error("OGP 画像の生成に失敗:", (e as Error).message);
  process.exit(1);
});
