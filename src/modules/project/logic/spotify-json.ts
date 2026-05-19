/**
 * TTML ↔ Spotify-style JSON conversion.
 * Ported from reference/SpotifyJson.php
 */

import { msToTimestamp } from "$/utils/timestamp.ts";

const TTML_NS = "http://www.w3.org/ns/ttml";
const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";
const TTM_NS = "http://www.w3.org/ns/ttml#metadata";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const ADD_SECTION_GAPS = true;

export interface SpotifySyllable {
	startTimeMs: number;
	numChars: number;
	endTimeMs: number;
	agent?: string;
}

export interface SpotifyLyricLine {
	startTimeMs: number | null;
	words: string;
	syllables: SpotifySyllable[];
	endTimeMs: number | null;
	isSmall: boolean;
	key?: string;
	agent?: string;
	agentType?: string;
	songPart?: string;
}

export interface SpotifyAgent {
	id: string;
	type: string | null;
}

export interface SpotifyMetadata {
	lang: string | null;
	timing: string | null;
	durationMs: number | null;
	bodyAgent: string | null;
	leadingSilence: string | null;
	songwriters: string[];
	agents: SpotifyAgent[];
}

export interface SpotifyLyricsWithMetadata {
	metadata: SpotifyMetadata;
	lyric: SpotifyLyricLine[];
}

function loadXml(xml: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "application/xml");
	const parseError = doc.querySelector("parsererror");
	if (parseError) {
		throw new Error(parseError.textContent?.trim() || "Invalid XML.");
	}
	return doc;
}

function first(doc: Document, localName: string): Element | null {
	const node = doc.evaluate(
		`//*[local-name()='${localName}']`,
		doc,
		null,
		XPathResult.FIRST_ORDERED_NODE_TYPE,
		null,
	).singleNodeValue;
	return node instanceof Element ? node : null;
}

function children(element: Element, localName: string): Element[] {
	const result: Element[] = [];
	for (const child of element.childNodes) {
		if (child instanceof Element && child.localName === localName) {
			result.push(child);
		}
	}
	return result;
}

function attr(
	element: Element,
	name: string,
	namespace: string | null = null,
): string | null {
	if (namespace && element.hasAttributeNS(namespace, name)) {
		return element.getAttributeNS(namespace, name);
	}
	if (element.hasAttribute(name)) {
		return element.getAttribute(name);
	}
	return null;
}

function parseDuration(duration: string | null): number | null {
	if (duration === null || duration === "") return null;

	const trimmed = duration.trim();

	if (trimmed.endsWith("ms")) {
		return Math.round(Number.parseFloat(trimmed.slice(0, -2)));
	}

	if (trimmed.endsWith("s")) {
		return Math.round(Number.parseFloat(trimmed.slice(0, -1)) * 1000);
	}

	const parts = trimmed.split(":");
	let seconds = 0;
	for (const part of parts) {
		seconds = seconds * 60 + Number.parseFloat(part);
	}
	return Math.round(seconds * 1000);
}

function charLength(text: string): number {
	return [...text].length;
}

function hasNextSpan(node: Node): boolean {
	let next = node.nextSibling;
	while (next) {
		if (next instanceof Element) {
			return next.localName === "span";
		}
		if (next.nodeType === Node.TEXT_NODE && next.nodeValue?.trim() !== "") {
			return false;
		}
		next = next.nextSibling;
	}
	return false;
}

function parseAgents(doc: Document): Record<string, SpotifyAgent> {
	const agents: Record<string, SpotifyAgent> = {};
	const nodes = doc.evaluate(
		"//*[local-name()='agent']",
		doc,
		null,
		XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
		null,
	);

	for (let i = 0; i < nodes.snapshotLength; i++) {
		const node = nodes.snapshotItem(i);
		if (!(node instanceof Element)) continue;

		const id = attr(node, "id", XML_NS) ?? attr(node, "id");
		if (!id) continue;

		agents[id] = {
			id,
			type: attr(node, "type"),
		};
	}

	return agents;
}

