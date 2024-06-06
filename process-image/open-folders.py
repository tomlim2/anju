import unreal 
import os

path_index: int

projectPath = unreal.Paths.project_dir()

screenshotsPath = projectPath + "/Saved/Screenshots/WindowsEditor/"
saveGamesPath = projectPath + "/Saved/SaveGames/"
customizePath = projectPath + "/CustomizePresets/"

pathsArray = [screenshotsPath, saveGamesPath, customizePath]

targetPath = pathsArray[path_index]

path = os.path.realpath(targetPath)
os.startfile(path)

print("Open ", projectPath)