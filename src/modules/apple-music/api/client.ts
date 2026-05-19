const BASE_URL = "https://apple-music-api.bshin.dev";

interface ApiErrorBody {
	message?: string;
}

export class AppleMusicApiError extends Error {
	readonly status: number;
	readonly apiMessage: string;

	constructor(status: number, apiMessage: string) {
		super(apiMessage);
		this.name = "AppleMusicApiError";
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
		// Non-JSON error body; keep status text.
	}
	throw new AppleMusicApiError(response.status, apiMessage);
}

interface CatalogSongAttributes {
	name?: string;
}

interface CatalogSongResource {
	attributes?: CatalogSongAttributes;
}

interface CatalogSongResponse {
	data?: CatalogSongResource[];
}

export const AppleMusicApi = {
	/**
	 * Fetch syllable-level TTML lyrics for an Apple Music track.
	 * @param trackId Apple Music track ID
	 * @returns TTML XML text
	 */
	async fetchSyllableLyrics(trackId: string): Promise<string> {
		const response = await fetch(`${BASE_URL}/syllable-lyrics/${trackId}`);
		if (!response.ok) {
			await throwApiError(response);
		}
		return response.text();
	},

	/**
	 * Fetch track title from the catalog API (`data[0].attributes.name`).
	 */
	async fetchSongName(trackId: string): Promise<string> {
		const response = await fetch(`${BASE_URL}/catalog/songs/${trackId}`);
		if (!response.ok) {
			await throwApiError(response);
		}
		const json = (await response.json()) as CatalogSongResponse;
		const name = json.data?.[0]?.attributes?.name?.trim();
		if (!name) {
			throw new Error("Song name was not found in catalog response.");
		}
		return name;
	},
};

export function sanitizeTtmlFileName(name: string): string {
	return `${name.trim()}.ttml`.replace(/[\\/:*?"<>|]/g, "_");
}
