/**
 * @fileoverview
 * 歌詞メタデータと、データベース登録に必要な情報 (アーティスト名・曲名・
 * Apple Music トラック ID) を相互変換するユーティリティ。
 */

import type { TTMLLyric, TTMLMetadata } from "$/types/ttml";

/** メタデータキー → 登録フィールドの対応 */
export const METADATA_KEYS = {
	artistName: "artists",
	trackName: "musicName",
	appleMusicTrackId: "appleMusicId",
} as const;

export interface ExtractedUploadMetadata {
	artistName: string;
	trackName: string;
	appleMusicTrackId: string;
}

function firstNonEmptyValue(metadata: TTMLMetadata[], key: string): string {
	const entry = metadata.find(
		(m) => m.key.toLowerCase() === key.toLowerCase(),
	);
	if (!entry) return "";
	return entry.value.find((v) => v.trim().length > 0)?.trim() ?? "";
}

/**
 * @description 既存のメタデータから、登録ダイアログの初期値となる
 * アーティスト名・曲名・Apple Music トラック ID を取り出す。
 * 値が存在しないフィールドは空文字になり、ユーザーへの入力要求の判定に使う。
 */
export function extractUploadMetadata(
	lyric: TTMLLyric,
): ExtractedUploadMetadata {
	return {
		artistName: firstNonEmptyValue(lyric.metadata, METADATA_KEYS.artistName),
		trackName: firstNonEmptyValue(lyric.metadata, METADATA_KEYS.trackName),
		appleMusicTrackId: firstNonEmptyValue(
			lyric.metadata,
			METADATA_KEYS.appleMusicTrackId,
		),
	};
}

/**
 * @description 入力された値をメタデータへ反映 (upsert) する。
 * 既存キーがあれば先頭の値を更新し、なければ追加する。空文字は無視する。
 * immer の draft を直接書き換える前提。
 */
export function applyUploadMetadata(
	draft: TTMLLyric,
	values: Partial<ExtractedUploadMetadata>,
): void {
	const upsert = (key: string, value: string | undefined) => {
		const trimmed = value?.trim();
		if (!trimmed) return;
		const entry = draft.metadata.find(
			(m) => m.key.toLowerCase() === key.toLowerCase(),
		);
		if (entry) {
			const idx = entry.value.findIndex((v) => v.trim().length > 0);
			if (idx >= 0) {
				entry.value[idx] = trimmed;
			} else {
				entry.value.unshift(trimmed);
			}
		} else {
			draft.metadata.push({ key, value: [trimmed] });
		}
	};

	upsert(METADATA_KEYS.artistName, values.artistName);
	upsert(METADATA_KEYS.trackName, values.trackName);
	upsert(METADATA_KEYS.appleMusicTrackId, values.appleMusicTrackId);
}
