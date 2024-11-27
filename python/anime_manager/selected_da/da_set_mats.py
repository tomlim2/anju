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
da_irochi_name = str(get_da_item(selected_data_asset, "Irochi"))

#####################
#####################

da_sm_materials = get_sm_materials(da_sm)

print(type(da_sm_materials))
print(type(get_da_list(selected_data_asset, "Materials")))

if da_irochi_name == 'Original':
    print (da_sm_materials)
    set_da_list(selected_data_asset, "Materials", da_sm_materials)
    exit()

new_mats: list[unreal.Object] = []

for material in da_sm_materials:
    material_path_array = material.get_path_name().split('/')
    mat_irochi_name = material.get_name() + '_' + da_irochi_name
    mat_irochi_path = '/'.join(material_path_array[:-1]) + '/' + mat_irochi_name

    does_exist = loaded_subsystem.does_asset_exist(mat_irochi_path)
    if does_exist == True:
        loaded_mic = loaded_subsystem.load_asset(mat_irochi_path)
        new_mats.append(loaded_mic)
    else: 
        loaded_mic = loaded_subsystem.load_asset(material.get_path_name())  
        new_mats.append(loaded_mic)

set_da_list(selected_data_asset, "Materials", new_mats)