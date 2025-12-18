import unreal

def validate_outline_material(material: unreal.Material, materials_path: str, character_name: str) -> tuple[str, unreal.Material]:
	"""
	Validates outline material and ensures it uses the expected material path.

	Returns:
		tuple: (status_message, material_to_use)
	"""
	material_name = material.get_name()
	if "Outline" in material_name:
		new_material_name = f'MI_{character_name}_Hair_Outline'
		expected_material_path = f'{materials_path}/{new_material_name}.{new_material_name}'
		current_material_path = material.get_path_name()

		if current_material_path == expected_material_path:
			return (f'  [OK] {material_name} is correctly named and located.', material)
		else:
			print(f'Validating outline material: {new_material_name}')
			print(f'  Current path: {current_material_path}')
			print(f'  Expected path: {expected_material_path}')

			# Check if expected material already exists
			if unreal.EditorAssetLibrary.does_asset_exist(expected_material_path):
				# Load and use the existing expected material
				expected_material = unreal.EditorAssetLibrary.load_asset(expected_material_path)
				return (f'  [Using Existing] Found {new_material_name} at expected path.', expected_material)
			else:
				# Duplicate the current material to the expected path
				new_material = unreal.EditorAssetLibrary.duplicate_asset(current_material_path, expected_material_path)

				if new_material:
					return (f'  [Duplicated] {material_name} to {new_material_name} at {materials_path}.', new_material)
				else:
					return (f'  [Failed] Could not duplicate {material_name} to {new_material_name}.', material)

	return ('', material)

def find_materials_path(materials: list[unreal.Material]) -> str:
	found_material: unreal.Material
	for material in materials:
		if "Outline" not in material.get_name():
			found_material = material
			break
	material_path = found_material.get_path_name()
	materials_path = '/'.join(material_path.split('/')[:-1])  # Get directory path
	return materials_path

def find_character_name(savefilename: str) -> str:
	parts = savefilename.split('_')
	if len(parts) >= 3:
		return f"{parts[1]}_{parts[2]}"
	return savefilename

selected_asset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

print('selected asset: ' + selected_asset.get_name())

loaded_asset = unreal.EditorAssetLibrary.load_asset(selected_asset.get_path_name())

loaded_datatable: unreal.DataTable = loaded_asset
row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(loaded_datatable)

# Get the NRCDataAsset column to check which rows have it
try:
	nrc_dataasset_column = unreal.DataTableFunctionLibrary.get_data_table_column_as_string(loaded_datatable, "NRCDataAsset")
except Exception as e:
	print(f"Failed to get NRCDataAsset column: {e}")
	raise SystemExit

for idx, row_name in enumerate(row_names):
	nrc_dataasset_str = nrc_dataasset_column[idx]
	if nrc_dataasset_str:
		data_asset = unreal.EditorAssetLibrary.load_asset(nrc_dataasset_str)

		if data_asset:
			print(f'\nProcessing row: {str(row_name)}')
			sk_hair = data_asset.get_editor_property('SK_AnimePartHair')
			character_name = find_character_name(data_asset.get_editor_property('SaveFileName'))
			if sk_hair:
				print('character name: ' + character_name)
				hair_display_name = sk_hair.get_name()
				hair_path = sk_hair.get_path_name()
				loaded_sk_hair = unreal.EditorAssetLibrary.load_asset(hair_path)
				loaded_sk_hair: unreal.SkeletalMesh = loaded_sk_hair
				material_ifs:list[unreal.MaterialInterface] = loaded_sk_hair.materials
				materials:list[unreal.Material] = [material_if.material_interface for material_if in material_ifs]
				materials_path = find_materials_path(materials)

				# Validate and duplicate materials, collect new materials
				new_materials = []
				for material in materials:
					status_msg, new_material = validate_outline_material(material, materials_path, character_name)
					if status_msg:
						print(status_msg)
					new_materials.append(new_material)

				# Replace materials on skeletal mesh
				# Checkout the asset from source control first
				unreal.EditorAssetLibrary.checkout_loaded_asset(loaded_sk_hair)

				# Mark the skeletal mesh as dirty before modifying
				loaded_sk_hair.modify()

				# Create a new materials array
				materials_array = []
				for idx, new_material in enumerate(new_materials):
					if idx < len(loaded_sk_hair.materials):
						old_material_name = loaded_sk_hair.materials[idx].material_interface.get_name() if loaded_sk_hair.materials[idx].material_interface else "None"

						# Create new SkeletalMaterial struct
						skel_material = unreal.SkeletalMaterial()
						skel_material.material_interface = new_material
						materials_array.append(skel_material)

						print(f'  [Replaced] Slot {idx}: {old_material_name} -> {new_material.get_name()}')

				# Set the entire materials array using set_editor_property
				loaded_sk_hair.set_editor_property('materials', materials_array)

				# Save the skeletal mesh with updated materials
				save_success = unreal.EditorAssetLibrary.save_asset(loaded_sk_hair.get_path_name())
				if save_success:
					print(f'  [Saved] Updated materials on {hair_display_name}')
				else:
					print(f'  [Failed] Could not save {hair_display_name}')

				# Set EyeOffset parameter on material instances
				for material in new_materials:
					eye_offset_param_name = "EyeOffset"
					if material.get_class().get_name() == "MaterialInstanceConstant":
						material_instance: unreal.MaterialInstanceConstant = material

						# Check current value before setting
						try:
							current_value = unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(material_instance, eye_offset_param_name)
							print(f'  Current {eye_offset_param_name} value: {current_value}')
						except Exception as e:
							print(f'  Could not get current value: {e}')

						# Mark as dirty before modifying
						material_instance.modify()

						# Set the parameter value
						success = unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(material_instance, eye_offset_param_name, 0.0)

						# Verify the new value
						try:
							new_value = unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(material_instance, eye_offset_param_name)
							print(f'  New {eye_offset_param_name} value: {new_value}')
						except Exception as e:
							print(f'  Could not verify new value: {e}')

						# Save the asset
						save_success = unreal.EditorAssetLibrary.save_asset(material_instance.get_path_name())

						if success and save_success:
							print(f'  [Set] {eye_offset_param_name}=0 on {material.get_name()}.')
						else:
							print(f'  [Failed] Could not set {eye_offset_param_name} on {material.get_name()}. Success={success}, SaveSuccess={save_success}')
		else:
			print(f'  Failed to load DataAsset: {nrc_dataasset_str}')