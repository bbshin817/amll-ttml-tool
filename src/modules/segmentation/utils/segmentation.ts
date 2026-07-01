/**
 * @description 分词引擎
 */

import { type LyricLine, type LyricWord, newLyricWord } from "$/types/ttml";
import TinySegmenter from "tiny-segmenter";
import { CharType, type SegmentationConfig } from "../types";
import {
	escapeRegExp,
	getCharType,
	getMergeDirection,
	MergeDirection,
	PUNCT_AMBIGUOUS_QUOTES,
} from "./charUtils";

const tinySegmenter = new TinySegmenter();

/**
 * 拗音・促音（小書き仮名）・長音符（音引き）・撥音「ん」。
 * CJK を1文字ずつ分割するときも、これらは直前の仮名と結合させて
 * 1つのトークンにする（例:「シャ」を「シ」「ャ」に、「らん」を「ら」「ん」に
 * 分けない）。撥音・促音・長音符は音韻上は独立した拍だが、歌唱・カラオケ表示
 * 上は直前の仮名と同じタイミングで扱うのが自然なため結合させる。
 */
const kanaCombiningMarkRegexp =
	/[ぁぃぅぇぉっゃゅょゎゕゖんァィゥェォッャュョヮヵヶンーｧｨｩｪｫｬｭｮｯｰﾝ]/u;
const japaneseTokenizerHintRegexp = /[\u3040-\u30ff々〆ヵヶ、。]/u;

export interface SegmentationContext {
	/**
	 * true 表示当前处于引号内部（下一个引号是闭引号）
	 */
	isQuoteOpen: boolean;
}

/**
 * @description 判断两个相邻字符是否应该合并
 */
function isMergeablePair(
	prev: CharType,
	curr: CharType,
	splitCJK: boolean,
): boolean {
	if (prev !== curr) {
		return false;
	}

	switch (prev) {
		case CharType.Latin:
		case CharType.Numeric:
		case CharType.Whitespace:
			return true;
		case CharType.Cjk:
			return !splitCJK;
		default:
			return false;
	}
}

/**
 * @description 自动将一个字符串拆分为 token
 */
function splitLatinByHyphenation(
	token: string,
	config: SegmentationConfig,
): string[] {
	if (!token) return [];
	const firstChar = token.length > 0 ? Array.from(token)[0] : " ";
	const tokenType = getCharType(firstChar);
	if (
		tokenType === CharType.Latin &&
		(config.splitEnglish || config.splitJapaneseByChar) &&
		token.length > 1 &&
		config.hyphenator
	) {
		return config.hyphenator(token).split("\u00AD");
	}
	return [token];
}

function shouldUseTinySegmenterForJapanese(
	text: string,
	config: SegmentationConfig,
): boolean {
	// 1文字単位モードでは形態素解析を使わず、常に1文字ずつ分割する。
	if (config.splitJapaneseByChar) return false;
	return config.splitCJK && japaneseTokenizerHintRegexp.test(text);
}

function autoTokenize(text: string, config: SegmentationConfig): string[] {
	if (!text) {
		return [];
	}

	if (shouldUseTinySegmenterForJapanese(text, config)) {
		try {
			return tinySegmenter
				.segment(text)
				.flatMap((token) => splitLatinByHyphenation(token, config))
				.filter((token) => token.length > 0);
		} catch {
			// Fallback to original tokenizer below.
		}
	}

	const tokens: string[] = [];
	let currentToken = "";
	let lastCharType: CharType | null = null;

	// CJK を1文字ずつ分割するかどうか。
	// 通常の splitCJK に加え、日本語1文字単位モードでも有効にする。
	const cjkSplit = config.splitCJK || config.splitJapaneseByChar;

	const pushCurrentToken = () => {
		if (!currentToken) return;
		tokens.push(...splitLatinByHyphenation(currentToken, config));
		currentToken = "";
	};

	const graphemes = Array.from(text);

	for (const grapheme of graphemes) {
		const firstChar = grapheme.length > 0 ? Array.from(grapheme)[0] : " ";
		const currentCharType = getCharType(firstChar);

		// 拗音・促音・長音符は直前の仮名（CJK）と結合させ、1文字分割の対象外にする。
		const isCombiningWithPrevKana =
			cjkSplit &&
			currentToken !== "" &&
			lastCharType === CharType.Cjk &&
			kanaCombiningMarkRegexp.test(grapheme);

		if (lastCharType !== null) {
			let shouldBreak = false;

			if (isCombiningWithPrevKana) {
				shouldBreak = false;
			} else if (currentCharType === CharType.Cjk && cjkSplit) {
				shouldBreak = true;
			} else if (lastCharType === CharType.Cjk && cjkSplit) {
				shouldBreak = true;
			} else if (currentCharType === CharType.Other) {
				shouldBreak = true;
			} else if (lastCharType === CharType.Other) {
				shouldBreak = true;
			} else if (!isMergeablePair(lastCharType, currentCharType, cjkSplit)) {
				shouldBreak = true;
			}

			if (shouldBreak && currentToken) {
				pushCurrentToken();
			}
		}

		currentToken += grapheme;
		lastCharType = currentCharType;
	}

	pushCurrentToken();

	return tokens;
}

