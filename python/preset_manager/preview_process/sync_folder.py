import unreal 
import os
import shutil

def copy_files(source_folder, destination_folder):
    files = os.listdir(source_folder)

    for file in files:
        source_file = os.path.join(source_folder, file)
        destination_file = os.path.join(destination_folder, file)
        shutil.copy2(source_file, destination_file)

    print("Files copied successfully!")

projectPath = unreal.Paths.project_dir()
saveGamesPath = projectPath + "/Saved/SaveGames/"
customizePath = projectPath + "/CustomizePresets/"

copy_files(saveGamesPath, customizePath)

print("Files copied successfully!")