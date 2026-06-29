import { Button, Dialog, Flex, Spinner, Text, TextField } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import {
	AppleMusicApi,
	AppleMusicApiError,
	type AppleMusicSongInfo,
	sanitizeTtmlFileName,
} from "$/modules/apple-music/api/client";
import { extractAppleMusicTrackId } from "$/modules/apple-music/utils/parse-track-id";
import type { TTMLMetadata } from "$/types/ttml";
import {
	confirmDialogAtom,
	importFromAppleMusicDialogAtom,
} from "$/states/dialogs.ts";
import { isDirtyAtom } from "$/states/main.ts";
import { error as logError } from "$/utils/logging";

export const ImportFromAppleMusic = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(importFromAppleMusicDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const { openFile } = useFileOpener();

	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);

	const resetForm = useCallback(() => {
		setUrl("");
		setLoading(false);
	}, []);

	const showApiError = useCallback(
		(message: string) => {
			setConfirmDialog({
				open: true,
				alertOnly: true,
				title: t("appleMusicImport.errors.apiErrorTitle", "エラー"),
				description: message,
			});
		},
		[setConfirmDialog, t],
	);

	const performImport = useCallback(
		async (inputUrl: string) => {
			const trackId = extractAppleMusicTrackId(inputUrl);
			if (!trackId) {
				toast.error(
					t(
						"appleMusicImport.errors.invalidUrl",
						"有効な Apple Music のトラック URL を入力してください",
					),
				);
				return;
			}

			setLoading(true);
			try {
				const ttmlText = await AppleMusicApi.fetchSyllableLyrics(trackId);

				let songInfo: AppleMusicSongInfo = {};
				try {
					songInfo = await AppleMusicApi.fetchSongInfo(trackId);
				} catch (e) {
					if (e instanceof AppleMusicApiError) {
						showApiError(e.apiMessage);
					}
				}

				const fileName = songInfo.name
					? sanitizeTtmlFileName(songInfo.name)
					: `apple-music-${trackId}.xml`;
				const file = new File([ttmlText], fileName, {
					type: "application/xml",
				});

				// Apple Music から取得した楽曲情報を、歌詞メタデータへ自動で関連付ける。
				// 後でデータベースへアップロードする際の初期値として利用される。
				const extraMetadata: TTMLMetadata[] = [
					{ key: "appleMusicId", value: [trackId] },
				];
				if (songInfo.name) {
					extraMetadata.push({ key: "musicName", value: [songInfo.name] });
				}
				if (songInfo.artistName) {
					extraMetadata.push({ key: "artists", value: [songInfo.artistName] });
				}
				if (songInfo.albumName) {
					extraMetadata.push({ key: "album", value: [songInfo.albumName] });
				}
				if (songInfo.isrc) {
					extraMetadata.push({ key: "isrc", value: [songInfo.isrc] });
				}

				openFile(file, undefined, null, extraMetadata);
				setIsOpen(false);
				resetForm();
			} catch (e) {
				logError("Apple Music import error", e);
				if (e instanceof AppleMusicApiError) {
					showApiError(e.apiMessage);
				} else {
					toast.error(
						t(
							"appleMusicImport.errors.fetchFailed",
							"歌詞の取得に失敗しました。URL またはネットワーク接続を確認してください",
						),
					);
				}
			} finally {
				setLoading(false);
			}
		},
		[openFile, resetForm, setIsOpen, showApiError, t],
	);

	const onTriggerImport = useCallback(() => {
		if (!url.trim()) return;

		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.importFile.title", "歌詞インポートの確認"),
				description: t(
					"confirmDialog.importFile.description",
					"未保存の変更があります。続行すると変更内容は失われます。新しい歌詞をインポートしますか？",
				),
				onConfirm: () => performImport(url),
			});
		} else {
			performImport(url);
		}
	}, [isDirty, performImport, setConfirmDialog, t, url]);

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) resetForm();
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
			<Dialog.Content maxWidth="480px">
				<Dialog.Title>
					{t("appleMusicImport.title", "Apple Music から取得")}
				</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					{t("appleMusicImport.description", "Apple Music のトラック URL を貼り付けて、歌詞を読み込みます。")}
				</Dialog.Description>

				<Flex direction="column" gap="2">
					<Text size="2" weight="medium">
						{t("appleMusicImport.urlLabel", "トラック URL")}
					</Text>
					<TextField.Root
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder={t(
							"appleMusicImport.placeholder",
							"https://music.apple.com/jp/song/...",
						)}
						disabled={loading}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !loading) onTriggerImport();
						}}
						autoFocus
					/>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray" disabled={loading}>
							{t("common.cancel", "キャンセル")}
						</Button>
					</Dialog.Close>
					<Button onClick={onTriggerImport} disabled={loading || !url.trim()}>
						{loading ? <Spinner /> : t("appleMusicImport.import", "読み込む")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
