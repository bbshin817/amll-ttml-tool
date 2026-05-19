import resources from "virtual:i18next-loader";
import {
	ContentView24Regular,
	History24Regular,
	Keyboard12324Regular,
	LocalLanguage24Regular,
	PaddingLeft24Regular,
	PaddingRight24Regular,
	Save24Regular,
	Speaker224Regular,
	Stack24Regular,
	Timer24Regular,
	TopSpeed24Regular,
} from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Select, Slider, Switch, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { playbackRateAtom, volumeAtom } from "$/modules/audio/states";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
	LayoutMode,
	layoutModeAtom,
	SyncJudgeMode,
	smartFirstWordAtom,
	smartLastWordAtom,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import {
	KeyBindingTriggerMode,
	keyBindingTriggerModeAtom,
} from "$/utils/keybindings";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";

const languageOptions: readonly string[] = Object.keys(resources);

export const SettingsCommonTab = () => {
	const [layoutMode, setLayoutMode] = useAtom(layoutModeAtom);
	const [syncJudgeMode, setSyncJudgeMode] = useAtom(syncJudgeModeAtom);
	const [keyBindingTriggerMode, setKeyBindingTriggerMode] = useAtom(
		keyBindingTriggerModeAtom,
	);
	const [smartFirstWord, setSmartFirstWord] = useAtom(smartFirstWordAtom);
	const [smartLastWord, setSmartLastWord] = useAtom(smartLastWordAtom);
	const [volume, setVolume] = useAtom(volumeAtom);
	const [playbackRate, setPlaybackRate] = useAtom(playbackRateAtom);
	const [autosaveEnabled, setAutosaveEnabled] = useAtom(autosaveEnabledAtom);
	const [autosaveInterval, setAutosaveInterval] = useAtom(autosaveIntervalAtom);
	const [autosaveLimit, setAutosaveLimit] = useAtom(autosaveLimitAtom);
	const { t, i18n } = useTranslation();
	const currentLanguage = i18n.resolvedLanguage || i18n.language;
	const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

	const getLanguageName = (code: string, locale: string) => {
		try {
			// Define a minimal interface to avoid using any
			interface DisplayNamesLike {
				new (
					locales: string | string[],
					options: { type: string },
				): {
					of: (code: string) => string | undefined;
				};
			}
			const DN: DisplayNamesLike | undefined = (
				Intl as unknown as {
					DisplayNames?: DisplayNamesLike;
				}
			).DisplayNames;
			if (DN) {
				const dn = new DN([locale], { type: "language" });
				const nativeDn = new DN([code], { type: "language" });
				const name = dn.of(code);
				const nativeName = nativeDn.of(code) || code;
				if (name && code !== locale) return `${nativeName} (${name})`;
				return nativeName;
			}
		} catch {
			// ignore errors and fallback
		}
		return code;
	};

	if (showBackgroundSettings) {
		return (
			<SettingsCustomBackgroundSettings
				onClose={() => setShowBackgroundSettings(false)}
			/>
		);
	}

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.display", "表示")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<LocalLanguage24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>{t("settings.common.language", "表示言語")}</Text>
									<Text size="1" color="gray">
										{t("settings.common.languageDesc", "インターフェースに表示する言語を選択します")}
									</Text>
								</Flex>

								<Select.Root
									value={currentLanguage}
									onValueChange={(lng) => {
										i18n.changeLanguage(lng).then(() => {
											localStorage.setItem("language", lng);
										});
									}}
								>
									<Select.Trigger />
									<Select.Content>
										{languageOptions.map((code) => (
											<Select.Item key={code} value={code}>
												{getLanguageName(code, currentLanguage)}
											</Select.Item>
										))}
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<ContentView24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>{t("settings.common.layoutMode", "エディターのレイアウト")}</Text>
									<Text size="1" color="gray">
										{t("settings.common.layoutModeDesc.line1", "シンプルレイアウトで基本的な操作を行えます")}
										<br />
										{t("settings.common.layoutModeDesc.line2", "より効率よく同期したい場合は高度モードに切り替えてください")}
									</Text>
								</Flex>

								<Select.Root
									value={layoutMode}
									onValueChange={(v) => setLayoutMode(v as LayoutMode)}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value={LayoutMode.Simple}>
											{t("settings.common.layoutModeOptions.simple", "シンプルモード")}
										</Select.Item>
										<Select.Item value={LayoutMode.Advance}>
											{t("settings.common.layoutModeOptions.advance", "高度モード")}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<SettingsCustomBackgroundCard
					onOpen={() => setShowBackgroundSettings(true)}
				/>
			</Flex>

			<Flex direction="column" gap="3">
				<Heading size="4">{t("settings.group.timing", "タイミング")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<Timer24Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.syncJudgeMode", "同期タイムスタンプの判定方法")}
									</Text>
									<Text size="1" color="gray">
										{t("settings.common.syncJudgeModeDesc", "同期時にタイムスタンプをどのタイミングで判定するかを設定します。デフォルトは「最初のキー押下時刻」です。")}
									</Text>
								</Flex>

								<Select.Root
									value={syncJudgeMode}
									onValueChange={(v) => setSyncJudgeMode(v as SyncJudgeMode)}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value={SyncJudgeMode.FirstKeyDownTime}>
											{t("settings.common.syncJudgeModeOptions.firstKeyDown", "最初にキーを押した時刻")}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.LastKeyUpTime}>
											{t("settings.common.syncJudgeModeOptions.lastKeyUp", "最後にキーを離した時刻")}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.MiddleKeyTime}>
											{t("settings.common.syncJudgeModeOptions.middleKey", "キーを押してから離すまでの中間")}
										</Select.Item>
										<Select.Item value={SyncJudgeMode.FirstKeyDownTimeLegacy}>
											{t("settings.common.syncJudgeModeOptions.firstKeyDownLegacy", "最初にキーを押した時刻（旧方式）")}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Keyboard12324Regular />
						<Box flexGrow="1">
							<Flex align="center" justify="between" gap="4">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.common.keyBindingTrigger", "ショートカットの発動タイミング")}
									</Text>
									<Text size="1" color="gray">
										{t("settings.common.keyBindingTriggerDesc", "ショートカットを、キーを押したときに発動するか、離したときに発動するかを設定します。")}
									</Text>
								</Flex>

								<Select.Root
									value={keyBindingTriggerMode}
									onValueChange={(v) =>
										setKeyBindingTriggerMode(v as KeyBindingTriggerMode)
									}
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value={KeyBindingTriggerMode.KeyDown}>
											{t("settings.common.keyBindingTriggerOptions.keyDown", "キー押下時に発動")}
										</Select.Item>
										<Select.Item value={KeyBindingTriggerMode.KeyUp}>
											{t("settings.common.keyBindingTriggerOptions.keyUp", "キー解放時に発動")}
										</Select.Item>
									</Select.Content>
								</Select.Root>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<PaddingLeft24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.smartFirstWord", "先頭単語のスマート同期")}
										</Text>
										<Text size="1" color="gray">
											{t("settings.common.smartFirstWordDesc", "行の最初の単語を同期する際、最初のキー入力では開始時刻のみを設定し、終了時刻はすぐには設定しません。")}
										</Text>
									</Flex>
									<Switch
										checked={smartFirstWord}
										onCheckedChange={setSmartFirstWord}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<PaddingRight24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Flex direction="column" gap="1">
										<Text>
											{t("settings.common.smartLastWord", "末尾単語のスマート同期")}
										</Text>
										<Text size="1" color="gray">
											{t("settings.common.smartLastWordDesc", "行の最後の単語を同期する際、キー入力で終了時刻を設定し、次の行の最初の単語の開始時刻は自動設定しません。")}
										</Text>
									</Flex>
									<Switch
										checked={smartLastWord}
										onCheckedChange={setSmartLastWord}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>
			</Flex>

			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.playback", "再生")}</Heading>

				<Card>
					<Flex gap="3" align="center">
						<Speaker224Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>{t("settings.common.volume", "音楽の音量")}</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{(volume * 100).toFixed()}%
									</Text>
								</Flex>
								<Slider
									min={0}
									max={1}
									defaultValue={[volume]}
									step={0.01}
									onValueChange={(v) => setVolume(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<TopSpeed24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>{t("settings.common.playbackRate", "再生速度")}</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{playbackRate.toFixed(2)}x
									</Text>
								</Flex>
								<Slider
									min={0.1}
									max={2}
									defaultValue={[playbackRate]}
									step={0.05}
									onValueChange={(v) => setPlaybackRate(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
			</Flex>

			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.group.autosave", "自動保存")}</Heading>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<Save24Regular />
							<Box flexGrow="1">
								<Flex gap="2" align="center" justify="between">
									<Text>
										{t("settings.common.autosave.enable", "自動保存を有効にする")}
									</Text>
									<Switch
										checked={autosaveEnabled}
										onCheckedChange={setAutosaveEnabled}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Text as="label">
						<Flex gap="3" align="center">
							<History24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="2" align="start">
									<Text>
										{t("settings.common.autosave.interval", "保存間隔（分）")}
									</Text>
									<TextField.Root
										type="number"
										disabled={!autosaveEnabled}
										value={autosaveInterval}
										onChange={(e) =>
											setAutosaveInterval(
												Math.max(1, Number.parseInt(e.target.value, 10) || 1),
											)
										}
									/>
								</Flex>
							</Box>
						</Flex>
					</Text>
				</Card>

				<Card>
					<Flex gap="3" align="center">
						<Stack24Regular />
						<Box flexGrow="1">
							<Flex direction="column" gap="2" align="start">
								<Flex
									align="center"
									justify="between"
									style={{ alignSelf: "stretch" }}
								>
									<Text>
										{t("settings.common.autosave.limit", "保持するスナップショット数")}
									</Text>
									<Text wrap="nowrap" color="gray" size="1">
										{autosaveLimit}
									</Text>
								</Flex>
								<Slider
									min={1}
									max={50}
									disabled={!autosaveEnabled}
									value={[autosaveLimit]}
									step={1}
									onValueChange={(v) => setAutosaveLimit(v[0])}
								/>
							</Flex>
						</Box>
					</Flex>
				</Card>
			</Flex>
		</Flex>
	);
};
