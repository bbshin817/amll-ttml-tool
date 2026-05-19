import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import {
	CheckmarkCircle24Regular,
	CloudArrowDown24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	Link,
	Progress,
	Text,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { useAppUpdate } from "$/utils/useAppUpdate";

export const SettingsAboutTab = () => {
	const { t } = useTranslation();
	const { status, update, progress, installUpdate } = useAppUpdate();

	const showUpdateCard = ["available", "downloading", "ready"].includes(status);

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="1">
				<Heading size="4">
					{t("aboutModal.appName", "Apple Music-like lyrics TTML Tools")}
				</Heading>
				<Text as="div" size="2" color="gray">
					{t("aboutModal.description", "Apple Music風歌詞向けの、単語単位の TTML 編集・タイムライン調整ツール")}
				</Text>
			</Flex>

			<Card>
				<Flex direction="column" gap="2">
					<Flex direction="column" gap="1">
						<Text as="div" size="2">
							{t("aboutModal.buildDate", "ビルド日: {date}", {
								date: BUILD_TIME,
							})}
						</Text>
						<Text as="div" size="2">
							{t("aboutModal.gitCommit", "Git コミット: {commit}", {
								commit:
									GIT_COMMIT === "unknown" ? (
										t("aboutModal.unknown", "unknown")
									) : (
										<Link
											href={`https://github.com/amll-dev/amll-ttml-tool/commit/${GIT_COMMIT}`}
											target="_blank"
											rel="noreferrer"
										>
											{GIT_COMMIT}
										</Link>
									),
							})}
						</Text>
					</Flex>
				</Flex>
			</Card>

			{showUpdateCard && (
				<Card>
					<Flex direction="column" gap="3">
						<Flex align="center" gap="2">
							<Heading size="3">
								{t("settings.about.update", "アップデート")}
							</Heading>
							{status === "available" && (
								<Badge color="green">
									{t("settings.about.newVersion", "新しいバージョン")}
								</Badge>
							)}
						</Flex>

						<Box>
							{status === "available" && update && (
								<Flex direction="column" gap="3">
									<Flex
										direction="column"
										gap="1"
										style={{
											padding: "8px",
											background: "var(--gray-3)",
											borderRadius: "6px",
										}}
									>
										<Text weight="bold" size="2">
											{update.version}
										</Text>
										<Text size="1" style={{ whiteSpace: "pre-wrap" }}>
											{update.body}
										</Text>
									</Flex>
									<Flex gap="3">
										<Button onClick={installUpdate}>
											<CloudArrowDown24Regular />
											{t("settings.about.updateNow", "今すぐアップデート")}
										</Button>
									</Flex>
								</Flex>
							)}

							{status === "downloading" && (
								<Flex direction="column" gap="2">
									<Flex justify="between">
										<Text size="2">
											{t("settings.about.downloading", "アップデートをダウンロード中…")}
										</Text>
										<Text size="2">{progress.toFixed(0)}%</Text>
									</Flex>
									<Progress value={progress} />
								</Flex>
							)}

							{status === "ready" && (
								<Flex direction="column" gap="2">
									<Flex align="center" gap="2">
										<CheckmarkCircle24Regular color="var(--green-9)" />
										<Text size="2">
											{t("settings.about.ready", "アップデートの準備ができました。反映するにはアプリケーションを再起動してください。")}
										</Text>
									</Flex>
									<Button onClick={() => window.location.reload()}>
										{t("settings.about.restart", "再起動")}
									</Button>
								</Flex>
							)}
						</Box>
					</Flex>
				</Card>
			)}
		</Flex>
	);
};
