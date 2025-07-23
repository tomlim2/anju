import unreal

selected_assets = unreal.EditorUtilityLibrary.get_selected_assets()
seletected_asset = selected_assets[0] if selected_assets else None
if selected_assets and isinstance(seletected_asset, unreal.Texture):
	texture: unreal.Texture = seletected_asset
	texture.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_DEFAULT)
	texture.set_editor_property('srgb', True)
	texture.set_editor_property('compression_no_alpha', False)