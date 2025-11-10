# Screenshot Cropper - User Guide

Simple tool to batch crop screenshots based on a mask template.

## What You Need

### 1. Windows Operating System
Any version of Windows (7, 10, 11, etc.)

### 2. Python
Download from: https://www.python.org/downloads/

**Important during installation:**
- ✅ Check the box "Add Python to PATH"
- This allows the .bat files to find Python

### 3. Pillow Library
Image processing library for Python.

**Easy installation:**
```
pip install Pillow
```

## Quick Setup

**Option 1: Automatic Check**
1. Double-click `SETUP_CHECK.bat`
2. It will check your setup and install Pillow if needed

**Option 2: Manual Install**
1. Install Python from https://www.python.org/downloads/
2. Open Command Prompt
3. Run: `pip install Pillow`

## How to Use

### Method 1: Drag & Drop Folder (Batch Processing)
1. Put your screenshots in a folder
2. **Drag that folder** onto `DRAG_FOLDER_HERE.bat`
3. Done! Cropped images appear in a `cropped` subfolder

### Method 2: Drag & Drop Files (Individual Files)
1. Select one or more PNG files in Windows Explorer
2. **Drag the selected files** onto `DRAG_FILES_HERE.bat`
3. Done! Cropped images saved as `filename_cropped.png` next to originals

**Example:**
- Drag: `screenshot_0001.png`
- Result: `screenshot_0001_cropped.png` (in same folder)

### Method 3: Interactive Menu
1. Double-click `crop_screenshots_menu.bat`
2. Choose your option from the menu
3. Follow the prompts

### Method 4: Simple Run
1. Edit the script to set default folders
2. Double-click `crop_screenshots.bat`

## What It Does

- Takes all PNG images from your input folder
- Crops them to remove UI elements based on the mask template
- Saves cropped versions to an output folder
- **Your original files are not modified!**

## Troubleshooting

### "Python is not recognized..."
- Python is not installed OR not added to PATH
- Reinstall Python and check "Add Python to PATH"

### "No module named PIL"
- Pillow library not installed
- Run: `pip install Pillow`

### No images found
- Make sure your folder contains .png files
- Try putting the full path in quotes

## File Structure

After cropping, your folders will look like:
```
YourScreenshotsFolder/
├── screenshot_0001.png  (original - untouched)
├── screenshot_0002.png  (original - untouched)
└── cropped/
    ├── screenshot_0001.png  (cropped version)
    └── screenshot_0002.png  (cropped version)
```

## Support

For issues or questions, check that:
1. Python is installed and in PATH
2. Pillow is installed (`pip install Pillow`)
3. You're dragging a valid folder with PNG images
4. The folder path doesn't have special characters
