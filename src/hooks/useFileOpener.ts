/**
 * @description 处理打开文件的逻辑
 */

import {
	type LyricLine,
	parseEslrc,
	parseLys,
	parseQrc,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { audioEngine } from "$/modules/audio/audio-engine";
import { getProjectList } from "$/modules/project/autosave/autosave";
import { isProjectMatch } from "$/modules/project/logic/project-match";
import { decodeSpotifyJsonToTtml } from "$/modules/project/logic/spotify-json";
import { parseLyric as parseTTML } from "$/modules/project/logic/ttml-parser";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { confirmDialogAtom } from "$/states/dialogs.ts";
import {
	isDirtyAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileHandleAtom,
	saveFileNameAtom,
} from "$/states/main.ts";
import type { TTMLLyric } from "$/types/ttml";
import { log, error as logError } from "$/utils/logging.ts";
import { parseLrc } from "$/utils/parse-lrc";
import { parseSrt } from "$/utils/parse-srt";

const LYRIC_PARSERS: Record<string, (text: string) => LyricLine[]> = {
	lrc: parseLrc,
	srt: parseSrt,
	eslrc: parseEslrc,
	qrc: parseQrc,
	yrc: parseYrc,
	lys: parseLys,
};

const AUDIO_EXTENSIONS = new Set([
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

const stripFileExtension = (name: string): string =>
	name.replace(/\.[^.]+$/, "");

export const useFileOpener = () => {
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileHandle = useSetAtom(saveFileHandleAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { t } = useTranslation();

	const normalizeLyricLines = useCallback(
		(lyricLines: LyricLine[]): TTMLLyric => {
			return {
				lyricLines: lyricLines.map((line) => ({
					...line,
					words: line.words.map((word) => ({
						...word,
						id: uid(),
						obscene: false,
						emptyBeat: 0,
					})),
					ignoreSync: false,
					id: uid(),
				})),
				metadata: [],
			};
		},
		[],
	);

	const performOpenFile = useCallback(
		async (
			file: File,
			forceExt?: string,
			fileHandle: FileSystemFileHandle | null = null,
		) => {
			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const ext = forceExt ? forceExt.toLowerCase() : rawExt;

			try {
				if (AUDIO_EXTENSIONS.has(ext)) {
					audioEngine.loadMusic(file);
					return;
				}

				let lyricData: TTMLLyric | null = null;
				const text = await file.text();

				if (ext === "ttml" || ext === "xml") {
					lyricData = parseTTML(text);
				} else if (ext === "json") {
					const ttml = decodeSpotifyJsonToTtml(text);
					lyricData = parseTTML(ttml);
				} else if (ext in LYRIC_PARSERS) {
					const parser = LYRIC_PARSERS[ext];
					const rawLines = parser(text);
					lyricData = normalizeLyricLines(rawLines);
				} else {
					toast.error(
						t(
							"error.unsupportedFileFormat",
							"サポートされていないファイル形式: {ext}",
							{ ext },
						),
					);
					return;
				}

				if (!lyricData) return;

				let resolvedProjectId = uid();

				try {
					if (lyricData.metadata.length > 0) {
						const projects = await getProjectList();
						const matchedProject = projects.find((p) =>
							isProjectMatch(p, lyricData as TTMLLyric),
						);

						if (matchedProject) {
							log(
								`既存プロジェクトに一致: ${matchedProject.name} (${matchedProject.id})`,
							);
							resolvedProjectId = matchedProject.id;
						} else {
							log("既存プロジェクトに一致しませんでした");
						}
					}
				} catch (e) {
					logError("プロジェクトデータの解析に失敗しました", e);
				}

				setProjectId(resolvedProjectId);
				setNewLyricLines(lyricData);
				const suggestedFile = getSuggestedTtmlFileName(lyricData.metadata);
				const nextFileName =
					ext === "ttml" || ext === "xml" || ext === "json"
						? ext === "ttml" || ext === "xml"
							? stripFileExtension(file.name)
							: stripFileExtension(
									suggestedFile?.fileName ??
										file.name.replace(/\.json$/i, ".ttml"),
								)
						: stripFileExtension(suggestedFile?.fileName ?? file.name);
				setSaveFileName(nextFileName || "lyric");
				setSaveFileHandle(fileHandle);
			} catch (e) {
				logError(`Failed to open file: ${file.name}`, e);
				toast.error(t("error.openFileFailed", "ファイルを開けませんでした"));
			}
		},
		[
			setNewLyricLines,
			setProjectId,
			setSaveFileHandle,
			setSaveFileName,
			normalizeLyricLines,
			t,
		],
	);

	const openFile = useCallback(
		/**
		 * 打开文件
		 * @param file
		 * @param forceExt 可选参数，用于强制指定解析方式，不传入则从文件后缀名推断
		 */
		(
			file: File,
			forceExt?: string,
			fileHandle: FileSystemFileHandle | null = null,
		) => {
			const run = () => performOpenFile(file, forceExt, fileHandle);

			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const finalExt = forceExt || rawExt;

			if (AUDIO_EXTENSIONS.has(finalExt)) {
				run();
				return;
			}

			if (isDirty) {
				setConfirmDialog({
					open: true,
					title: t("confirmDialog.openFile.title", "ファイルを開く前の確認"),
					description: t(
						"confirmDialog.openFile.description",
						"未保存の変更があります。続行すると変更内容は失われます。新しいファイルを開きますか？",
					),
					onConfirm: run,
				});
			} else {
				run();
			}
		},
		[isDirty, setConfirmDialog, t, performOpenFile],
	);

	return { openFile };
};
