/**
 * @fileoverview
 * アーティスト名入力フィールド。入力に応じて外部 DB (ttml-api.bshin.dev) の
 * `GET /artists/suggest` からサジェスト候補を取得し、ドロップダウンで表示する。
 * 上下キーで候補を選択し、Enter で確定できる (Escape で閉じる)。
 */

import { Spinner, TextField } from "@radix-ui/themes";
import {
	type KeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
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
	/** Enter 押下時、サジェストが選択されていない場合に呼ばれる (任意) */
	onEnter?: () => void;
	/** サジェスト候補が選択された後に呼ばれる (次のフィールドへフォーカスを移す等) */
	onSelect?: () => void;
}

const SUGGEST_DEBOUNCE_MS = 250;

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

	// ユーザーが実際に入力した場合のみサジェストを取得する。
	// (ダイアログ表示時にメタデータから自動代入された値では候補を出さない)
	const userTypedRef = useRef(false);
	// 候補選択直後の再取得を抑止する。
	const skipFetchRef = useRef(false);
	const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// 古いリクエストの結果で新しい入力を上書きしないための世代カウンタ。
	const reqIdRef = useRef(0);

	const fetchSuggestions = useCallback(async (query: string) => {
		const q = query.trim();
		if (!q) {
			setSuggestions([]);
			setOpen(false);
			return;
		}
		const myId = ++reqIdRef.current;
		setLoading(true);
		try {
			const results = await TtmlDbApi.suggestArtists(q);
			if (myId !== reqIdRef.current) return;
			setSuggestions(results);
			setHighlight(-1);
			setOpen(results.length > 0);
		} catch (e) {
			if (myId !== reqIdRef.current) return;
			logError("Artist suggest failed", e);
			setSuggestions([]);
			setOpen(false);
		} finally {
			if (myId === reqIdRef.current) setLoading(false);
		}
	}, []);

	// 入力値の変化に応じてデバウンス付きで候補を取得する。
	useEffect(() => {
		if (skipFetchRef.current) {
			skipFetchRef.current = false;
			return;
		}
		if (!userTypedRef.current) return;
		if (!value.trim()) {
			setSuggestions([]);
			setOpen(false);
			return;
		}
		const handle = setTimeout(
			() => fetchSuggestions(value),
			SUGGEST_DEBOUNCE_MS,
		);
		return () => clearTimeout(handle);
	}, [value, fetchSuggestions]);

	// 強調中の候補をスクロールして見える位置に保つ。
	useEffect(() => {
		if (open && highlight >= 0) {
			optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
		}
	}, [open, highlight]);

	useEffect(() => {
		return () => {
			if (blurTimer.current) clearTimeout(blurTimer.current);
		};
	}, []);

	// 仕様: サジェストが選択されたら入力欄を空にし、次のフィールドへフォーカスを移す。
	const selectSuggestion = useCallback(() => {
		skipFetchRef.current = true;
		onChange("");
		setSuggestions([]);
		setOpen(false);
		setHighlight(-1);
		if (onSelect) {
			onSelect();
		} else {
			inputRef?.current?.focus();
		}
	}, [onChange, inputRef, onSelect]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (!open || suggestions.length === 0) {
				// 候補が閉じている状態で下キーを押したら候補を開く / 再取得する。
				if (e.key === "ArrowDown") {
					e.preventDefault();
					if (suggestions.length > 0) {
						setOpen(true);
						setHighlight(0);
					} else if (value.trim()) {
						userTypedRef.current = true;
						fetchSuggestions(value);
					}
				}
				return;
			}
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setHighlight((h) => (h + 1) % suggestions.length);
					break;
				case "ArrowUp":
					e.preventDefault();
					setHighlight(
						(h) => (h - 1 + suggestions.length) % suggestions.length,
					);
					break;
				case "Enter":
					if (highlight >= 0 && highlight < suggestions.length) {
						e.preventDefault();
						selectSuggestion();
					} else {
						onEnter?.();
					}
					break;
				case "Escape":
					e.preventDefault();
					setOpen(false);
					setHighlight(-1);
					break;
				default:
					break;
			}
		},
		[
			open,
			suggestions,
			highlight,
			value,
			fetchSuggestions,
			selectSuggestion,
			onEnter,
		],
	);

	return (
		<div style={{ position: "relative" }}>
			<TextField.Root
				ref={inputRef}
				value={value}
				onChange={(e) => {
					userTypedRef.current = true;
					onChange(e.target.value);
				}}
				onKeyDown={handleKeyDown}
				onFocus={() => {
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
				aria-expanded={open}
				aria-autocomplete="list"
			>
				{loading && (
					<TextField.Slot side="right">
						<Spinner size="1" />
					</TextField.Slot>
				)}
			</TextField.Root>

			{open && suggestions.length > 0 && (
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
								selectSuggestion();
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
