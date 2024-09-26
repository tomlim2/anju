import os

folder_path = 'python/preset_manager/customize_presets/'
file_names = os.listdir(folder_path)

for file_name in file_names:
    print(file_name)
