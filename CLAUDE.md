# プロジェクトルール (amll-ttml-tool)

## 多言語対応 (i18n)

- **翻訳データは英語 (`en-US`) と日本語 (`ja-JP`) のみを管理する。** これ以外の言語の
  ロケールは追加しない。`locales/` 配下には `en-US/` と `ja-JP/` の 2 つだけを置く。
- 新しい翻訳キーを追加するときは、必ず `locales/ja-JP/translation.json` と
  `locales/en-US/translation.json` の **両方** に追加する。
- コード上では `t("some.key", "日本語の既定文言")` や
  `<Trans i18nKey="some.key">日本語の既定文言</Trans>` のように、インライン既定文言を
  必ず付ける（ロケールが読み込めない場合のフォールバックになる）。
- i18n の **型ソースは `ja-JP`** である（[src/types/vite-env.d.ts](src/types/vite-env.d.ts)
  の `virtual:i18next-loader` 宣言が `locales/ja-JP/translation.json` を参照）。
  新しいキーは `ja-JP` に存在しないと `t()` / `<Trans>` の型エラーになる。
- ロケール一覧はビルド時に `locales/` ディレクトリを走査して動的に決まる
  （[vite.config.ts](vite.config.ts) の `i18nextLoader({ paths: ["./locales"] })`、
  言語セレクタは [src/modules/settings/modals/common.tsx](src/modules/settings/modals/common.tsx)
  の `Object.keys(resources)`）。ハードコードされた言語リストは存在しないため、
  ロケールの追加・削除はディレクトリの増減だけで反映される。
- 既定言語およびフォールバックは `ja-JP`
  （[src/i18n/index.ts](src/i18n/index.ts)）。
