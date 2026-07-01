/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/amll-dev/amll-ttml-tool/blob/main/LICENSE
 */

import {
	ChevronDownFilled,
	ChevronUpFilled,
	PauseFilled,
	PlayFilled,
	Speaker1Filled,
	Speaker2Filled,
	SpeakerMuteFilled,
	TopSpeedFilled,
} from "@fluentui/react-icons";
import {
	Button,
	Card,
	Flex,
	HoverCard,
	IconButton,
	Inset,
	Slider,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { type FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioEngine } from "$/modules/audio/audio-engine";
import { AudioSlider } from "$/modules/audio/components/AudioSlider";
import {
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
	playbackRateAtom,
	seekStepSecondsAtom,
	volumeAtom,
} from "$/modules/audio/states";
import { AuditionKeyBinding } from "$/modules/keyboard/components/AuditionKeyBinding";
import { AudioSpectrogram } from "$/modules/spectrogram/components/AudioSpectrogram";
import {
	keyPlaybackRateDownAtom,
	keyPlaybackRateResetAtom,
	keyPlaybackRateUpAtom,
	keyPlayPauseAtom,
	keySeekBackwardAtom,
	keySeekForwardAtom,
	keyVolumeDownAtom,
	keyVolumeUpAtom,
} from "$/states/keybindings.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";

const AudioPlaybackKeyBinding = memo(() => {
	const store = useStore();
	const seekStepSeconds = useAtomValue(seekStepSecondsAtom);

	useKeyBindingAtom(keyPlayPauseAtom, () => {
		if (audioEngine.musicPlaying) audioEngine.pauseMusic();
		else audioEngine.resumeOrSeekMusic();
	}, []);

	useKeyBindingAtom(keySeekForwardAtom, () => {
		audioEngine.seekMusic(
			Math.min(
				audioEngine.musicCurrentTime + Math.max(seekStepSeconds, 0),
				audioEngine.musicDuration,
			),
		);
	}, [seekStepSeconds]);

	useKeyBindingAtom(keySeekBackwardAtom, () => {
		audioEngine.seekMusic(
			Math.max(audioEngine.musicCurrentTime - Math.max(seekStepSeconds, 0), 0),
		);
	}, [seekStepSeconds]);

	useKeyBindingAtom(keyVolumeUpAtom, () => {
		store.set(volumeAtom, (v) => Math.min(1, v + 0.1));
	}, [store]);

	useKeyBindingAtom(keyVolumeDownAtom, () => {
		store.set(volumeAtom, (v) => Math.max(0, v - 0.1));
	}, [store]);

	useKeyBindingAtom(keyPlaybackRateUpAtom, () => {
		store.set(playbackRateAtom, (v) => Math.min(4, v + 0.25));
	}, [store]);

	useKeyBindingAtom(keyPlaybackRateDownAtom, () => {
		store.set(playbackRateAtom, (v) => Math.max(0.25, v - 0.25));
	}, [store]);

	useKeyBindingAtom(keyPlaybackRateResetAtom, () => {
		store.set(playbackRateAtom, 1);
	}, [store]);

	return null;
});

export const AudioControls: FC = memo(() => {
	const [audioLoaded, setAudioLoaded] = useState(false);
	const [spectrogramVisible, setSpectrogramVisible] = useState(false);
	const currentTime = useAtomValue(currentTimeAtom);
	const currentDuration = useAtomValue(currentDurationAtom);
	const [audioPlaying, setAudioPlaying] = useAtom(audioPlayingAtom);
	const [volume, setVolume] = useAtom(volumeAtom);
	const [playbackRate, setPlaybackRate] = useAtom(playbackRateAtom);
	const { t } = useTranslation();

	// ミュート解除時に元の音量へ戻すため、直前の非ゼロ音量を覚えておく。
	const lastNonZeroVolumeRef = useRef(volume > 0 ? volume : 1);
	// マウスホイールで調節するためのボタン参照（そのボタンにホバー中のみ動作する）。
	const volumeButtonRef = useRef<HTMLButtonElement>(null);
	const speedButtonRef = useRef<HTMLButtonElement>(null);

	const onTogglePlay = useCallback(() => {
		if (audioEngine.musicPlaying) {
			audioEngine.pauseMusic();
		} else {
			audioEngine.resumeOrSeekMusic();
		}
	}, []);

	const onToggleMute = useCallback(() => {
		if (volume > 0) {
			lastNonZeroVolumeRef.current = volume;
			setVolume(0);
		} else {
			setVolume(lastNonZeroVolumeRef.current || 1);
		}
	}, [volume, setVolume]);

	// 速度ボタンのダブルクリックで等速（1.00x）へ戻す。
	const onResetPlaybackRate = useCallback(() => {
		setPlaybackRate(1);
	}, [setPlaybackRate]);

	useEffect(() => {
		const onMusicLoad = () => {
			setAudioLoaded(true);
			setAudioPlaying(false);
		};
		const onMusicUnload = () => {
			setAudioLoaded(false);
			setAudioPlaying(false);
		};
		const onMusicPause = () => {
			setAudioPlaying(false);
		};
		const onMusicResume = () => {
			setAudioPlaying(true);
		};
		const onVolumeChange = () => {
			setVolume(audioEngine.volume);
		};
		setAudioLoaded(audioEngine.musicLoaded);
		setAudioPlaying(audioEngine.musicPlaying);
		setVolume(audioEngine.volume);
		setPlaybackRate(audioEngine.musicPlayBackRate);
		audioEngine.addEventListener("music-load", onMusicLoad);
		audioEngine.addEventListener("music-unload", onMusicUnload);
		audioEngine.addEventListener("music-pause", onMusicPause);
		audioEngine.addEventListener("music-resume", onMusicResume);
		audioEngine.addEventListener("volume-change", onVolumeChange);
		return () => {
			audioEngine.removeEventListener("music-load", onMusicLoad);
			audioEngine.removeEventListener("music-unload", onMusicUnload);
			audioEngine.removeEventListener("music-pause", onMusicPause);
			audioEngine.removeEventListener("music-resume", onMusicResume);
			audioEngine.removeEventListener("volume-change", onVolumeChange);
		};
	}, [setAudioPlaying, setVolume, setPlaybackRate]);

	useEffect(() => {
		audioEngine.volume = volume;
	}, [volume]);

	useEffect(() => {
		audioEngine.musicPlayBackRate = playbackRate;
	}, [playbackRate]);

	// 音量ボタンにホバー中、マウスホイールで音量を 5% ずつ調節する。
	// ページのスクロールを防ぐため、非パッシブのネイティブリスナーで登録する。
	useEffect(() => {
		const el = volumeButtonRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (!audioLoaded) return;
			e.preventDefault();
			const step = e.deltaY < 0 ? 0.05 : -0.05;
			setVolume((v) =>
				Math.min(1, Math.max(0, Math.round((v + step) * 100) / 100)),
			);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [setVolume, audioLoaded]);

	// 再生速度ボタンにホバー中、マウスホイールで速度を 0.05x ずつ調節する。
	useEffect(() => {
		const el = speedButtonRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (!audioLoaded) return;
			e.preventDefault();
			const step = e.deltaY < 0 ? 0.05 : -0.05;
			setPlaybackRate((r) =>
				Math.min(2, Math.max(0.1, Math.round((r + step) * 100) / 100)),
			);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [setPlaybackRate, audioLoaded]);

	// 音量アイコンは現在の音量レベルに応じて切り替える（YouTube 風）。
	const volumeIcon =
		volume <= 0 ? (
			<SpeakerMuteFilled />
		) : volume < 0.5 ? (
			<Speaker1Filled />
		) : (
			<Speaker2Filled />
		);
	// 再生速度ボタンのラベル。小数第二位まで表示する。例: 1.00x / 0.90x / 1.25x
	const rateLabel = `${playbackRate.toFixed(2)}x`;

	return (
		<Card m="2" mt="0">
			<Inset>
				<AudioPlaybackKeyBinding />
				<AuditionKeyBinding />
				<Flex direction="column">
					<div style={{ display: spectrogramVisible ? "flex" : "none" }}>
						<AudioSpectrogram />
					</div>
					<Flex align="center" px="2" gapX="2">
						<Tooltip content={t("audioPanel.playPause", "音声を再生／一時停止")}>
							<IconButton
								my="2"
								ml="0"
								variant="soft"
								disabled={!audioLoaded}
								onClick={onTogglePlay}
							>
								{audioPlaying ? <PauseFilled /> : <PlayFilled />}
							</IconButton>
						</Tooltip>
						{/* 音量: 一時停止の右に配置。クリックでミュート、ホバーでスライダー表示（YouTube 風）。 */}
						<HoverCard.Root>
							<HoverCard.Trigger>
								<IconButton
									ref={volumeButtonRef}
									my="2"
									variant="soft"
									disabled={!audioLoaded}
									onClick={onToggleMute}
									aria-label={t("audioPanel.volume", "音量")}
								>
									{volumeIcon}
								</IconButton>
							</HoverCard.Trigger>
							<HoverCard.Content size="1">
								<Flex align="center" gap="3">
									<Text wrap="nowrap" size="1">
										{t("audioPanel.volume", "音量")}
									</Text>
									<Slider
										min={0}
										max={1}
										value={[volume]}
										step={0.01}
										onValueChange={(v) => setVolume(v[0])}
										style={{ width: "8em" }}
									/>
									<Text
										wrap="nowrap"
										color="gray"
										size="1"
										style={{ minWidth: "2.8em", textAlign: "right" }}
									>
										{(volume * 100).toFixed()}%
									</Text>
								</Flex>
							</HoverCard.Content>
						</HoverCard.Root>
						{/* 再生速度: 音量の右に配置。ボタンに現在の速度を表示し、ホバーでスライダー表示。 */}
						<HoverCard.Root>
							<HoverCard.Trigger>
								<Button
									ref={speedButtonRef}
									my="2"
									variant="soft"
									disabled={!audioLoaded}
									onDoubleClick={onResetPlaybackRate}
									aria-label={t("audioPanel.playbackRate", "再生速度")}
								>
									<TopSpeedFilled />
									{rateLabel}
								</Button>
							</HoverCard.Trigger>
							<HoverCard.Content size="1">
								<Flex align="center" gap="3">
									<Text wrap="nowrap" size="1">
										{t("audioPanel.playbackRate", "再生速度")}
									</Text>
									<Slider
										min={0.1}
										max={2}
										value={[playbackRate]}
										step={0.05}
										onValueChange={(v) => setPlaybackRate(v[0])}
										style={{ width: "8em" }}
									/>
									<Text
										wrap="nowrap"
										color="gray"
										size="1"
										style={{ minWidth: "2.8em", textAlign: "right" }}
									>
										{playbackRate.toFixed(2)}x
									</Text>
								</Flex>
							</HoverCard.Content>
						</HoverCard.Root>
						<Text
							size="2"
							style={{
								minWidth: "5.5em",
								textAlign: "left",
							}}
						>
							{msToTimestamp(currentTime)}
						</Text>
						<AudioSlider />
						<Text
							size="2"
							style={{
								minWidth: "5.5em",
							}}
						>
							{msToTimestamp(currentDuration)}
						</Text>
						<Tooltip
							content={t("audioPanel.expandSpectrogram", "スペクトログラムを展開／折りたたみ")}
						>
							<IconButton
								my="2"
								ml="0"
								variant="soft"
								onClick={() => setSpectrogramVisible(!spectrogramVisible)}
							>
								{spectrogramVisible ? (
									<ChevronDownFilled />
								) : (
									<ChevronUpFilled />
								)}
							</IconButton>
						</Tooltip>
					</Flex>
				</Flex>
			</Inset>
		</Card>
	);
});

export default AudioControls;
