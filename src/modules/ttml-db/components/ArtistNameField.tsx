/**
 * @fileoverview
 * アーティスト名入力フィールド。入力に応じて外部 DB (ttml-api.bshin.dev) の
 * `GET /artists/suggest` からサジェスト候補を取得し、ドロップダウンで表示する。
 *
 * サジェスト取得は「最後の入力から 0.4 秒間、何も入力されなかったとき」だけ
 * リクエストする (setTimeout デバウンス)。0.4 秒未満の連続入力では
 * リクエストを送らない。
 *
 * 候補が 2 件以上あるときはポップアップで一覧表示し、上下キー + Enter で選択できる
 * (1 件のみのときはポップアップを出さない)。また 1 文字以上入力かつ前方一致する
 * 候補があるときは、最有力候補の残りをインラインのグレー文字 (ゴースト) として
 * 実文字に重ねて表示し、Tab / キャレット末尾での → / Enter で確定 (補完) できる。
 * 候補を選択・補完すると、その候補名をそのまま入力欄へ注入する。
 */

import { Spinner, TextField } from "@radix-ui/themes";
import {
	type KeyboardEvent,
	type MutableRefObject,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { TtmlDbApi } from "$/modules/ttml-db/api/client";
import type { Artist } from "$/modules/ttml-db/types";
import { error as logError } from "$/utils/logging";

interface ArtistNameFieldProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	invalid?: boolean;
	inputRef?: RefObject<HTMLInputElement | null>;
	/** Enter 押下時、サジェストもゴーストも無い場合に呼ばれる (任意) */
	onEnter?: () => void;
	/** サジェスト候補が選択された後に呼ばれる (次のフィールドへフォーカスを移す等) */
	onSelect?: () => void;
}

/** 最後の入力からこの時間だけ無操作が続いたらサジェストを取得する。 */
const SUGGEST_DEBOUNCE_MS = 400;

/** ゴースト文字を実文字とピクセル単位で重ねるための、入力欄の実測ジオメトリ。 */
type GhostBox = {
	left: number;
	top: number;
	width: number;
	height: number;
	paddingLeft: string;
	paddingRight: string;
	fontFamily: string;
	fontSize: string;
	fontWeight: string;
	fontStyle: string;
	letterSpacing: string;
};

