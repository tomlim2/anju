import unreal

# [
# "/Game/CineMaps/06_Nature/LV_1001_SuburbanPark/06_Material/MI_1001_SuburbanPark_085.MI_1001_SuburbanPark_085", 
# "/Game/Fab/Megascans/Decals/Square_Rusty_Drain_sdurvik/Medium/MI_sdurvik.MI_sdurvik", 
# "/Game/Fab/Megascans/Decals/Stone_Tile_Crack_sfvkz2g/Medium/MI_sfvkz2g.MI_sfvkz2g", 
# "/Game/CineMaps/04_Public/LV_1018_SchoolCourtyard/06_Material/MI_phluybp2.MI_phluybp2", 
# "/Game/CineMaps/06_Nature/LV_1001_SuburbanPark/06_Material/MI_1001_SuburbanPark_083.MI_1001_SuburbanPark_083", 
# "/Game/Fab/Megascans/Decals/Mud_Splash_vlmqagmv/Medium/MI_vlmqagmv.MI_vlmqagmv", 
# "/Game/CineMaps/06_Nature/LV_1001_SuburbanPark/06_Material/MI_1001_SuburbanPark_086.MI_1001_SuburbanPark_086", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_442.MI_1003_RetailAlley_A_01_442", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_444.MI_1003_RetailAlley_A_01_444", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_492.MI_1003_RetailAlley_A_01_492", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_493.MI_1003_RetailAlley_A_01_493", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_496.MI_1003_RetailAlley_A_01_496", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_535.MI_1003_RetailAlley_A_01_535", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_536.MI_1003_RetailAlley_A_01_536", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_537.MI_1003_RetailAlley_A_01_537", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_538.MI_1003_RetailAlley_A_01_538", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_539.MI_1003_RetailAlley_A_01_539", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_795.MI_1003_RetailAlley_A_01_795", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_796.MI_1003_RetailAlley_A_01_796", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_797.MI_1003_RetailAlley_A_01_797", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_798.MI_1003_RetailAlley_A_01_798", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_799.MI_1003_RetailAlley_A_01_799", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_800.MI_1003_RetailAlley_A_01_800", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_801.MI_1003_RetailAlley_A_01_801", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_802.MI_1003_RetailAlley_A_01_802", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_803.MI_1003_RetailAlley_A_01_803", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_804.MI_1003_RetailAlley_A_01_804", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_805.MI_1003_RetailAlley_A_01_805", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_806.MI_1003_RetailAlley_A_01_806", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_807.MI_1003_RetailAlley_A_01_807", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_808.MI_1003_RetailAlley_A_01_808", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_809.MI_1003_RetailAlley_A_01_809", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_810.MI_1003_RetailAlley_A_01_810", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_811.MI_1003_RetailAlley_A_01_811", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_812.MI_1003_RetailAlley_A_01_812", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_813.MI_1003_RetailAlley_A_01_813", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_814.MI_1003_RetailAlley_A_01_814", 
# "/Game/CineMaps/05_Street/RetailAlley/LV_1003_RetailAlley_A_01/06_Material/MI_1003_RetailAlley_A_01_816.MI_1003_RetailAlley_A_01_816", 
# "/Game/CineMaps/04_Public/LV_1018_SchoolCourtyard/06_Material/MI_phetpnp2.MI_phetpnp2", 
# "/Game/CineMaps/05_Street/UrbanOverpass/LV_1002_UrbanOverpass_A_01/06_Material/MI_1002_UrbanOverpass_601.MI_1002_UrbanOverpass_601", 
# "/Game/CineMaps/05_Street/UrbanOverpass/LV_1002_UrbanOverpass_A_01/06_Material/MI_1002_UrbanOverpass_602.MI_1002_UrbanOverpass_602", 
# "/Game/CineMaps/01_Living/LV_1015_LivingKitchen/06_Material/MI_teikzuh.MI_teikzuh", 
# "/Game/Fab/Megascans/Decals/Corner_Debris_sgvqwwg/Medium/MI_sgvqwwg.MI_sgvqwwg", 
# "/Game/CineMaps/06_Nature/LV_1001_SuburbanPark/06_Material/MI_1001_SuburbanPark_084.MI_1001_SuburbanPark_084", 
# "/Game/Fab/Megascans/Decals/Bottlebrush_Leaves_slwrnyo/Medium/MI_slwrnyo.MI_slwrnyo", 
# "/Game/Fab/Megascans/Decals/Scattered_Dried_Leaves_shfprin/Medium/MI_shfprin.MI_shfprin", 
# "/Game/CineMaps/04_Public/LV_1009_SchoolRooftop/06_Material/MI_1009_SchoolRooftop_836.MI_1009_SchoolRooftop_836", 
# "/Game/CineMaps/04_Public/LV_1009_SchoolRooftop/06_Material/MI_1009_SchoolRooftop_864.MI_1009_SchoolRooftop_864", 
# "/Game/CineMaps/04_Public/LV_1009_SchoolRooftop/06_Material/MI_1009_SchoolRooftop_865.MI_1009_SchoolRooftop_865", 
# "/Game/CineMaps/04_Public/LV_1009_SchoolRooftop/06_Material/MI_1009_SchoolRooftop_866.MI_1009_SchoolRooftop_866", 
# "/Game/CineMaps/04_Public/LV_1009_SchoolRooftop/06_Material/MI_1009_SchoolRooftop_923.MI_1009_SchoolRooftop_923", 
# "/Game/CineMaps/04_Public/LV_1018_SchoolCourtyard/06_Material/MI_1009_SchoolRooftop_836.MI_1009_SchoolRooftop_836", 
# "/Game/Fab/Megascans/Decals/Dried_Mixed_Leaves_tbsncvl/Medium/MI_tbsncvl.MI_tbsncvl", 
# ]
target_material_list = [
	"/Game/Fab/Megascans/3D/Japanese_Stone_Corner_Wall_vf5paeqga/Medium/MI_vf5paeqga.MI_vf5paeqga",
"/Game/CineMaps/06_Nature/LV_1001_SuburbanPark/06_Material/MI_1001_SuburbanPark_097.MI_1001_SuburbanPark_097",
"/Game/Fab/Megascans/3D/Japanese_Stone_Lantern_veniffjdb/Medium/MI_veniffjdb.MI_veniffjdb",
"/Game/Fab/Megascans/3D/Japanese_Stone_Corner_Wall_vgdjdgmqx/Medium/MI_vgdjdgmqx.MI_vgdjdgmqx",
"/Game/CineMaps/06_Nature/LV_1001_SuburbanPark/06_Material/MI_1001_SuburbanPark_095.MI_1001_SuburbanPark_095",
"/Game/CineMaps/04_Public/LV_1010_SchoolYard/06_Material/MI_1010_SchoolYard_523.MI_1010_SchoolYard_523",
"/Game/CineMaps/05_Street/CoastalVillage/LV_1005_CoastalVillage_A_01/06_Material/MI_1005_CoastalVillage_A_01_378.MI_1005_CoastalVillage_A_01_378",
"/Game/CineMaps/05_Street/CoastalVillage/LV_1005_CoastalVillage_A_01/06_Material/MI_1005_CoastalVillage_A_01_379.MI_1005_CoastalVillage_A_01_379",
"/Game/Fab/Megascans/3D/Japanese_Park_Stone_Embankment_ulldfjw/Medium/MI_ulldfjw.MI_ulldfjw",
"/Game/CineMaps/05_Street/CoastalVillage/LV_1005_CoastalVillage_A_01/06_Material/Outdoor/MI_1005_CoastalVillage_A_01_Out_498.MI_1005_CoastalVillage_A_01_Out_498",
"/Game/CineMaps/05_Street/CoastalVillage/LV_1005_CoastalVillage_A_01/06_Material/Outdoor/MI_1005_CoastalVillage_A_01_Out_499.MI_1005_CoastalVillage_A_01_Out_499",
"/Game/Fab/Megascans/3D/Japanese_Stone_Wall_vfvndg3cb/Medium/MI_vfvndg3cb.MI_vfvndg3cb",
"/Game/CineMaps/04_Public/LV_1009_SchoolRooftop/06_Material/MI_1009_SchoolRooftop_932.MI_1009_SchoolRooftop_932",
"/Game/CineMaps/05_Street/CoastalVillage/LV_1014_CoastalRoom_A_01/06_Material/Outdoor/MI_1014_CoastalRoom_A_01_Out_281.MI_1014_CoastalRoom_A_01_Out_281",
"/Game/CineMaps/05_Street/CoastalVillage/LV_1014_CoastalRoom_A_01/06_Material/Outdoor/MI_1014_CoastalRoom_A_01_Out_282.MI_1014_CoastalRoom_A_01_Out_282",
"/Game/Fab/Megascans/3D/Japanese_Mossy_Stone_Wall_ulldfgb/Medium/MI_ulldfgb.MI_ulldfgb",
]


