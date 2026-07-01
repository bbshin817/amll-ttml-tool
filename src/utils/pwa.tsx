import { registerSW } from "virtual:pwa-register";

// ServiceWorker / PWA は廃止済み。
// vite-plugin-pwa の selfDestroying により生成される自己破棄型 SW を登録し、
// 既存ユーザーに残っている ServiceWorker とキャッシュを解除・削除させる。
// トーストなどの通知は一切出さない。
if (!import.meta.env.TAURI_ENV_PLATFORM) {
	registerSW({ immediate: true });
}
