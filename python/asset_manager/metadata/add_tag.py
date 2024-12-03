import unreal

input_tags:str = "[hi,no,yes]"
input_list = input_tags.strip('[]').split(',')

output_list:list[list[str, str]] = [[]]
selected_assets:list[unreal.Object] = unreal.EditorUtilityLibrary.get_selected_assets()

for asset in selected_assets:
    loaded_asset = unreal.EditorAssetLibrary.load_asset(asset.get_path_name().split('.')[0])
    all_metadata = unreal.EditorAssetLibrary.get_metadata_tag_values(loaded_asset)
    new_key_value = []
    has_tag = False
    for tag_name, value in all_metadata.items():
        if tag_name == '#':
            has_tag = True
            value_array = value.strip('[]').split(',')
            for item in input_list:
                if item not in value:
                    value_array.append(item)
            # print(value_array)
            value_string = '[' + ','.join(value_array) + ']'
            new_key_value = ['#', value_string]
            print(value_string)
        if has_tag == False:
            new_key_value = ['#', input_tags]
    unreal.EditorAssetLibrary.set_metadata_tag(asset, new_key_value[0], new_key_value[1])
    unreal.EditorAssetLibrary.save_asset(asset.get_path_name())
    





print(input_list)
