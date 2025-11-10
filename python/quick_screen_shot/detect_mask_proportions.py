from PIL import Image
import sys

def detect_red_box(image_path):
    """
    Detect the exact boundaries of the red box in the mask image.
    """
    img = Image.open(image_path)
    width, height = img.size
    pixels = img.load()

    # Find the red box boundaries
    # Red pixels have high R value and low G, B values
    min_x, min_y = width, height
    max_x, max_y = 0, 0

    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y][:3]  # Get RGB, ignore alpha if present

            # Check if pixel is red (R > 200, G < 100, B < 100)
            if r > 200 and g < 100 and b < 100:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if min_x == width or min_y == height:
        print("ERROR: No red box found in image!")
        return None

    # Calculate proportions
    left_prop = min_x / width
    top_prop = min_y / height
    right_prop = (max_x + 1) / width  # +1 to include the last pixel
    bottom_prop = (max_y + 1) / height

    print(f"Red box detected in: {image_path}")
    print(f"Image size: {width}x{height}")
    print(f"\nRed box boundaries:")
    print(f"  Left edge: {min_x}px ({left_prop:.3%})")
    print(f"  Top edge: {min_y}px ({top_prop:.3%})")
    print(f"  Right edge: {max_x}px ({right_prop:.3%})")
    print(f"  Bottom edge: {max_y}px ({bottom_prop:.3%})")
    print(f"\nProportions to use in crop_image_by_mask.py:")
    print(f"CROP_PROPORTIONS = {{")
    print(f"    'left': {left_prop:.4f},")
    print(f"    'top': {top_prop:.4f},")
    print(f"    'right': {right_prop:.4f},")
    print(f"    'bottom': {bottom_prop:.4f}")
    print(f"}}")

    return {
        'left': left_prop,
        'top': top_prop,
        'right': right_prop,
        'bottom': bottom_prop
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python detect_mask_proportions.py <mask_image.png>")
        print("\nExample:")
        print('  python detect_mask_proportions.py "D:/vs/anju/python/quick_screen_shot/input/MaskImage.png"')
        sys.exit(1)

    mask_path = sys.argv[1]
    detect_red_box(mask_path)
