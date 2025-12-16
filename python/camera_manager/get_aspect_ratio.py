import unreal
from math import gcd

width: int
height: int

result: float

def get_aspect_ratio(width, height):
    """
    Calculate aspect ratio from width and height

    Args:
        width (int): Width in pixels
        height (int): Height in pixels

    Returns:
        tuple: (ratio_width, ratio_height, decimal_ratio)
        Example: (16, 9, 1.777...)
    """
    if height == 0:
        unreal.log_warning("Height cannot be zero")
        return (0, 0, 0.0)

    # Calculate GCD to find simplified ratio
    divisor = gcd(int(width), int(height))
    ratio_width = int(width / divisor)
    ratio_height = int(height / divisor)

    # Calculate decimal ratio
    decimal_ratio = width / height

    return (ratio_width, ratio_height, decimal_ratio)


def get_common_aspect_ratio_name(width, height):
    """
    Get common aspect ratio name

    Args:
        width (int): Width in pixels
        height (int): Height in pixels

    Returns:
        str: Aspect ratio name (e.g., "16:9", "4:3", "21:9")
    """
    ratio_w, ratio_h, decimal = get_aspect_ratio(width, height)

    # Common aspect ratios
    common_ratios = {
        (16, 9): "16:9",
        (16, 10): "16:10",
        (4, 3): "4:3",
        (21, 9): "21:9",
        (32, 9): "32:9",
        (1, 1): "1:1",
        (3, 2): "3:2",
        (5, 4): "5:4",
    }

    ratio_key = (ratio_w, ratio_h)
    if ratio_key in common_ratios:
        return common_ratios[ratio_key]
    else:
        return f"{ratio_w}:{ratio_h}"

result = get_aspect_ratio(width, height)