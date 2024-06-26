import unreal;

def get_component_handles(blueprint_asset_path):
    subsystem = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)

    blueprint_asset = unreal.load_asset(blueprint_asset_path)
    subobject_data_handles = subsystem.k2_gather_subobject_data_for_blueprint(blueprint_asset)
    return subobject_data_handles

def get_component_objects(blueprint_asset_path : str):
    objects = []
    handles = get_component_handles(blueprint_asset_path)
    for handle in handles:
        data = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(handle)
        object = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(data)
        objects.append(object)
    return objects

def get_component_by_var_name(asset_path, component_name_to_find : str) -> unreal.SkeletalMeshComponent : 
    components = []
    component_objects = get_component_objects(asset_path)

    for each in component_objects:
        compare_name = (each.get_name()) == ( component_name_to_find + '_GEN_VARIABLE' )
        if compare_name :
            components.append(each)
    return components[0]

selectedAsset = unreal.EditorUtilityLibrary.get_selected_assets()[0]

if(selectedAsset.__class__ == unreal.SkeletalMesh):
    str_selected_asset = unreal.EditorAssetLibrary.get_path_name_for_loaded_asset(selectedAsset)
    new_skeletal_mesh = unreal.EditorAssetLibrary.load_asset(str_selected_asset)
    
    #set path
    path = str_selected_asset.rsplit('/', 1)[0] + '/'
    name = str_selected_asset.rsplit('/', 1)[1]
    name = name.rsplit('.', 1)[1]
    BaseBP: str = '/Game/RnD/Common/Blueprint/BPC_Pmx_Wrapper'
    TargetBPDir: str = path + "BPC_Pmx_Wrapper_" + name

    #########set post process animation blueprint
    #path
    BaseABP = "/Game/RnD/Common/Blueprint/ABP_Pmx_PPAB"
    TargetABPDir: str = path + "ABP_Pmx_" + name 

    #process assign blueprint target
    new_skeletal = new_skeletal_mesh.skeleton
    existing_blueprint = unreal.EditorAssetLibrary.load_asset(BaseABP)
    existing_blueprint.set_editor_property('target_skeleton', new_skeletal)
    
    BaseABP_loaded = unreal.load_asset(BaseABP)
    unreal.EditorAssetLibrary.duplicate_loaded_asset(BaseABP_loaded,TargetABPDir)

    new_ABP_loaded = unreal.EditorAssetLibrary.load_blueprint_class(TargetABPDir)
    new_skeletal_mesh.set_editor_property('post_process_anim_blueprint', new_ABP_loaded)

    #reset
    default_SK_path = '/Game/RnD/Common/DefaultPmx/NURU_Hatsune_Miku_v03_Skeleton'
    default_SK = unreal.EditorAssetLibrary.load_asset(default_SK_path)
    existing_blueprint.set_editor_property('target_skeleton', default_SK)

    ##########set skeletal mesh in wrapper
    pmx = get_component_by_var_name(BaseBP, 'Pmx')
    outline = get_component_by_var_name(BaseBP, 'Outline')


    pmx.set_skinned_asset_and_update(new_skeletal_mesh)
    outline.set_skinned_asset_and_update(new_skeletal_mesh)

    outline.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
    print(outline.get_collision_enabled())
    

    #outline
    outlineMaterialPath = "/Game/RnD/Common/Materials/MI_Outline_InvertedHull"
    outlineMaterial = unreal.EditorAssetLibrary.load_asset(outlineMaterialPath)
    outlineAllMaterial = outline.get_materials()
    length = len(outlineAllMaterial)

    for i in range(length):
        outline.set_material(i, outlineMaterial)

    BaseBP_loaded = unreal.load_asset(BaseBP)
    unreal.EditorAssetLibrary.duplicate_loaded_asset(BaseBP_loaded,TargetBPDir)
  
    #reset
    pmx.set_skinned_asset_and_update(None)
    outline.set_skinned_asset_and_update(None)

   