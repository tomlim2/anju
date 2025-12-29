import unreal
import os
import re # 정규표현식 사용 (UDIM 숫자 추출용)

# ==========================================
# [설정 영역]
# ==========================================

# 1. PC 내보내기 베이스 폴더 (하위에 에셋별 폴더가 생성됩니다)
DISK_EXPORT_PATH = "D:/vs/anju/python/texture_manager/udim/exported"


# ==========================================
# [함수 정의]
# ==========================================

def process_selected_udims():
    # 1. 현재 선택된 에셋 가져오기
    selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()

    if not selected_assets:
        unreal.log_warning("No assets selected. Please select UDIM Texture assets in the Content Browser.")
        return

    # 텍스처만 필터링 (UDIM/VT 체크)
    texture_assets = []
    for asset in selected_assets:
        if isinstance(asset, unreal.Texture):
            texture_assets.append(asset)
            unreal.log(f"Selected texture: {asset.get_name()}")

    if not texture_assets:
        unreal.log_error("No textures selected! Please select Texture assets in the Content Browser.")
        unreal.log_error("Script execution cancelled.")
        return

    asset_count = len(texture_assets)
    unreal.log(f"Found {asset_count} texture(s) for processing...")

    # 선택된 에셋을 텍스처로 변경
    selected_assets = texture_assets

    # 슬로우 태스크(진행바) 시작
    with unreal.ScopedSlowTask(asset_count + 2, f"Processing {asset_count} UDIM Assets...") as slow_task:
        slow_task.make_dialog(True)

        # --- STEP 1: Export (.png로 내보내기) ---
        slow_task.enter_progress_frame(1, "Exporting Selected Assets...")

        export_tasks = []
        base_name_to_folder = {}  # base_name -> original folder path 매핑
        exported_base_names = set()  # 현재 세션에서 export한 base name만 추적

        for asset in selected_assets:
            # 텍스처인지 확인 (Texture2D, TextureRenderTarget 등)
            if not isinstance(asset, unreal.Texture):
                unreal.log_warning(f"Skipping {asset.get_name()}: Not a Texture.")
                continue

            # 에셋 정보 가져오기
            asset_name = asset.get_name()
            package_path = asset.get_package().get_path_name()
            folder_path = os.path.dirname(package_path)

            # UDIM 패턴 확인하여 base name 추출 (예: T_Body.1001 -> T_Body)
            udim_match = re.search(r'(\.\d{4})$', asset_name)
            if udim_match:
                base_name = asset_name[:udim_match.start()]
            else:
                base_name = asset_name

            # 원본 폴더 경로 저장
            if base_name not in base_name_to_folder:
                base_name_to_folder[base_name] = folder_path

            # 현재 세션에서 export한 base name 추적
            exported_base_names.add(base_name)

            # 에셋별 export 폴더 생성 (exported/base_name/)
            asset_export_dir = os.path.join(DISK_EXPORT_PATH, base_name)
            os.makedirs(asset_export_dir, exist_ok=True)

            # Export 경로 설정
            export_path = os.path.join(asset_export_dir, f"{asset_name}.png")

            # Export Task 설정
            task = unreal.AssetExportTask()
            task.object = asset
            task.filename = export_path
            task.automated = True
            task.replace_identical = True
            task.prompt = False
            task.exporter = unreal.TextureExporterPNG()

            export_tasks.append(task)

        # 내보내기 실행
        if len(export_tasks) > 0:
            unreal.Exporter.run_asset_export_tasks(export_tasks)
            unreal.log("Export complete!")
        else:
            unreal.log_error("No valid textures found in selection.")
            return

        # --- STEP 2: Renaming (디스크 상에서 이름 변경) ---
        slow_task.enter_progress_frame(1, "Renaming Files on Disk...")

        renamed_count = 0
        renamed_files_info = []  # (파일 경로, 임포트 대상 폴더) 리스트

        # 현재 세션에서 export한 base name만 처리
        for base_name_dir in exported_base_names:
            dir_path = os.path.join(DISK_EXPORT_PATH, base_name_dir)
            if not os.path.isdir(dir_path):
                unreal.log_warning(f"Export directory not found: {dir_path}")
                continue

            # 폴더 내 PNG 파일들을 수집하고 정렬
            png_files = []
            for filename in os.listdir(dir_path):
                if filename.endswith(".png"):
                    png_files.append(filename)

            # 파일명 정렬 (UDIM 번호 순서대로)
            png_files.sort()

            # 순차적 번호 부여 (1, 2, 3...)
            sequential_number = 1

            # 각 폴더 내의 파일 처리
            for filename in png_files:
                old_path = os.path.join(dir_path, filename)
                name_without_ext = os.path.splitext(filename)[0]

                # -----------------------------------------------------------
                # [이름 변경 로직] UDIM 번호를 순차 번호로 변환
                # -----------------------------------------------------------
                # 예: "T_Body.1001.png" -> "T_Body_1.png"
                #     "T_Body.1002.png" -> "T_Body_2.png"

                udim_match = re.search(r'\.(\d{4})$', name_without_ext)

                if udim_match:
                    # UDIM이 있는 경우: [base_name]_[순차번호]
                    base_name = name_without_ext[:udim_match.start()]
                    new_filename = f"{base_name}_{sequential_number}.png"
                    sequential_number += 1
                else:
                    # UDIM이 없는 경우: 이름 그대로
                    new_filename = filename

                new_path = os.path.join(dir_path, new_filename)

                # 이름 변경 실행 (이름이 다를 경우에만)
                if old_path != new_path:
                    os.rename(old_path, new_path)
                    unreal.log(f"Renamed: {filename} -> {new_filename}")
                    renamed_count += 1

                # 임포트 정보 저장 (원본 폴더 경로 사용)
                dest_folder = base_name_to_folder.get(base_name_dir, "/Game/Textures")
                renamed_files_info.append((new_path, dest_folder))

        unreal.log(f"Renamed {renamed_count} files.")

        # --- STEP 3: Import (모든 리네이밍된 텍스처 임포트) ---
        slow_task.enter_progress_frame(1, "Importing All Renamed Textures...")

        total_files = len(renamed_files_info)
        unreal.log(f"Importing {total_files} renamed texture files...")

        import_tasks = []

        for file_path, dest_path in renamed_files_info:
            # 파일 경로를 forward slash로 변환 (Unreal Engine 요구사항)
            normalized_path = file_path.replace("\\", "/")

            file_name = os.path.basename(file_path)
            unreal.log(f"Import: {file_name} -> {dest_path}")

            task = unreal.AssetImportTask()
            task.filename = normalized_path
            task.destination_path = dest_path
            task.automated = True
            task.replace_existing = False  # 새 에셋으로 생성
            task.save = True

            import_tasks.append(task)

        if len(import_tasks) > 0:
            unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(import_tasks)
            unreal.log(f"Success: Imported {len(import_tasks)} texture files.")

            # --- STEP 4: Consolidate references and delete original UDIM textures ---
            unreal.log("Consolidating references to original UDIM textures...")

            editor_asset_lib = unreal.EditorAssetLibrary()

            for base_name, original_folder in base_name_to_folder.items():
                # 원본 UDIM 텍스처 경로 (예: /Game/.../T_LicensePlate_C)
                original_asset_path = f"{original_folder}/{base_name}.{base_name}"

                # 새로 임포트된 첫 번째 텍스처 경로 (예: /Game/.../T_LicensePlate_C_1)
                new_asset_name = f"{base_name}_1"
                new_asset_path = f"{original_folder}/{new_asset_name}.{new_asset_name}"

                unreal.log(f"Consolidating: {original_asset_path} -> {new_asset_path}")

                # 원본 에셋이 존재하는지 확인
                if not editor_asset_lib.does_asset_exist(original_asset_path):
                    unreal.log_warning(f"Original asset not found: {original_asset_path}")
                    continue

                # 새 에셋이 존재하는지 확인
                if not editor_asset_lib.does_asset_exist(new_asset_path):
                    unreal.log_warning(f"New asset not found: {new_asset_path}")
                    continue

                # 레퍼런스 찾기
                referencers = editor_asset_lib.find_package_referencers_for_asset(original_asset_path, False)
                unreal.log(f"Found {len(referencers)} referencers for {base_name}")

                # 원본 및 새 에셋 로드
                original_asset = editor_asset_lib.load_asset(original_asset_path)
                new_asset = editor_asset_lib.load_asset(new_asset_path)

                if not original_asset or not new_asset:
                    unreal.log_error(f"Failed to load assets for {base_name}")
                    continue

                # Consolidate: 원본의 모든 레퍼런스를 새 에셋으로 교체
                assets_to_consolidate = [original_asset]
                asset_to_consolidate_to = new_asset

                # EditorAssetSubsystem 사용
                editor_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
                success = editor_subsystem.consolidate_assets(asset_to_consolidate_to, assets_to_consolidate)

                if success:
                    unreal.log(f"Successfully consolidated {base_name} -> {new_asset_name}")
                    unreal.log(f"Original UDIM texture deleted: {original_asset_path}")
                else:
                    unreal.log_error(f"Failed to consolidate {base_name}")

            unreal.log("Consolidation complete!")
        else:
            unreal.log_warning("No files to import.")

    unreal.log("Batch Processing Complete.")

# 실행
if __name__ == "__main__":
    process_selected_udims()