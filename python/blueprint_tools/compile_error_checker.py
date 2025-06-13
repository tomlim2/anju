import unreal

def compile_blueprint_and_check(blueprint):
	"""Compiles a Blueprint asset and prints the result."""
	# Use the proper compilation method
	unreal.EditorUtilityLibrary.compile_blueprint(blueprint)
	unreal.EditorAssetLibrary.save_loaded_asset(blueprint)
	if blueprint.status == unreal.BlueprintStatus.COMPILED:
		print(f"✅ Compilation successful for: {blueprint.get_path_name()}")
	else:
		print(f"❌ Compilation failed for: {blueprint.get_path_name()}")

def main():
	selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
	if not selected_assets:
		print("No assets selected.")
		return

	for asset in selected_assets:
		if isinstance(asset, unreal.Blueprint):
			compile_blueprint_and_check(asset)
		else:
			print(f"⚠️ Selected asset {asset.get_name()} is not a Blueprint.")

if __name__ == "__main__":
	main()
