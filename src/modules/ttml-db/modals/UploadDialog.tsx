/**
 * @fileoverview
 * 外部歌詞データベース (ttml-api.bshin.dev) へ歌詞をアップロードするダイアログ。
 *
 * Apple Music から取得した歌詞などでは、アーティスト名・曲名・Apple Music
 * トラック ID をメタデータから自動で読み取って各フィールドへ代入する。
 * 不足している情報はユーザーへ入力を求め、入力済みの情報はそのまま使用する。
 *
 * 全フィールドが自動入力された場合でも、一部をユーザーが入力した場合でも、
 * 登録前に必ず内容確認ステップを表示し、ユーザーの承諾を得てから POST する。
 */

import { Button, Dialog, Flex, Spinner, Text, TextField } from "@radix-ui/themes";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { ArtistNameField } from "$/modules/ttml-db/components/ArtistNameField";
import { TtmlDbApi, TtmlDbApiError } from "$/modules/ttml-db/api/client";
import {
	applyUploadMetadata,
	extractUploadMetadata,
} from "$/modules/ttml-db/utils/upload-metadata";
import { confirmDialogAtom, uploadToTtmlDbDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { error as logError } from "$/utils/logging";

const isNumericId = (value: string) => /^\d+$/.test(value.trim());

type Step = "form" | "confirm";
/**
 * 確認ステップにおける、同名レコード存在チェックの状態。
 * exists = 上書きになる / new = 新規登録 / error = 確認失敗 (登録自体は可能)
 */
type ExistingState = "idle" | "checking" | "exists" | "new" | "error";

export const UploadToTtmlDb = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(uploadToTtmlDbDialogAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();

	const [step, setStep] = useState<Step>("form");
	const [artistName, setArtistName] = useState("");
	const [trackName, setTrackName] = useState("");
	const [appleMusicTrackId, setAppleMusicTrackId] = useState("");
	const [loading, setLoading] = useState(false);
	const [existing, setExisting] = useState<ExistingState>("idle");
	// 確認モーダルに表示する、歌詞の先頭行のプレビュー。
	const [firstLineText, setFirstLineText] = useState("");

	const artistRef = useRef<HTMLInputElement>(null);
	const trackRef = useRef<HTMLInputElement>(null);

	// ダイアログを開いたタイミングで、現在の歌詞メタデータから各フィールドを初期化する。
	useEffect(() => {
		if (!isOpen) return;
		const extracted = extractUploadMetadata(store.get(lyricLinesAtom));
		// 曲名欄には現在開いているプロジェクト名 (保存ファイル名・拡張子なし) を自動で入れる。
		// 既定名 "lyric" や空の場合のみ、メタデータの曲名にフォールバックする。
		const projectBase = store
			.get(saveFileNameAtom)
			.replace(/\.[^.]+$/, "")
			.trim();
		const isDefaultName =
			projectBase === "" || projectBase.toLowerCase() === "lyric";
		const trackDefault = isDefaultName ? extracted.trackName : projectBase;
		setArtistName(extracted.artistName);
		setTrackName(trackDefault);
		setAppleMusicTrackId(extracted.appleMusicTrackId);
		setLoading(false);
		setStep("form");
		setExisting("idle");
		setFirstLineText("");
		// 不足している必須項目に自動でフォーカスする。
		requestAnimationFrame(() => {
			if (!extracted.artistName.trim()) {
				artistRef.current?.focus();
			} else if (!trackDefault.trim()) {
				trackRef.current?.focus();
			}
		});
	}, [isOpen, store]);

	const showApiError = useCallback(
		(message: string) => {
			setConfirmDialog({
				open: true,
				alertOnly: true,
				title: t("ttmlDbUpload.errors.apiErrorTitle", "アップロードエラー"),
				description: message,
			});
		},
		[setConfirmDialog, t],
	);

	const trimmedArtist = artistName.trim();
	const trimmedTrack = trackName.trim();
	const trimmedAppleId = appleMusicTrackId.trim();

	const appleIdInvalid = trimmedAppleId !== "" && !isNumericId(trimmedAppleId);
	// 必須項目が揃い、Apple Music トラック ID が不正でなければ確認ステップへ進める。
	const canProceed =
		trimmedArtist !== "" && trimmedTrack !== "" && !appleIdInvalid;

	// 確認ステップで、同名 (アーティスト名・曲名) のレコードが既に存在するか調べる。
	// 存在する場合、登録は上書き更新になるため、その旨をユーザーへ提示する。
	const checkExisting = useCallback(async () => {
		setExisting("checking");
		try {
			const found = await TtmlDbApi.findByArtistAndTrack(
				trimmedArtist,
				trimmedTrack,
			);
			setExisting(found.length > 0 ? "exists" : "new");
		} catch (e) {
			// 確認に失敗しても登録自体は可能なので、状態だけ error にして続行できるようにする。
			logError("Existing record check failed", e);
			setExisting("error");
		}
	}, [trimmedArtist, trimmedTrack]);

	const goToConfirm = useCallback(() => {
		if (!canProceed) return;
		// 空の歌詞は確認ステップに進む前に弾く。
		const lyric = store.get(lyricLinesAtom);
		if (lyric.lyricLines.length === 0) {
			toast.error(
				t("ttmlDbUpload.errors.noLyrics", "アップロードする歌詞がありません"),
			);
			return;
		}
		// 確認用に、内容のある先頭行のテキストを組み立てる。
		const firstLine =
			lyric.lyricLines.find((l) =>
				l.words.some((w) => w.word.trim().length > 0),
			) ?? lyric.lyricLines[0];
		setFirstLineText(
			firstLine ? firstLine.words.map((w) => w.word).join("").trim() : "",
		);
		setStep("confirm");
		checkExisting();
	}, [canProceed, checkExisting, store, t]);

	const performUpload = useCallback(async () => {
		const lyric = store.get(lyricLinesAtom);
		if (lyric.lyricLines.length === 0) {
			toast.error(
				t("ttmlDbUpload.errors.noLyrics", "アップロードする歌詞がありません"),
			);
			return;
		}

		const ttmlXml = exportTTMLText(lyric);

		setLoading(true);
		try {
			// 同名レコードがあれば API 側で上書き更新される (201=新規 / 200=上書き)。
			const { record, created } = await TtmlDbApi.register(
				trimmedArtist,
				trimmedTrack,
				ttmlXml,
			);

			// Apple Music トラック ID があれば関連付けを行う。
			if (trimmedAppleId) {
				try {
					await TtmlDbApi.linkAppleMusic(record.uuid, trimmedAppleId);
					toast.info(
						t(
							"ttmlDbUpload.appleMusicLinked",
							"Apple Music トラック ID を関連付けました",
						),
					);
				} catch (linkErr) {
					if (linkErr instanceof TtmlDbApiError && linkErr.status === 409) {
						toast.info(
							t(
								"ttmlDbUpload.appleMusicAlreadyLinked",
								"この Apple Music トラック ID は既に関連付け済みです",
							),
						);
					} else {
						logError("Apple Music link error", linkErr);
						toast.warn(
							t(
								"ttmlDbUpload.appleMusicLinkFailed",
								"登録は成功しましたが、Apple Music トラック ID の関連付けに失敗しました",
							),
						);
					}
				}
			}

			// アップロードした情報を歌詞メタデータへ反映し、関連付けを保持する。
			editLyricLines((draft) => {
				applyUploadMetadata(draft, {
					artistName: trimmedArtist,
					trackName: trimmedTrack,
					appleMusicTrackId: trimmedAppleId || undefined,
				});
			});

			toast.success(
				created
					? t("ttmlDbUpload.success", "データベースに登録しました")
					: t("ttmlDbUpload.overwriteSuccess", "歌詞を上書き更新しました"),
			);
			setIsOpen(false);
		} catch (e) {
			logError("TTML database upload error", e);
			// 失敗時は確認ステップに留まり、ユーザーが内容を修正して再試行できるようにする。
			if (e instanceof TtmlDbApiError) {
				showApiError(e.apiMessage);
			} else {
				toast.error(
					t(
						"ttmlDbUpload.errors.uploadFailed",
						"アップロードに失敗しました。ネットワーク接続を確認してください",
					),
				);
			}
		} finally {
			setLoading(false);
		}
	}, [
		editLyricLines,
		setIsOpen,
		showApiError,
		store,
		t,
		trimmedAppleId,
		trimmedArtist,
		trimmedTrack,
	]);

	const handleOpenChange = (open: boolean) => {
		if (loading) return;
		setIsOpen(open);
	};

	const showMissingHint = trimmedArtist === "" || trimmedTrack === "";

	return (
		<Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
			<Dialog.Content maxWidth="480px">
				{step === "form" ? (
					<>
						<Dialog.Title>
							{t("ttmlDbUpload.title", "データベースにアップロード")}
						</Dialog.Title>
						<Dialog.Description size="2" mb="4">
							{t(
								"ttmlDbUpload.description",
								"歌詞を外部データベース (ttml-api.bshin.dev) に登録します。アーティスト名と曲名は必須です。",
							)}
						</Dialog.Description>

						<Flex direction="column" gap="3">
							<Flex direction="column" gap="1">
								<Text size="2" weight="medium">
									{t("ttmlDbUpload.fields.artistName", "アーティスト名")}
								</Text>
								<ArtistNameField
									inputRef={artistRef}
									value={artistName}
									onChange={setArtistName}
									placeholder={t(
										"ttmlDbUpload.placeholders.artistName",
										"例: ヨルシカ",
									)}
									invalid={trimmedArtist === ""}
									onSelect={() => trackRef.current?.focus()}
								/>
							</Flex>

							<Flex direction="column" gap="1">
								<Text size="2" weight="medium">
									{t("ttmlDbUpload.fields.trackName", "曲名")}
								</Text>
								<TextField.Root
									ref={trackRef}
									value={trackName}
									onChange={(e) => setTrackName(e.target.value)}
									placeholder={t(
										"ttmlDbUpload.placeholders.trackName",
										"例: 花に亡霊",
									)}
									color={trimmedTrack === "" ? "red" : undefined}
									variant={trimmedTrack === "" ? "soft" : "surface"}
								/>
							</Flex>

							<Flex direction="column" gap="1">
								<Text size="2" weight="medium">
									{t(
										"ttmlDbUpload.fields.appleMusicTrackId",
										"Apple Music トラック ID",
									)}
								</Text>
								<TextField.Root
									value={appleMusicTrackId}
									onChange={(e) => setAppleMusicTrackId(e.target.value)}
									placeholder={t(
										"ttmlDbUpload.placeholders.appleMusicTrackId",
										"例: 1234567890 (任意)",
									)}
									color={appleIdInvalid ? "red" : undefined}
									variant={appleIdInvalid ? "soft" : "surface"}
									onKeyDown={(e) => {
										if (e.key === "Enter" && canProceed) goToConfirm();
									}}
								/>
								<Text size="1" color={appleIdInvalid ? "red" : "gray"}>
									{appleIdInvalid
										? t(
												"ttmlDbUpload.appleMusicTrackIdInvalid",
												"Apple Music トラック ID は数値で入力してください",
											)
										: t(
												"ttmlDbUpload.appleMusicTrackIdHint",
												"任意。指定すると Apple Music トラック ID を関連付けます",
											)}
								</Text>
							</Flex>

							{showMissingHint && (
								<Text size="1" color="orange">
									{t(
										"ttmlDbUpload.missingHint",
										"不足している項目を入力してください",
									)}
								</Text>
							)}
						</Flex>

						<Flex gap="3" mt="4" justify="end">
							<Dialog.Close>
								<Button variant="soft" color="gray">
									{t("common.cancel", "キャンセル")}
								</Button>
							</Dialog.Close>
							<Button onClick={goToConfirm} disabled={!canProceed}>
								{t("ttmlDbUpload.proceed", "確認へ進む")}
							</Button>
						</Flex>
					</>
				) : (
					<>
						<Dialog.Title>
							{t("ttmlDbUpload.confirmTitle", "アップロード内容の確認")}
						</Dialog.Title>
						<Dialog.Description size="2" mb="4">
							{t(
								"ttmlDbUpload.confirmDescription",
								"以下の内容でデータベースに登録します。よろしいですか？",
							)}
						</Dialog.Description>

						<Flex direction="column" gap="3">
							<ConfirmRow
								label={t("ttmlDbUpload.fields.artistName", "アーティスト名")}
								value={trimmedArtist}
							/>
							<ConfirmRow
								label={t("ttmlDbUpload.fields.trackName", "曲名")}
								value={trimmedTrack}
							/>
							<ConfirmRow
								label={t(
									"ttmlDbUpload.fields.appleMusicTrackId",
									"Apple Music トラック ID",
								)}
								value={
									trimmedAppleId ||
									t("ttmlDbUpload.notProvided", "（未設定）")
								}
								muted={!trimmedAppleId}
							/>
							<ConfirmRow
								label={t("ttmlDbUpload.fields.firstLine", "歌詞（先頭行）")}
								value={
									firstLineText ||
									t("ttmlDbUpload.emptyFirstLine", "（空の行）")
								}
								muted={!firstLineText}
							/>

							{existing === "checking" && (
								<Flex align="center" gap="2">
									<Spinner size="1" />
									<Text size="1" color="gray">
										{t(
											"ttmlDbUpload.checkingExisting",
											"既存の歌詞を確認しています…",
										)}
									</Text>
								</Flex>
							)}
							{existing === "exists" && (
								<Text size="1" color="orange">
									{t(
										"ttmlDbUpload.willOverwrite",
										"同名の歌詞が既に存在します。登録すると上書き更新されます。",
									)}
								</Text>
							)}
							{existing === "new" && (
								<Text size="1" color="grass">
									{t(
										"ttmlDbUpload.willCreate",
										"新規の歌詞として登録されます。",
									)}
								</Text>
							)}
							{existing === "error" && (
								<Text size="1" color="gray">
									{t(
										"ttmlDbUpload.checkFailed",
										"既存の歌詞を確認できませんでした。そのまま登録できます。",
									)}
								</Text>
							)}
						</Flex>

						<Flex gap="3" mt="4" justify="end">
							<Button
								variant="soft"
								color="gray"
								onClick={() => setStep("form")}
								disabled={loading}
							>
								{t("ttmlDbUpload.back", "戻る")}
							</Button>
							<Button
								onClick={performUpload}
								disabled={loading}
								color={existing === "exists" ? "orange" : undefined}
							>
								{loading ? (
									<>
										<Spinner />
										{t("ttmlDbUpload.uploading", "アップロード中…")}
									</>
								) : existing === "exists" ? (
									t("ttmlDbUpload.confirmOverwrite", "上書き更新する")
								) : (
									t("ttmlDbUpload.confirmUpload", "登録する")
								)}
							</Button>
						</Flex>
					</>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
};

interface ConfirmRowProps {
	label: string;
	value: string;
	muted?: boolean;
}

const ConfirmRow = ({ label, value, muted }: ConfirmRowProps) => (
	<Flex direction="column" gap="1">
		<Text size="1" color="gray">
			{label}
		</Text>
		<Text
			size="2"
			weight="medium"
			color={muted ? "gray" : undefined}
			style={{ wordBreak: "break-word" }}
		>
			{value}
		</Text>
	</Flex>
);
