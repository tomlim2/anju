import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
selected_sm:unreal.SkeletalMesh = selected_assets[0]

# set data asset
destination_path_array = selected_sm.get_path_name().split('/')
new_da_path = '/'.join(destination_path_array[:-1]) + '/DA_' + selected_sm.get_name()
blueprint_asset = unreal.load_asset(new_da_path)
does_da_exist = blueprint_asset != None

if(does_da_exist == False):
    print('data asset does not exist')
    exit()

loaded_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
loaded_subsystem.open_editor_for_assets([blueprint_asset])

# /Game/Content/RnD/ProjectVamBo/Enum_Vambo
