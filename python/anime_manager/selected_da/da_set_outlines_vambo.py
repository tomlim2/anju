import unreal

def get_da_list(da:unreal.PrimaryDataAsset, property_name:str) -> list[unreal.Object]:
    return unreal.PrimaryDataAsset.get_editor_property(da, property_name)

def get_da_item(da:unreal.PrimaryDataAsset, property_name:str) -> unreal.SkeletalMesh:
    return unreal.PrimaryDataAsset.get_editor_property(da, property_name)

def set_da_list(blueprint_asset, property_name:str ,sm_materials):
    key_name = property_name
    property_info = {key_name: sm_materials}
    blueprint_asset.set_editor_properties(property_info)
    return blueprint_asset.set_editor_properties(property_info)

def get_sm_materials(selected_sm:unreal.SkeletalMesh) -> list[unreal.MaterialInstanceConstant]:
    sm_materials = []
    for material in selected_sm.materials:
        mic:unreal.MaterialInstanceConstant = material.material_interface
        sm_materials.append(mic)
    return sm_materials

selected_data_asset: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()[0]
loaded_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

if selected_data_asset.__class__ != unreal.PrimaryDataAsset:
    print('data asset does not exist')
    exit()

#set variables
da_path = selected_data_asset.get_path_name()
da_materials = get_da_list(selected_data_asset, "Materials")
da_outlines = get_da_list(selected_data_asset, "OutlineMaterials")
da_sm = get_da_item(selected_data_asset, "SkeletalMesh")
da_base_outline = get_da_item(selected_data_asset, "BasicOutlineMaterial")
da_clear = get_da_item(selected_data_asset, "ClearMaterial")
da_cha_name = str(get_da_item(selected_data_asset, "CharacterName"))

#####################
#####################

new_outlines = []
clear_list = ['eye', 'oral', 'tooth', 'toungue', 'mouth', 'tongue']

for material in da_materials:
    if material == None:
        new_outlines.append(None)
        continue
    da_path_array = da_path.split('/')
    material_path = '/'.join(da_path_array[:-1]) + '/materials'
    part_name = material.get_name().split('_')[1]

    # print(part_name)
    ## check clear list
    onClearList = False
    for clear in clear_list:
        if clear in part_name.lower():
            new_outlines.append(da_clear)
            onClearList = True
            continue
    if onClearList:
        print('set mi_clear')
        continue

    mic_outline_name = 'MI_' + da_cha_name + '_' + part_name + '_Outline'
    print(mic_outline_name)
    mic_outline_path = material_path + '/' + mic_outline_name

    does_outline_exist = loaded_subsystem.does_asset_exist(mic_outline_path)
    if(does_outline_exist == False):
        new_outlines.append(da_base_outline)
    else:
        loaded_mic = loaded_subsystem.load_asset(mic_outline_path)
        new_outlines.append(loaded_mic)
    
set_da_list(selected_data_asset, 'OutlineMaterials' ,new_outlines)

loaded_subsystem.save_asset(selected_data_asset.get_path_name())
print('done')