export const ArtistNameField = ({
	value,
	onChange,
	placeholder,
	invalid,
	inputRef,
	onEnter,
	onSelect,
}: ArtistNameFieldProps) => {
	const [suggestions, setSuggestions] = useState<Artist[]>([]);
	const [open, setOpen] = useState(false);
	const [highlight, setHighlight] = useState(-1);
	const [loading, setLoading] = useState(false);
	// ゴースト文字を実文字に重ねるために測った入力欄のジオメトリ。
	const [ghostBox, setGhostBox] = useState<GhostBox | null>(null);

	const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// サジェスト取得のデバウンス用タイマー。
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	// 実測とフォーカス制御のために保持する input 要素への参照。
	const localInputRef = useRef<HTMLInputElement | null>(null);

	// 親から渡された ref と内部 ref の両方へ input 要素を割り当てる。
	const assignInputRef = useCallback(
		(node: HTMLInputElement | null) => {
			localInputRef.current = node;
			if (inputRef) {
				(inputRef as MutableRefObject<HTMLInputElement | null>).current = node;
			}
		},
		[inputRef],
	);

	// 入力欄の実際の位置・フォントを測り、ゴースト用のジオメトリを更新する。
	const measure = useCallback(() => {
		const wrap = wrapperRef.current;
		// ref がラッパー/ルートのどちらを指していても確実に <input> 本体を測る。
		// (フォントや余白を実文字とズレなく合わせるため、必ず input から取得する)
		const el = wrap?.querySelector("input");
		if (!wrap || !el) return;
		const ir = el.getBoundingClientRect();
		const wr = wrap.getBoundingClientRect();
		const cs = getComputedStyle(el);
		const num = (v: string) => Number.parseFloat(v) || 0;
		// Radix Themes はテキスト入力の左インセットを padding-left ではなく
		// text-indent (= --text-field-padding) で付けている。両方を足したものが
		// 実文字の開始位置になるので、ここで合算してゴーストの左余白に反映する。
		const leftInset = num(cs.paddingLeft) + num(cs.textIndent);
		// 入力欄の枠ボックスにぴったり重ね、内側余白とフォントも input に合わせる。
		setGhostBox({
			left: ir.left - wr.left,
			top: ir.top - wr.top,
			width: ir.width,
			height: ir.height,
			paddingLeft: `${leftInset}px`,
			paddingRight: cs.paddingRight,
			fontFamily: cs.fontFamily,
			fontSize: cs.fontSize,
			fontWeight: cs.fontWeight,
			fontStyle: cs.fontStyle,
			letterSpacing: cs.letterSpacing,
		});
	}, []);

	const fetchSuggestions = useCallback(async (query: string) => {
		const q = query.trim();
		if (!q) {
			setSuggestions([]);
			setOpen(false);
			return;
		}
		setLoading(true);
		try {
			const results = await TtmlDbApi.suggestArtists(q);
			setSuggestions(results);
			setHighlight(-1);
			setOpen(results.length > 0);
		} catch (e) {
			logError("Artist suggest failed", e);
			setSuggestions([]);
			setOpen(false);
		} finally {
			setLoading(false);
		}
	}, []);

	// 入力のたびにデバウンスタイマーを張り直す。0.4 秒間、次の入力が無ければ取得する。
	// (連続入力中はタイマーが張り直されるため、リクエストは一切飛ばない)
	const scheduleFetch = useCallback(
		(query: string) => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
			if (!query.trim()) {
				setSuggestions([]);
				setOpen(false);
				setLoading(false);
				return;
			}
			debounceTimer.current = setTimeout(() => {
				void fetchSuggestions(query);
			}, SUGGEST_DEBOUNCE_MS);
		},
		[fetchSuggestions],
	);

	// 強調中の候補をスクロールして見える位置に保つ。
	useEffect(() => {
		if (open && highlight >= 0) {
			optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
		}
	}, [open, highlight]);

	useEffect(() => {
		return () => {
			if (blurTimer.current) clearTimeout(blurTimer.current);
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, []);

	// 仕様: 候補を選択・補完したら、その候補名をそのまま入力欄へ注入する。
	const selectSuggestion = useCallback(
		(artist: Artist) => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
			onChange(artist.artist_name);
			setSuggestions([]);
			setOpen(false);
			setHighlight(-1);
			if (onSelect) {
				onSelect();
			} else {
				localInputRef.current?.focus();
			}
		},
		[onChange, onSelect],
	);

	// 1 文字以上入力かつ前方一致する最有力候補 (候補ナビゲーション中は無効)。
	const ghostArtist = useMemo(() => {
		if (highlight >= 0) return null;
		if (!value.trim()) return null;
		const lower = value.toLowerCase();
		return (
			suggestions.find(
				(s) =>
					s.artist_name.length > value.length &&
					s.artist_name.toLowerCase().startsWith(lower),
			) ?? null
		);
	}, [value, suggestions, highlight]);
	// 実際に入力された文字数以降を、補完候補として表示する部分。
	const ghostSuffix = ghostArtist
		? ghostArtist.artist_name.slice(value.length)
		: "";

	// ゴーストが実際に見えている状態 (フォーカス/候補あり) か。
	const showGhost = open && !!ghostArtist;
	// ポップアップ候補は 2 件以上のときだけ表示する (1 件のみならゴーストで十分)。
	const showDropdown = open && suggestions.length > 1;

	// ゴーストを表示する直前にジオメトリを測り直し、確実に整列させる。
	useLayoutEffect(() => {
		if (showGhost && ghostSuffix) measure();
	}, [showGhost, ghostSuffix, measure]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			const el = localInputRef.current;

			// ゴースト補完の確定 (表示中のみ): Tab、またはキャレット末尾での →。
			if (showGhost && ghostArtist) {
				const caretAtEnd =
					!!el &&
					el.selectionStart === el.selectionEnd &&
					el.selectionStart === value.length;
				if (e.key === "Tab" || (e.key === "ArrowRight" && caretAtEnd)) {
					e.preventDefault();
					selectSuggestion(ghostArtist);
					return;
				}
			}

			// ポップアップ (2 件以上) のキーボード操作。
			if (showDropdown) {
				switch (e.key) {
					case "ArrowDown":
						e.preventDefault();
						setHighlight((h) => (h + 1) % suggestions.length);
						return;
					case "ArrowUp":
						e.preventDefault();
						setHighlight(
							(h) => (h - 1 + suggestions.length) % suggestions.length,
						);
						return;
					case "Enter":
						if (highlight >= 0 && highlight < suggestions.length) {
							e.preventDefault();
							selectSuggestion(suggestions[highlight]);
							return;
						}
						break;
					case "Escape":
						e.preventDefault();
						setOpen(false);
						setHighlight(-1);
						return;
					default:
						break;
				}
			}

			// Enter: ゴーストがあれば確定、なければ onEnter へ委譲。
			if (e.key === "Enter") {
				if (showGhost && ghostArtist) {
					e.preventDefault();
					selectSuggestion(ghostArtist);
				} else {
					onEnter?.();
				}
				return;
			}

			// 閉じている 2 件以上の候補を ↓ で開く。
			if (e.key === "ArrowDown" && !showDropdown && suggestions.length > 1) {
				e.preventDefault();
				setOpen(true);
				setHighlight(0);
			}
		},
		[
			showGhost,
			showDropdown,
			ghostArtist,
			suggestions,
			highlight,
			value,
			selectSuggestion,
			onEnter,
		],
	);

	return (
		<div ref={wrapperRef} style={{ position: "relative" }}>
			<TextField.Root
				ref={assignInputRef}
				value={value}
				onChange={(e) => {
					const next = e.target.value;
					onChange(next);
					scheduleFetch(next);
				}}
				onKeyDown={handleKeyDown}
				onFocus={() => {
					measure();
					if (suggestions.length > 0) setOpen(true);
				}}
				onBlur={() => {
					// クリック選択を拾えるよう、閉じるのを少し遅らせる。
					blurTimer.current = setTimeout(() => setOpen(false), 120);
				}}
				placeholder={placeholder}
				color={invalid ? "red" : undefined}
				variant={invalid ? "soft" : "surface"}
				autoComplete="off"
				role="combobox"
				aria-expanded={showDropdown}
				aria-autocomplete="both"
			>
				{loading && (
					<TextField.Slot side="right">
						<Spinner size="1" />
					</TextField.Slot>
				)}
			</TextField.Root>

			{showGhost && ghostSuffix && ghostBox && (
				// 実文字に重ねて、最有力候補の残りをグレーで補完表示する (操作は入力欄側)。
				<div
					aria-hidden
					style={{
						position: "absolute",
						left: ghostBox.left,
						top: ghostBox.top,
						width: ghostBox.width,
						height: ghostBox.height,
						boxSizing: "border-box",
						paddingLeft: ghostBox.paddingLeft,
						paddingRight: ghostBox.paddingRight,
						display: "flex",
						alignItems: "center",
						overflow: "hidden",
						pointerEvents: "none",
						whiteSpace: "pre",
						fontFamily: ghostBox.fontFamily,
						fontSize: ghostBox.fontSize,
						fontWeight: ghostBox.fontWeight,
						fontStyle: ghostBox.fontStyle,
						letterSpacing: ghostBox.letterSpacing,
					}}
				>
					{/* 実文字ぶんの幅を確保して、続きのゴーストを正しい位置から始める。 */}
					<span style={{ visibility: "hidden", flexShrink: 0 }}>{value}</span>
					<span style={{ color: "var(--gray-a8)", flexShrink: 0 }}>
						{ghostSuffix}
					</span>
				</div>
			)}

			{showDropdown && (
				// biome-ignore lint/a11y/useFocusableInteractive: フォーカスは input に保持し、候補はマウス/キーで操作する
				<div
					role="listbox"
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						left: 0,
						right: 0,
						zIndex: 50,
						maxHeight: "220px",
						overflowY: "auto",
						backgroundColor: "var(--color-panel-solid)",
						border: "1px solid var(--gray-a6)",
						borderRadius: "var(--radius-3)",
						boxShadow: "var(--shadow-4)",
						padding: "4px",
					}}
				>
					{suggestions.map((s, i) => (
						// biome-ignore lint/a11y/useKeyWithMouseEvents: キーボード操作は input の onKeyDown で処理している
						<div
							key={s.uuid}
							ref={(el) => {
								optionRefs.current[i] = el;
							}}
							role="option"
							aria-selected={i === highlight}
							onMouseDown={(e) => {
								// blur によるドロップダウン閉鎖より先に選択を確定する。
								e.preventDefault();
								selectSuggestion(s);
							}}
							onMouseEnter={() => setHighlight(i)}
							style={{
								padding: "6px 8px",
								borderRadius: "var(--radius-2)",
								cursor: "pointer",
								fontSize: "var(--font-size-2)",
								color: "var(--gray-12)",
								backgroundColor:
									i === highlight ? "var(--accent-a4)" : "transparent",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{s.artist_name}
						</div>
					))}
				</div>
			)}
		</div>
	);
};
