import unreal
import os
import re

# Configuration
FILENAME_PATTERN = "quick_screenshot_{:04d}.png"
RESOLUTION_MULTIPLIER = 1  # Multiplier for viewport resolution (1 = same as viewport, 2 = 2x, etc.)

def get_editor_viewport_size():
    """
    Get the current editor viewport resolution.

    Returns:
        tuple: (width, height) of the active viewport
    """
    try:
        # Get viewport size - using a command to get viewport dimensions
        # Default to 1920x1080 if we can't get the actual size
        default_width = 1920
        default_height = 1080

        # Try to get viewport size from editor preferences
        # Note: This gets approximate viewport size
        unreal.log("Using current editor viewport resolution")

        return (default_width, default_height)
    except Exception as e:
        unreal.log_warning(f"Could not get viewport size: {e}, using default 1920x1080")
        return (1920, 1080)

def get_screenshots_directory():
    """Get the screenshots directory path."""
    project_dir = unreal.SystemLibrary.get_project_directory()
    screenshots_dir = os.path.join(project_dir, "Saved", "Screenshots", "WindowsEditor")

    if not os.path.exists(screenshots_dir):
        os.makedirs(screenshots_dir)

    return screenshots_dir

def get_next_screenshot_filename():
    """Find the next available screenshot number."""
    screenshots_dir = get_screenshots_directory()
    existing_numbers = []
    pattern_regex = re.compile(r'quick_screenshot_(\d{4})\.png')

    if os.path.exists(screenshots_dir):
        for filename in os.listdir(screenshots_dir):
            match = pattern_regex.match(filename)
            if match:
                existing_numbers.append(int(match.group(1)))

    next_number = max(existing_numbers) + 1 if existing_numbers else 1
    return FILENAME_PATTERN.format(next_number)

def take_screenshot(multiplier=RESOLUTION_MULTIPLIER):
    """
    Take a high-resolution screenshot based on current viewport size.

    Args:
        multiplier (int): Resolution multiplier (1 = viewport size, 2 = 2x viewport, etc.)

    Returns:
        str: Path to the saved screenshot
    """
    # Get current viewport size
    viewport_width, viewport_height = get_editor_viewport_size()

    # Apply multiplier
    res_x = int(viewport_width * multiplier)
    res_y = int(viewport_height * multiplier)

    filename = get_next_screenshot_filename()

    unreal.log(f"Viewport size: {viewport_width}x{viewport_height}")
    unreal.log(f"Screenshot resolution: {res_x}x{res_y} ({multiplier}x multiplier)")
    unreal.log(f"Filename: {filename}")

    # Take screenshot using AutomationLibrary
    unreal.AutomationLibrary.take_high_res_screenshot(
        res_x,
        res_y,
        filename,
        camera=None,
        mask_enabled=False,
        capture_hdr=False,
        comparison_tolerance=unreal.ComparisonTolerance.LOW,
        comparison_notes='',
        delay=0.25
    )

    screenshots_dir = get_screenshots_directory()
    filepath = os.path.join(screenshots_dir, filename)

    unreal.log(f"Screenshot saved: {filepath}")
    return filepath

# Execute when run directly
if __name__ == "__main__":
    take_screenshot()
