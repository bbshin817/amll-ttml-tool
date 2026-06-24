/**
 * @description 连字符分词加载器
 * 用于按需异步加载不同语言的断词模式
 */

import type { HyphenatorFunc } from "../types";

/**
 * @description 支持的分词语言列表
 * @property label 语言名称
 * @property value 传递给加载器的语言代码，对应 hyphen 库的子包路径
 */
export const SUPPORTED_LANGUAGES = [
	{ label: "English (US)", value: "en-us" },
	{ label: "Deutsch (German)", value: "de" },
	{ label: "Français (French)", value: "fr" },
	{ label: "Español (Spanish)", value: "es" },
	{ label: "Bahasa Indonesia (Indonesian)", value: "id" },
	{ label: "Italiano (Italian)", value: "it" },
	{ label: "Português (Portuguese)", value: "pt" },
	{ label: "Pусский (Russian)", value: "ru" },
];

/**
 * @description 分词函数的缓存
 */
const hyphenatorCache: Record<string, HyphenatorFunc> = {};

/**
 * @description 加载指定语言的分词函数
 * @param lang 目标语言代码 (例: `en-us` `de`)，必须是 `SUPPORTED_LANGUAGES` 中的 value
 * @returns {Promise<HyphenatorFunc | null>}
 * 返回一个 Promise
 * - 成功时兑现为该语言的分词函数
 * - 失败或语言不支持时兑现为 null
 */
export async function loadHyphenator(
	lang: string,
): Promise<HyphenatorFunc | null> {
	if (hyphenatorCache[lang]) {
		return hyphenatorCache[lang];
	}

	try {
		let imported: {
			hyphenateSync?: HyphenatorFunc;
			default?: { hyphenateSync?: HyphenatorFunc };
		};
		switch (lang) {
			case "en-us":
				imported = await import("hyphen/en-us");
				break;
			case "de":
				imported = await import("hyphen/de");
				break;
			case "fr":
				imported = await import("hyphen/fr");
				break;
			case "es":
				imported = await import("hyphen/es");
				break;
			case "id":
				imported = await import("hyphen/id");
				break;
			case "it":
				imported = await import("hyphen/it");
				break;
			case "pt":
				imported = await import("hyphen/pt");
				break;
			case "ru":
				imported = await import("hyphen/ru");
				break;
			default:
				throw new Error(`不支持的语言: ${lang}`);
		}

		// hyphen は CommonJS (`module.exports = factory()`) のため、Vite/esbuild の
		// CJS 相互運用では名前付きエクスポート(hyphenateSync)が名前空間の直下には現れず
		// `default` の配下に入る。直下と default の両方を見て確実に取り出す。
		// これを怠ると関数が undefined になり、英語の音節分割が無効化される。
		const func = imported.hyphenateSync ?? imported.default?.hyphenateSync;
		if (typeof func === "function") {
			hyphenatorCache[lang] = func;
			return func;
		}
		return null;
	} catch (error) {
		console.error(`${lang} の分詞エンジンの読み込みに失敗しました:`, error);
		return null;
	}
}
