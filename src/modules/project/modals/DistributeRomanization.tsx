import { InfoRegular } from "@fluentui/react-icons";
import {
	Button,
	Callout,
	Dialog,
	Flex,
	RadioGroup,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { predictLineRomanization } from "$/modules/segmentation/utils/Transliteration/distributor";
import { applyRomanizationWarnings } from "$/modules/segmentation/utils/Transliteration/roman-warning";
import { distributeRomanizationDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";

type Scope = "all" | "selected" | "selected-following" | "custom";

export const DistributeRomanizationDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(distributeRomanizationDialogAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);

	const [scope, setScope] = useState<Scope>("all");
	const [customStart, setCustomStart] = useState("1");
	const [customEnd, setCustomEnd] = useState("1");

	const hasSelection = selectedLines.size > 0;
	const totalLines = lyricLines.lyricLines.length;

	useEffect(() => {
		if (open) {
			if (hasSelection) {
				setScope("selected");
			} else {
				setScope("all");
			}
			setCustomEnd(totalLines.toString());
		}
	}, [open, hasSelection, totalLines]);

	const handleConfirm = () => {
		const targetLineIndices = new Set<number>();

		if (scope === "all") {
			for (let i = 0; i < totalLines; i++) targetLineIndices.add(i);
		} else if (scope === "selected") {
			lyricLines.lyricLines.forEach((line, index) => {
				if (selectedLines.has(line.id)) {
					targetLineIndices.add(index);
				}
			});
		} else if (scope === "selected-following") {
			let firstSelectedIndex = -1;
			lyricLines.lyricLines.forEach((line, index) => {
				if (selectedLines.has(line.id)) {
					if (firstSelectedIndex === -1 || index < firstSelectedIndex) {
						firstSelectedIndex = index;
					}
				}
			});
			if (firstSelectedIndex !== -1) {
				for (let i = firstSelectedIndex; i < totalLines; i++) {
					targetLineIndices.add(i);
				}
			}
		} else if (scope === "custom") {
			const start = parseInt(customStart, 10);
			const end = parseInt(customEnd, 10);
			if (!Number.isNaN(start) && !Number.isNaN(end)) {
				for (
					let i = Math.max(0, start - 1);
					i < Math.min(totalLines, end);
					i++
				) {
					targetLineIndices.add(i);
				}
			}
		}

		setLyricLines((draft) => {
			draft.lyricLines.forEach((line, index) => {
				if (targetLineIndices.has(index)) {
					const fullRoman = line.romanLyric || "";
					if (line.words.length > 0 && fullRoman.trim() !== "") {
						try {
							const results = predictLineRomanization(line.words, fullRoman);

							line.words.forEach((word, wordIndex) => {
								if (results[wordIndex]) {
									word.romanWord = results[wordIndex];
								}
							});
							applyRomanizationWarnings(line.words);
						} catch (e) {
							console.error(
								`Failed to distribute romanization for line ${index + 1}`,
								e,
							);
						}
					}
				}
			});
		});

		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="450px">
				<Dialog.Title>
					{t("distributeRomanDialog.title", "行のローマ字を単語ごとに分配")}
				</Dialog.Title>

				<Flex direction="column" gap="4">
					<Callout.Root color="gray" size="1">
						<Callout.Icon>
							<InfoRegular />
						</Callout.Icon>
						<Callout.Text>
							{t("distributeRomanDialog.warning", "この操作では、行単位のローマ字表記を読み取り、各単語に分配します。アルゴリズムは日本語のローマ字表記向けに最適化されているため、他の言語では期待どおりに動作しない場合があります。")}
						</Callout.Text>
					</Callout.Root>

					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("common.applyScope", "適用範囲")}
						</Text>
						<RadioGroup.Root
							value={scope}
							onValueChange={(v) => setScope(v as Scope)}
						>
							<RadioGroup.Item value="all">
								{t("common.scope.all", "すべての歌詞行")}
							</RadioGroup.Item>

							<RadioGroup.Item value="selected" disabled={!hasSelection}>
								{t("common.scope.selected", "選択した歌詞行")}
								{hasSelection && ` (${selectedLines.size})`}
							</RadioGroup.Item>

							<RadioGroup.Item
								value="selected-following"
								disabled={!hasSelection}
							>
								{t("common.scope.selectedFollowing", "選択行と以降")}
							</RadioGroup.Item>

							<RadioGroup.Item value="custom">
								{t("common.scope.custom", "カスタム範囲")}
							</RadioGroup.Item>
						</RadioGroup.Root>
					</Flex>

					{scope === "custom" && (
						<Flex align="center" gap="2" ml="4">
							<Text size="2">{t("common.fromLine", "開始行")}</Text>
							<TextField.Root
								style={{ width: "60px" }}
								size="1"
								type="number"
								value={customStart}
								onChange={(e) => setCustomStart(e.target.value)}
							/>
							<Text size="2">{t("common.toLine", "終了行")}</Text>
							<TextField.Root
								style={{ width: "60px" }}
								size="1"
								type="number"
								value={customEnd}
								onChange={(e) => setCustomEnd(e.target.value)}
							/>
							<Text size="2">{t("common.line", "行")}</Text>
						</Flex>
					)}
				</Flex>

				<Flex gap="3" mt="5" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "キャンセル")}
						</Button>
					</Dialog.Close>
					<Button onClick={handleConfirm}>{t("common.apply", "適用")}</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
