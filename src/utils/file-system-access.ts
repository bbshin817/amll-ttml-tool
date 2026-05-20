import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeTextFile } from "@tauri-apps/plugin-fs";

type PickerWindow = Window &
	typeof globalThis & {
		showOpenFilePicker?: (
			options?: WebOpenFilePickerOptions,
		) => Promise<FileSystemFileHandle[]>;
		showSaveFilePicker?: (
			options?: WebSaveFilePickerOptions,
		) => Promise<FileSystemFileHandle>;
	};

type WebFilePickerAcceptType = {
	description: string;
	accept: Record<string, string[]>;
};

type WebOpenFilePickerOptions = {
	multiple?: boolean;
	types?: WebFilePickerAcceptType[];
};

type WebSaveFilePickerOptions = {
	suggestedName?: string;
	types?: WebFilePickerAcceptType[];
};

const EXTENSION_MIME: Record<string, string> = {
	ttml: "application/xml",
	xml: "application/xml",
	json: "application/json",
	srt: "text/plain",
	lrc: "text/plain",
	eslrc: "text/plain",
	qrc: "text/plain",
	yrc: "text/plain",
	lys: "text/plain",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	flac: "audio/flac",
	ogg: "audio/ogg",
	oga: "audio/ogg",
	m4a: "audio/mp4",
	webm: "audio/webm",
	weba: "audio/webm",
	aiff: "audio/aiff",
	aif: "audio/aiff",
	opus: "audio/ogg",
	mid: "audio/midi",
	wma: "audio/x-ms-wma",
	au: "audio/basic",
};

export type TauriFileHandle = {
	kind: "tauri-path";
	path: string;
	name: string;
};

export type SaveFileHandle = FileSystemFileHandle | TauriFileHandle;

const getPickerWindow = (): PickerWindow => window as PickerWindow;

const isTauriRuntime = (): boolean => Boolean(import.meta.env.TAURI_ENV_PLATFORM);

const normalizeExtensions = (extensions: string[]): string[] =>
	extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));

const toDialogExtensions = (extensions: string[]): string[] =>
	extensions.map((ext) => ext.replace(/^\./, "").toLowerCase());

const fileNameFromPath = (path: string): string => {
	const segments = path.split(/[/\\]/);
	return segments[segments.length - 1] || "untitled";
};

const extensionFromName = (name: string): string =>
	name.split(".").pop()?.toLowerCase() ?? "";

const inferMimeType = (name: string, fallback: string): string =>
	EXTENSION_MIME[extensionFromName(name)] ?? fallback;

export const isTauriFileHandle = (
	handle: SaveFileHandle,
): handle is TauriFileHandle => {
	return "kind" in handle && handle.kind === "tauri-path";
};

export async function readFileFromTauriPath(path: string): Promise<{
	file: File;
	handle: TauriFileHandle;
}> {
	const name = fileNameFromPath(path);
	const bytes = await readFile(path);
	const file = new File([bytes], name, {
		type: inferMimeType(name, "application/octet-stream"),
	});
	return {
		file,
		handle: {
			kind: "tauri-path",
			path,
			name,
		},
	};
}

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException && error.name === "AbortError";

export const isFileSystemAccessSupported = (): boolean => {
	if (isTauriRuntime()) return true;
	const pickerWindow = getPickerWindow();
	return (
		typeof pickerWindow.showOpenFilePicker === "function" &&
		typeof pickerWindow.showSaveFilePicker === "function"
	);
};

export const assertFileSystemAccessSupported = (): void => {
	if (!isFileSystemAccessSupported()) {
		throw new Error("File System Access API is not supported in this environment.");
	}
};

export const buildPickerType = (
	description: string,
	mimeType: string,
	extensions: string[],
): WebFilePickerAcceptType => ({
	description,
	accept: {
		[mimeType]: normalizeExtensions(extensions),
	},
});

export async function openSingleFileWithPicker(options: {
	description: string;
	mimeType: string;
	extensions: string[];
}): Promise<{ file: File; handle: SaveFileHandle } | null> {
	if (isTauriRuntime()) {
		const selected = await open({
			title: options.description,
			multiple: false,
			filters: [
				{
					name: options.description,
					extensions: toDialogExtensions(options.extensions),
				},
			],
		});
		if (!selected || Array.isArray(selected)) {
			return null;
		}
		const name = fileNameFromPath(selected);
		const bytes = await readFile(selected);
		const file = new File([bytes], name, {
			type: inferMimeType(name, options.mimeType),
		});
		return {
			file,
			handle: {
				kind: "tauri-path",
				path: selected,
				name,
			},
		};
	}

	assertFileSystemAccessSupported();
	const pickerWindow = getPickerWindow();

	try {
		const [handle] = await pickerWindow.showOpenFilePicker!({
			multiple: false,
			types: [buildPickerType(options.description, options.mimeType, options.extensions)],
		});
		if (!handle) return null;
		const file = await handle.getFile();
		return { file, handle };
	} catch (error) {
		if (isAbortError(error)) return null;
		throw error;
	}
}

export async function pickSaveFileHandle(options: {
	suggestedName: string;
	description: string;
	mimeType: string;
	extensions: string[];
}): Promise<SaveFileHandle | null> {
	if (isTauriRuntime()) {
		const selected = await save({
			title: options.description,
			defaultPath: options.suggestedName,
			filters: [
				{
					name: options.description,
					extensions: toDialogExtensions(options.extensions),
				},
			],
		});
		if (!selected || Array.isArray(selected)) return null;
		return {
			kind: "tauri-path",
			path: selected,
			name: fileNameFromPath(selected),
		};
	}

	assertFileSystemAccessSupported();
	const pickerWindow = getPickerWindow();

	try {
		return await pickerWindow.showSaveFilePicker!({
			suggestedName: options.suggestedName,
			types: [buildPickerType(options.description, options.mimeType, options.extensions)],
		});
	} catch (error) {
		if (isAbortError(error)) return null;
		throw error;
	}
}

export async function writeTextToFileHandle(
	handle: SaveFileHandle,
	content: string,
): Promise<void> {
	if (isTauriFileHandle(handle)) {
		await writeTextFile(handle.path, content);
		return;
	}
	const writable = await handle.createWritable();
	await writable.write(content);
	await writable.close();
}
