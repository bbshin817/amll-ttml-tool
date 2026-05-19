import { registerSW } from "virtual:pwa-register";
import { Button, Flex } from "@radix-ui/themes";
import { t } from "i18next";
import { toast } from "react-toastify";

if (!import.meta.env.TAURI_ENV_PLATFORM) {
	const refresh = registerSW({
		onOfflineReady() {
			toast.info(
				t(
					"pwa.offlineReady",
					"オフラインで利用できるようにサイトをキャッシュしました",
				),
			);
		},
		onNeedRefresh() {
			toast.info(
				<Flex direction="column" gap="2" align="stretch">
					<div>
						{t("pwa.updateRefresh", "サイトが更新されました。最新版を使用するには再読み込みしてください")}
					</div>
					<Button
						size="2"
						onClick={() => {
							refresh(true);
						}}
					>
						{t("pwa.refresh", "更新")}
					</Button>
				</Flex>,
			);
		},
	});
}
