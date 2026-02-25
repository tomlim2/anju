import unreal

asset_path:str
key:str
value:str


loaded_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
unreal.EditorAssetLibrary.set_metadata_tag(loaded_asset, key, value)