function calculateWeight(token: string, config: SegmentationConfig): number {
	if (!token) {
		return 0;
	}
	const firstChar = token.length > 0 ? Array.from(token)[0] : " ";
	const charType = getCharType(firstChar);

	switch (charType) {
		case CharType.Latin:
		case CharType.Numeric:
		case CharType.Cjk:
			return token.length;
		case CharType.Other:
			return config.punctuationWeight;
		case CharType.Whitespace:
			return 0.0;
		default:
			return 0.0;
	}
}

/**
 * @description 后处理
 *
 * 处理标点粘连，过滤空字符，计算总权重
 * @returns 处理完的 Token 列表、对应的权重列表、总权重
 */
function postProcess(
	tokens: string[],
	config: SegmentationConfig,
	context?: SegmentationContext,
): { finalTokens: string[]; finalWeights: number[]; totalWeight: number } {
	const processedTokens: string[] = [];
	const tokenWeights: number[] = [];

	/**
	 * @description 用于存储等待向右合并的标点。例如 `(`
	 */
	let pendingPrefix = "";
	let pendingPrefixWeight = 0;

	for (const token of tokens) {
		const tokenWeight = calculateWeight(token, config);
		const firstChar = token.length > 0 ? Array.from(token)[0] : " ";
		const charType = getCharType(firstChar);

		if (config.punctuationMode === "merge" && charType === CharType.Other) {
			let direction = getMergeDirection(token);

			if (context && PUNCT_AMBIGUOUS_QUOTES.has(token)) {
				if (context.isQuoteOpen) {
					direction = MergeDirection.Left;
					context.isQuoteOpen = false;
				} else {
					direction = MergeDirection.Right;
					context.isQuoteOpen = true;
				}
			}

			if (direction === MergeDirection.Right) {
				// 向右合并
				pendingPrefix += token;
				pendingPrefixWeight += tokenWeight;
			} else {
				// 向左合并
				if (processedTokens.length > 0) {
					processedTokens[processedTokens.length - 1] += token;
					tokenWeights[tokenWeights.length - 1] += tokenWeight;
				} else {
					// 行首就是应该向左合并的标点符号，存起来然后合并到第一个音节中
					pendingPrefix += token;
					pendingPrefixWeight += tokenWeight;
				}
			}
		} else {
			// 实词，将缓冲区的标点拼接在词前
			const combinedToken = pendingPrefix + token;
			const combinedWeight = pendingPrefixWeight + tokenWeight;

			processedTokens.push(combinedToken);
			tokenWeights.push(combinedWeight);

			pendingPrefix = "";
			pendingPrefixWeight = 0;
		}
	}

	// 行尾缓冲区里还有应该向右合并的标点，拼接到上一个词中
	if (pendingPrefix) {
		if (processedTokens.length > 0) {
			processedTokens[processedTokens.length - 1] += pendingPrefix;
			tokenWeights[tokenWeights.length - 1] += pendingPrefixWeight;
		} else {
			// 整行都只有标点了
			processedTokens.push(pendingPrefix);
			tokenWeights.push(pendingPrefixWeight);
		}
	}

	// 权重计算
	const finalTokens: string[] = [];
	const finalWeights: number[] = [];
	let totalWeight = 0;

	for (let i = 0; i < processedTokens.length; i++) {
		const token = processedTokens[i];
		const weight = tokenWeights[i];

		if (token === "" && config.removeEmptySegments) {
			continue;
		}

		finalTokens.push(token);
		finalWeights.push(weight);
		totalWeight += weight;
	}

	return { finalTokens, finalWeights, totalWeight };
}

/**
 * @description 把原 `LyricWord` 的总时长按权重分给切分后的 `tokens`
 * @param originalWord 原始的大词对象
 * @param tokens 切分后的文本数组
 * @param weights 对应的权重数组
 * @param totalWeight 总权重
 */
