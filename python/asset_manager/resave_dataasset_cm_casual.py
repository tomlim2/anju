import unreal

print("DataAsset Resave Start")

# DataTable path - update this to your DataTable
selected_datatable = unreal.EditorUtilityLibrary.get_selected_assets()[0]
datatable_path = selected_datatable.get_path_name()

# Load the DataTable
dt_asset = unreal.EditorAssetLibrary.load_asset(datatable_path)
if not dt_asset:
	print(f"Failed to load DataTable: {datatable_path}")
	raise SystemExit

print(f"Loaded DataTable: {datatable_path}")

# Get all row names
row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(dt_asset)
print(f"Total rows: {len(row_names)}")

# Get NRCDataAsset column
try:
	nrc_dataasset_column = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(dt_asset, "NRCDataAsset")
	print(f"Found NRCDataAsset column with {len(nrc_dataasset_column)} entries")
except Exception as e:
	print(f"Failed to get NRCDataAsset column: {e}")
	raise SystemExit

# Process each DataAsset
saved_count = 0
failed_count = 0

for idx, nrc_dataasset_str in enumerate(nrc_dataasset_column):
	row_name = row_names[idx]

	if nrc_dataasset_str:
		print(f"\nRow '{row_name}': {nrc_dataasset_str}")

		# Load the DataAsset
		data_asset = unreal.EditorAssetLibrary.load_asset(nrc_dataasset_str)

		if data_asset:
			# Check out from source control
			unreal.EditorAssetLibrary.checkout_loaded_asset(data_asset)

			# Mark the asset as dirty to force recompile
			data_asset.modify()

			# Get the asset subsystem to recompile
			asset_editor_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)

			# Recompile/reimport the asset
			success = unreal.EditorAssetLibrary.save_loaded_asset(data_asset)

			if success:
				print(f"  ✓ Recompiled: {nrc_dataasset_str}")
				saved_count += 1
			else:
				print(f"  ✗ Failed to recompile: {nrc_dataasset_str}")
				failed_count += 1
		else:
			print(f"  ✗ Failed to load: {nrc_dataasset_str}")
			failed_count += 1
	else:
		print(f"Row '{row_name}': No DataAsset assigned")

print(f"\n=== Summary ===")
print(f"Recompiled: {saved_count}")
print(f"Failed: {failed_count}")
print(f"Total: {len(row_names)}")
