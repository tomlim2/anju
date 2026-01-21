# CINEV Character Creator GUI

Simple Python GUI application for creating Unreal Engine CINEV characters.

## Requirements

- Python 3.x (tkinter is built-in)

## How to Run

```bash
python character_creator_gui.py
```

## Usage

### Step 1: Configure Paths (One-time setup)
These paths are **automatically saved** and will be remembered next time you open the app:

1. **UE_CINEV Directory**: Select your Unreal Engine installation folder (e.g., `D:\UE_CINEV`)
2. **Project File**: Select your `.uproject` file
   - Once selected, the app will show the UserCharacter folder path
3. **Output Folder**: Choose where to save the created character (can be anywhere)

After first setup, these paths will be pre-filled when you launch the app again.

### Step 2: Character Files
1. Select **Gender** (Female/Male)
2. Enter **Display Name**
3. Click **"Generate & Save JSON"**
   - JSON will be **automatically saved** to: `ProjectFolder\Saved\SaveGames\UserCharacter\`
   - Filename format: `DisplayName_YYYYMMDD_HHMMSS.json`

### Step 3: Execute
1. **JSON File**: Browse to select the JSON file (from anywhere)
2. **VRM File**: Browse and select your `.vrm` character model (from anywhere)
3. Click **"CREATE CHARACTER"**
   - If JSON/VRM files are not in UserCharacter folder, they will be **automatically moved** there
   - You'll see messages in the output console about the file movements
4. Watch the output console for progress
5. Wait for completion message

## Features

- ✓ Simple black & white flat design
- ✓ Real-time command output
- ✓ Path validation with folder location checking
- ✓ File browsers for all inputs
- ✓ JSON generation with just 2 fields (Gender + DisplayName)
- ✓ **Remembers configuration** - paths saved automatically and restored on next launch
- ✓ **Auto-saves JSON to correct UserCharacter folder**
- ✓ **Auto-creates UserCharacter folder if it doesn't exist**
- ✓ **Auto-moves JSON & VRM to UserCharacter folder if needed** (on execution)
- ✓ Shows UserCharacter folder path after selecting project
- ✓ Timestamp-based filename generation
- ✓ Select files from anywhere - app handles the organization

## Important File Locations

Both `.json` and `.vrm` files **must be** in:
```
YourProject\Saved\SaveGames\UserCharacter\
```

Example:
```
C:\Users\USER\Documents\Unreal Projects\Cinev\CINEVStudio\CINEVStudio\
  └── Saved\
      └── SaveGames\
          └── UserCharacter\
              ├── meicat_20251114_081729.json
              └── meicat_20251114_081729.vrm
```

The app handles this automatically:
- **JSON**: Generated directly to this folder
- **VRM**: Can be selected from anywhere - the app will move it to UserCharacter folder when you click "CREATE CHARACTER"

## JSON Format

```json
{
  "Gender": "Female",
  "DisplayName": "VRMTestA"
}
```

## Configuration File

The app saves your paths to `character_creator_config.json` in the same directory as the script. This file contains:
- UE_CINEV Directory path
- Project File path
- Output Folder path

To reset the configuration, simply delete this file.
