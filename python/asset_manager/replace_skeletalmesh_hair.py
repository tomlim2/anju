import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
datatable_path = "/Script/Engine.DataTable'/Game/Character/Anime/_LookDev/DataTable/DT_LookDevHair.DT_LookDevHair'"
da_cm_parameter_name = "CustomMaterialsHair"
skeletal_mesh_parameter_name = "BaseSkeletalMesh"
skeletal_mesh_parameter_name_part = "SK_AnimePartHair"
skeletal_mesh_to_replace = "/Script/Engine.SkeletalMesh'/Game/Character/Anime/Female/Body/000_Freyja/Skinning/Freyja_hair.Freyja_hair'"

def get_material_list_from_selected_skeletalmesh(selected_asset):
    get_material_list = []

    # For hair, only get material from slot [0]
    skeletal_materials = selected_asset.get_editor_property('materials')
    if skeletal_materials and len(skeletal_materials) > 0:
        try:
            mat_interface = skeletal_materials[0].get_editor_property('material_interface')
        except Exception:
            mat_interface = getattr(skeletal_materials[0], 'material_interface', None)

        if mat_interface:
            get_material_list.append(mat_interface)
            print(f"Hair Material from slot [0]: {mat_interface.get_path_name()}")

    return get_material_list

def get_dataasset_list_from_referencers(selected_asset):
	get_reference_list = unreal.EditorAssetLibrary.find_package_referencers_for_asset(selected_asset.get_path_name())
	data_assets = []
	for reference in get_reference_list:
		loaded_asset = unreal.EditorAssetLibrary.load_asset(reference)
		if loaded_asset:
			if isinstance(loaded_asset, unreal.DataAsset) or isinstance(loaded_asset, unreal.PrimaryDataAsset):
				data_assets.append(reference)
	return data_assets

def get_slot_name_list_from_skeletalmesh_materials(selected_asset, material_list):
	slotname_list = []
	skeletal_materials = selected_asset.get_editor_property('materials')
	for sm in skeletal_materials:
		try:
			mat_interface = sm.get_editor_property('material_interface')
			slot_name = sm.get_editor_property('material_slot_name')
		except Exception:
			mat_interface = getattr(sm, 'material_interface', None)
			slot_name = getattr(sm, 'material_slot_name', None)
		if mat_interface and mat_interface in material_list:
			slotname_list.append(slot_name)
	return slotname_list

def create_slotname_to_material_map(selected_asset, material_list, slotname_list):
	slotname_to_material_map = {}
	for sm in selected_asset.get_editor_property('materials'):
		try:
			mi = sm.get_editor_property('material_interface')
			sn = sm.get_editor_property('material_slot_name')
		except Exception:
			mi = getattr(sm, 'material_interface', None)
			sn = getattr(sm, 'material_slot_name', None)
		if mi and sn in slotname_list and mi in material_list:
			slotname_to_material_map[str(sn)] = mi
	return slotname_to_material_map

def set_skeletal_mesh_in_dataasset (sk_mesh, parameter_name):
	if sk_mesh:
		try:
			da_asset.set_editor_property(parameter_name, sk_mesh)
		except Exception as e:
			print(f"Failed to set {parameter_name} on DataAsset: {e}")
	else:
		print(f"Failed to load SkeletalMesh: {sk_mesh}")


