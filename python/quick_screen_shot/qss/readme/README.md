# Screenshot Tools

Simple screenshot and cropping tools for Unreal Engine.

## Files

- `take_screenshot.py` - Take screenshots with auto-increment naming
- `crop_image_by_mask.py` - Crop images based on mask proportions
- `DRAG_FOLDER_HERE.bat` - Drag & drop a folder to crop all screenshots (Windows)
- `crop_screenshots.bat` - Simple batch file to run cropper (Windows)
- `crop_screenshots_menu.bat` - Interactive menu for cropping (Windows)

## Usage

### 1. Take Screenshot in Unreal Engine

Run in Unreal Python console:

```python
exec(open("D:/vs/anju/python/quick_screen_shot/take_screenshot.py").read())
```

This will:
- Take a screenshot at **current viewport resolution** (matches your editor viewport size)
- Save as `quick_screenshot_0001.png`, `quick_screenshot_0002.png`, etc.
- Auto-increment the number
- Save to `Project/Saved/Screenshots/WindowsEditor/`

**To take higher resolution:**
```python
# Import the module first
import sys
sys.path.append("D:/vs/anju/python/quick_screen_shot")
import take_screenshot

# Take at 2x viewport resolution (if viewport is 1920x1080, captures at 3840x2160)
take_screenshot.take_screenshot(multiplier=2)

# Take at 4x viewport resolution
take_screenshot.take_screenshot(multiplier=4)
```

### 2. Crop Screenshots

The cropping tool processes images from an **input folder** and saves cropped versions to an **output folder**, keeping originals untouched.

#### Windows - Easy Way (Batch Files)

**Method 1: Drag & Drop (Easiest!)**
1. Open Windows Explorer and navigate to your screenshots folder
2. Drag the folder onto `DRAG_FOLDER_HERE.bat`
3. Done! Cropped images saved to `cropped/` subfolder

**Method 2: Interactive Menu**
1. Double-click `crop_screenshots_menu.bat`
2. Choose from menu options:
   - Use default folders
   - Specify custom input folder
   - Specify both input and output
3. Follow the prompts

**Method 3: Simple Run**
- Double-click `crop_screenshots.bat` to use default folders
- Or drag a folder onto it

#### Command Line

**Option 1: Specify input folder (creates "cropped" subfolder):**
```bash
python crop_image_by_mask.py "E:/CINEVStudio/CINEVStudio/Saved/Screenshots/WindowsEditor"
```
Cropped images will be saved to: `E:/CINEVStudio/.../WindowsEditor/cropped/`

**Option 2: Specify both input and output folders:**
```bash
python crop_image_by_mask.py "E:/Screenshots/WindowsEditor" "E:/CroppedScreenshots"
```

**Option 3: Use default folders (edit INPUT_FOLDER and OUTPUT_FOLDER in the script):**
```bash
python crop_image_by_mask.py
```

**What it does:**
- Reads all PNG images from input folder
- Crops based on mask proportions (30.5% from left, 8.1% from top, 66.4% width, 82.2% height)
- Saves cropped images to output folder with same filenames
- Originals remain untouched in input folder

## Configuration

### Change Screenshot Resolution Multiplier

Edit `take_screenshot.py`:
```python
RESOLUTION_MULTIPLIER = 2  # 2x viewport resolution (default is 1x)
```

The screenshot will automatically match your current editor viewport size multiplied by this value.

### Change Default Input/Output Folders

Edit `crop_image_by_mask.py`:
```python
INPUT_FOLDER = "input"    # Your screenshots folder
OUTPUT_FOLDER = "output"  # Where to save cropped images
```

### Change Crop Proportions

Edit `crop_image_by_mask.py`:
```python
CROP_PROPORTIONS = {
    'left': 0.305,
    'top': 0.081,
    'right': 0.969,
    'bottom': 0.903
}
```

## Requirements

- **take_screenshot.py**: Unreal Engine 5.3+ with Python support (uses HighResShot command)
- **crop_image_by_mask.py**: Python 3.x with Pillow (`pip install Pillow`)

## Workflow Example

1. **Take screenshots in Unreal Engine:**
   - Run `take_screenshot.py` multiple times
   - Screenshots saved to `Project/Saved/Screenshots/WindowsEditor/`
   - Named as `quick_screenshot_0001.png`, `0002.png`, etc.

2. **Batch crop all screenshots:**
   ```bash
   python crop_image_by_mask.py "E:/CINEVStudio/CINEVStudio/Saved/Screenshots/WindowsEditor"
   ```
   - Original screenshots remain in `WindowsEditor/`
   - Cropped versions saved to `WindowsEditor/cropped/`
   - Same filenames, ready to use!

## Notes

- Screenshots are taken at the **current editor viewport resolution** × multiplier
- If your viewport is 1920×1080 and multiplier is 2, the screenshot will be 3840×2160
- The HighResShot command automatically detects viewport size
- Make sure to focus the viewport before taking a screenshot for best results
- Cropping keeps originals untouched - output goes to separate folder
