<div align=center>

<img src="./public/logo.svg" align="center" width="256">

# Apple Music-like Lyrics TTML Tool

まったく新しい単語単位の歌詞エディターです。[Apple Music-like Lyrics エコシステム](https://github.com/amll-dev/applemusic-like-lyrics)向けに制作されています。

<img width="1312" alt="image" src="https://github.com/user-attachments/assets/4db81b29-df0c-4f6e-819a-3b956b28247c">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/929eefee-ebda-43db-ad04-c0f099077053">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/7c80902e-45a9-42ae-b980-f5500069acb8">

</div>

## 使い方

> [!WARNING]
> 本ツールはスマートフォンや小さな画面の端末での利用は推奨しません。操作が非常に煩雑になります。

オンライン版は [`https://amll-ttml-tool.stevexmh.net/`](https://amll-ttml-tool.stevexmh.net/) から利用できます。

最新機能や最新の不具合を試す場合は、[test ブランチ](https://amll-ttml-tool-test.vercel.app/) をご利用ください。

Tauri デスクトップ版は GitHub Actions のビルド成果物から入手できます。詳細は [GitHub Actions による Tauri デスクトップ版のビルド](https://github.com/amll-dev/amll-ttml-tool/actions/workflows/build-desktop.yaml) を参照してください。

## エディターの機能

- 基本的な入力・編集・タイミング同期（打軸）機能
- TTML 形式の歌詞の読み込み・保存
- 歌詞行の設定（バックボーカル、デュエットなど）
- 歌詞ファイルのメタデータ設定（曲名、アーティスト、NetEase Music ID など）
- 単語の分割・結合・移動
- LRC / ESLyRiC / YRC / QRC / Lyricify Syllable など各種歌詞形式のインポート、および一部形式のエクスポート
- 特殊な識別子付きプレーンテキストからの歌詞インポート
- カスタマイズ可能なショートカットキー

## 開発・ビルド

本ツールのビルド手順はやや複雑です。説明が分かりにくい場合は、[`build-desktop.yaml`](.github/workflows/build-desktop.yaml) ワークフローの手順を参考にしてください。

まず、本プロジェクトは **PNPM のみ** 対応です。PNPM がインストールされていることを確認してください。

リポジトリをクローンしたうえで、以下を実行します。

```bash
pnpm i # 依存関係のインストール
pnpm dev # 開発サーバーの起動
pnpm build # Web 版のビルド
pnpm tauri dev # Tauri デスクトップ版の開発環境
pnpm tauri build # Tauri デスクトップ版のビルド
```

## コントリビューション

コードや翻訳のコントリビューション、Issue や提案の投稿を歓迎します。

新しい言語の翻訳を追加する場合は、[`./src/i18n/index.ts`](./src/i18n/index.ts) と [`./locales/ja-JP/translation.json`](./locales/ja-JP/translation.json)（標準ロケール）を参考にしてください。