new_base_material_path = "/Game/Materials/Base_Mat/M_MS_Base.M_MS_Base"


# "/Game/Materials/Base_Mat/Decal/M_MS_Decal.M_MS_Decal"

# ==========================================
# [메인 로직]
# ==========================================

unreal.log(f"Processing {len(target_material_list)} material(s)...")

# 새 베이스 머티리얼 로드
new_base_material = unreal.EditorAssetLibrary.load_asset(new_base_material_path)

if not new_base_material:
	unreal.log_error(f"Failed to load new base material: {new_base_material_path}")
else:
	unreal.log(f"New base material loaded: {new_base_material_path}\n")

	replaced_count = 0
	skipped_count = 0
	error_count = 0

	for material_path in target_material_list:
		# 머티리얼 로드
		material = unreal.EditorAssetLibrary.load_asset(material_path)

		if not material:
			unreal.log_error(f"Failed to load: {material_path}")
			error_count += 1
			continue

		# 머티리얼 인스턴스인지 확인
		if not isinstance(material, unreal.MaterialInstance):
			unreal.log_warning(f"Skipped (not a Material Instance): {material_path}")
			skipped_count += 1
			continue

		# 현재 부모 머티리얼 확인
		current_parent = material.get_editor_property("parent")

		if current_parent:
			current_parent_path = current_parent.get_path_name()
			unreal.log(f"{material.get_name()}:")
			unreal.log(f"  Current Parent: {current_parent_path}")
		else:
			unreal.log(f"{material.get_name()}:")
			unreal.log(f"  Current Parent: None")

		# 부모 머티리얼 설정/교체
		material.set_editor_property("parent", new_base_material)

		# 변경사항 저장
		unreal.EditorAssetLibrary.save_asset(material_path)

		unreal.log(f"  New Parent: {new_base_material_path}")
		replaced_count += 1

	# 결과 요약
	unreal.log(f"\n{'='*60}")
	unreal.log(f"Summary:")
	unreal.log(f"  Successfully replaced: {replaced_count}")
	unreal.log(f"  Skipped: {skipped_count}")
	unreal.log(f"  Errors: {error_count}")
	unreal.log(f"  Total processed: {len(target_material_list)}")
	unreal.log(f"{'='*60}")