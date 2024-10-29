import unreal

def open_level(level_path):
    if unreal.EditorAssetLibrary.does_asset_exist(level_path):
        unreal.EditorLevelLibrary.load_level(level_path)
        print(f"Successfully opened level: {level_path}")
    else:
        print(f"Level path '{level_path}' does not exist.")

target_path:str
open_level(target_path)