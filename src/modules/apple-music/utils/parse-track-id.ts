/**
 * Extract Apple Music track ID from a track or album URL.
 */
export function extractAppleMusicTrackId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	try {
		const url = new URL(trimmed);
		if (!url.hostname.endsWith("music.apple.com")) return null;

		const iParam = url.searchParams.get("i");
		if (iParam && /^\d+$/.test(iParam)) return iParam;

		const segments = url.pathname.split("/").filter(Boolean);
		const last = segments.at(-1);
		if (last && /^\d+$/.test(last) && url.pathname.includes("/song/")) {
			return last;
		}

		return null;
	} catch {
		return null;
	}
}