function appendSpan(
	span: Element,
	words: { value: string },
	syllables: SpotifySyllable[],
	lastEndMs: { value: number | null },
	fallbackAgent: string | null,
): void {
	const childSpans = children(span, "span");

	if (childSpans.length > 0) {
		const agent = attr(span, "agent", TTM_NS) ?? fallbackAgent;
		for (const childSpan of childSpans) {
			appendSpan(childSpan, words, syllables, lastEndMs, agent);
		}
		return;
	}

	const text = span.textContent ?? "";
	if (text === "") return;

	const agent = attr(span, "agent", TTM_NS) ?? fallbackAgent;
	const beginMs = parseDuration(attr(span, "begin"));
	const endMs = parseDuration(attr(span, "end"));

	words.value += text;

	const syllable: SpotifySyllable = {
		startTimeMs: beginMs ?? 0,
		numChars: charLength(text),
		endTimeMs: endMs ?? 0,
	};

	if (agent) {
		syllable.agent = agent;
	}

	syllables.push(syllable);
	lastEndMs.value = endMs;
}

function appendTextBetweenSpans(
	node: Node,
	words: { value: string },
	syllables: SpotifySyllable[],
	lastEndMs: { value: number | null },
): void {
	const raw = node.nodeValue ?? "";
	if (raw === "" || lastEndMs.value === null) return;

	if (raw.trim() === "" && !hasNextSpan(node)) return;

	let text = raw;
	if (text.trim() === "") {
		text = text.replace(/\s+/gu, " ");
	}
	if (text === "") return;

	words.value += text;

	syllables.push({
		startTimeMs: lastEndMs.value,
		numChars: charLength(text),
		endTimeMs: lastEndMs.value + 1,
	});
}

function parseLine(
	p: Element,
	agent: string | null,
	songPart: string | null,
	agents: Record<string, SpotifyAgent>,
): SpotifyLyricLine {
	const words = { value: "" };
	const syllables: SpotifySyllable[] = [];
	const lastEndMs = { value: null as number | null };
	let hasSpan = false;

	for (const node of p.childNodes) {
		if (node instanceof Element && node.localName === "span") {
			hasSpan = true;
			appendSpan(node, words, syllables, lastEndMs, agent);
			continue;
		}

		if (node.nodeType === Node.TEXT_NODE && hasSpan) {
			appendTextBetweenSpans(node, words, syllables, lastEndMs);
		}
	}

	const lineWords = hasSpan ? words.value : (p.textContent ?? "");

	const line: SpotifyLyricLine = {
		startTimeMs: parseDuration(attr(p, "begin")),
		words: lineWords,
		syllables,
		endTimeMs: parseDuration(attr(p, "end")),
		isSmall: false,
	};

	const key = attr(p, "key", ITUNES_NS);
	if (key) line.key = key;

	if (agent) {
		line.agent = agent;
		const agentType = agents[agent]?.type;
		if (agentType) line.agentType = agentType;
	}

	if (songPart) line.songPart = songPart;

	return line;
}

function appendGap(
	lyrics: SpotifyLyricLine[],
	div: Element,
	nextBegin: string | null,
	agent: string | null,
	songPart: string | null,
	agents: Record<string, SpotifyAgent>,
): void {
	const startMs = parseDuration(attr(div, "end"));
	const endMs = parseDuration(nextBegin);

	if (startMs === null || endMs === null || endMs <= startMs) return;

	const line: SpotifyLyricLine = {
		startTimeMs: startMs,
		words: "",
		syllables: [],
		endTimeMs: endMs,
		isSmall: false,
	};

	if (agent) {
		line.agent = agent;
		const agentType = agents[agent]?.type;
		if (agentType) line.agentType = agentType;
	}

	if (songPart) line.songPart = songPart;

	lyrics.push(line);
}

