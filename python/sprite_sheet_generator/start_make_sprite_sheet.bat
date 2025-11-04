@echo off
echo What type of sprite sheet do you want to generate?
echo 1. Face Animation Sprite Sheet
echo 2. Camera1
echo 3. Camera2
echo 4. Camera4
echo 5. Camera8
echo 6. Camera16
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
	echo Generating face animation sprite sheet...
	py generate_sprite_sheet.py --use_png_subfolder=False --fps_reduction=3 --frame_width=80 --frame_height=80
	pause
) else if "%choice%"=="2" (
	echo Generating motion browser sprite sheet with fps_reduction 1...
	py generate_sprite_sheet.py --use_png_subfolder=True --fps_reduction=1 --frame_width=260 --frame_height=145
	pause
) else if "%choice%"=="3" (
	echo Generating motion browser sprite sheet with fps_reduction 2...
	py generate_sprite_sheet.py --use_png_subfolder=True --fps_reduction=2 --frame_width=260 --frame_height=145
	pause
) else if "%choice%"=="4" (
	echo Generating motion browser sprite sheet with fps_reduction 4...
	py generate_sprite_sheet.py --use_png_subfolder=True --fps_reduction=4 --frame_width=260 --frame_height=145
	pause
) else if "%choice%"=="5" (
	echo Generating motion browser sprite sheet with fps_reduction 8...
	py generate_sprite_sheet.py --use_png_subfolder=True --fps_reduction=8 --frame_width=260 --frame_height=145
	pause
) else if "%choice%"=="6" (
	echo Generating motion browser sprite sheet with fps_reduction 16...
	py generate_sprite_sheet.py --use_png_subfolder=True --fps_reduction=16 --frame_width=260 --frame_height=145
	pause
) else (
	echo Invalid choice. Please run the script again and enter a number between 1 and 6.
	pause
)
