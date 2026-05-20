type PickerWindow = Window &
	typeof globalThis & {
		showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
		showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
	};

const getPickerWindow = (): PickerWindow => window as PickerWindow;

const normalizeExtensions = (extensions: string[]): string[] =>
	extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException && error.name === "AbortError";

export const isFileSystemAccessSupported = (): boolean => {
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
): FilePickerAcceptType => ({
	description,
	accept: {
		[mimeType]: normalizeExtensions(extensions),
	},
});

export async function openSingleFileWithPicker(options: {
	description: string;
	mimeType: string;
	extensions: string[];
}): Promise<{ file: File; handle: FileSystemFileHandle } | null> {
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
}): Promise<FileSystemFileHandle | null> {
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
	handle: FileSystemFileHandle,
	content: string,
): Promise<void> {
	const writable = await handle.createWritable();
	await writable.write(content);
	await writable.close();
}