function parseMetadata(
	doc: Document,
	body: Element,
	agents: Record<string, SpotifyAgent>,
): SpotifyMetadata {
	const tt = doc.documentElement;
	const itunesMetadata = doc.evaluate(
		"//*[local-name()='iTunesMetadata']",
		doc,
		null,
		XPathResult.FIRST_ORDERED_NODE_TYPE,
		null,
	).singleNodeValue;

	const songwriters: string[] = [];
	const songwriterNodes = doc.evaluate(
		"//*[local-name()='songwriter']",
		doc,
		null,
		XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
		null,
	);
	for (let i = 0; i < songwriterNodes.snapshotLength; i++) {
		const node = songwriterNodes.snapshotItem(i);
		if (node) songwriters.push(node.textContent ?? "");
	}

	return {
		lang: tt instanceof Element ? attr(tt, "lang", XML_NS) : null,
		timing: tt instanceof Element ? attr(tt, "timing", ITUNES_NS) : null,
		durationMs: parseDuration(attr(body, "dur")),
		bodyAgent: attr(body, "agent", TTM_NS),
		leadingSilence:
			itunesMetadata instanceof Element
				? attr(itunesMetadata, "leadingSilence")
				: null,
		songwriters,
		agents: Object.values(agents),
	};
}

/**
 * Encode TTML XML as Spotify-style JSON.
 */
export function encodeSpotifyJson(
	xml: string,
	withMetadata = false,
): string {
	const doc = loadXml(xml);
	const body = first(doc, "body");

	if (!body) {
		throw new Error("body element was not found.");
	}

	const agents = parseAgents(doc);
	const bodyAgent = attr(body, "agent", TTM_NS);
	const divElements = children(body, "div");
	const lyrics: SpotifyLyricLine[] = [];

	for (let index = 0; index < divElements.length; index++) {
		const div = divElements[index];
		const divAgent = attr(div, "agent", TTM_NS) ?? bodyAgent;
		const songPart = attr(div, "songPart", ITUNES_NS);

		for (const p of children(div, "p")) {
			const lineAgent = attr(p, "agent", TTM_NS) ?? divAgent;
			lyrics.push(parseLine(p, lineAgent, songPart, agents));
		}

		if (ADD_SECTION_GAPS) {
			const nextBegin =
				index + 1 < divElements.length
					? attr(divElements[index + 1], "begin")
					: attr(body, "dur");
			appendGap(lyrics, div, nextBegin, divAgent, songPart, agents);
		}
	}

	const result: SpotifyLyricLine[] | SpotifyLyricsWithMetadata = withMetadata
		? { metadata: parseMetadata(doc, body, agents), lyric: lyrics }
		: lyrics;

	return JSON.stringify(result);
}

function isGapLine(line: SpotifyLyricLine): boolean {
	return line.words === "" && line.syllables.length === 0;
}

function formatTimeMs(ms: number | null): string {
	if (ms === null) return "0:00.000";
	return msToTimestamp(ms);
}

function sliceByCharCount(
	text: string,
	offset: number,
	count: number,
): [string, number] {
	const chars = [...text];
	return [chars.slice(offset, offset + count).join(""), offset + count];
}

/**
 * Parse Spotify-style JSON (array or `{ metadata, lyric }`).
 * Mirrors reference/SpotifyJson.php `decode()`.
 */
export function parseSpotifyJson(
	json: string,
): SpotifyLyricLine[] | SpotifyLyricsWithMetadata {
	const data: unknown = JSON.parse(json);

	if (Array.isArray(data)) {
		return data as SpotifyLyricLine[];
	}

	if (
		data &&
		typeof data === "object" &&
		"lyric" in data &&
		Array.isArray((data as SpotifyLyricsWithMetadata).lyric)
	) {
		return data as SpotifyLyricsWithMetadata;
	}

	throw new Error("Invalid JSON.");
}

function buildParagraph(
	doc: Document,
	line: SpotifyLyricLine,
	lineIndex: number,
): Element {
	const p = doc.createElement("p");
	p.setAttribute("begin", formatTimeMs(line.startTimeMs));
	p.setAttribute("end", formatTimeMs(line.endTimeMs));
	p.setAttribute("itunes:key", line.key ?? `L${lineIndex}`);

	if (line.agent) {
		p.setAttributeNS(TTM_NS, "agent", line.agent);
	}

	if (line.syllables.length > 0) {
		let offset = 0;
		for (const syllable of line.syllables) {
			const [text, nextOffset] = sliceByCharCount(
				line.words,
				offset,
				syllable.numChars,
			);
			offset = nextOffset;
			if (text === "") continue;

			const span = doc.createElement("span");
			span.setAttribute("begin", formatTimeMs(syllable.startTimeMs));
			span.setAttribute("end", formatTimeMs(syllable.endTimeMs));
			if (syllable.agent) {
				span.setAttributeNS(TTM_NS, "agent", syllable.agent);
			}
			span.appendChild(doc.createTextNode(text));
			p.appendChild(span);
		}

		const remaining = [...line.words].slice(offset).join("");
		if (remaining) {
			p.appendChild(doc.createTextNode(remaining));
		}
	} else if (line.words) {
		p.appendChild(doc.createTextNode(line.words));
	}

	return p;
}