function distributeTime(
	originalWord: LyricWord,
	tokens: string[],
	weights: number[],
	totalWeight: number,
): LyricWord[] {
	if (tokens.length === 0) {
		return [];
	}
	if (tokens.length === 1) {
		return [{ ...originalWord, word: tokens[0] }];
	}

	const totalDuration = originalWord.endTime - originalWord.startTime;
	if (totalDuration <= 0) {
		return tokens.map((token) => ({
			...newLyricWord(),
			word: token,
			startTime: originalWord.startTime,
			endTime: originalWord.endTime,
		}));
	}

	if (totalWeight <= 0) {
		return [];
	}

	const durationPerWeight = totalDuration / totalWeight;
	const newWords: LyricWord[] = [];
	let currentTokenStartMs = originalWord.startTime;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const weight = weights[i];

		const tokenDuration = Math.round(weight * durationPerWeight);
		let tokenEndMs = currentTokenStartMs + tokenDuration;

		if (i === tokens.length - 1) {
			tokenEndMs = originalWord.endTime;
		}

		newWords.push({
			...newLyricWord(),
			word: token,
			startTime: currentTokenStartMs,
			endTime: tokenEndMs,
		});

		if (tokenEndMs > currentTokenStartMs) {
			currentTokenStartMs = tokenEndMs;
		}
	}

	return newWords;
}

/**
 * @description 将单个 LyricWord 拆分为多个
 */
export function segmentWord(
	word: LyricWord,
	config: SegmentationConfig,
	context?: SegmentationContext,
): LyricWord[] {
	const protectedWords = new Set([
		...config.ignoreList,
		...config.customRules.keys(),
	]);
	const ctx = context || { isQuoteOpen: false };

	if (protectedWords.size === 0) {
		const tokens = autoTokenize(word.word, config);
		if (tokens.length === 0) return [];
		const { finalTokens, finalWeights, totalWeight } = postProcess(
			tokens,
			config,
			ctx,
		);
		return distributeTime(word, finalTokens, finalWeights, totalWeight);
	}

	const sortedPatterns = Array.from(protectedWords)
		.filter((k) => k.trim() !== "")
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp);

	if (sortedPatterns.length === 0) {
		const tokens = autoTokenize(word.word, config);
		if (tokens.length === 0) return [];
		const { finalTokens, finalWeights, totalWeight } = postProcess(
			tokens,
			config,
			ctx,
		);
		return distributeTime(word, finalTokens, finalWeights, totalWeight);
	}

	const pattern = new RegExp(`(${sortedPatterns.join("|")})`, "g");

	const parts = word.word.split(pattern);

	const allTokens: string[] = [];
	const allWeights: number[] = [];
	let grandTotalWeight = 0;

	for (const part of parts) {
		if (!part) continue;

		if (config.customRules.has(part)) {
			const ruleParts = config.customRules.get(part);
			if (!ruleParts) continue;
			for (const token of ruleParts) {
				const weight = calculateWeight(token, config);
				allTokens.push(token);
				allWeights.push(weight);
				grandTotalWeight += weight;
			}
		} else if (config.ignoreList.has(part)) {
			const weight = calculateWeight(part, config);
			allTokens.push(part);
			allWeights.push(weight);
			grandTotalWeight += weight;
		} else {
			const tokens = autoTokenize(part, config);
			const { finalTokens, finalWeights, totalWeight } = postProcess(
				tokens,
				config,
				ctx,
			);
			allTokens.push(...finalTokens);
			allWeights.push(...finalWeights);
			grandTotalWeight += totalWeight;
		}
	}

	return distributeTime(word, allTokens, allWeights, grandTotalWeight);
}

/**
 * 批量处理歌词行，支持跨词的上下文状态（如引号合并方向）
 *
 * 一般推荐优先使用这个函数而不是 segmentWord，因为这个函数可以处理英文双引号的方向
 * @param lines 歌词行数组
 * @param config 分词配置
 * @param resetStatePerLine 是否每行重置上下文状态。默认 false 以支持跨行引号，设为 true 可以防止上一行未闭合的引号影响下一行
 */
export function segmentLyricLines(
	lines: LyricLine[],
	config: SegmentationConfig,
	resetStatePerLine = true,
): LyricLine[] {
	const context: SegmentationContext = { isQuoteOpen: false };

	return lines.map((line) => {
		if (resetStatePerLine) {
			context.isQuoteOpen = false;
		}

		const newWords: LyricWord[] = [];
		for (const word of line.words) {
			const segments = segmentWord(word, config, context);
			newWords.push(...segments);
		}

		return {
			...line,
			words: newWords,
		};
	});
}

/**
 * 手动分词的时间重计算
 *
 * 用于当已经有了手动指定的分词结果，需要重新计算时间戳时
 *
 * 一个典型应用是拆分单词对话框里的手动分词
 */
export function recalculateWordTime(
	originalWord: LyricWord,
	segments: string[],
	config: SegmentationConfig,
): LyricWord[] {
	const weights = segments.map((token) => calculateWeight(token, config));
	const totalWeight = weights.reduce((sum, w) => sum + w, 0);

	return distributeTime(originalWord, segments, weights, totalWeight);
}
