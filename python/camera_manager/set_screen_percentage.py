import unreal

def set_screen_percentage(enable=True, value=200.0):
    """Set screen percentage for runtime performance scaling (affects PIE and builds)

    Args:
        enable (bool): Whether to enable custom screen percentage
        value (float): Screen percentage value (10-400, where 100 = native resolution)
    """

    # Clamp value to reasonable range
    value = max(10.0, min(400.0, value))

    # Method 1: Try CVarLibrary (preferred, no world context needed)
    try:
        if enable:
            unreal.CVarLibrary.set_int_cvar("r.ScreenPercentage.Enable", 1)
            unreal.CVarLibrary.set_int_cvar("r.DynamicRes.OperationMode", 0)  # Disable dynamic resolution
            unreal.CVarLibrary.set_float_cvar("r.ScreenPercentage", float(value))
            print(f"Screen percentage set via CVarLibrary: {value}%")
        else:
            unreal.CVarLibrary.set_int_cvar("r.ScreenPercentage.Enable", 0)
            unreal.CVarLibrary.set_int_cvar("r.DynamicRes.OperationMode", 1)  # Re-enable dynamic resolution
            unreal.CVarLibrary.set_float_cvar("r.ScreenPercentage", 100.0)
            print("Screen percentage disabled via CVarLibrary (reset to 100%)")
        return
    except Exception as e:
        print(f"CVarLibrary method failed: {e}")

    # Method 2: Fallback to console commands
    try:
        world = unreal.EditorLevelLibrary.get_editor_world()

        if enable:
            commands = [
                "r.ScreenPercentage.Enable 1",
                "r.DynamicRes.OperationMode 0",
                f"r.ScreenPercentage {int(value)}"
            ]
            print(f"Screen percentage set via console commands: {value}%")
        else:
            commands = [
                "r.ScreenPercentage.Enable 0",
                "r.DynamicRes.OperationMode 1",
                "r.ScreenPercentage 100"
            ]
            print("Screen percentage disabled via console commands (reset to 100%)")

        for cmd in commands:
            unreal.SystemLibrary.execute_console_command(world, cmd)

    except Exception as e:
        print(f"Console command method failed: {e}")
        print("Note: This affects runtime performance, not editor viewport preview")

def get_screen_percentage():
    """Get current screen percentage value"""
    try:
        enabled = unreal.CVarLibrary.get_int_cvar("r.ScreenPercentage.Enable")
        value = unreal.CVarLibrary.get_float_cvar("r.ScreenPercentage")
        dynamic_res = unreal.CVarLibrary.get_int_cvar("r.DynamicRes.OperationMode")

        print(f"Screen Percentage Enabled: {bool(enabled)}")
        print(f"Screen Percentage Value: {value}%")
        print(f"Dynamic Resolution Mode: {dynamic_res} (0=disabled, 1=enabled)")

        return {"enabled": bool(enabled), "value": value, "dynamic_res": dynamic_res}
    except Exception as e:
        print(f"Failed to get screen percentage: {e}")
        return None

# Default behavior when running this script
enable_screen_percentage = True
screen_percentage_value = 200.0
set_screen_percentage(enable_screen_percentage, screen_percentage_value)
