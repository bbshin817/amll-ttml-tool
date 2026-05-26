import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import {
	Card,
	Flex,
	Heading,
	Link,
	Text,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

export const SettingsAboutTab = () => {
	const { t } = useTranslation();

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
		</Flex>
	);
};
