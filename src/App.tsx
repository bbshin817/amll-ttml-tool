/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/amll-dev/amll-ttml-tool/blob/main/LICENSE
 */

import {
	Box,
	Button,
	Flex,
	Heading,
	Text,
	TextArea,
	Theme,
} from "@radix-ui/themes";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { TouchSyncPanel } from "$/modules/lyric-editor/components/TouchSyncPanel/index.tsx";
import { log, error as logError } from "$/utils/logging.ts";
import "@radix-ui/themes/styles.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform, version } from "@tauri-apps/plugin-os";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { lazy, Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import semverGt from "semver/functions/gt";
import styles from "./App.module.css";
import DarkThemeDetector from "./components/DarkThemeDetector";
import RibbonBar from "./components/RibbonBar";
import { TitleBar } from "./components/TitleBar";
import { AUDIO_EXTENSIONS, useFileOpener } from "./hooks/useFileOpener.ts";
import AudioControls from "./modules/audio/components/index.tsx";
import { useAudioFeedback } from "./modules/audio/hooks/useAudioFeedback.ts";
import { SyncKeyBinding } from "./modules/lyric-editor/components/sync-keybinding.tsx";
import { AutosaveManager } from "./modules/project/autosave/AutosaveManager.tsx";
import exportTTMLText from "./modules/project/logic/ttml-writer.ts";
import { GlobalDragOverlay } from "./modules/project/modals/GlobalDragOverlay.tsx";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundImageInitAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "./modules/settings/modals/customBackground";
import { showTouchSyncPanelAtom } from "./modules/settings/states/sync.ts";
import {
	isDirtyAtom,
	isDarkThemeAtom,
	isGlobalFileDraggingAtom,
	lyricLinesAtom,
	markCurrentLyricsAsSavedAtom,
	saveFileHandleAtom,
	saveFileNameAtom,
	ToolMode,
	toolModeAtom,
} from "./states/main.ts";
import {
	assertFileSystemAccessSupported,
	isTauriFileHandle,
	pickSaveFileHandle,
	readFileFromTauriPath,
	writeTextToFileHandle,
} from "./utils/file-system-access";

const LyricLinesView = lazy(() => import("./modules/lyric-editor/components"));
const AMLLWrapper = lazy(() => import("./components/AMLLWrapper"));
const Dialogs = lazy(() => import("./components/Dialogs"));

const AppErrorPage = ({
	error,
	resetErrorBoundary,
}: {
	error: Error;
	resetErrorBoundary: () => void;
}) => {
	const store = useStore();
	const { t } = useTranslation();

	return (
		<Flex direction="column" align="center" justify="center" height="100vh">
			<Flex direction="column" align="start" justify="center" gap="2">
				<Heading>{t("app.error.title", "エラーが発生しました")}</Heading>
				<Text>
					{t("app.error.description", "AMLL TTML Tools の実行中にエラーが発生しました")}
				</Text>
				<Text>
					{t("app.error.checkDevTools", "詳しい情報は開発者ツールで確認できます")}
				</Text>
				<Flex gap="2">
					<Button
						onClick={() => {
							(async () => {
								try {
									assertFileSystemAccessSupported();
									const ttmlText = exportTTMLText(store.get(lyricLinesAtom));
									let handle = store.get(saveFileHandleAtom);
									if (!handle) {
										handle = await pickSaveFileHandle({
											suggestedName: store.get(saveFileNameAtom),
											description: "TTML lyric",
											mimeType: "application/xml",
											extensions: ["xml", "ttml"],
										});
									}
									if (!handle) return;
									await writeTextToFileHandle(handle, ttmlText);
									store.set(saveFileHandleAtom, handle);
									if (isTauriFileHandle(handle)) {
										store.set(saveFileNameAtom, handle.name);
									} else {
										const file = await handle.getFile();
										store.set(saveFileNameAtom, file.name);
									}
									store.set(markCurrentLyricsAsSavedAtom);
								} catch (e) {
									logError("Failed to save TTML file", e);
								}
							})();
						}}
					>
						{t("app.error.saveLyrics", "現在の歌詞を保存してください")}
					</Button>
					<Button
						onClick={() => {
							resetErrorBoundary();
						}}
						variant="soft"
					>
						{t("app.error.tryRestart", "アプリを再読み込みしてください")}
					</Button>
				</Flex>
				<Text>{t("app.error.details", "エラー情報の概要：")}</Text>
				<TextArea
					readOnly
					value={String(error)}
					style={{
						width: "100%",
						height: "8em",
					}}
				/>
			</Flex>
		</Flex>
	);
};

