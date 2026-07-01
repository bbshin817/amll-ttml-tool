import { Button, DropdownMenu } from "@radix-ui/themes";
import type { CSSProperties } from "react";
import { Toolbar } from "radix-ui";
import { Trans, useTranslation } from "react-i18next";
import { useTopMenuActions } from "../useTopMenuActions";

type ToolMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const ToolMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();

	return (
		<>
			<DropdownMenu.Item onSelect={menu.onSyncLineTimestamps}>
				{t("topBar.menu.syncLineTimestamps", "行のタイムスタンプを同期")}
			</DropdownMenu.Item>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.resetTiming.index", "タイミングをリセット")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onResetAllWordTimings}>
						{t("topBar.menu.resetTiming.words", "すべての音節（行タイミングは保持）")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onResetAllTimings}>
						{t("topBar.menu.resetTiming.all", "すべての行")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.perWordRomanization.index", "単語ごとのローマ字")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onOpenDistributeRomanization}>
						{t("topBar.menu.perWordRomanization.distribute", "ローマ字を分配…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onCheckRomanizationWarnings}>
						{t("topBar.menu.perWordRomanization.check", "単語ごとのローマ字を確認")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={menu.onAutoRuby}>
				{t("topBar.menu.perWordRomanization.autoRuby", "自動ルビ")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenLatencyTest}>
				{t("settingsDialog.common.latencyTest", "音声／入力レイテンシのテスト")}
			</DropdownMenu.Item>
		</>
	);
};

export const ToolMenu = (props: ToolMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.tool">ツール</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<ToolMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.tool">ツール</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<ToolMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