def set_datatable (dt_datatable_path, selected_asset, new_sk_mesh, material_list):
	dt_asset = unreal.EditorAssetLibrary.load_asset(dt_datatable_path)
	print(f"Loaded DataTable: {dt_datatable_path}")

	found_row_name = None
	selected_path = selected_asset.get_path_name()

	if dt_asset:
		row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(dt_asset)
		row_struct = dt_asset.get_editor_property('row_struct')

		try:
			skeletal_mesh_column = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(dt_asset, "SkeletalMesh")
			for idx, sk_mesh_str in enumerate(skeletal_mesh_column):
				row_name = row_names[idx]
				if sk_mesh_str:
					if selected_path in sk_mesh_str or sk_mesh_str in selected_path:
						found_row_name = row_name
						print(f"  >>> MATCH FOUND: Row '{row_name}' matches selected asset!")

						# Open DataTable in editor FIRST before making changes
						editor_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
						editor_subsystem.open_editor_for_assets([dt_asset])
						print(f"  ✓ Opened DataTable in editor")

						if new_sk_mesh:
							new_mesh_path = new_sk_mesh.get_path_name()
							print(f"\n  Attempting manual CSV construction...")

							# Convert material_list to TArray<TSoftObjectPtr<UMaterialInterface>> format for CSV
							materials_str = ""
							if material_list:
								material_paths = [mat.get_path_name() for mat in material_list]
								# Format as array: (path1,path2,path3)
								materials_str = "(" + ",".join(material_paths) + ")"
								print(f"  Built CustomMaterials array with {len(material_list)} materials")

							# Try to discover all columns dynamically from the row struct
							print(f"  Row struct type: {row_struct.get_name()}")
							print(f"  Attempting to discover all columns...")

							# Get the first row to inspect its structure
							first_row_name = row_names[0]

							# Try different approaches to get column names
							discovered_columns = []

							# Approach 1: Try to get struct fields using get_fields_from_struct
							try:
								# This might work in some UE versions
								struct_fields = unreal.SystemLibrary.get_fields_from_struct(row_struct)
								for field in struct_fields:
									discovered_columns.append(field.get_name())
									print(f"  Discovered column via get_fields_from_struct: {field.get_name()}")
							except Exception as e:
								print(f"  get_fields_from_struct not available: {e}")

							# Approach 2: Brute force - try reading many common column names
							if not discovered_columns:
								print(f"  Falling back to brute-force column detection...")
								possible_columns = [
									'SkeletalMesh', 'CustomMaterialsBody', 'CustomMaterialsHead', 'CustomMaterialsFace',
									'CustomMaterials', 'Materials', 'MaterialSlots', "EyebrowColorTexture",
									'OSTexture', 'OSTextureHead', 'OSTextureFace', 'OSTextureBody',
									'BaseSkeletalMesh', 'SK_AnimePartCloth', 'SK_AnimePart',
									'Texture', 'TextureSet', 'MaterialSet',
									'HeadMesh', 'FaceMesh', 'BodyMesh', 'ClothMesh',
									'Description', 'DisplayName', 'Category', 'Tags',
									'PreviewMesh', 'ThumbnailTexture', 'Icon'
								]

								for col_name in possible_columns:
									try:
										col_values = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(dt_asset, col_name)
										if col_values and len(col_values) > 0:
											discovered_columns.append(col_name)
											print(f"  Found column: {col_name}")
									except:
										pass

							available_columns = []
							column_data = {}

							# Now read all discovered columns
							for col_name in discovered_columns:
								try:
									col_values = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(dt_asset, col_name)
									if col_values:
										available_columns.append(col_name)
										column_data[col_name] = col_values
								except:
									pass

							print(f"  Total columns found: {len(available_columns)}")

							if available_columns:
								# Build CSV
								csv_lines = []
								csv_lines.append('---,' + ','.join(available_columns))

								for row_idx in range(len(row_names)):
									row_line = [str(row_names[row_idx])]
									for col_name in available_columns:
										value = column_data[col_name][row_idx]

										# Replace values for matching row
										if row_idx == idx:
											if col_name == 'SkeletalMesh':
												value = new_mesh_path
												print(f"  Replacing SkeletalMesh: {sk_mesh_str} -> {new_mesh_path}")
											elif 'CustomMaterials' in col_name and materials_str:
												value = materials_str
												print(f"  Replacing {col_name} with {len(material_list)} materials")

										# Properly escape CSV values - replace double quotes with double-double quotes
										value_escaped = str(value).replace('"', '""')
										row_line.append(f'"{value_escaped}"')
									csv_lines.append(','.join(row_line))

								csv_content = '\n'.join(csv_lines)
								print(f"  Built CSV with {len(csv_lines)} lines, {len(available_columns)} columns")

								# Debug: Print the first few rows to check format
								print(f"\n  === CSV Preview (first 3 rows) ===")
								for i, line in enumerate(csv_lines[:3]):
									print(f"  {line}")
								print(f"  ===================================\n")

								# Try to reimport
								print(f"  Reimporting CSV to DataTable...")
								success = unreal.DataTableFunctionLibrary.fill_data_table_from_csv_string(dt_asset, csv_content)
								if success:
									print(f"  ✓ Successfully updated DataTable (NOT SAVED - review changes in editor before saving)")
								else:
									print(f"  ✗ Failed to update DataTable - check log for errors")
				else:
					print(f"  - {row_name}: No SkeletalMesh assigned")
		except Exception as e:
			import traceback
			print(f"  Error: {e}")
			print(f"  Traceback: {traceback.format_exc()}")

	if found_row_name:
		print(f"\nFound matching row: {found_row_name}")
	else:
		print(f"\nNo matching row found for: {selected_path}")

	return found_row_name

sm_path = skeletal_mesh_to_replace.split("'")[1] if "'" in skeletal_mesh_to_replace else skeletal_mesh_to_replace
sk_mesh = unreal.EditorAssetLibrary.load_asset(sm_path)

if len(selected_assets) == 1:
	print("Replace Target SkeletalMesh Selected")
	selected_asset = selected_assets[0]
	material_list = get_material_list_from_selected_skeletalmesh(selected_asset)
	slotname_list = get_slot_name_list_from_skeletalmesh_materials(selected_asset, material_list)
	data_assets = get_dataasset_list_from_referencers(selected_asset)
	slotname_to_material_map = create_slotname_to_material_map(selected_asset, material_list, slotname_list)

	set_datatable(datatable_path, selected_asset, sk_mesh, material_list)

	for da in data_assets:
		print(f"DataAsset: {da}")
		da_asset = unreal.EditorAssetLibrary.load_asset(da)
		if not da_asset:
			print(f"Failed to load DataAsset: {da}")
			continue

		# Open DataAsset in editor FIRST before making changes
		editor_subsystem = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
		editor_subsystem.open_editor_for_assets([da_asset])
		print(f"  ✓ Opened DataAsset in editor")

		if not slotname_to_material_map:
			print(f"No matching materials found for {da}")
			continue
		try:
			# Try setting as TMap<Name, UMaterialInterface>
			da_asset.set_editor_property(da_cm_parameter_name, slotname_to_material_map)
		except Exception:
			# Fallback: TMap<Name, TSoftObjectPtr<UMaterialInterface>>
			slot_to_soft = {k: unreal.SoftObjectPath(v.get_path_name()) for k, v in slotname_to_material_map.items()}
			da_asset.set_editor_property(da_cm_parameter_name, slot_to_soft)
		set_skeletal_mesh_in_dataasset(sk_mesh, skeletal_mesh_parameter_name_part)

		print(f"  ✓ Updated {da_cm_parameter_name} on {da} with {len(slotname_to_material_map)} entries (NOT SAVED - review in editor before saving)")