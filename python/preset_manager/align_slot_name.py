import unreal

path_dt_cm_casuel = "/Game/Customizing/Blueprints/Structs/Lists/UniqueSet/DT_CM_Casual.DT_CM_Casual"

# Load the data table
loaded_datatable: unreal.DataTable = unreal.EditorAssetLibrary.load_asset(path_dt_cm_casuel)

if not loaded_datatable:
    print(f"Failed to load data table: {path_dt_cm_casuel}")
    raise SystemExit

# Get all row names
row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(loaded_datatable)

# Get the NRCDataAsset column
try:
    nrc_dataasset_column = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(loaded_datatable, "NRCDataAsset")
except Exception as e:
    print(f"Failed to get NRCDataAsset column: {e}")
    raise SystemExit

# Process all data assets
for idx, row_name in enumerate(row_names):
    nrc_dataasset_str = nrc_dataasset_column[idx]
    if nrc_dataasset_str:
        data_asset = unreal.EditorAssetLibrary.load_asset(nrc_dataasset_str)
        if data_asset:
            # Get SK_AnimePartHead and its display name
            sk_head = data_asset.get_editor_property('SK_AnimePartHead')
            if sk_head:
                head_display_name = sk_head.get_name()
                print(f"{head_display_name}")

                # Only process CustomMaterialsHead if head name is "Azul_Head"
                if head_display_name == "Azul_Head":
                    # Get CustomMaterialsHead
                    custom_materials_head = data_asset.get_editor_property('CustomMaterialsHead')
                    if custom_materials_head:
                        # Define key rename mappings
                        key_renames = {
                            "MI_Eyelash_Upper_MTL": "Eyelash_Upper_MTL",
                            "MI_Eyelash_Lower_MTL": "Eyelash_Lower_MTL",
                        }

                        modified = False
                        for old_key, new_key in key_renames.items():
                            if old_key in custom_materials_head:
                                # Get the value associated with the old key
                                material_value = custom_materials_head[old_key]

                                # Remove the old key
                                del custom_materials_head[old_key]

                                # Add with the new key
                                custom_materials_head[new_key] = material_value

                                print(f"  Renamed key: {old_key} -> {new_key}")
                                modified = True

                        if modified:
                            # Set the modified map back to the data asset
                            data_asset.set_editor_property('CustomMaterialsHead', custom_materials_head)

                            # Save the data asset
                            unreal.EditorAssetLibrary.save_asset(data_asset.get_path_name())

