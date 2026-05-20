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

import { useCurrentLocation } from "$/modules/lyric-editor/utils/lyric-states.ts";
import {
	displayRomanizationInSyncAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	autoScrollActiveLineAtom,
	currentEmptyBeatAtom,
	showTouchSyncPanelAtom,
	syncTimeOffsetAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import {
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";
import { bgLyricIgnoreSyncAtom, lyricLinesAtom } from "$/states/main.ts";
import {
	Checkbox,
	Flex,
	Grid,
	Slider,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { KeyBinding } from "../KeyBinding/index.tsx";
import { RibbonFrame, RibbonSection } from "./common";

const EmptyBeatField = () => {
	const [currentEmptyBeat, setCurrentEmptyBeat] = useAtom(currentEmptyBeatAtom);
	const currentWordEmptyBeat = useCurrentLocation()?.word.emptyBeat || 0;
	const { t } = useTranslation();

	return (
		<>
			<Text wrap="nowrap" size="1">
				{t("ribbonBar.syncMode.currentEmptyBeat", "現在の空拍")}
			</Text>
			<Slider
				value={[currentEmptyBeat]}
				onValueChange={(v) => setCurrentEmptyBeat(v[0])}
				min={0}
				max={currentWordEmptyBeat}
				step={1}
				disabled={currentWordEmptyBeat === 0}
			/>
			<div />
			<Text wrap="nowrap" align="center" size="1">
				{currentEmptyBeat} / {currentWordEmptyBeat}
			</Text>
		</>
	);
};

export const SyncModeRibbonBar: FC = forwardRef<HTMLDivElement>(
	(_props, ref) => {
		const [visualizeTimestampUpdate, setVisualizeTimestampUpdate] = useAtom(
			visualizeTimestampUpdateAtom,
		);
		const [showTouchSyncPanel, setShowTouchSyncPanel] = useAtom(
			showTouchSyncPanelAtom,
		);
		const [showTimestamps, setShowTimestamps] = useAtom(showTimestampsAtom);
		const [highlightErrors, setHighlightErrors] = useAtom(highlightErrorsAtom);
		const [highlightActiveWord, setHighlightActiveWord] = useAtom(
			highlightActiveWordAtom,
		);
		const [displayRomanizationInSync, setdisplayRomanizationInSync] = useAtom(
			displayRomanizationInSyncAtom,
		);
		const [bgLyricIgnoreSync, setBgLyricIgnoreSync] = useAtom(
			bgLyricIgnoreSyncAtom,
		);
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const showWordRomanizationInput = useAtomValue(
			showWordRomanizationInputAtom,
		);
		const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
		const [autoScrollActiveLine, setAutoScrollActiveLine] = useAtom(
			autoScrollActiveLineAtom,
		);
		const { t } = useTranslation();

		return (
			<RibbonFrame ref={ref}>
				<RibbonSection
					label={t("ribbonBar.syncMode.currentEmptyBeat", "現在の空拍")}
				>
					<Grid columns="0fr 4em" gap="4" gapY="1" flexGrow="1" align="center">
						<EmptyBeatField />
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.syncAdjustment", "タイミング補正")}
				>
					<Grid columns="0fr 0fr" gap="4" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.timeOffset", "時間オフセット")}
						</Text>
						<TextField.Root
							type="number"
							step={1}
							size="1"
							style={{
								width: "8em",
							}}
							value={syncTimeOffset}
							onChange={(e) => setSyncTimeOffset(e.target.valueAsNumber)}
						>
							<TextField.Slot />
							<TextField.Slot>ms</TextField.Slot>
						</TextField.Root>
						<EmptyBeatField />
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.assistSettings", "アシスト設定")}
				>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.showTimestampUpdate", "タイムスタンプの更新を表示")}
						</Text>
						<Checkbox
							checked={visualizeTimestampUpdate}
							onCheckedChange={(v) => setVisualizeTimestampUpdate(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.touchSyncPanel", "タッチ同期パネル")}
						</Text>
						<Checkbox
							checked={showTouchSyncPanel}
							onCheckedChange={(v) => setShowTouchSyncPanel(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.bgLyricIgnoreSync", "バックボーカルを同期対象外にする")}
						</Text>
						<Checkbox
							checked={bgLyricIgnoreSync}
							onCheckedChange={(v) => {
								const next = !!v;
								setBgLyricIgnoreSync(next);
								editLyricLines((state) => {
									for (const line of state.lyricLines) {
										if (line.isBG) {
											line.ignoreSync = next;
										}
									}
									return state;
								});
							}}
						/>
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.displayOptions", "表示オプション")}
				>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.showTimestamps", "タイムスタンプを表示")}
						</Text>
						<Checkbox
							checked={showTimestamps}
							onCheckedChange={(v) => setShowTimestamps(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.highlightActiveWord", "アクティブな単語をハイライト")}
						</Text>
						<Checkbox
							checked={highlightActiveWord}
							onCheckedChange={(v) => setHighlightActiveWord(!!v)}
						/>
						<Text wrap="nowrap" size="1">
							{t("ribbonBar.syncMode.highlightErrors", "エラーをハイライト")}
						</Text>
						<Checkbox
							checked={highlightErrors}
							onCheckedChange={(v) => setHighlightErrors(!!v)}
						/>
						{showWordRomanizationInput && (
							<>
								<Text wrap="nowrap" size="1">
									{t("ribbonBar.syncMode.showPerWordRomanization", "単語ごとのローマ字を表示")}
								</Text>
								<Checkbox
									checked={displayRomanizationInSync}
									onCheckedChange={(v) => setdisplayRomanizationInSync(!!v)}
								/>
							</>
						)}
					</Grid>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.keyBindingReference", "ショートカット一覧")}
				>
					<Flex gap="4">
						<Grid
							columns="0fr 0fr"
							gap="4"
							gapY="1"
							flexGrow="1"
							align="center"
							justify="center"
						>
							<Text wrap="nowrap" size="1">
								{t("ribbonBar.syncMode.startSync", "開始位置を記録")}
							</Text>
							<KeyBinding kbdAtom={keySyncStartAtom} />
							<Text wrap="nowrap" size="1">
								{t("ribbonBar.syncMode.continuousSync", "確定")}
							</Text>
							<KeyBinding kbdAtom={keySyncNextAtom} />
							<Text wrap="nowrap" size="1">
								{t("ribbonBar.syncMode.endSync", "終了位置を記録")}
							</Text>
							<KeyBinding kbdAtom={keySyncEndAtom} />
						</Grid>
					</Flex>
				</RibbonSection>
				<RibbonSection
					label={t("ribbonBar.syncMode.autoScroll", "自動スクロール")}
				>
					<Grid columns="0fr 0fr" gap="2" gapY="1" flexGrow="1" align="center">
						<Text wrap="nowrap" size="1">
							{t(
								"ribbonBar.syncMode.autoScrollActiveLine",
								"アクティブな行へ自動スクロール",
							)}
						</Text>
						<Checkbox
							checked={autoScrollActiveLine}
							onCheckedChange={(v) => setAutoScrollActiveLine(!!v)}
						/>
					</Grid>
				</RibbonSection>
			</RibbonFrame>
		);
	},
);

export default SyncModeRibbonBar;
