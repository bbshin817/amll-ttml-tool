import { AddRegular, SubtractRegular } from "@fluentui/react-icons";
import { Button, Dialog, Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { syncTimeOffsetAtom } from "$/modules/settings/states/sync.ts";
import { syncInputOffsetDialogAtom } from "$/states/dialogs.ts";

const DEFAULT_SYNC_INPUT_OFFSET_MS = -200;

export const SyncInputOffsetDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(syncInputOffsetDialogAtom);
	const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
	const [offsetInput, setOffsetInput] = useState(String(syncTimeOffset));

	useEffect(() => {
		if (open) {
			setOffsetInput(String(syncTimeOffset));
		}
	}, [open, syncTimeOffset]);

	const adjustOffset = useCallback((delta: number) => {
		const current = Number.parseInt(offsetInput, 10);
		const base = Number.isNaN(current) ? 0 : current;
		setOffsetInput(String(base + delta));
	}, [offsetInput]);

	const handleApply = useCallback(() => {
		const parsed = Number.parseInt(offsetInput, 10);
		setSyncTimeOffset(Number.isNaN(parsed) ? syncTimeOffset : parsed);
		setOpen(false);
	}, [offsetInput, setOpen, setSyncTimeOffset, syncTimeOffset]);

	const handleReset = useCallback(() => {
		setOffsetInput(String(DEFAULT_SYNC_INPUT_OFFSET_MS));
	}, []);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="440px">
				<Dialog.Title>
					{t("syncInputOffsetDialog.title", "音声遅延（キー入力補正）")}
				</Dialog.Title>
				<Dialog.Description mb="4">
					{t(
						"syncInputOffsetDialog.description",
						"打鍵タイミング判定の補正値を ms 単位で調整します。Bluetooth 利用時は -200ms が目安です。",
					)}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<Text size="2" weight="bold">
						{t("syncInputOffsetDialog.offsetLabel", "入力タイミング補正（ms）")}
					</Text>
					<Flex gap="2" align="center">
						<IconButton variant="soft" onClick={() => adjustOffset(-10)} title="-10ms">
							<SubtractRegular />
						</IconButton>
						<IconButton variant="soft" onClick={() => adjustOffset(-50)} title="-50ms">
							<SubtractRegular />
						</IconButton>
						<TextField.Root
							type="number"
							step="1"
							value={offsetInput}
							onChange={(e) => setOffsetInput(e.target.value)}
							placeholder="-200"
							style={{ flexGrow: 1 }}
						/>
						<IconButton variant="soft" onClick={() => adjustOffset(10)} title="+10ms">
							<AddRegular />
						</IconButton>
						<IconButton variant="soft" onClick={() => adjustOffset(50)} title="+50ms">
							<AddRegular />
						</IconButton>
					</Flex>
					<Text size="1" color="gray">
						{t(
							"syncInputOffsetDialog.hint",
							"正の値で遅めに判定（Bluetooth 向け）、負の値で早めに判定します。",
						)}
					</Text>
				</Flex>

				<Flex gap="3" mt="5" justify="end">
					<Button variant="soft" color="gray" onClick={handleReset}>
						{t("syncInputOffsetDialog.resetDefault", "既定値（-200ms）に戻す")}
					</Button>
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "キャンセル")}
						</Button>
					</Dialog.Close>
					<Button onClick={handleApply}>{t("common.apply", "適用")}</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