function App() {
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const showTouchSyncPanel = useAtomValue(showTouchSyncPanelAtom);
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const customBackgroundOpacity = useAtomValue(customBackgroundOpacityAtom);
	const customBackgroundMask = useAtomValue(customBackgroundMaskAtom);
	const customBackgroundBlur = useAtomValue(customBackgroundBlurAtom);
	const customBackgroundBrightness = useAtomValue(customBackgroundBrightnessAtom);
	const [hasBackground, setHasBackground] = useState(false);
	const effectiveTheme = customBackgroundImage
		? "light"
		: isDarkTheme
			? "dark"
			: "light";
	const isDirty = useAtomValue(isDirtyAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const initCustomBackgroundImage = useSetAtom(customBackgroundImageInitAtom);
	const { t } = useTranslation();
	const store = useStore();

	useEffect(() => {
		initCustomBackgroundImage();
	}, [initCustomBackgroundImage]);

	useEffect(() => {
		const appName = t("topBar.appName", "TTML Editor");
		document.title = `${isDirty ? "*" : ""}${saveFileName} - ${appName}`;
	}, [isDirty, saveFileName, t]);

	const setIsGlobalDragging = useSetAtom(isGlobalFileDraggingAtom);
	const { openFile } = useFileOpener();
	useAudioFeedback();

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const file: {
				path: string;
				ext: string;
			} | null = await invoke("get_open_file_data");

			if (file) {
				log("File data from tauri args", file);
				const picked = await readFileFromTauriPath(file.path);
				openFile(picked.file, undefined, picked.handle);
			}
		})();
	}, [openFile]);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const win = getCurrentWindow();
			if (platform() === "windows") {
				if (semverGt("10.0.22000", version())) {
					setHasBackground(true);
					await win.clearEffects();
				}
			}

			await new Promise((r) => requestAnimationFrame(r));

			await win.show();
		})();
	}, []);

	useEffect(() => {
		const onBeforeClose = (evt: BeforeUnloadEvent) => {
			const currentLyricLines = store.get(lyricLinesAtom);
			if (
				currentLyricLines.lyricLines.length +
					currentLyricLines.metadata.length >
				0
			) {
				evt.preventDefault();
				evt.returnValue = false;
			}
		};
		window.addEventListener("beforeunload", onBeforeClose);
		return () => {
			window.removeEventListener("beforeunload", onBeforeClose);
		};
	}, [store]);

	useEffect(() => {
		const handleDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) {
				setIsGlobalDragging(true);
			}
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
		};

		const handleDragLeave = (e: DragEvent) => {
			if (e.relatedTarget === null) {
				setIsGlobalDragging(false);
			}
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			setIsGlobalDragging(false);

			const file = e.dataTransfer?.files?.[0];
			if (!file) return;

			// 音声ファイルの読み込みはメニューバー（ファイル → 音声を読み込む）に限定する。
			// ドラッグ＆ドロップでの音声読み込みはブロックし、歌詞ファイルのみ受け付ける。
			const ext = file.name.split(".").pop()?.toLowerCase() || "";
			if (AUDIO_EXTENSIONS.has(ext)) {
				toast.info(
					t(
						"error.audioDropDisabled",
						"音声ファイルはメニューバーの「ファイル」→「音声を読み込む」から読み込んでください",
					),
				);
				return;
			}

			openFile(file);
		};

		window.addEventListener("dragenter", handleDragEnter);
		window.addEventListener("dragover", handleDragOver);
		window.addEventListener("dragleave", handleDragLeave);
		window.addEventListener("drop", handleDrop);

		return () => {
			window.removeEventListener("dragenter", handleDragEnter);
			window.removeEventListener("dragover", handleDragOver);
			window.removeEventListener("dragleave", handleDragLeave);
			window.removeEventListener("drop", handleDrop);
		};
	}, [setIsGlobalDragging, openFile, t]);

	return (
		<Theme
			appearance={effectiveTheme}
			panelBackground="solid"
			hasBackground={hasBackground}
			accentColor={effectiveTheme === "dark" ? "jade" : "green"}
			className={styles.radixTheme}
		>
			<ErrorBoundary
				FallbackComponent={AppErrorPage}
				onReset={(_details) => {
					// TODO
				}}
			>
				{customBackgroundImage && (
					<div className={styles.customBackgroundLayer} aria-hidden="true">
						<div
							className={styles.customBackgroundImage}
							style={{
								backgroundImage: `linear-gradient(rgba(0, 0, 0, ${customBackgroundMask}), rgba(0, 0, 0, ${customBackgroundMask})), url(${customBackgroundImage})`,
								opacity: customBackgroundOpacity,
								filter: `blur(${customBackgroundBlur}px) brightness(${customBackgroundBrightness})`,
							}}
						/>
					</div>
				)}
				<div className={styles.appContent}>
					<AutosaveManager />
					<GlobalDragOverlay />
					{toolMode === ToolMode.Sync && <SyncKeyBinding />}
					<DarkThemeDetector />
					<Flex direction="column" height="100vh">
						<TitleBar />
						<RibbonBar />
						<Box flexGrow="1" overflow="hidden">
							<AnimatePresence mode="wait">
								{toolMode !== ToolMode.Preview && (
									<SuspensePlaceHolder key="edit">
										<motion.div
											layout="position"
											style={{
												height: "100%",
												maxHeight: "100%",
												overflowY: "hidden",
											}}
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
										>
											<LyricLinesView key="edit" />
										</motion.div>
									</SuspensePlaceHolder>
								)}
								{toolMode === ToolMode.Preview && (
									<SuspensePlaceHolder key="amll-preview">
										<Box height="100%" key="amll-preview" p="2" asChild>
											<motion.div
												layout="position"
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
											>
												<AMLLWrapper />
											</motion.div>
										</Box>
									</SuspensePlaceHolder>
								)}
							</AnimatePresence>
						</Box>
						{showTouchSyncPanel && toolMode === ToolMode.Sync && (
							<TouchSyncPanel />
						)}
						<Box flexShrink="0">
							<AudioControls />
						</Box>
					</Flex>
					<Suspense fallback={null}>
						<Dialogs />
					</Suspense>
					<ToastContainer theme={effectiveTheme} />
				</div>
			</ErrorBoundary>
		</Theme>
	);
}

export default App;
