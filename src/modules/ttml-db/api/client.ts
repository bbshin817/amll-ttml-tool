/**
 * @fileoverview
 * 外部歌詞データベース (ttml-api.bshin.dev) のクライアント。
 * OpenAPI 仕様 (TTML API 1.0.0) に対応する。
 */

import type {
	Artist,
	TtmlAppleMusicLink,
	TtmlRecord,
} from "$/modules/ttml-db/types";

const BASE_URL = "https://ttml-api.bshin.dev";

interface ApiErrorBody {
	message?: string;
}

/**
 * @description TTML データベース API がエラー応答を返したことを表す例外。
 * `status` に HTTP ステータス、`apiMessage` に API から返されたメッセージを保持する。
 */
export class TtmlDbApiError extends Error {
	readonly status: number;
	readonly apiMessage: string;

	constructor(status: number, apiMessage: string) {
		super(apiMessage);
		this.name = "TtmlDbApiError";
		this.status = status;
		this.apiMessage = apiMessage;
	}
}

async function throwApiError(response: Response): Promise<never> {
	let apiMessage = `${response.status} ${response.statusText}`;
	try {
		const json = (await response.json()) as ApiErrorBody;
		if (typeof json.message === "string" && json.message.trim()) {
			apiMessage = json.message.trim();
		}
	} catch {
		// JSON 以外のエラー本文。ステータステキストをそのまま使う。
	}
	throw new TtmlDbApiError(response.status, apiMessage);
}

/** パスセグメントを安全に URL エンコードする (スラッシュや空白を含む名前に対応)。 */
function seg(value: string): string {
	return encodeURIComponent(value);
}

export const TtmlDbApi = {
	/**
	 * アーティスト名のサジェスト候補を取得する (部分一致)。
	 * `GET /artists/suggest?q={query}`
	 * @returns 一致するアーティストの配列 (該当なしや空クエリの場合は空配列)
	 * @throws {TtmlDbApiError} 404 以外の異常時 (500 など)
	 */
	async suggestArtists(query: string): Promise<Artist[]> {
		const q = query.trim();
		if (!q) return [];
		const response = await fetch(
			`${BASE_URL}/artists/suggest?q=${encodeURIComponent(q)}`,
		);
		if (response.status === 404) return [];
		if (!response.ok) {
			await throwApiError(response);
		}
		return (await response.json()) as Artist[];
	},

	/**
	 * 歌詞を登録する。同名 (アーティスト名・曲名) のレコードが存在する場合は上書き更新する。
	 * `POST /ttml/{artistName}/{trackName}` (リクエスト本文は TTML の XML 文字列)
	 * @returns 登録された TTML レコードと、新規作成 (HTTP 201) か上書き (HTTP 200) かのフラグ
	 * @throws {TtmlDbApiError} 400 (空), 422 (不正な XML) など
	 */
	async register(
		artistName: string,
		trackName: string,
		ttmlXml: string,
	): Promise<{ record: TtmlRecord; created: boolean }> {
		const response = await fetch(
			`${BASE_URL}/ttml/${seg(artistName)}/${seg(trackName)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/xml" },
				body: ttmlXml,
			},
		);
		if (!response.ok) {
			await throwApiError(response);
		}
		const record = (await response.json()) as TtmlRecord;
		return { record, created: response.status === 201 };
	},

	/**
	 * 登録済みの TTML に Apple Music トラック ID を関連付ける。
	 * `POST /ttml/{uuid}/apple-music/{appleMusicTrackId}`
	 * @throws {TtmlDbApiError} 404 (TTML が見つからない), 409 (既に関連付け済み)
	 */
	async linkAppleMusic(
		uuid: string,
		appleMusicTrackId: string,
	): Promise<TtmlAppleMusicLink> {
		const response = await fetch(
			`${BASE_URL}/ttml/${seg(uuid)}/apple-music/${seg(appleMusicTrackId)}`,
			{ method: "POST" },
		);
		if (!response.ok) {
			await throwApiError(response);
		}
		return (await response.json()) as TtmlAppleMusicLink;
	},

	/**
	 * Apple Music トラック ID で TTML を検索する。
	 * `GET /ttml/apple-music/{trackId}`
	 * @returns 見つかった TTML レコード。存在しない場合は null
	 * @throws {TtmlDbApiError} 404 以外の異常時
	 */
	async findByAppleMusicTrackId(
		trackId: string,
	): Promise<TtmlRecord | null> {
		const response = await fetch(
			`${BASE_URL}/ttml/apple-music/${seg(trackId)}`,
		);
		if (response.status === 404) return null;
		if (!response.ok) {
			await throwApiError(response);
		}
		return (await response.json()) as TtmlRecord;
	},

	/**
	 * アーティスト名・曲名で TTML を検索する。
	 * `GET /ttml/{artistName}/{trackName}`
	 * @returns 見つかった TTML レコードの配列 (存在しない場合は空配列)
	 * @throws {TtmlDbApiError} 404 以外の異常時
	 */
	async findByArtistAndTrack(
		artistName: string,
		trackName: string,
	): Promise<TtmlRecord[]> {
		const response = await fetch(
			`${BASE_URL}/ttml/${seg(artistName)}/${seg(trackName)}`,
		);
		if (response.status === 404) return [];
		if (!response.ok) {
			await throwApiError(response);
		}
		return (await response.json()) as TtmlRecord[];
	},
};
