/**
 * File extensions the editor recognizes when opening files (lyric + audio
 * formats). Mirrors the open-file picker filters. Used to strip a trailing
 * extension from a display / save name without truncating dots that are part
 * of the name itself (e.g. "Mr. Brightside" or "U.N.I.").
 */
const KNOWN_FILE_EXTENSIONS = new Set([
	// lyric formats
	"ttml",
	"xml",
	"json",
	"srt",
	"lrc",
	"qrc",
	"eslrc",
	"lys",
	"yrc",
	// audio formats
	"opus",
	"flac",
	"webm",
	"weba",
	"wav",
	"ogg",
	"m4a",
	"oga",
	"mid",
	"mp3",
	"aiff",
	"wma",
	"au",
]);

/**
 * Strips a single trailing extension from `name`, but only when that extension
 * is one the editor recognizes. Names whose final dot-segment is not a known
 * extension (e.g. "Mr. Brightside", "3.14") are returned unchanged, so dots
 * that belong to the name are never dropped.
 */
export const stripKnownFileExtension = (name: string): string => {
	const dotIndex = name.lastIndexOf(".");
	if (dotIndex <= 0) return name;
	const ext = name.slice(dotIndex + 1).toLowerCase();
	return KNOWN_FILE_EXTENSIONS.has(ext) ? name.slice(0, dotIndex) : name;
};
