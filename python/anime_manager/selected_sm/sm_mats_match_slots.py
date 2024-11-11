import unreal

selected_assets: list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()

if not isinstance(selected_assets[0], unreal.SkeletalMesh):
    print('Please select a skeletal mesh')
    exit()

selected_sm: unreal.SkeletalMesh = selected_assets[0]
sm_path = selected_sm.get_path_name()
sm_skeletal_mats = selected_sm.materials

new_skeletal_mats = []

for skeletal_mat in sm_skeletal_mats:
    slot_name = str(skeletal_mat.material_slot_name)
    slot_part_name = slot_name.split('_')[0]
    print('mat:', skeletal_mat)

    sm_path_array = sm_path.split('/')
    mats_folder_path = '/'.join(sm_path_array[:-1]) + '/Materials' 
    mat_name = 'MI_' + slot_part_name.capitalize()
    mat_path = mats_folder_path + '/' + mat_name

    does_exist = unreal.EditorAssetLibrary.does_asset_exist(mat_path)
    print('material_path:', does_exist)
    if does_exist == True:
        loaded_mat = unreal.EditorAssetLibrary.load_asset(mat_path)
        skeletal_mat.material_interface = loaded_mat
    new_skeletal_mats.append(skeletal_mat)
selected_sm.set_editor_property('Materials', new_skeletal_mats)