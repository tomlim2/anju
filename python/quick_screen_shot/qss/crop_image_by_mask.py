import os
import sys
import glob

try:
    from PIL import Image
except ImportError:
    print("ERROR: PIL/Pillow is required for image cropping")
    print("Install with: pip install Pillow")
    sys.exit(1)

# Configuration
INPUT_FOLDER = "input"    # Folder containing original screenshots
OUTPUT_FOLDER = "output"  # Folder for cropped screenshots

# Crop proportions detected from MaskImage.png (red box area)
# These percentages define where to crop on all four sides
CROP_PROPORTIONS = {
    'left': 0.2727,   # 27.27% from left edge - cuts left side
    'top': 0.0468,    # 4.68% from top edge - cuts top side
    'right': 0.8662,  # 86.62% from left edge - cuts right side
    'bottom': 0.7138  # 71.38% from top edge - cuts bottom side
}

def crop_image(image_path, output_path, crop_props=CROP_PROPORTIONS):
    """
    Crop an image based on proportional coordinates from the mask.

    Args:
        image_path (str): Path to the input image
        output_path (str): Path to save cropped image
        crop_props (dict): Dictionary with 'left', 'top', 'right', 'bottom' proportions (0.0 to 1.0)

    Returns:
        str: Path to the cropped image, or None if failed
    """
    if not os.path.exists(image_path):
        print(f"ERROR: Image not found: {image_path}")
        return None

    try:
        # Open image
        img = Image.open(image_path)
        width, height = img.size

        # Calculate pixel coordinates from proportions
        left = int(width * crop_props['left'])
        top = int(height * crop_props['top'])
        right = int(width * crop_props['right'])
        bottom = int(height * crop_props['bottom'])

        crop_width = right - left
        crop_height = bottom - top

        # Debug output
        print(f"  Original: {width}x{height}")
        print(f"  Crop box: ({left}, {top}, {right}, {bottom})")
        print(f"  Cutting LEFT: {left}px, TOP: {top}px, RIGHT: {width-right}px, BOTTOM: {height-bottom}px")

        # Crop the image
        cropped_img = img.crop((left, top, right, bottom))

        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Save cropped image
        cropped_img.save(output_path)

        print(f"  ✓ Result: {crop_width}x{crop_height}\n")
        return output_path

    except Exception as e:
        print(f"✗ ERROR: {os.path.basename(image_path)} - {e}")
        return None

def process_folder(input_folder, output_folder, pattern="*.png"):
    """
    Process all images from input folder and save cropped versions to output folder.

    Args:
        input_folder (str): Folder containing original screenshots
        output_folder (str): Folder to save cropped screenshots
        pattern (str): File pattern to match (default: *.png)

    Returns:
        int: Number of images successfully processed
    """
    # Validate input folder
    if not os.path.exists(input_folder):
        print(f"ERROR: Input folder not found: {input_folder}")
        return 0

    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"Created output folder: {output_folder}")

    # Find all images matching pattern
    search_path = os.path.join(input_folder, pattern)
    files = glob.glob(search_path)

    if not files:
        print(f"No files found matching: {search_path}")
        return 0

    print(f"\nFound {len(files)} files to process")
    print(f"Input:  {input_folder}")
    print(f"Output: {output_folder}")
    print("-" * 60)

    # Process each file
    success_count = 0
    for input_path in files:
        filename = os.path.basename(input_path)
        output_path = os.path.join(output_folder, filename)

        if crop_image(input_path, output_path):
            success_count += 1

    print("-" * 60)
    print(f"\n✓ Complete! Processed {success_count}/{len(files)} images")
    print(f"Cropped images saved to: {output_folder}")

    return success_count

# Command-line usage
if __name__ == "__main__":
    print("=" * 60)
    print("Screenshot Cropper - Batch Image Processing")
    print("=" * 60)

    # Default: use configured INPUT_FOLDER and OUTPUT_FOLDER
    if len(sys.argv) == 1:
        # No arguments - use default folders
        input_folder = INPUT_FOLDER
        output_folder = OUTPUT_FOLDER
        print(f"Using default folders from configuration:")

    elif len(sys.argv) == 2:
        # One argument - use as input folder, create "output" subfolder
        input_folder = sys.argv[1]
        output_folder = os.path.join(input_folder, "cropped")
        print(f"Input folder specified:")

    elif len(sys.argv) >= 3:
        # Two arguments - input and output folders
        input_folder = sys.argv[1]
        output_folder = sys.argv[2]
        print(f"Input and output folders specified:")

    else:
        print("\nUsage:")
        print("  Default folders:  python crop_image_by_mask.py")
        print("  Input folder:     python crop_image_by_mask.py <input_folder>")
        print("  Custom output:    python crop_image_by_mask.py <input_folder> <output_folder>")
        print("\nExamples:")
        print('  python crop_image_by_mask.py "E:/Screenshots"')
        print('  python crop_image_by_mask.py "E:/Screenshots" "E:/Cropped"')
        sys.exit(1)

    # Process the folder
    process_folder(input_folder, output_folder)
