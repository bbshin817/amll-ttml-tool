import { Box, Flex } from "@radix-ui/themes";
import { listen } from "@tauri-apps/api/event";
import { Toolbar } from "radix-ui";
import { type FC, useEffect, useState } from "react";
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
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { HeaderFileInfo } from "./HeaderFileInfo";
import { EditMenu } from "./modals/EditMenu";
import { FileMenu } from "./modals/FileMenu";
import { HelpMenu } from "./modals/HelpMenu";
import { HomeMenu } from "./modals/HomeMenu";
import { ToolMenu } from "./modals/ToolMenu";
import { useTopMenuActions } from "./useTopMenuActions";

const useWindowSize = () => {
	const [windowSize, setWindowSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});

	useEffect(() => {
		const handleResize = () => {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return windowSize;
};

export const TopMenu: FC = () => {
	const { width } = useWindowSize();
	const showHomeButton = width < 800;
	const menu = useTopMenuActions();

	useKeyBindingAtom(keyNewFileAtom, menu.onNewFile, [
		menu.onNewFile,
	]);
	useKeyBindingAtom(keyOpenFileAtom, menu.onOpenFile, [
		menu.onOpenFile,
	]);
	useKeyBindingAtom(keySaveFileAtom, menu.onSaveFile, [
		menu.onSaveFile,
	]);
	useKeyBindingAtom(keyUndoAtom, menu.onUndo, [menu.onUndo]);
	useKeyBindingAtom(keyRedoAtom, menu.onRedo, [menu.onRedo]);
	useKeyBindingAtom(
		keySelectAllAtom,
		menu.onUnselectAll,
		[menu.onUnselectAll],
	);
	useKeyBindingAtom(keySelectAllAtom, menu.onSelectAll, [
		menu.onSelectAll,
	]);
	useKeyBindingAtom(
		keySelectInvertedAtom,
		menu.onSelectInverted,
		[menu.onSelectInverted],
	);
	useKeyBindingAtom(
		keySelectWordsOfMatchedSelectionAtom,
		menu.onSelectWordsOfMatchedSelection,
		[menu.onSelectWordsOfMatchedSelection],
	);
	useKeyBindingAtom(
		keyDeleteSelectionAtom,
		menu.onDeleteSelection,
		[menu.onDeleteSelection],
	);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) return;

		let unlisten: (() => void) | null = null;
		(async () => {
			unlisten = await listen<string>("native-menu-action", (event) => {
				switch (event.payload) {
					case "file.new":
						menu.onNewFile();
						break;
					case "file.open":
						void menu.onOpenFile();
						break;
					case "file.save":
						void menu.onSaveFile();
						break;
					case "file.saveAs":
						void menu.onSaveFileAs();
						break;
					case "file.openFromAppleMusic":
						menu.onOpenFromAppleMusic();
						break;
					case "file.openHistoryRestore":
						menu.onOpenHistoryRestore();
						break;
					case "file.openFromClipboard":
						void menu.onOpenFileFromClipboard();
						break;
					case "file.saveToClipboard":
						void menu.onSaveFileToClipboard();
						break;
					case "edit.undo":
						menu.onUndo();
						break;
					case "edit.redo":
						menu.onRedo();
						break;
					case "edit.selectAll":
						menu.onSelectAll();
						break;
					case "edit.unselectAll":
						menu.onUnselectAll();
						break;
					case "edit.selectInverted":
						menu.onSelectInverted();
						break;
					case "edit.selectWordsOfMatchedSelection":
						menu.onSelectWordsOfMatchedSelection();
						break;
					case "edit.deleteSelection":
						menu.onDeleteSelection();
						break;
					case "edit.timeShift":
						menu.onOpenTimeShift();
						break;
					case "edit.metadata":
						menu.onOpenMetadataEditor();
						break;
					case "edit.themeAuto":
						menu.onSetThemeAuto();
						break;
					case "edit.themeLight":
						menu.onSetThemeLight();
						break;
					case "edit.themeDark":
						menu.onSetThemeDark();
						break;
					case "edit.settings":
						menu.onOpenSettings();
						break;
					case "tool.autoSegment":
						menu.onAutoSegment();
						break;
					case "tool.rubySegment":
						menu.onRubySegment();
						break;
					case "tool.advancedSegment":
						menu.onOpenAdvancedSegmentation();
						break;
					case "tool.syncLineTimestamps":
						menu.onSyncLineTimestamps();
						break;
					case "tool.distributeRomanization":
						menu.onOpenDistributeRomanization();
						break;
					case "tool.checkRomanizationWarnings":
						menu.onCheckRomanizationWarnings();
						break;
					case "tool.autoRuby":
						menu.onAutoRuby();
						break;
					case "tool.syncInputOffset":
						menu.onOpenSyncInputOffset();
						break;
					case "tool.latencyTest":
						menu.onOpenLatencyTest();
						break;
					case "help.github":
						void menu.onOpenGitHub();
						break;
					case "help.wiki":
						void menu.onOpenWiki();
						break;
					default:
						break;
				}
			});
		})();

		return () => {
			unlisten?.();
		};
	}, [
		menu.onNewFile,
		menu.onOpenFile,
		menu.onSaveFile,
		menu.onSaveFileAs,
		menu.onOpenFromAppleMusic,
		menu.onOpenHistoryRestore,
		menu.onOpenFileFromClipboard,
		menu.onSaveFileToClipboard,
		menu.onUndo,
		menu.onRedo,
		menu.onSelectAll,
		menu.onUnselectAll,
		menu.onSelectInverted,
		menu.onSelectWordsOfMatchedSelection,
		menu.onDeleteSelection,
		menu.onOpenMetadataEditor,
		menu.onSetThemeAuto,
		menu.onSetThemeLight,
		menu.onSetThemeDark,
		menu.onOpenSettings,
		menu.onAutoSegment,
		menu.onRubySegment,
		menu.onOpenAdvancedSegmentation,
		menu.onSyncLineTimestamps,
		menu.onOpenDistributeRomanization,
		menu.onCheckRomanizationWarnings,
		menu.onAutoRuby,
		menu.onOpenSyncInputOffset,
		menu.onOpenLatencyTest,
		menu.onOpenTimeShift,
		menu.onOpenGitHub,
		menu.onOpenWiki,
	]);

	return (
		<Flex
			p="2"
			pr="0"
			align="center"
			gap="2"
			style={{
				whiteSpace: "nowrap",
			}}
		>
			{showHomeButton ? (
				<HomeMenu />
			) : (
				<Toolbar.Root>
					<FileMenu
						variant="toolbar"
						buttonStyle={{
							borderTopRightRadius: "0",
							borderBottomRightRadius: "0",
							marginRight: "0px",
						}}
					/>
					<EditMenu
						variant="toolbar"
						triggerStyle={{
							borderRadius: "0",
							marginRight: "0px",
						}}
					/>
					<ToolMenu
						variant="toolbar"
						triggerStyle={{
							borderRadius: "0",
							marginRight: "0px",
						}}
					/>
					<HelpMenu
						variant="toolbar"
						buttonStyle={{
							borderTopLeftRadius: "0",
							borderBottomLeftRadius: "0",
						}}
					/>
				</Toolbar.Root>
			)}
			<Box style={{ marginLeft: "16px" }}>
				<HeaderFileInfo />
			</Box>
		</Flex>
	);
};
