import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";

const TIMESTAMP_REGEXP = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/;
const TIMING_LINE_REGEXP = /^(.+?)\s*-->\s*(.+?)(?:\s+.*)?$/;

function parseSrtTimestamp(input: string): number | null {
	const trimmed = input.trim();
	const match = TIMESTAMP_REGEXP.exec(trimmed);
	if (!match) return null;

	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	const seconds = Number.parseInt(match[3], 10);
	const milliseconds = Number.parseInt(match[4].padEnd(3, "0"), 10);

	return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

export function parseSrt(srtContent: string): LyricLine[] {
	const normalized = srtContent.replace(/^\uFEFF/, "").replace(/\r/g, "");
	const blocks = normalized.split(/\n{2,}/);
	const lyricLines: LyricLine[] = [];

	for (const block of blocks) {
		const rawLines = block
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		if (rawLines.length < 2) continue;

		const timingLineIndex = /^\d+$/.test(rawLines[0]) ? 1 : 0;
		const timingLine = rawLines[timingLineIndex];
		const timingMatch = TIMING_LINE_REGEXP.exec(timingLine);
		if (!timingMatch) continue;

		const startTime = parseSrtTimestamp(timingMatch[1]);
		const endTime = parseSrtTimestamp(timingMatch[2]);
		if (startTime === null || endTime === null) continue;

		const text = rawLines
			.slice(timingLineIndex + 1)
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
		if (!text) continue;

		const line = newLyricLine();
		const word = newLyricWord();
		word.word = text;
		word.startTime = startTime;
		word.endTime = endTime;

		line.words = [word];
		line.startTime = startTime;
		line.endTime = endTime;
		lyricLines.push(line);
	}

	return lyricLines;
}
