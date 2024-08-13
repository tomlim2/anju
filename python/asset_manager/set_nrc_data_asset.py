import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

## set sm materials
sm_materials = []
selected_sm:unreal.SkeletalMesh = selected_assets[0]

for material in selected_sm.materials:
    mic:unreal.MaterialInstanceConstant = material.material_interface
    sm_materials.append(mic)

print('set materials done')

# generate outline materials
original_path = '/Game/RnD/Outlines/VRM4U/MI_Vrm4UCineV_Outline'
original_outline_mic = unreal.load_asset(original_path)

target_path = '/Game/RnD/Outlines/VRM4U/MI_CinevTarget_Outline'
target_outline_mic = unreal.load_asset(target_path)

original_txt_params = original_outline_mic.get_editor_property('texture_parameter_values')

for asset in sm_materials :
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
        destination_path = loaded_asset.get_path_name()
        name_wip = loaded_asset.get_name() +'_Outline'
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

print('make outline materials done')



# set outline materials from selected skeletal mesh
outline_materials = []

for material in sm_materials:
    mic:unreal.MaterialInstanceConstant = material
    mic_path_array = mic.get_path_name().split('/')
    mic_path = '/'.join(mic_path_array[:-1])
    mic_outline_name = mic.get_name() + '_Outline'
    mic_outline_path = mic_path + '/' + mic_outline_name
    loaded_mic = loaded_subsystem.load_asset(mic_outline_path)
    outline_materials.append(loaded_mic)

print('outline materials set done')

## set data asset
target_da_path = "/Game/RnD/Common/DataAsset/DA_Target"
destination_path_array = selected_sm.get_path_name().split('/')
new_da_path = '/'.join(destination_path_array[:-1]) + '/DA_' + selected_sm.get_name()

## duplicate and save
loaded_subsystem.duplicate_asset(target_da_path, new_da_path)
loaded_subsystem.save_asset(new_da_path)


## set variables to data asset
blueprint_asset = unreal.EditorAssetLibrary.load_asset(new_da_path)


### set materials to data asset
property_info = {'Materials': sm_materials}
blueprint_asset.set_editor_properties(property_info)
loaded_subsystem.save_asset(new_da_path)

### set outline materials to data asset
property_info = {'Outline_Materials': outline_materials}
blueprint_asset.set_editor_properties(property_info)
loaded_subsystem.save_asset(new_da_path)

print('data asset set done')