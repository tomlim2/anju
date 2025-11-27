import unreal

print("SkeletalMesh Replace Start")

def get_material_list_from_selected_skeletalmesh(selected_asset):
    get_material_list = []
    package_path = selected_asset.get_path_name().rsplit('/', 1)[0]
    mat_folder_path = f"{package_path}/Mat"

    for asset_path in unreal.EditorAssetLibrary.list_assets(mat_folder_path, recursive=True, include_folder=False):
        asset = unreal.EditorAssetLibrary.load_asset(asset_path)
        if isinstance(asset, unreal.MaterialInterface):
            get_material_list.append(asset)
            print(f"Material: {asset_path}")
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

def set_skeletal_mesh_in_dataasset (skeletal_mesh_to_replace, parameter_name):
		sm_path = skeletal_mesh_to_replace.split("'")[1] if "'" in skeletal_mesh_to_replace else skeletal_mesh_to_replace
		sk_mesh = unreal.EditorAssetLibrary.load_asset(sm_path)
		if sk_mesh:
			# Assign the loaded SkeletalMesh object directly for ObjectProperty/SoftObjectProperty of SkeletalMesh
			try:
				da_asset.set_editor_property(parameter_name, sk_mesh)
			except Exception as e:
				print(f"Failed to set {parameter_name} on DataAsset: {e}")
		else:
			print(f"Failed to load SkeletalMesh: {skeletal_mesh_to_replace}")

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
da_cm_parameter_name = "CustomMaterialsBody"
skeletal_mesh_parameter_name = "BaseSkeletalMesh"
skeletal_mesh_parameter_name_cloth = "SK_AnimePartCloth"
skeletal_mesh_to_replace = "/Script/Engine.SkeletalMesh'/Game/Character/Anime/Female/Cloth/F_Daily_002/Skinning/F_Daily_002.F_Daily_002'"

if len(selected_assets) == 1:
	print("Replace Target SkeletalMesh Selected")
	selected_asset = selected_assets[0]
	material_list = get_material_list_from_selected_skeletalmesh(selected_asset)
	slotname_list = get_slot_name_list_from_skeletalmesh_materials(selected_asset, material_list)
	print("Slot Names:")
	for sn in slotname_list:
		print(f"SlotName: {sn}")

	data_assets = get_dataasset_list_from_referencers(selected_asset)
	slotname_to_material_map = create_slotname_to_material_map(selected_asset, material_list, slotname_list)

	for da in data_assets:
		print(f"DataAsset: {da}")
		da_asset = unreal.EditorAssetLibrary.load_asset(da)
		if not da_asset:
			print(f"Failed to load DataAsset: {da}")
			continue

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

		da_asset.modify(True)
		# Set BaseSkeletalMesh from skeletal_mesh_to_replace
		set_skeletal_mesh_in_dataasset(skeletal_mesh_to_replace, skeletal_mesh_parameter_name)
		if (da_cm_parameter_name == da_cm_parameter_name):
			set_skeletal_mesh_in_dataasset(skeletal_mesh_to_replace, skeletal_mesh_parameter_name_cloth)

		unreal.EditorAssetLibrary.save_loaded_asset(da_asset)
		tools = unreal.AssetToolsHelpers.get_asset_tools()
		tools.open_editor_for_assets([da_asset])
		print(f"Updated {da_cm_parameter_name} on {da} with {len(slotname_to_material_map)} entries")

		