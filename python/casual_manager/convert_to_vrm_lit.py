import unreal 
from Lib import __lib_topaz__ as topaz

base_MI : str = "/Game/RnD/ThirdRaid/materials/MI_VrmMToonOptLitOpaque.MI_VrmMToonOptLitOpaque" # edit this to your liking

#E:/CINEVStudio/CINEVStudio/Content/RnD/ThirdRaid/materials/MI_VrmMToonOptLitOpaque.uasset

selected : list[unreal.Texture2D] = topaz.get_selected_assets()[0]

print(  selected)

unreal.SkeletalMesh.get_all_

# for i in selected : # i is unreal.Texture2D
    # newname : str = i.get_path_name().rsplit(".", 1)[0]
    # print(newname) # debug 
    
    # material_instance : unreal.MaterialInstanceConstant = unreal.EditorAssetLibrary.duplicate_asset(base_MI,newname + "_MI")
    
    # print ( material_instance.get_texture_parameter_value('gltf_tex_diffuse') ) 
    # print ( material_instance.get_texture_parameter_value('mtoon_tex_ShadeTexture') ) 
    # unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(material_instance, 'gltf_tex_diffuse', i)
    # unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(material_instance, 'mtoon_tex_ShadeTexture', i)