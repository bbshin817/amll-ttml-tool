import { ImportFromAppleMusic } from "$/modules/apple-music/modals/ImportDialog.tsx";
import { LatencyTestDialog } from "$/modules/audio/modals/LatencyTest.tsx";
import { SyncInputOffsetDialog } from "$/modules/audio/modals/SyncInputOffsetDialog.tsx";
import { ImportFromLRCLIB } from "$/modules/lrclib/modals/ImportDialog.tsx";
import { ReplaceWordDialog } from "$/modules/lyric-editor/tools/ReplaceWordDialog.tsx";
import { TimeShiftDialog } from "$/modules/lyric-editor/tools/TimeShift.tsx";
import { DistributeRomanizationDialog } from "$/modules/project/modals/DistributeRomanization.tsx";
import { HistoryRestoreDialog } from "$/modules/project/modals/HistoryRestore.tsx";
import { ImportFromText } from "$/modules/project/modals/ImportFromText.tsx";
import { MetadataEditor } from "$/modules/project/modals/MetadataEditor.tsx";
import { AdvancedSegmentationDialog } from "$/modules/segmentation/components/AdvancedSegmentation.tsx";
import { SplitWordDialog } from "$/modules/segmentation/components/split-word.tsx";
import { SettingsDialog } from "$/modules/settings/modals/index.tsx";
import { ConfirmationDialog } from "./confirmation.tsx";

export const Dialogs = () => {
	return (
		<>
			<ImportFromText />
			<ImportFromLRCLIB />
			<ImportFromAppleMusic />
			<MetadataEditor />
			<SettingsDialog />
			<SplitWordDialog />
			<ReplaceWordDialog />
			<LatencyTestDialog />
			<SyncInputOffsetDialog />
			<ConfirmationDialog />
			<HistoryRestoreDialog />
			<AdvancedSegmentationDialog />
			<TimeShiftDialog />
			<DistributeRomanizationDialog />
		</>
	);
};

export default Dialogs;
