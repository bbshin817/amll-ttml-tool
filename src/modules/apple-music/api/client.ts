const BASE_URL = "https://apple-music-api.bshin.dev";

export const AppleMusicApi = {
	/**
	 * Fetch syllable-level TTML lyrics for an Apple Music track.
	 * @param trackId Apple Music track ID
	 * @returns TTML XML text
	 */
	async fetchSyllableLyrics(trackId: string): Promise<string> {
		const response = await fetch(`${BASE_URL}/syllable-lyrics/${trackId}`);
		if (!response.ok) {
			throw new Error(
				`Apple Music lyrics fetch failed: ${response.status} ${response.statusText}`,
			);
		}
		return response.text();
	},
};
