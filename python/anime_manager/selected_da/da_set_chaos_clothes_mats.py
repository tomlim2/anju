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
    print('Please select a data asset')
    exit()

#set variables
da_path = selected_data_asset.get_path_name()
da_materials = get_da_list(selected_data_asset, "Materials")
da_outlines = get_da_list(selected_data_asset, "OutlineMaterials")
da_sm = get_da_item(selected_data_asset, "SkeletalMesh")
da_base_outline = get_da_item(selected_data_asset, "BasicOutlineMaterial")
da_clear = get_da_item(selected_data_asset, "ClearMaterial")
da_cha_name = str(get_da_item(selected_data_asset, "CharacterName"))
da_ca = get_da_item(selected_data_asset, "ChaosCloth")

#####################
#####################

ca_mats = da_ca.get_editor_property('Materials')

new_materials = []

for mi in ca_mats:
    mic = mi.material_interface
    print(mic)
    new_materials.append(mic)

set_da_list(selected_data_asset, "ChaosMaterials", new_materials)

loaded_subsystem.save_asset(da_path)