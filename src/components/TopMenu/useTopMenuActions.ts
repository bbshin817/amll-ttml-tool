import { open } from "@tauri-apps/plugin-shell";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom, withImmer } from "jotai-immer";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { uid } from "uid";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { applyRomanizationWarnings } from "$/modules/segmentation/utils/Transliteration/roman-warning";
import { predictLineRomanization } from "$/modules/segmentation/utils/Transliteration/distributor";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { segmentationLangAtom } from "$/modules/segmentation/states";
import { loadHyphenator } from "$/modules/segmentation/utils/hyphen-loader";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import { applyGeneratedRuby } from "$/modules/lyric-editor/utils/ruby-generator";
import {
	confirmDialogAtom,
	historyRestoreDialogAtom,
	importFromAppleMusicDialogAtom,
	latencyTestDialogAtom,
	metadataEditorDialogAtom,
	settingsDialogAtom,
	timeShiftDialogAtom,
	uploadToTtmlDbDialogAtom,
} from "$/states/dialogs.ts";
import {
	keyDeleteSelectionAtom,
	keyNewFileAtom,
	keyOpenFileAtom,
	keyRedoAtom,
	keySaveFileAtom,
	keySelectAllAtom,
	keySelectInvertedAtom,
	keySelectWordsOfMatchedSelectionAtom,
	keyUndoAtom,
} from "$/states/keybindings.ts";
import {
	DarkMode,
	isDirtyAtom,
	lyricLinesAtom,
	markCurrentLyricsAsSavedAtom,
	newLyricLinesAtom,
	projectIdAtom,
	redoLyricLinesAtom,
	saveFileHandleAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	darkModeAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "$/states/main.ts";
import {
	assertFileSystemAccessSupported,
	isTauriFileHandle,
	openSingleFileWithPicker,
	pickSaveFileHandle,
	writeTextToFileHandle,
} from "$/utils/file-system-access";
import type { LyricWord } from "$/types/ttml";
import { error, log } from "$/utils/logging.ts";

/**
 * 単語（音節）のタイミングをすべて 0 にリセットする。
 * 空拍とルビのタイミングも合わせてクリアする。
 */
function resetWordTimings(word: LyricWord) {
	word.startTime = 0;
	word.endTime = 0;
	word.emptyBeat = 0;
	if (word.ruby) {
		for (const rubyWord of word.ruby) {
			rubyWord.startTime = 0;
			rubyWord.endTime = 0;
		}
	}
}

const OPEN_FILE_EXTENSIONS = [
	"ttml",
	"xml",
	"json",
	"srt",
	"lrc",
	"qrc",
	"eslrc",
	"lys",
	"yrc",
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
];

export const useTopMenuActions = () => {
	const { t } = useTranslation();
	const [saveFileName, setSaveFileName] = useAtom(saveFileNameAtom);
	const [saveFileHandle, setSaveFileHandle] = useAtom(saveFileHandleAtom);
	const newLyricLine = useSetAtom(newLyricLinesAtom);
	const setDarkMode = useSetAtom(darkModeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const markCurrentLyricsAsSaved = useSetAtom(markCurrentLyricsAsSavedAtom);
	const setMetadataEditorOpened = useSetAtom(metadataEditorDialogAtom);
	const setSettingsDialogOpened = useSetAtom(settingsDialogAtom);
	const undoLyricLines = useAtomValue(undoableLyricLinesAtom);
	const store = useStore();
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setHistoryRestoreDialog = useSetAtom(historyRestoreDialogAtom);
	const setTimeShiftDialog = useSetAtom(timeShiftDialogAtom);
	const setImportFromAppleMusicDialog = useSetAtom(
		importFromAppleMusicDialogAtom,
	);
	const setUploadToTtmlDbDialog = useSetAtom(uploadToTtmlDbDialogAtom);
	const { openFile } = useFileOpener();
	const setProjectId = useSetAtom(projectIdAtom);
	const { config: segmentationConfig } = useSegmentationConfig();
	const newFileKey = useAtomValue(keyNewFileAtom);
	const openFileKey = useAtomValue(keyOpenFileAtom);
	const saveFileKey = useAtomValue(keySaveFileAtom);
	const undoKey = useAtomValue(keyUndoAtom);
	const redoKey = useAtomValue(keyRedoAtom);
	const selectAllLinesKey = useAtomValue(keySelectAllAtom);
	const selectInvertedLinesKey = useAtomValue(keySelectInvertedAtom);
	const selectWordsOfMatchedSelectionKey = useAtomValue(
		keySelectWordsOfMatchedSelectionAtom,
	);
	const deleteSelectionKey = useAtomValue(keyDeleteSelectionAtom);

	const onNewFile = useCallback(() => {
		const action = () => {
			newLyricLine();
			setProjectId(uid());
			setSaveFileHandle(null);
			setSaveFileName("lyric.xml");
		};

		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.newFile.title", "新規ファイル作成の確認"),
				description: t(
					"confirmDialog.newFile.description",
					"未保存の変更があります。続行すると変更内容は失われます。新しいファイルを作成しますか？",
				),
				onConfirm: action,
			});
		} else {
			action();
		}
	}, [
		isDirty,
		newLyricLine,
		setConfirmDialog,
		t,
		setProjectId,
		setSaveFileHandle,
		setSaveFileName,
	]);

	const onOpenFile = useCallback(async () => {
		try {
			assertFileSystemAccessSupported();
			const picked = await openSingleFileWithPicker({
				description: "Lyrics or audio files",
				mimeType: "text/plain",
				extensions: OPEN_FILE_EXTENSIONS,
			});
			if (!picked) return;
			openFile(picked.file, undefined, picked.handle);
		} catch (e) {
			error("Failed to open file from File System Access API", e);
		}
	}, [openFile]);

	const onOpenFileFromClipboard = useCallback(async () => {
		try {
			const ttmlText = await navigator.clipboard.readText();
			const file = new File([ttmlText], "lyric.xml", {
				type: "application/xml",
			});
			openFile(file, undefined, null);
		} catch (e) {
			error("Failed to parse TTML file from clipboard", e);
		}
	}, [openFile]);

	const onOpenFromAppleMusic = useCallback(() => {
		setImportFromAppleMusicDialog(true);
	}, [setImportFromAppleMusicDialog]);

	const onUploadToTtmlDb = useCallback(() => {
		setUploadToTtmlDbDialog(true);
	}, [setUploadToTtmlDbDialog]);

	const onSaveFile = useCallback(async () => {
		try {
			assertFileSystemAccessSupported();
			const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
			let handle = saveFileHandle;
			if (!handle) {
				handle = await pickSaveFileHandle({
					suggestedName: saveFileName,
					description: "TTML lyric",
					mimeType: "application/xml",
					extensions: ["xml", "ttml"],
				});
			}
			if (!handle) return;
			await writeTextToFileHandle(handle, ttmlText);
			setSaveFileHandle(handle);
			if (isTauriFileHandle(handle)) {
				setSaveFileName(handle.name);
			} else {
				const file = await handle.getFile();
				setSaveFileName(file.name);
			}
			markCurrentLyricsAsSaved();
		} catch (e) {
			error("Failed to save TTML file", e);
		}
	}, [
		saveFileHandle,
		saveFileName,
		markCurrentLyricsAsSaved,
		setSaveFileHandle,
		setSaveFileName,
		store,
	]);

	const onSaveFileAs = useCallback(async () => {
		try {
			assertFileSystemAccessSupported();
			const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
			const handle = await pickSaveFileHandle({
				suggestedName: saveFileName,
				description: "TTML lyric",
				mimeType: "application/xml",
				extensions: ["xml", "ttml"],
			});
			if (!handle) return;
			await writeTextToFileHandle(handle, ttmlText);
			setSaveFileHandle(handle);
			if (isTauriFileHandle(handle)) {
				setSaveFileName(handle.name);
			} else {
				const file = await handle.getFile();
				setSaveFileName(file.name);
			}
			markCurrentLyricsAsSaved();
		} catch (e) {
			error("Failed to save TTML file as a new file", e);
		}
	}, [
		saveFileName,
		markCurrentLyricsAsSaved,
		setSaveFileHandle,
		setSaveFileName,
		store,
	]);

	const onOpenHistoryRestore = useCallback(() => {
		setHistoryRestoreDialog(true);
	}, [setHistoryRestoreDialog]);

	const onSaveFileToClipboard = useCallback(async () => {
		try {
			const lyric = store.get(lyricLinesAtom);
			const ttml = exportTTMLText(lyric);
			await navigator.clipboard.writeText(ttml);
		} catch (e) {
			error("Failed to save TTML file into clipboard", e);
		}
	}, [store]);

	const onOpenMetadataEditor = useCallback(() => {
		setMetadataEditorOpened(true);
	}, [setMetadataEditorOpened]);

	const onOpenSettings = useCallback(() => {
		setSettingsDialogOpened(true);
	}, [setSettingsDialogOpened]);

	const onOpenLatencyTest = useCallback(() => {
		store.set(latencyTestDialogAtom, true);
	}, [store]);

	const onOpenGitHub = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/amll-dev/amll-ttml-tool");
		} else {
			window.open("https://github.com/amll-dev/amll-ttml-tool");
		}
	}, []);

	const onOpenWiki = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/amll-dev/amll-ttml-tool/wiki");
		} else {
			window.open("https://github.com/amll-dev/amll-ttml-tool/wiki");
		}
	}, []);

	const onUndo = useCallback(() => {
		store.set(undoLyricLinesAtom);
	}, [store]);

	const onRedo = useCallback(() => {
		store.set(redoLyricLinesAtom);
	}, [store]);

	const onUnselectAll = useCallback(() => {
		const immerSelectedLinesAtom = withImmer(selectedLinesAtom);
		const immerSelectedWordsAtom = withImmer(selectedWordsAtom);
		store.set(immerSelectedLinesAtom, (old) => {
			old.clear();
		});
		store.set(immerSelectedWordsAtom, (old) => {
			old.clear();
		});
	}, [store]);

	const onSelectAll = useCallback(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords = lines
			.flatMap((l) => l.words)
			.filter((w) => selectedWordIds.has(w.id));
		if (selectedWords.length > 0) {
			const tmpWordIds = new Set(selectedWordIds);
			for (const selLine of selectedLines) {
				for (const word of selLine.words) {
					tmpWordIds.delete(word.id);
				}
			}
			if (tmpWordIds.size === 0) {
				store.set(
					selectedWordsAtom,
					new Set(selectedLines.flatMap((line) => line.words.map((w) => w.id))),
				);
				return;
			}
		} else {
			store.set(
				selectedLinesAtom,
				new Set(store.get(lyricLinesAtom).lyricLines.map((l) => l.id)),
			);
		}
		const sel = window.getSelection();
		if (sel) {
			if (sel.empty) {
				sel.empty();
			} else if (sel.removeAllRanges) {
				sel.removeAllRanges();
			}
		}
	}, [store]);

	const onSelectInverted = useCallback(() => {}, []);

	const onSelectWordsOfMatchedSelection = useCallback(() => {}, []);

	const onDeleteSelection = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedLineIds = store.get(selectedLinesAtom);
		log("deleting selections", selectedWordIds, selectedLineIds);
		if (selectedWordIds.size === 0) {
			editLyricLines((prev) => {
				prev.lyricLines = prev.lyricLines.filter(
					(l) => !selectedLineIds.has(l.id),
				);
			});
		} else {
			editLyricLines((prev) => {
				for (const line of prev.lyricLines) {
					line.words = line.words.filter((w) => !selectedWordIds.has(w.id));
				}
			});
		}
		store.set(selectedWordsAtom, new Set());
		store.set(selectedLinesAtom, new Set());
	}, [store, editLyricLines]);

	const onAutoSegment = useCallback(() => {
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(
				draft.lyricLines,
				segmentationConfig,
			);
		});
	}, [editLyricLines, segmentationConfig]);

	const onMoraSegment = useCallback(async () => {
		// 日本語（ひらがな・カタカナ・漢字）をモーラ（拍）単位で分割する。
		// 拗音・促音・長音符・撥音「ん」は直前の仮名と結合させる（分割エンジン側で処理）。
		// 英語の音節分割用に、ハイフネーション辞書を必要に応じて読み込む。
		const hyphenator =
			segmentationConfig.hyphenator ??
			(await loadHyphenator(store.get(segmentationLangAtom))) ??
			undefined;
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(draft.lyricLines, {
				...segmentationConfig,
				splitJapaneseByChar: true,
				hyphenator,
			});
		});
	}, [editLyricLines, segmentationConfig, store]);

	const onOpenTimeShift = useCallback(() => {
		setTimeShiftDialog(true);
	}, [setTimeShiftDialog]);

	const onSyncLineTimestamps = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (let i = 0; i < draft.lyricLines.length; i++) {
					const line = draft.lyricLines[i];
					if (line.words.length === 0) continue;

					let startTime = line.words[0].startTime;
					let endTime = line.words[line.words.length - 1].endTime;

					if (i + 1 < draft.lyricLines.length) {
						const nextLine = draft.lyricLines[i + 1];
						if (nextLine.isBG && nextLine.words.length > 0) {
							const nextLineStart = nextLine.words[0].startTime;
							const nextLineEnd =
								nextLine.words[nextLine.words.length - 1].endTime;
							startTime = Math.min(startTime, nextLineStart);
							endTime = Math.max(endTime, nextLineEnd);
						}
					}

					line.startTime = startTime;
					line.endTime = endTime;
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t("confirmDialog.syncLineTimestamps.title", "行のタイムスタンプ同期の確認"),
			description: t(
				"confirmDialog.syncLineTimestamps.description",
				"各行に含まれる単語のタイムスタンプをもとに、すべての行の開始時刻と終了時刻を、最初と最後の音節に合わせて自動で同期します。続行しますか？",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onResetAllWordTimings = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (const line of draft.lyricLines) {
					for (const word of line.words) {
						resetWordTimings(word);
					}
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t("confirmDialog.resetWordTimings.title", "音節タイミングのリセットの確認"),
			description: t(
				"confirmDialog.resetWordTimings.description",
				"すべての音節（単語）のタイミングを 0 にリセットします。行のタイミングは保持されます。続行しますか？",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onResetAllTimings = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (const line of draft.lyricLines) {
					line.startTime = 0;
					line.endTime = 0;
					for (const word of line.words) {
						resetWordTimings(word);
					}
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t("confirmDialog.resetAllTimings.title", "すべてのタイミングのリセットの確認"),
			description: t(
				"confirmDialog.resetAllTimings.description",
				"すべての行と音節のタイミングを 0 にリセットします。続行しますか？",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onOpenDistributeRomanization = useCallback(() => {
		const selectedLines = store.get(selectedLinesAtom);
		const hasSelection = selectedLines.size > 0;
		editLyricLines((draft) => {
			draft.lyricLines.forEach((line) => {
				if (hasSelection && !selectedLines.has(line.id)) return;
				const fullRoman = line.romanLyric || "";
				if (line.words.length === 0 || fullRoman.trim() === "") return;
				try {
					const results = predictLineRomanization(line.words, fullRoman);
					line.words.forEach((word, wordIndex) => {
						if (!results[wordIndex]) return;
						word.romanWord = results[wordIndex];
					});
					applyRomanizationWarnings(line.words);
				} catch (e) {
					error("Failed to distribute romanization", e);
				}
			});
		});
	}, [editLyricLines, store]);

	const onAutoRuby = useCallback(() => {
		const selectedLines = store.get(selectedLinesAtom);
		const hasSelection = selectedLines.size > 0;
		editLyricLines((draft) => {
			draft.lyricLines.forEach((line) => {
				if (hasSelection && !selectedLines.has(line.id)) return;
				if (line.words.length === 0) return;
				line.words.forEach((word) => {
					if (!word.romanWord || word.romanWord.trim() === "") return;
					applyGeneratedRuby(word);
				});
			});
		});
	}, [editLyricLines, store]);

	const onCheckRomanizationWarnings = useCallback(() => {
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				applyRomanizationWarnings(line.words);
			}
		});
	}, [editLyricLines]);

	const onSetThemeLight = useCallback(() => {
		setDarkMode(DarkMode.Light);
	}, [setDarkMode]);

	const onSetThemeDark = useCallback(() => {
		setDarkMode(DarkMode.Dark);
	}, [setDarkMode]);

	const onSetThemeAuto = useCallback(() => {
		setDarkMode(DarkMode.Auto);
	}, [setDarkMode]);

	return {
		newFileKey,
		openFileKey,
		saveFileKey,
		undoKey,
		redoKey,
		selectAllLinesKey,
		unselectAllLinesKey: selectAllLinesKey,
		selectInvertedLinesKey,
		selectWordsOfMatchedSelectionKey,
		deleteSelectionKey,
		undoDisabled: !undoLyricLines.canUndo,
		redoDisabled: !undoLyricLines.canRedo,
		onNewFile,
		onOpenFile,
		onOpenFileFromClipboard,
		onOpenFromAppleMusic,
		onUploadToTtmlDb,
		onSaveFile,
		onSaveFileAs,
		onOpenHistoryRestore,
		onSaveFileToClipboard,
		onUndo,
		onRedo,
		onSelectAll,
		onUnselectAll,
		onSelectInverted,
		onSelectWordsOfMatchedSelection,
		onDeleteSelection,
		onOpenTimeShift,
		onOpenMetadataEditor,
		onOpenSettings,
		onSetThemeAuto,
		onSetThemeLight,
		onSetThemeDark,
		onAutoSegment,
		onMoraSegment,
		onSyncLineTimestamps,
		onResetAllWordTimings,
		onResetAllTimings,
		onOpenDistributeRomanization,
		onAutoRuby,
		onCheckRomanizationWarnings,
		onOpenLatencyTest,
		onOpenGitHub,
		onOpenWiki,
	};
};
