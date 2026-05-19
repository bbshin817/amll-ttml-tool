import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type Id, toast } from "react-toastify";
import {
	audioErrorAtom,
	audioTaskStateAtom,
} from "$/modules/audio/states/index.ts";

export const useAudioFeedback = () => {
	const taskState = useAtomValue(audioTaskStateAtom);
	const [errorMsg, setErrorMsg] = useAtom(audioErrorAtom);
	const toastId = useRef<Id | null>(null);
	const { t } = useTranslation();

	useEffect(() => {
		const getMessage = (type: string) => {
			switch (type) {
				case "TRANSCODING":
					return t("audio.status.transcoding", "デコードに失敗しました。音声の変換を試行しています…");
				case "LOADING":
					return t("audio.status.loading", "音声を読み込み中…");
				default:
					return t("audio.status.processing", "処理中…");
			}
		};

		if (taskState) {
			const { type, progress } = taskState;
			const message = getMessage(type);

			if (toastId.current === null) {
				toastId.current = toast.loading(message, {
					autoClose: false,
					closeButton: false,
					closeOnClick: false,
					draggable: false,
					progress: progress,
				});
			} else {
				toast.update(toastId.current, {
					render: message,
					progress: progress,
				});
			}
		} else {
			if (toastId.current !== null) {
				toast.dismiss(toastId.current);
				toastId.current = null;
			}
		}
	}, [taskState, t]);

	useEffect(() => {
		if (errorMsg) {
			toast.error(
				`${t("audio.error.workerError", "音声の処理中にエラーが発生しました")}: ${errorMsg}`,
				{
					autoClose: 5000,
					closeOnClick: true,
					draggable: true,
				},
			);

			setErrorMsg(null);
		}
	}, [errorMsg, setErrorMsg, t]);
};
