import { DropdownMenu } from "@radix-ui/themes";
import { useSetAtom, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import saveFile from "save-file";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { encodeSpotifyJson } from "$/modules/project/logic/spotify-json";
import { importFromTextDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { error } from "$/utils/logging.ts";

export const ImportExportLyric = () => {
	const store = useStore();
	const setImportFromTextDialog = useSetAtom(importFromTextDialogAtom);
	const { openFile } = useFileOpener();
	const { t } = useTranslation();

	const onImportLyric = (extension: string) => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = `.${extension},*/*`;
		inputEl.addEventListener(
			"change",
			() => {
				const file = inputEl.files?.[0];
				if (!file) return;

				openFile(file, extension);
			},
			{
				once: true,
			},
		);
		inputEl.click();
	};

	const saveExport = async (data: string, extension: string, mimeType: string) => {
		const saveFileName = store.get(saveFileNameAtom);
		const baseName = saveFileName.replace(/\.[^.]*$/, "");
		const fileName = `${baseName}.${extension}`;
		const blob = new Blob([data], { type: mimeType });
		await saveFile(blob, fileName);
	};

	const onExportTtml = async () => {
		try {
			const lyric = store.get(lyricLinesAtom);
			const data = exportTTMLText(lyric);
			await saveExport(data, "ttml", "application/xml");
		} catch (e) {
			error("Failed to export lyric as TTML", e);
		}
	};

	const onExportSpotifyJson = async () => {
		try {
			const lyric = store.get(lyricLinesAtom);
			const ttml = exportTTMLText(lyric);
			const data = encodeSpotifyJson(ttml);
			await saveExport(data, "json", "application/json");
		} catch (e) {
			error("Failed to export lyric as Spotify JSON", e);
		}
	};

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.importLyric.import", "歌詞をインポート")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onClick={() => setImportFromTextDialog(true)}>
						{t("topBar.menu.importLyric.fromPlainText", "プレーンテキストからインポート…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("lrc")}>
						{t("topBar.menu.importLyric.fromLrc", "LRC ファイルからインポート…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("srt")}>
						{t("topBar.menu.importLyric.fromSrt", "SRT ファイルからインポート…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("ttml")}>
						{t("topBar.menu.importLyric.fromTTML", "TTML ファイルからインポート…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={() => onImportLyric("json")}>
						{t(
							"topBar.menu.importLyric.fromSpotifyJson",
							"Spotify JSON ファイルからインポート…",
						)}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.exportLyric.export", "歌詞をエクスポート")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onClick={onExportTtml}>
						{t("topBar.menu.exportLyric.toTTML", "TTML")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportSpotifyJson}>
						{t("topBar.menu.exportLyric.toSpotifyJson", "JSON (Spotify)")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</>
	);
};
