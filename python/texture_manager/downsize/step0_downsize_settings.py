import unreal

projectPath = unreal.Paths.project_dir()
content_path = unreal.Paths.project_content_dir()

path_split = projectPath.split('/')
wip_folder_name = path_split[len(path_split)-3] + '_WIP'
path_split[len(path_split)-3] = wip_folder_name
wip_path = '/'.join(path_split)

wip_folder = wip_path
source_folder = content_path  
texture_folder = wip_path + 'Game/'
desired_size = 2024

print('WIP Folder:', wip_folder)
print('Source Folder:', source_folder)
print('Texture Folder:', texture_folder)
print('Desired Size:', desired_size)