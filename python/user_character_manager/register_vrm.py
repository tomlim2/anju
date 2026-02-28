"""Headless VRM registration: commandlet → verify → assets.info.

Runs the same pipeline as CharacterCreatorGUI.bulk_register without the GUI.
Reads paths from character_creator_config.json (shared with the GUI).
"""

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import uuid
from datetime import datetime


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "character_creator_config.json")
ASSETS_INFO = os.path.join(SCRIPT_DIR, "assets.info")
COMMANDLET_SOURCE = r"E:\CINEVStudio\CINEVStudio\Source\Cinev\CLI\CinevCreateUserCharacterCommandlet.cpp"
PATCH_ORIGINAL = "if (!InitializeWorldAndGameInstance())"
PATCH_REPLACE = "if (!InitializeWorldAndGameInstance(FString(), false, false))"


def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"ERROR: Config not found: {CONFIG_FILE}")
        print("Run the Character Creator GUI once to set paths.")
        sys.exit(1)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def check_zen_server(port=8558, timeout=1.0):
    for host in ("::1", "127.0.0.1"):
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except (ConnectionRefusedError, OSError, TimeoutError):
            pass
    return False


def patch_source():
    try:
        with open(COMMANDLET_SOURCE, "r", encoding="utf-8") as f:
            content = f.read()
        if PATCH_ORIGINAL in content:
            content = content.replace(PATCH_ORIGINAL, PATCH_REPLACE, 1)
            with open(COMMANDLET_SOURCE, "w", encoding="utf-8") as f:
                f.write(content)
            print("[Patch] Applied")
            return True
        elif PATCH_REPLACE in content:
            print("[Patch] Already applied")
            return True
        else:
            print("[Patch] WARNING: target string not found")
            return False
    except Exception as e:
        print(f"[Patch] Error: {e}")
        return False


def restore_source():
    try:
        with open(COMMANDLET_SOURCE, "r", encoding="utf-8") as f:
            content = f.read()
        if PATCH_REPLACE in content:
            content = content.replace(PATCH_REPLACE, PATCH_ORIGINAL, 1)
            with open(COMMANDLET_SOURCE, "w", encoding="utf-8") as f:
                f.write(content)
            print("[Patch] Restored")
    except Exception as e:
        print(f"[Patch] Restore error: {e}")


