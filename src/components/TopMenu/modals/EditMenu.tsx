import { Button, DropdownMenu } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import type { CSSProperties } from "react";
import { Toolbar } from "radix-ui";
import { Trans, useTranslation } from "react-i18next";
import { DarkMode, darkModeAtom, selectedWordsAtom } from "$/states/main.ts";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const selectedWordsSize = useAtomValue(selectedWordsAtom).size;
	const darkMode = useAtomValue(darkModeAtom);

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onUndo}
				shortcut={formatKeyBindings(menu.undoKey)}
				disabled={menu.undoDisabled}
			>
				<Trans i18nKey="topBar.menu.undo">元に戻す</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onRedo}
				shortcut={formatKeyBindings(menu.redoKey)}
				disabled={menu.redoDisabled}
			>
				<Trans i18nKey="topBar.menu.redo">やり直し</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onSelectAll}
				shortcut={formatKeyBindings(menu.selectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.selectAllLines">すべての行を選択</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onUnselectAll}
				shortcut={formatKeyBindings(menu.unselectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.unselectAllLines">すべての行の選択を解除</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSelectInverted}
				shortcut={formatKeyBindings(menu.selectInvertedLinesKey)}
			>
				<Trans i18nKey="topBar.menu.invertSelectAllLines">行の選択を反転</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSelectWordsOfMatchedSelection}
				shortcut={formatKeyBindings(menu.selectWordsOfMatchedSelectionKey)}
			>
				<Trans i18nKey="topBar.menu.selectWordsOfMatchedSelection">選択内容と一致する単語を選択</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onDeleteSelection}
				shortcut={formatKeyBindings(menu.deleteSelectionKey)}
			>
				{t("contextMenu.deleteWords", {
					count: selectedWordsSize,
					defaultValue: "{{count}}個の単語を削除",
				})}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenTimeShift}>
				{t("topBar.menu.timeShift", "時間をシフト…")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenMetadataEditor}>
				<Trans i18nKey="topBar.menu.editMetadata">歌詞メタデータを編集…</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.theme", "テーマ")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onSetThemeAuto}>
						{darkMode === DarkMode.Auto ? "✓ " : ""}
						{t("topBar.menu.themeAuto", "デバイスのデフォルト")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onSetThemeLight}>
						{darkMode === DarkMode.Light ? "✓ " : ""}
						{t("topBar.menu.themeLight", "ライト")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onSetThemeDark}>
						{darkMode === DarkMode.Dark ? "✓ " : ""}
						{t("topBar.menu.themeDark", "ダーク")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenSettings}>
				<Trans i18nKey="settingsDialog.title">環境設定</Trans>
			</DropdownMenu.Item>
		</>
	);
};

export const EditMenu = (props: EditMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.edit">編集</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<EditMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.edit">編集</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<EditMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
