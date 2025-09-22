import unreal

def set_game_view(enable=True):
    """Enable or disable game view mode in the viewport (equivalent to pressing 'G' key)"""

    # Try multiple approaches to set game view

    # Method 1: Try the deprecated EditorLevelLibrary method (might still work)
    try:
        unreal.EditorLevelLibrary.editor_set_game_view(enable)
        print(f"Game view set via EditorLevelLibrary: {'ON' if enable else 'OFF'}")
        return
    except Exception as e:
        print(f"EditorLevelLibrary method failed: {e}")

    # Method 2: Try LevelEditorSubsystem methods
    try:
        level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

        # Check if methods exist and call them
        if hasattr(level_editor, 'editor_set_game_view'):
            level_editor.editor_set_game_view(enable)
            print(f"Game view set via LevelEditorSubsystem: {'ON' if enable else 'OFF'}")
            return
        else:
            print("LevelEditorSubsystem game view methods not found")
    except Exception as e:
        print(f"LevelEditorSubsystem method failed: {e}")

    # Method 3: Try using show flags to simulate game view
    try:
        world = unreal.EditorLevelLibrary.get_editor_world()

        # Set editor elements visibility based on enable parameter
        # For game view: enable=True means hide editor elements (flag_value=0)
        # For normal view: enable=False means show editor elements (flag_value=1)
        if enable:
            flag_value = 0  # Hide editor elements for game view
        else:
            flag_value = 1  # Show editor elements for normal view

        show_flags = [
            f"showflag.editor {flag_value}",
            f"showflag.selection {flag_value}",
            f"showflag.grid {flag_value}",
            f"showflag.bounds {flag_value}",
            f"showflag.hitproxies {flag_value}"
        ]

        for flag in show_flags:
            unreal.SystemLibrary.execute_console_command(world, flag)

        print(f"Game view simulated: {'ON' if enable else 'OFF'}")

    except Exception as e:
        print(f"Show flags method failed: {e}")
        print("Manual toggle with 'G' key is recommended")

# Default behavior when running this script
enable_game_view = True
set_game_view(enable_game_view)