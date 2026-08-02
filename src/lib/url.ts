const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function siteLink(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${base}${path}`;
}

/**
 * サイトの origin（`https://<user>.github.io`）。
 *
 * ハードコードせず `astro.config.mjs` の `site` を参照する＝二重管理を避ける。
 * Astro はビルド時に `site` を `import.meta.env.SITE` として注入するので、config を
 * 変えればここも自動で追従する（`Astro.site` はコンポーネント側でしか使えないため、
 * ただの .ts であるこのファイルからは `import.meta.env` 経由で読む）。
 * 末尾スラッシュは siteLink() の結果と二重にならないよう落とす。
 * 万一未注入でも壊れないよう既定値を持たせる（値は astro.config.mjs と揃えること）。
 */
const SITE_ORIGIN = (import.meta.env.SITE ?? "https://tomoraku5.github.io").replace(/\/$/, "");

/** base path 込みの絶対 URL（RSS / OGP など host が必須の場面で使う）。 */
export function absUrl(path: string): string {
  return `${SITE_ORIGIN}${siteLink(path)}`;
}
