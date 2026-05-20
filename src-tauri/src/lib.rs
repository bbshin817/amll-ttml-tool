#[derive(serde::Serialize)]
struct OpenFileData {
    pub path: String,
    pub ext: String,
}

#[tauri::command]
fn get_open_file_data() -> Option<OpenFileData> {
    let opened_path = std::env::args().nth(1);
    if let Some(opened_path) = opened_path {
        let path = std::path::Path::new(&opened_path);
        let ext = path
            .extension()
            .map(|x| x.to_string_lossy().into_owned())
            .unwrap_or_default();
        return Some(OpenFileData {
            path: opened_path,
            ext,
        });
    }

    None
}

fn build_native_menu(app: &tauri::App) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

    let file_new = MenuItem::with_id(app, "file.new", "新規", true, Some("CmdOrCtrl+N"))?;
    let file_open = MenuItem::with_id(app, "file.open", "開く…", true, Some("CmdOrCtrl+O"))?;
    let file_save = MenuItem::with_id(app, "file.save", "保存", true, Some("CmdOrCtrl+S"))?;
    let file_save_as = MenuItem::with_id(app, "file.saveAs", "名前を付けて保存…", true, None::<&str>)?;
    let file_apple = MenuItem::with_id(app, "file.openFromAppleMusic", "Apple Music から取得", true, None::<&str>)?;
    let file_restore =
        MenuItem::with_id(app, "file.openHistoryRestore", "履歴から復元…", true, None::<&str>)?;
    let file_open_clipboard = MenuItem::with_id(
        app,
        "file.openFromClipboard",
        "クリップボードから TTML を開く",
        true,
        None::<&str>,
    )?;
    let file_save_clipboard = MenuItem::with_id(
        app,
        "file.saveToClipboard",
        "TTML をクリップボードに保存",
        true,
        None::<&str>,
    )?;
    let file_sep_1 = PredefinedMenuItem::separator(app)?;
    let file_sep_2 = PredefinedMenuItem::separator(app)?;

    let edit_undo = MenuItem::with_id(app, "edit.undo", "元に戻す", true, Some("CmdOrCtrl+Z"))?;
    let edit_redo = MenuItem::with_id(app, "edit.redo", "やり直し", true, Some("CmdOrCtrl+Shift+Z"))?;
    let edit_select_all =
        MenuItem::with_id(app, "edit.selectAll", "すべての行を選択", true, None::<&str>)?;
    let edit_unselect_all = MenuItem::with_id(
        app,
        "edit.unselectAll",
        "すべての行の選択を解除",
        true,
        None::<&str>,
    )?;
    let edit_select_inverted =
        MenuItem::with_id(app, "edit.selectInverted", "行の選択を反転", true, None::<&str>)?;
    let edit_select_matched = MenuItem::with_id(
        app,
        "edit.selectWordsOfMatchedSelection",
        "選択内容と一致する単語を選択",
        true,
        None::<&str>,
    )?;
    let edit_delete_selection =
        MenuItem::with_id(app, "edit.deleteSelection", "選択を削除", true, None::<&str>)?;
    let edit_time_shift = MenuItem::with_id(app, "edit.timeShift", "時間をシフト…", true, None::<&str>)?;
    let edit_metadata =
        MenuItem::with_id(app, "edit.metadata", "歌詞メタデータを編集…", true, None::<&str>)?;
    let edit_theme_auto =
        MenuItem::with_id(app, "edit.themeAuto", "デバイスのデフォルト", true, None::<&str>)?;
    let edit_theme_light =
        MenuItem::with_id(app, "edit.themeLight", "ライト", true, None::<&str>)?;
    let edit_theme_dark = MenuItem::with_id(app, "edit.themeDark", "ダーク", true, None::<&str>)?;
    let edit_sep_1 = PredefinedMenuItem::separator(app)?;
    let edit_sep_2 = PredefinedMenuItem::separator(app)?;
    let edit_sep_3 = PredefinedMenuItem::separator(app)?;
    let edit_sep_4 = PredefinedMenuItem::separator(app)?;
    let edit_sep_5 = PredefinedMenuItem::separator(app)?;
    let edit_settings = MenuItem::with_id(app, "edit.settings", "設定…", true, None::<&str>)?;

    let tool_auto_segment =
        MenuItem::with_id(app, "tool.autoSegment", "自動分割", true, None::<&str>)?;
    let tool_ruby_segment =
        MenuItem::with_id(app, "tool.rubySegment", "ルビ分割", true, None::<&str>)?;
    let tool_advanced_segment =
        MenuItem::with_id(app, "tool.advancedSegment", "詳細分割…", true, None::<&str>)?;
    let tool_sync_line = 
        MenuItem::with_id(app, "tool.syncLineTimestamps", "行のタイムスタンプを同期", true, None::<&str>)?;
    let tool_distribute_roman =
        MenuItem::with_id(app, "tool.distributeRomanization", "ローマ字を分配…", true, None::<&str>)?;
    let tool_check_roman =
        MenuItem::with_id(app, "tool.checkRomanizationWarnings", "単語ごとのローマ字を確認", true, None::<&str>)?;
    let tool_auto_ruby = MenuItem::with_id(app, "tool.autoRuby", "自動ルビ", true, None::<&str>)?;
    let tool_sync_input =
        MenuItem::with_id(app, "tool.syncInputOffset", "音声遅延（キー入力補正）…", true, None::<&str>)?;
    let tool_latency_test =
        MenuItem::with_id(app, "tool.latencyTest", "音声／入力レイテンシのテスト", true, None::<&str>)?;
    let tool_sep_1 = PredefinedMenuItem::separator(app)?;
    let tool_sep_2 = PredefinedMenuItem::separator(app)?;

    let help_github = MenuItem::with_id(app, "help.github", "GitHub", true, None::<&str>)?;
    let help_wiki = MenuItem::with_id(app, "help.wiki", "Wiki", true, None::<&str>)?;

    let edit_theme_menu = Submenu::with_items(
        app,
        "テーマ",
        true,
        &[&edit_theme_auto, &edit_theme_light, &edit_theme_dark],
    )?;
    let tool_segmentation_menu = Submenu::with_items(
        app,
        "分割ツール",
        true,
        &[&tool_auto_segment, &tool_ruby_segment, &tool_advanced_segment],
    )?;
    let tool_romanization_menu = Submenu::with_items(
        app,
        "単語ごとのローマ字",
        true,
        &[&tool_distribute_roman, &tool_check_roman],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "ファイル",
        true,
        &[
            &file_new,
            &file_open,
            &file_save,
            &file_save_as,
            &file_sep_1,
            &file_apple,
            &file_restore,
            &file_sep_2,
            &file_open_clipboard,
            &file_save_clipboard,
        ],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "編集",
        true,
        &[
            &edit_undo,
            &edit_redo,
            &edit_sep_1,
            &edit_select_all,
            &edit_unselect_all,
            &edit_select_inverted,
            &edit_select_matched,
            &edit_sep_2,
            &edit_delete_selection,
            &edit_sep_3,
            &edit_time_shift,
            &edit_sep_4,
            &edit_metadata,
            &edit_sep_5,
            &edit_theme_menu,
            &edit_settings,
        ],
    )?;
    let tool_menu = Submenu::with_items(
        app,
        "ツール",
        true,
        &[
            &tool_segmentation_menu,
            &tool_sync_line,
            &tool_sep_1,
            &tool_romanization_menu,
            &tool_auto_ruby,
            &tool_sep_2,
            &tool_sync_input,
            &tool_latency_test,
        ],
    )?;
    let help_menu = Submenu::with_items(app, "ヘルプ", true, &[&help_github, &help_wiki])?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &tool_menu, &help_menu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::missing_panics_doc)]
pub fn run() {
    use tauri::{Emitter, Manager};

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_process::init())
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("native-menu-action", event.id().0.as_str());
            }
        });

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let menu = build_native_menu(app)?;
            app.set_menu(menu)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "macos")]
            {
                use tauri_plugin_decorum::WebviewWindowExt;

                let main_window = app.get_webview_window("main").unwrap();
                main_window.set_traffic_lights_inset(16.0, 20.0).unwrap();
                main_window.make_transparent().unwrap();
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |evt| {
                    if let tauri::WindowEvent::Resized(_) = evt {
                        main_window_clone
                            .set_traffic_lights_inset(16.0, 20.0)
                            .unwrap();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_open_file_data,])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
