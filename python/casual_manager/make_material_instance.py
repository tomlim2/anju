import unreal

selectedAsset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

material_instance_path = '/Game/RnD/Common/Materials/MI_Main_PMX_Second_Raid.uasset'
unreal.EditorAssetLibrary.duplicate_asset(selectedAsset, '/Game/RnD/Common/Blueprint/BPC_Pmx_Wrapper')