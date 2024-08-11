import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()

original_path = '/Game/RnD/Outlines/VRM4U/MI_Vrm4UCineV_Outline'
original_outline_mic = unreal.load_asset(original_path)

target_path = '/Game/RnD/Outlines/VRM4U/MI_CinevTarget_Outline'
target_outline_mic = unreal.load_asset(target_path)

original_txt_params = original_outline_mic.get_editor_property('texture_parameter_values')

for asset in selected_assets :
    loaded_asset: unreal.MaterialInstanceConstant = asset
    
    if loaded_asset.__class__ == unreal.MaterialInstanceConstant:
        txt_params:list[unreal.TextureParameterValue] = loaded_asset.get_editor_property('texture_parameter_values')
        new_txt_params: list[unreal.TextureParameterValue] = []
        for txt_param in txt_params:
            parameter_info = txt_param.get_editor_property('parameter_info')
            parameter_value = txt_param.get_editor_property('parameter_value')   
        
        new_txt_params = txt_params
        
        #outline set
        target_outline_mic.set_editor_property('texture_parameter_values', new_txt_params)

        #duplicate
        loaded_asset_name_array = loaded_asset.get_name().split('_')
        loaded_asset_name = '_'.join(loaded_asset_name_array[1:])
        destination_path = loaded_asset.get_path_name()
        name_wip = 'MI_' + loaded_asset_name +'_Outline'
        new_name = name_wip # + '.' + name_wip
        destination_path_array = destination_path.split('/')
        new_path = '/'.join(destination_path_array[:-1]) + '/' + new_name
        print(new_path)
        
        #execute
        loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)        
        # loaded_subsystem.open_editor_for_assets([main_material])
        loaded_subsystem.duplicate_asset(target_path, new_path)
        loaded_subsystem.save_asset(new_path)
        
#reset
target_outline_mic.set_editor_property('texture_parameter_values', original_txt_params)
print('done?')