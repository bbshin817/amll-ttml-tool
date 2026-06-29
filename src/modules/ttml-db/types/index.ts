/**
 * @fileoverview
 * 外部歌詞データベース (ttml-api.bshin.dev) の型定義。
 * OpenAPI 仕様 (TTML API 1.0.0) のスキーマに対応する。
 */

/**
 * @description アーティスト (`Artist` スキーマ)。サジェスト候補としても使う。
 */
export interface Artist {
	uuid: string;
	artist_name: string;
	created_at?: string;
	updated_at?: string;
}

/**
 * @description TTML と Apple Music トラック ID の関連付け結果 (`TtmlAppleMusic` スキーマ)
 */
export interface TtmlAppleMusicLink {
	ttml_uuid: string;
	apple_music_track_id: string;
}

/**
 * @description データベースに登録された TTML レコード (`Ttml` スキーマ)
 */
export interface TtmlRecord {
	uuid: string;
	artist_uuid?: string;
	track_name: string;
	/** TTML 形式の XML 文字列 */
	ttml: string;
	created_at?: string;
	updated_at?: string;
	/** アーティスト情報 (ネスト) */
	artist?: Artist;
	/** 関連付けられた Apple Music トラック (未関連付けの場合は null) */
	apple_music_track?: TtmlAppleMusicLink | null;
}

/**
 * @description 歌詞をデータベースへ登録するために必要な情報
 */
export interface TtmlUploadInput {
	/** アーティスト名 (必須) */
	artistName: string;
	/** 曲名 (必須) */
	trackName: string;
	/** Apple Music トラック ID (任意。指定すると登録後に関連付けを行う) */
	appleMusicTrackId?: string;
}