def load_assets():
    if os.path.exists(ASSETS_INFO):
        with open(ASSETS_INFO, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_assets(data):
    with open(ASSETS_INFO, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description="Register VRM files as user characters")
    parser.add_argument("vrm_files", nargs="+", help="VRM file paths to register")
    parser.add_argument("--gender", default="Female", choices=["Male", "Female"])
    parser.add_argument("--scaling", default="Original")
    parser.add_argument("--source", default="VRM")
    parser.add_argument("--no-build", action="store_true", help="Skip UE build step")
    args = parser.parse_args()

    # Validate VRM files
    vrm_files = []
    for p in args.vrm_files:
        p = os.path.normpath(p)
        if not os.path.isfile(p):
            print(f"WARNING: File not found, skipping: {p}")
            continue
        if not p.lower().endswith(".vrm"):
            print(f"WARNING: Not a .vrm file, skipping: {p}")
            continue
        vrm_files.append(p)

    if not vrm_files:
        print("ERROR: No valid VRM files provided.")
        sys.exit(1)

    # Load config
    config = load_config()
    ue_dir = config.get("ue_dir", "")
    project_file = os.path.normpath(config.get("project_file", ""))
    output_folder = os.path.normpath(config.get("output_folder", ""))

    exe_path = os.path.normpath(os.path.join(ue_dir, "Engine", "Binaries", "Win64", "UnrealEditor-Cmd.exe"))
    if not os.path.exists(exe_path):
        print(f"ERROR: UnrealEditor-Cmd.exe not found: {exe_path}")
        sys.exit(1)
    if not os.path.exists(project_file):
        print(f"ERROR: Project file not found: {project_file}")
        sys.exit(1)

    user_char_folder = os.path.normpath(
        os.path.join(os.path.dirname(project_file), "Saved", "SaveGames", "UserCharacter")
    )
    os.makedirs(user_char_folder, exist_ok=True)
    os.makedirs(output_folder, exist_ok=True)

    # ZenServer check
    if not check_zen_server():
        print("ERROR: ZenServer (port 8558) is not running.")
        print("Start ZenServer before registering characters.")
        sys.exit(1)

    # Patch + Build (matches GUI: Popen with CREATE_NEW_CONSOLE)
    patch_source()
    try:
        if not args.no_build:
            build_bat = os.path.normpath(os.path.join(ue_dir, "Engine", "Build", "BatchFiles", "Build.bat"))
            if os.path.exists(build_bat):
                print("=== Building (patched source) ===")
                build_cmd = f'"{build_bat}" CINEVStudioEditor Win64 Development -Project="{project_file}" -WaitMutex'
                build_process = subprocess.Popen(build_cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
                build_process.wait()
                if build_process.returncode != 0:
                    print(f"ERROR: Build failed (code {build_process.returncode})")
                    return
                print("Build OK\n")

        assets_data = load_assets()
        added = 0
        failed = 0
        total = len(vrm_files)

        for i, vrm_path in enumerate(vrm_files):
            stem = os.path.splitext(os.path.basename(vrm_path))[0]
            display_name = stem[:12]
            print(f"\n=== [{i+1}/{total}] {display_name} ===")

            # Step 1: JSON
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_data = {
                "Gender": args.gender,
                "DisplayName": display_name,
                "ScalingMethod": args.scaling,
                "ModelSourceType": args.source,
            }
            json_file = os.path.join(output_folder, f"{display_name}_{timestamp}.json")
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(json_data, f, indent=2)
            print(f"  1) JSON: {os.path.basename(json_file)}")

            # Step 2: Commandlet (matches GUI: Popen with CREATE_NEW_CONSOLE)
            before_files = set(os.listdir(output_folder))
            cmd = (
                f'"{exe_path}" "{project_file}" '
                f'-run=CinevCreateUserCharacter '
                f'-UserCharacterJsonPath="{json_file}" '
                f'-UserCharacterVrmPath="{vrm_path}" '
                f'-OutputPath="{output_folder}" '
                f'-stdout -nopause -unattended -AllowCommandletRendering -RenderOffScreen'
            )
            print(f"  2) Commandlet running...")
            process = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
            process.wait()
            print(f"     Exit code: {process.returncode}")

            # Step 3: Verify & move
            after_files = set(os.listdir(output_folder))
            new_files = after_files - before_files
            new_characters = [f for f in new_files if f.endswith(".character")]

            thumb_file = ""
            if new_characters:
                char_file = new_characters[0]
                src = os.path.join(output_folder, char_file)
                dst = os.path.join(user_char_folder, char_file)
                shutil.move(src, dst)
                print(f"  3) Moved: {char_file} → UserCharacter/")

                char_stem = os.path.splitext(char_file)[0]
                thumb_name = f"thumb_{char_stem}_01.png"
                thumb_src = os.path.join(output_folder, thumb_name)
                if os.path.exists(thumb_src):
                    shutil.move(thumb_src, os.path.join(user_char_folder, thumb_name))
                    thumb_file = thumb_name
                    print(f"     Thumbnail: {thumb_name}")
                else:
                    print(f"     Thumbnail not found: {thumb_name}")
            else:
                char_file = f"{display_name}.character"
                print(f"  3) No new .character detected, using default: {char_file}")
                failed += 1

            # Step 4: assets.info
            preset_id = str(uuid.uuid4())
            assets_data.insert(0, {
                "Preset_id": preset_id,
                "Gender": args.gender,
                "DisplayName": display_name,
                "CharacterFilePath": char_file,
                "CategoryName": "CharacterCategory.VRM",
                "ThumbnailFileName": thumb_file,
            })
            save_assets(assets_data)
            added += 1
            print(f"  4) Registered in assets.info")

        result = f"Done. {added}/{total} registered"
        if failed:
            result += f", {failed} without .character file"
        print(f"\n=== {result} ===")

    finally:
        restore_source()


if __name__ == "__main__":
    main()