function groupLinesIntoDivs(lines: SpotifyLyricLine[]): SpotifyLyricLine[][] {
	const divs: SpotifyLyricLine[][] = [];
	let current: SpotifyLyricLine[] = [];

	for (const line of lines) {
		if (isGapLine(line)) {
			if (current.length > 0) {
				divs.push(current);
				current = [];
			}
			continue;
		}
		current.push(line);
	}

	if (current.length > 0) {
		divs.push(current);
	}

	return divs.length > 0 ? divs : [[]];
}

/**
 * Convert Spotify-style JSON to TTML XML for `parseTTML()`.
 */
export function decodeSpotifyJsonToTtml(json: string): string {
	const parsed = parseSpotifyJson(json);
	const lines = Array.isArray(parsed) ? parsed : parsed.lyric;
	const metadata = Array.isArray(parsed) ? null : parsed.metadata;

	const doc = document.implementation.createDocument(TTML_NS, "tt", null);
	const tt = doc.documentElement;
	tt.setAttribute("xmlns", TTML_NS);
	tt.setAttribute("xmlns:itunes", ITUNES_NS);
	tt.setAttribute("xmlns:ttm", TTM_NS);
	tt.setAttributeNS(XML_NS, "lang", metadata?.lang ?? "und");
	tt.setAttributeNS(ITUNES_NS, "timing", metadata?.timing ?? "Word");

	const head = doc.createElement("head");
	const headMetadata = doc.createElement("metadata");

	for (const agent of metadata?.agents ?? []) {
		const agentEl = doc.createElementNS(TTM_NS, "agent");
		agentEl.setAttributeNS(XML_NS, "id", agent.id);
		if (agent.type) {
			agentEl.setAttribute("type", agent.type);
		}
		headMetadata.appendChild(agentEl);
	}

	if (headMetadata.childNodes.length === 0) {
		const defaultAgent = doc.createElementNS(TTM_NS, "agent");
		defaultAgent.setAttributeNS(XML_NS, "id", "v1");
		defaultAgent.setAttribute("type", "person");
		headMetadata.appendChild(defaultAgent);
	}

	head.appendChild(headMetadata);
	tt.appendChild(head);

	const body = doc.createElement("body");
	if (metadata?.bodyAgent) {
		body.setAttributeNS(TTM_NS, "agent", metadata.bodyAgent);
	}

	const nonGapLines = lines.filter((line) => !isGapLine(line));
	const bodyDur =
		metadata?.durationMs ??
		nonGapLines.at(-1)?.endTimeMs ??
		nonGapLines.at(-1)?.startTimeMs ??
		0;
	body.setAttribute("dur", formatTimeMs(bodyDur));

	const divGroups = groupLinesIntoDivs(lines);
	let lineIndex = 0;

	for (const group of divGroups) {
		if (group.length === 0) continue;

		const div = doc.createElementNS(TTML_NS, "div");
		const first = group[0];
		const last = group[group.length - 1];
		div.setAttribute("begin", formatTimeMs(first.startTimeMs));
		div.setAttribute("end", formatTimeMs(last.endTimeMs));

		if (first.songPart) {
			div.setAttributeNS(ITUNES_NS, "songPart", first.songPart);
		}

		for (const line of group) {
			lineIndex++;
			div.appendChild(buildParagraph(doc, line, lineIndex));
		}

		body.appendChild(div);
	}

	tt.appendChild(body);

	return new XMLSerializer().serializeToString(doc);
}
