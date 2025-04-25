import unreal

selected_asset: unreal.Object = unreal.EditorUtilityLibrary.get_selected_assets()[0]

is_blueprint = selected_asset.get_class().get_name() == 'Blueprint'

print('Selected asset is blueprint: ', selected_asset)

if is_blueprint:
    result_unused_varuable = unreal.BlueprintEditorLibrary.remove_unused_variables(selected_asset)
    print('Blueprint: ', selected_asset.get_name(), ' Removed ', result_unused_varuable, ' unused variables')