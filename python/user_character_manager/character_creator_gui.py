import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import json
import os
import socket
import subprocess
import threading
import shutil
import uuid

class ToolTip:
    """Simple tooltip for tkinter widgets."""
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tip_window = None
        widget.bind('<Enter>', self.show)
        widget.bind('<Leave>', self.hide)

    def show(self, event=None):
        if self.tip_window:
            return
        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 4
        self.tip_window = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = tk.Label(tw, text=self.text, background="#ffffe0",
                         relief=tk.SOLID, borderwidth=1, font=('Arial', 8))
        label.pack()

    def hide(self, event=None):
        if self.tip_window:
            self.tip_window.destroy()
            self.tip_window = None


class CharacterCreatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CINEV Character Creator")
        self.root.geometry("1600x900")
        self.root.minsize(1024, 600)
        self.root.configure(bg='white')

        # Config file path
        self.config_file = os.path.join(os.path.dirname(__file__), "character_creator_config.json")

        # Variables
        self.gender_var = tk.StringVar(value="Female")
        self.scaling_method_var = tk.StringVar(value="Original")
        self.model_source_type_var = tk.StringVar(value="None")
        self.display_name_var = tk.StringVar()
        self.ue_dir_var = tk.StringVar()
        self.project_file_var = tk.StringVar()
        self.json_file_var = tk.StringVar()
        self.vrm_file_var = tk.StringVar()
        self.output_folder_var = tk.StringVar()

        # Assets info data
        self.assets_data = []

        self.create_widgets()

        # Load saved configuration (after widgets are created)
        self.load_config()

        # Add trace to auto-save when config changes
        self.ue_dir_var.trace_add('write', lambda *args: self.save_config())
        self.project_file_var.trace_add('write', lambda *args: self.save_config())
        self.output_folder_var.trace_add('write', lambda *args: self.save_config())

        # Key bindings
        self.root.bind('<Escape>', lambda e: self.root.focus_set())
        self.root.bind('<Control-s>', lambda e: self.assets_auto_save())

    def create_widgets(self):
        # Main container
        main_frame = tk.Frame(self.root, bg='white', padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(main_frame, text="CINEV Character Creator",
                        font=('Arial', 18, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 10))

        # 2-column layout
        columns_frame = tk.Frame(main_frame, bg='white')
        columns_frame.pack(fill=tk.BOTH, expand=True)
        columns_frame.columnconfigure(0, weight=1)
        columns_frame.columnconfigure(1, weight=1)
        columns_frame.rowconfigure(0, weight=1)

        # === LEFT PANE ===
        left_pane = tk.Frame(columns_frame, bg='white', padx=10)
        left_pane.grid(row=0, column=0, sticky='nsew')

        # Paths Section
        paths_frame = tk.LabelFrame(left_pane, text="1. Configure Paths",
                                    font=('Arial', 10, 'bold'), bg='white',
                                    fg='black', padx=10, pady=10)
        paths_frame.pack(fill=tk.X, pady=(0, 10))

        self.create_path_input(paths_frame, "UE_CINEV Directory:",
                              self.ue_dir_var, self.browse_ue_directory)
        self.create_path_input(paths_frame, "Project File (.uproject):",
                              self.project_file_var, self.browse_project_file)
        # Output Folder with Open button
        output_folder_frame = tk.Frame(paths_frame, bg='white')
        output_folder_frame.pack(fill=tk.X, pady=5)
        tk.Label(output_folder_frame, text="Output Folder:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        tk.Entry(output_folder_frame, textvariable=self.output_folder_var, bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        tk.Button(output_folder_frame, text="Browse", command=self.browse_output_folder,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)
        tk.Button(output_folder_frame, text="Open folder", command=self.open_output_folder,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT, padx=(5, 0))

        # UserCharacter folder info label
        self.user_char_label = tk.Label(left_pane, text="",
                                        bg='#f0f0f0', fg='#666666',
                                        font=('Arial', 8), anchor='w',
                                        relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.user_char_label.pack(fill=tk.X, pady=(0, 10))

        # Character Files Section
        char_frame = tk.LabelFrame(left_pane, text="2. Character Files",
                                   font=('Arial', 10, 'bold'), bg='white',
                                   fg='black', padx=10, pady=10)
        char_frame.pack(fill=tk.X, pady=(0, 10))

        # Gender
        gender_frame = tk.Frame(char_frame, bg='white')
        gender_frame.pack(fill=tk.X, pady=5)
        tk.Label(gender_frame, text="Gender:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        ttk.Combobox(gender_frame, textvariable=self.gender_var,
                     values=["Female", "Male"], state='readonly', width=30).pack(side=tk.LEFT, padx=5)

        # Scaling Method
        scaling_frame = tk.Frame(char_frame, bg='white')
        scaling_frame.pack(fill=tk.X, pady=5)
        tk.Label(scaling_frame, text="Scaling Method:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        ttk.Combobox(scaling_frame, textvariable=self.scaling_method_var,
                     values=["Original", "CineV"], state='readonly', width=30).pack(side=tk.LEFT, padx=5)

        # Model Source Type
        source_frame = tk.Frame(char_frame, bg='white')
        source_frame.pack(fill=tk.X, pady=5)
        tk.Label(source_frame, text="Model Source:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        ttk.Combobox(source_frame, textvariable=self.model_source_type_var,
                     values=["None", "VRM", "VRoid", "Zepeto"], state='readonly', width=30).pack(side=tk.LEFT, padx=5)

        # Display Name
        name_frame = tk.Frame(char_frame, bg='white')
        name_frame.pack(fill=tk.X, pady=5)
        tk.Label(name_frame, text="Display Name:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        tk.Entry(name_frame, textvariable=self.display_name_var,
                width=33, bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, padx=5)

        # Generate JSON Button
        tk.Button(char_frame, text="Generate & Save JSON",
                 command=self.generate_json, bg='black', fg='white',
                 relief=tk.FLAT, padx=20, pady=8, font=('Arial', 9, 'bold'),
                 cursor='hand2').pack(pady=10)

        # Execute Section
        execute_frame = tk.LabelFrame(left_pane, text="3. Execute",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        execute_frame.pack(fill=tk.X, pady=(0, 10))

        self.create_path_input(execute_frame, "JSON File:",
                              self.json_file_var, self.browse_json_file)
        self.create_path_input(execute_frame, "VRM File:",
                              self.vrm_file_var, self.browse_vrm_file)

        # Command display area
        cmd_display_frame = tk.Frame(execute_frame, bg='white')
        cmd_display_frame.pack(fill=tk.X, pady=(10, 5))
        tk.Label(cmd_display_frame, text="Command:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        self.cmd_display_var = tk.StringVar()
        tk.Entry(cmd_display_frame, textvariable=self.cmd_display_var,
                 bg='#f5f5f5', fg='black', relief=tk.SOLID,
                 borderwidth=1, state='readonly').pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        tk.Button(cmd_display_frame, text="Copy command", command=self.copy_command,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)
        tk.Button(cmd_display_frame, text="Refresh command", command=self.update_command_display,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT, padx=(5, 0))

        # Buttons frame
        buttons_frame = tk.Frame(execute_frame, bg='white')
        buttons_frame.pack(pady=10)

        self.build_and_create_btn = tk.Button(buttons_frame, text="Build & Create",
                                              command=self.build_and_create_character, bg='#0066CC',
                                              fg='white', relief=tk.FLAT,
                                              font=('Arial', 11, 'bold'),
                                              padx=20, pady=10, cursor='hand2')
        self.build_and_create_btn.pack(side=tk.LEFT, padx=3)

        self.zen_btn = tk.Button(buttons_frame, text="Open Zen Dashboard",
                                 command=self.start_zen_dashboard, bg='#666666',
                                 fg='white', relief=tk.FLAT,
                                 font=('Arial', 11, 'bold'),
                                 padx=20, pady=10, cursor='hand2')
        self.zen_btn.pack(side=tk.LEFT, padx=3)

        # Output Console
        output_frame = tk.LabelFrame(left_pane, text="Output",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        output_frame.pack(fill=tk.BOTH, expand=True)

        self.output_text = scrolledtext.ScrolledText(output_frame, height=8,
                                                     bg='white', fg='black',
                                                     relief=tk.SOLID, borderwidth=1,
                                                     font=('Consolas', 9))
        self.output_text.pack(fill=tk.BOTH, expand=True)

        # === RIGHT PANE: assets.info editor ===
        right_pane = tk.Frame(columns_frame, bg='white', padx=10)
        right_pane.grid(row=0, column=1, sticky='nsew')

        self.create_assets_editor(right_pane)

        # Tooltips
        ToolTip(self.build_and_create_btn, "Build editor, then run character creation commandlet")
        ToolTip(self.zen_btn, "Launch Zen Dashboard to check server status")
        ToolTip(self.assets_apply_btn, "Save edit form changes to the selected entry")
        ToolTip(self.assets_delete_btn, "Remove the selected entry from assets.info")

    def create_assets_editor(self, parent):
        """Create the assets.info editor panel"""
        editor_frame = tk.LabelFrame(parent, text="assets.info Editor",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        editor_frame.pack(fill=tk.BOTH, expand=True)

        # Count label + Refresh
        count_frame = tk.Frame(editor_frame, bg='white')
        count_frame.pack(fill=tk.X, pady=(0, 5))
        tk.Button(count_frame, text="Refresh", command=self.assets_load,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=8, cursor='hand2', font=('Arial', 8)).pack(side=tk.LEFT)
        self.assets_count_label = tk.Label(count_frame, text="", bg='white', fg='#666666',
                                           font=('Arial', 9))
        self.assets_count_label.pack(side=tk.RIGHT)

        # Treeview for entries
        tree_frame = tk.Frame(editor_frame, bg='white')
        tree_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        columns = ('preset_id', 'display_name', 'character_file', 'scaling', 'category')
        self.assets_tree = ttk.Treeview(tree_frame, columns=columns, show='headings', height=15)

        self.assets_tree.heading('preset_id', text='Preset ID')
        self.assets_tree.heading('display_name', text='Display Name')
        self.assets_tree.heading('character_file', text='Character File')
        self.assets_tree.heading('scaling', text='Scaling')
        self.assets_tree.heading('category', text='Category')

        self.assets_tree.column('preset_id', width=80, minwidth=60)
        self.assets_tree.column('display_name', width=100, minwidth=80)
        self.assets_tree.column('character_file', width=180, minwidth=120)
        self.assets_tree.column('scaling', width=60, minwidth=50)
        self.assets_tree.column('category', width=120, minwidth=80)

        scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.assets_tree.yview)
        self.assets_tree.configure(yscrollcommand=scrollbar.set)

        self.assets_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.assets_tree.bind('<<TreeviewSelect>>', self.assets_on_select)

        self.selected_asset_idx = None

        # --- Add from .character file ---
        add_frame = tk.LabelFrame(editor_frame, text="Add from .character",
                                  font=('Arial', 9, 'bold'), bg='white',
                                  fg='black', padx=10, pady=10)
        add_frame.pack(fill=tk.X, pady=(0, 5))

        char_pick_row = tk.Frame(add_frame, bg='white')
        char_pick_row.pack(fill=tk.X, pady=2)

        self.add_char_file_var = tk.StringVar()
        tk.Label(char_pick_row, text=".character File:", width=16, anchor='w',
                bg='white', fg='black', font=('Arial', 9)).pack(side=tk.LEFT)
        tk.Entry(char_pick_row, textvariable=self.add_char_file_var, bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1, state='readonly').pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        tk.Button(char_pick_row, text="Browse", command=self.assets_pick_character_file,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)

        tk.Button(add_frame, text="Add to assets.info",
                 command=self.assets_add_from_character,
                 bg='#0066CC', fg='white', relief=tk.FLAT,
                 padx=20, pady=5, font=('Arial', 9, 'bold'),
                 cursor='hand2').pack(pady=(8, 2))

        # --- Edit form ---
        form_frame = tk.LabelFrame(editor_frame, text="Edit Entry",
                                   font=('Arial', 9, 'bold'), bg='white',
                                   fg='black', padx=10, pady=10)
        form_frame.pack(fill=tk.X)

        self.asset_preset_id_var = tk.StringVar()
        self.asset_gender_var = tk.StringVar()
        self.asset_display_name_var = tk.StringVar()
        self.asset_scaling_var = tk.StringVar()
        self.asset_char_file_var = tk.StringVar()
        self.asset_category_var = tk.StringVar()
        self.asset_thumbnail_var = tk.StringVar()

        fields = [
            ("Preset ID:", self.asset_preset_id_var, None),
            ("Gender:", self.asset_gender_var, ["", "Female", "Male"]),
            ("DisplayName:", self.asset_display_name_var, None),
            ("ScalingMethod:", self.asset_scaling_var, ["", "Original", "CineV"]),
            ("CharacterFilePath:", self.asset_char_file_var, None),
            ("CategoryName:", self.asset_category_var, ["CharacterCategory.VRM"]),
            ("ThumbnailFileName:", self.asset_thumbnail_var, None),
        ]

        for label_text, var, combo_values in fields:
            row = tk.Frame(form_frame, bg='white')
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label_text, width=16, anchor='w',
                    bg='white', fg='black', font=('Arial', 9)).pack(side=tk.LEFT)
            if combo_values is not None:
                ttk.Combobox(row, textvariable=var, values=combo_values,
                            width=40).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
            else:
                tk.Entry(row, textvariable=var, bg='white', fg='black',
                        relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        # Buttons row
        btn_row = tk.Frame(form_frame, bg='white')
        btn_row.pack(pady=(10, 5))
        self.assets_apply_btn = tk.Button(btn_row, text="Apply Changes", command=self.assets_apply_changes,
                 bg='#0066CC', fg='white', relief=tk.FLAT,
                 padx=20, pady=5, font=('Arial', 9, 'bold'),
                 cursor='hand2', state=tk.DISABLED)
        self.assets_apply_btn.pack(side=tk.LEFT, padx=5)
        self.assets_delete_btn = tk.Button(btn_row, text="Delete entry", command=self.assets_delete_entry,
                 bg='#CC0000', fg='white', relief=tk.FLAT,
                 padx=20, pady=5, font=('Arial', 9, 'bold'),
                 cursor='hand2', state=tk.DISABLED)
        self.assets_delete_btn.pack(side=tk.LEFT, padx=5)

    def get_assets_info_path(self):
        """Get the assets.info file path"""
        user_char_folder = self.get_user_character_folder()
        if user_char_folder:
            return os.path.join(user_char_folder, "assets.info")
        return None

    def assets_load(self):
        """Load assets.info file"""
        path = self.get_assets_info_path()
        if not path:
            messagebox.showerror("Error", "Set Project File first to locate UserCharacter folder")
            return
        if not os.path.exists(path):
            messagebox.showerror("Error", f"assets.info not found:\n{path}")
            return

        try:
            with open(path, 'r', encoding='utf-8') as f:
                self.assets_data = json.load(f)
            self.assets_refresh_tree()
            self.log_output(f"Loaded assets.info: {len(self.assets_data)} entries")
        except Exception as e:
            self.log_output(f"Error loading assets.info: {str(e)}")
            messagebox.showerror("Error", "Failed to load assets.info. Check the output console for details.")

    def assets_auto_save(self):
        """Auto-save assets.info after any change"""
        path = self.get_assets_info_path()
        if not path:
            return
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(self.assets_data, f, indent=2, ensure_ascii=False)
            self.log_output(f"Auto-saved assets.info ({len(self.assets_data)} entries)")
            # Flash count label to confirm save
            self.assets_count_label.config(text="Saved", fg='#00AA00')
            self.root.after(2000, lambda: self.assets_count_label.config(
                text=f"{len(self.assets_data)} entries", fg='#666666'))
        except Exception as e:
            self.log_output(f"Auto-save failed: {str(e)}")

    def assets_save(self):
        """Save assets.info file"""
        path = self.get_assets_info_path()
        if not path:
            messagebox.showerror("Error", "Set Project File first to locate UserCharacter folder")
            return

        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(self.assets_data, f, indent=2, ensure_ascii=False)
            self.log_output(f"Saved assets.info: {len(self.assets_data)} entries")
            messagebox.showinfo("Success", f"assets.info saved!\n{path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save assets.info:\n{str(e)}")

    def assets_refresh_tree(self):
        """Refresh the treeview with current data"""
        self.assets_tree.delete(*self.assets_tree.get_children())
        for i, entry in enumerate(self.assets_data):
            preset_id = entry.get('Preset_id', '')
            short_id = '...' + preset_id[-4:] if len(preset_id) > 4 else preset_id
            self.assets_tree.insert('', tk.END, iid=str(i), values=(
                short_id,
                entry.get('DisplayName', ''),
                entry.get('CharacterFilePath', ''),
                entry.get('ScalingMethod', ''),
                entry.get('CategoryName', ''),
            ))
        self.assets_count_label.config(text=f"{len(self.assets_data)} entries")

        # Empty state guidance
        if not self.assets_data:
            self.assets_tree.insert('', tk.END, iid='empty_placeholder', values=(
                '', 'No entries yet.', 'Use "Add from .character" above.', '', ''
            ))
            self.assets_apply_btn.config(state=tk.DISABLED)
            self.assets_delete_btn.config(state=tk.DISABLED)

    def assets_on_select(self, event):
        """Handle treeview selection - populate edit form"""
        selection = self.assets_tree.selection()
        if not selection or (len(selection) == 1 and selection[0] == 'empty_placeholder'):
            return
        idx = int(selection[0])
        self.selected_asset_idx = idx
        entry = self.assets_data[idx]

        self.asset_preset_id_var.set(entry.get('Preset_id', ''))
        self.asset_gender_var.set(entry.get('Gender', ''))
        self.asset_display_name_var.set(entry.get('DisplayName', ''))
        self.asset_scaling_var.set(entry.get('ScalingMethod', ''))
        self.asset_char_file_var.set(entry.get('CharacterFilePath', ''))
        self.asset_category_var.set(entry.get('CategoryName', ''))
        self.asset_thumbnail_var.set(entry.get('ThumbnailFileName', ''))

        # Enable edit buttons
        self.assets_apply_btn.config(state=tk.NORMAL)
        self.assets_delete_btn.config(state=tk.NORMAL)

    def assets_apply_changes(self):
        """Apply edit form changes to selected entry"""
        if self.selected_asset_idx is None:
            messagebox.showwarning("Warning", "Select an entry first")
            return
        idx = self.selected_asset_idx

        self.assets_data[idx]['Preset_id'] = self.asset_preset_id_var.get()
        self.assets_data[idx]['Gender'] = self.asset_gender_var.get()
        self.assets_data[idx]['DisplayName'] = self.asset_display_name_var.get()
        self.assets_data[idx]['ScalingMethod'] = self.asset_scaling_var.get()
        self.assets_data[idx]['CharacterFilePath'] = self.asset_char_file_var.get()
        self.assets_data[idx]['CategoryName'] = self.asset_category_var.get()
        self.assets_data[idx]['ThumbnailFileName'] = self.asset_thumbnail_var.get()

        self.assets_refresh_tree()
        self.assets_tree.selection_set(str(idx))
        self.assets_tree.see(str(idx))
        self.assets_auto_save()

    def assets_add_entry(self):
        """Add a new entry to assets data"""
        new_entry = {
            "Preset_id": str(uuid.uuid4()),
            "Gender": "",
            "DisplayName": "",
            "ScalingMethod": "",
            "CharacterFilePath": "",
            "CategoryName": "CharacterCategory.VRM",
            "ThumbnailFileName": ""
        }
        self.assets_data.append(new_entry)
        self.assets_refresh_tree()
        # Select the new entry
        new_idx = str(len(self.assets_data) - 1)
        self.assets_tree.selection_set(new_idx)
        self.assets_tree.see(new_idx)
        self.assets_on_select(None)

    def assets_pick_character_file(self):
        """Browse for a .character file (just stores the path)"""
        filename = filedialog.askopenfilename(
            title="Select Character File",
            filetypes=[("Character Files", "*.character"), ("All Files", "*.*")]
        )
        if filename:
            self.add_char_file_var.set(os.path.normpath(filename))

    @staticmethod
    def read_character_metadata(char_path):
        """Read metadata JSON embedded in a .character file (after binary header)"""
        with open(char_path, 'rb') as f:
            data = f.read()
        idx = data.find(b'{')
        if idx < 0:
            return None
        # Find the end of the first JSON object
        depth = 0
        end = idx
        for i in range(idx, len(data)):
            if data[i:i+1] == b'{':
                depth += 1
            elif data[i:i+1] == b'}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        json_str = data[idx:end].decode('utf-8', errors='replace')
        return json.loads(json_str)

    def assets_add_from_character(self):
        """Add a new entry from .character file, reading metadata directly and requiring matching .png"""
        char_path = self.add_char_file_var.get()
        if not char_path:
            messagebox.showwarning("Warning", "Select a .character file first")
            return

        user_char_folder = self.get_user_character_folder()
        if not user_char_folder:
            messagebox.showerror("Error", "Set Project File first")
            return

        src_dir = os.path.normpath(os.path.dirname(char_path))
        basename = os.path.basename(char_path)
        name_stem = os.path.splitext(basename)[0]

        # Read metadata from .character file
        try:
            meta = self.read_character_metadata(char_path)
        except Exception as e:
            self.log_output(f"Error reading .character: {str(e)}")
            messagebox.showerror("Error", "Failed to read .character file. Check the output console for details.")
            return
        if not meta:
            messagebox.showerror("Error", "No metadata found in .character file")
            return

        # Check for matching PNG (thumb_{name}_01.png)
        png_name = f"thumb_{name_stem}_01.png"
        png_path = os.path.join(src_dir, png_name)
        if not os.path.exists(png_path):
            messagebox.showerror("Error", f"PNG file not found:\n{png_name}\n\nCannot add entry without matching thumbnail.")
            return

        # Copy files to UserCharacter folder
        dest_dir = os.path.normpath(user_char_folder)
        if src_dir != dest_dir:
            for src_file in [char_path, png_path]:
                try:
                    shutil.copy2(src_file, os.path.join(dest_dir, os.path.basename(src_file)))
                except Exception as e:
                    self.log_output(f"Error copying {os.path.basename(src_file)}: {str(e)}")
                    messagebox.showerror("Error", f"Failed to copy {os.path.basename(src_file)}. Check the output console for details.")
                    return

        # Create new entry (character metadata uses camelCase keys)
        new_entry = {
            "Preset_id": str(uuid.uuid4()),
            "Gender": meta.get("gender", ""),
            "DisplayName": meta.get("displayName", ""),
            "ScalingMethod": meta.get("scalingMethod", ""),
            "CharacterFilePath": basename,
            "CategoryName": f"CharacterCategory.{meta.get('format', 'VRM')}",
            "ThumbnailFileName": png_name
        }
        self.assets_data.append(new_entry)
        self.assets_refresh_tree()

        # Select the new entry
        new_idx = str(len(self.assets_data) - 1)
        self.assets_tree.selection_set(new_idx)
        self.assets_tree.see(new_idx)

        self.log_output(f"Added entry: {basename} (from .character metadata)")
        self.add_char_file_var.set("")
        self.assets_auto_save()

    def assets_browse_character_file(self):
        """Browse for a .character file, move it to UserCharacter folder, and auto-fill from matching JSON"""
        user_char_folder = self.get_user_character_folder()
        filename = filedialog.askopenfilename(
            title="Select Character File",
            filetypes=[("Character Files", "*.character"), ("All Files", "*.*")]
        )
        if not filename:
            return

        src_path = os.path.normpath(filename)
        basename = os.path.basename(src_path)
        src_dir = os.path.normpath(os.path.dirname(src_path))

        # Move to UserCharacter folder if not already there
        if user_char_folder:
            dest_dir = os.path.normpath(user_char_folder)
            if src_dir != dest_dir:
                dest_path = os.path.join(dest_dir, basename)
                try:
                    shutil.copy2(src_path, dest_path)
                    self.log_output(f"Copied to UserCharacter: {basename}")
                except Exception as e:
                    messagebox.showerror("Error", f"Failed to copy file:\n{str(e)}")
                    return

        # Set just the filename (not full path) as CharacterFilePath
        self.asset_char_file_var.set(basename)

        # Look for matching JSON and PNG files (same name stem)
        name_stem = os.path.splitext(basename)[0]

        # JSON auto-fill
        json_path = os.path.join(src_dir, f"{name_stem}.json")
        if not os.path.exists(json_path) and user_char_folder:
            json_path = os.path.join(user_char_folder, f"{name_stem}.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                if json_data.get('Gender'):
                    self.asset_gender_var.set(json_data['Gender'])
                if json_data.get('DisplayName'):
                    self.asset_display_name_var.set(json_data['DisplayName'])
                if json_data.get('ScalingMethod'):
                    self.asset_scaling_var.set(json_data['ScalingMethod'])
                self.log_output(f"Auto-filled from: {os.path.basename(json_path)}")
            except Exception as e:
                self.log_output(f"Failed to read JSON: {str(e)}")

        # PNG thumbnail - copy to UserCharacter folder and set filename
        png_path = os.path.join(src_dir, f"{name_stem}.png")
        if not os.path.exists(png_path) and user_char_folder:
            png_path = os.path.join(user_char_folder, f"{name_stem}.png")
        if os.path.exists(png_path):
            png_basename = os.path.basename(png_path)
            if user_char_folder:
                dest_dir = os.path.normpath(user_char_folder)
                png_src_dir = os.path.normpath(os.path.dirname(png_path))
                if png_src_dir != dest_dir:
                    try:
                        shutil.copy2(png_path, os.path.join(dest_dir, png_basename))
                        self.log_output(f"Copied thumbnail: {png_basename}")
                    except Exception as e:
                        self.log_output(f"Failed to copy thumbnail: {str(e)}")
            self.asset_thumbnail_var.set(png_basename)
            self.log_output(f"Thumbnail set: {png_basename}")

    def assets_delete_by_idx(self, idx):
        """Delete entry by index"""
        entry = self.assets_data[idx]
        name = entry.get('CharacterFilePath', entry.get('DisplayName', f'index {idx}'))

        if messagebox.askyesno("Confirm Delete", f"Delete entry?\n{name}"):
            self.assets_data.pop(idx)
            self.selected_asset_idx = None
            self.assets_refresh_tree()
            self.assets_auto_save()
            self.assets_apply_btn.config(state=tk.DISABLED)
            self.assets_delete_btn.config(state=tk.DISABLED)

    def assets_delete_entry(self):
        """Delete currently selected entry"""
        if self.selected_asset_idx is None:
            messagebox.showwarning("Warning", "Select an entry first")
            return
        self.assets_delete_by_idx(self.selected_asset_idx)

    # --- existing methods below (unchanged) ---

    def create_path_input(self, parent, label_text, var, browse_command):
        frame = tk.Frame(parent, bg='white')
        frame.pack(fill=tk.X, pady=5)

        tk.Label(frame, text=label_text, width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)

        entry = tk.Entry(frame, textvariable=var, bg='white', fg='black',
                       relief=tk.SOLID, borderwidth=1)
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

        tk.Button(frame, text="Browse", command=browse_command,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)

    def load_config(self):
        """Load saved configuration from file"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.ue_dir_var.set(config.get('ue_dir', ''))
                    self.project_file_var.set(config.get('project_file', ''))
                    self.output_folder_var.set(config.get('output_folder', ''))

                    # Update UserCharacter folder info if project is loaded
                    if self.project_file_var.get():
                        self.update_user_char_folder_info()
            except Exception as e:
                print(f"Error loading config: {e}")

        # Auto-load assets.info if available
        path = self.get_assets_info_path()
        if path and os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    self.assets_data = json.load(f)
                self.assets_refresh_tree()
            except Exception:
                pass

    def save_config(self):
        """Save current configuration to file"""
        try:
            config = {
                'ue_dir': self.ue_dir_var.get(),
                'project_file': self.project_file_var.get(),
                'output_folder': self.output_folder_var.get()
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    def browse_ue_directory(self):
        directory = filedialog.askdirectory(title="Select UE_CINEV Directory")
        if directory:
            self.ue_dir_var.set(directory)

    def browse_project_file(self):
        initial_dir = os.path.dirname(self.project_file_var.get()) if self.project_file_var.get() else None

        filename = filedialog.askopenfilename(
            title="Select Project File",
            initialdir=initial_dir,
            filetypes=[("Unreal Project", "*.uproject"), ("All Files", "*.*")]
        )
        if filename:
            self.project_file_var.set(filename)
            self.update_user_char_folder_info()

    def get_user_character_folder(self):
        """Get the UserCharacter folder path from project file"""
        project_file = self.project_file_var.get()
        if not project_file:
            return None

        # Normalize path to use consistent separators
        project_file = os.path.normpath(project_file)
        project_dir = os.path.dirname(project_file)
        user_char_folder = os.path.join(project_dir, "Saved", "SaveGames", "UserCharacter")
        return os.path.normpath(user_char_folder)

    def update_user_char_folder_info(self):
        """Update the info label showing UserCharacter folder"""
        folder = self.get_user_character_folder()
        if folder:
            # Create folder if it doesn't exist
            if not os.path.exists(folder):
                try:
                    os.makedirs(folder, exist_ok=True)
                    self.user_char_label.config(
                        text=f"Files will be saved to: {folder} (folder created)",
                        fg='#00AA00'
                    )
                except:
                    self.user_char_label.config(
                        text=f"UserCharacter folder: {folder} (cannot create)",
                        fg='#CC0000'
                    )
            else:
                self.user_char_label.config(
                    text=f"Files will be saved to: {folder}",
                    fg='#666666'
                )
        else:
            self.user_char_label.config(text="", fg='#666666')

    def browse_json_file(self):
        user_char_folder = self.get_user_character_folder()
        initial_dir = user_char_folder if user_char_folder and os.path.exists(user_char_folder) else None

        filename = filedialog.askopenfilename(
            title="Select JSON File",
            initialdir=initial_dir,
            filetypes=[("JSON Files", "*.json"), ("All Files", "*.*")]
        )
        if filename:
            self.json_file_var.set(filename)

    def browse_vrm_file(self):
        user_char_folder = self.get_user_character_folder()
        initial_dir = user_char_folder if user_char_folder and os.path.exists(user_char_folder) else None

        filename = filedialog.askopenfilename(
            title="Select VRM File (must be in UserCharacter folder)",
            initialdir=initial_dir,
            filetypes=[("VRM Files", "*.vrm"), ("All Files", "*.*")]
        )
        if filename:
            self.vrm_file_var.set(filename)

    def browse_output_folder(self):
        directory = filedialog.askdirectory(title="Select Output Folder")
        if directory:
            self.output_folder_var.set(directory)

    def open_output_folder(self):
        """Open output folder in Explorer"""
        folder = self.output_folder_var.get()
        if not folder:
            messagebox.showwarning("Warning", "Output Folder is not set")
            return
        folder = os.path.normpath(folder)
        if not os.path.exists(folder):
            messagebox.showwarning("Warning", f"Folder does not exist:\n{folder}")
            return
        os.startfile(folder)

    def generate_json(self):
        display_name = self.display_name_var.get().strip()
        if not display_name:
            messagebox.showerror("Error", "Display Name is required")
            return

        # Check if project file is selected
        if not self.project_file_var.get():
            messagebox.showerror("Error", "Select a Project File first")
            return

        gender = self.gender_var.get()

        scaling_method = self.scaling_method_var.get()
        model_source_type = self.model_source_type_var.get()

        # Create JSON data
        json_data = {
            "Gender": gender,
            "DisplayName": display_name,
            "ScalingMethod": scaling_method,
            "ModelSourceType": model_source_type
        }

        # Get UserCharacter folder
        user_char_folder = self.get_user_character_folder()
        if not user_char_folder:
            messagebox.showerror("Error", "Cannot determine UserCharacter folder")
            return

        # Create folder if it doesn't exist
        if not os.path.exists(user_char_folder):
            try:
                os.makedirs(user_char_folder, exist_ok=True)
            except Exception as e:
                messagebox.showerror("Error", f"Cannot create UserCharacter folder: {str(e)}")
                return

        # Auto-generate filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(user_char_folder, f"{display_name}_{timestamp}.json")

        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2)

            self.json_file_var.set(filename)
            self.log_output(f"JSON file saved: {filename}")
            messagebox.showinfo("Success", f"JSON file saved to UserCharacter folder!\n\n{filename}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save JSON: {str(e)}")

    def validate_paths(self):
        errors = []

        if not self.ue_dir_var.get():
            errors.append("UE_CINEV Directory is required")
        elif not os.path.exists(self.ue_dir_var.get()):
            errors.append("UE_CINEV Directory does not exist")
        else:
            exe_path = os.path.join(self.ue_dir_var.get(), "Engine", "Binaries", "Win64", "UnrealEditor-Cmd.exe")
            if not os.path.exists(exe_path):
                errors.append("UnrealEditor-Cmd.exe not found in UE directory")

        if not self.project_file_var.get():
            errors.append("Project File is required")
        elif not os.path.exists(self.project_file_var.get()):
            errors.append("Project File does not exist")

        if not self.json_file_var.get():
            errors.append("JSON File is required")
        elif not os.path.exists(self.json_file_var.get()):
            errors.append("JSON File does not exist")

        if not self.vrm_file_var.get():
            errors.append("VRM File is required")
        elif not os.path.exists(self.vrm_file_var.get()):
            errors.append("VRM File does not exist")

        if not self.output_folder_var.get():
            errors.append("Output Folder is required")

        return errors

    def move_files_to_user_character_folder(self):
        """Move JSON and VRM files to UserCharacter folder if not already there"""
        user_char_folder = self.get_user_character_folder()
        if not user_char_folder:
            return

        # Create folder if doesn't exist
        if not os.path.exists(user_char_folder):
            os.makedirs(user_char_folder, exist_ok=True)

        # Move JSON file if needed
        json_path = self.json_file_var.get()
        if json_path:
            json_dir = os.path.dirname(json_path)
            if os.path.normpath(json_dir) != os.path.normpath(user_char_folder):
                json_filename = os.path.basename(json_path)
                new_json_path = os.path.join(user_char_folder, json_filename)
                self.log_output(f"Moving JSON to UserCharacter folder: {json_filename}")
                shutil.move(json_path, new_json_path)
                self.json_file_var.set(new_json_path)

    # --- ZenServer check ---
    def is_zen_server_running(self, port=8558, timeout=1.0):
        """Check if ZenServer is running on localhost"""
        try:
            with socket.create_connection(("::1", port), timeout=timeout):
                return True
        except (ConnectionRefusedError, OSError, TimeoutError):
            pass
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=timeout):
                return True
        except (ConnectionRefusedError, OSError, TimeoutError):
            return False

    def warn_if_zen_not_running(self):
        """Block execution if ZenServer is not running. Returns True to proceed, False to cancel."""
        if self.is_zen_server_running():
            return True
        messagebox.showerror(
            "ZenServer Not Running",
            "ZenServer (port 8558) is not running.\n"
            "Start ZenServer first before running the commandlet."
        )
        return False

    # --- Source patching for commandlet ---
    COMMANDLET_SOURCE = r"E:\CINEVStudio\CINEVStudio\Source\Cinev\CLI\CinevCreateUserCharacterCommandlet.cpp"
    PATCH_ORIGINAL = "if (!InitializeWorldAndGameInstance())"
    PATCH_REPLACE = "if (!InitializeWorldAndGameInstance(FString(), false, false))"

    def patch_commandlet_source(self):
        """Patch InitializeWorldAndGameInstance before commandlet run"""
        try:
            with open(self.COMMANDLET_SOURCE, 'r', encoding='utf-8') as f:
                content = f.read()
            if self.PATCH_ORIGINAL in content:
                content = content.replace(self.PATCH_ORIGINAL, self.PATCH_REPLACE, 1)
                with open(self.COMMANDLET_SOURCE, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.log_output("[Patch] Applied: InitializeWorldAndGameInstance(FString(), false, false)")
                return True
            elif self.PATCH_REPLACE in content:
                self.log_output("[Patch] Already applied, skipping")
                return True
            else:
                self.log_output("[Patch] Warning: target string not found in source")
                return False
        except Exception as e:
            self.log_output(f"[Patch] Error: {str(e)}")
            return False

    def restore_commandlet_source(self):
        """Restore InitializeWorldAndGameInstance after commandlet run"""
        try:
            with open(self.COMMANDLET_SOURCE, 'r', encoding='utf-8') as f:
                content = f.read()
            if self.PATCH_REPLACE in content:
                content = content.replace(self.PATCH_REPLACE, self.PATCH_ORIGINAL, 1)
                with open(self.COMMANDLET_SOURCE, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.log_output("[Patch] Restored: InitializeWorldAndGameInstance()")
        except Exception as e:
            self.log_output(f"[Patch] Restore error: {str(e)}")

    def log_output(self, message):
        self.output_text.insert(tk.END, message + "\n")
        self.output_text.see(tk.END)
        self.output_text.update()

    def execute_command(self):
        # Validate
        errors = self.validate_paths()
        if errors:
            messagebox.showerror("Validation Error", "\n".join(errors))
            return

        if not self.warn_if_zen_not_running():
            return

        # Disable button
        self.execute_btn.config(state=tk.DISABLED, text="RUNNING...")
        self.output_text.delete(1.0, tk.END)

        # Move files to UserCharacter folder if needed
        try:
            self.move_files_to_user_character_folder()
        except Exception as e:
            self.log_output(f"Error moving files: {str(e)}")
            messagebox.showerror("Error", f"Failed to move files to UserCharacter folder:\n{str(e)}")
            self.execute_btn.config(state=tk.NORMAL, text="CREATE CHARACTER")
            return

        # Run in thread to prevent UI freeze
        thread = threading.Thread(target=self.run_command)
        thread.daemon = True
        thread.start()

    def run_command(self):
        try:
            # Patch source and rebuild
            self.patch_commandlet_source()

            build_bat = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Build", "BatchFiles", "Build.bat"))
            project_file = os.path.normpath(self.project_file_var.get())
            if os.path.exists(build_bat):
                self.log_output("=== Building with patched source ===")
                build_cmd = f'"{build_bat}" CINEVStudioEditor Win64 Development -Project="{project_file}" -WaitMutex'
                build_process = subprocess.Popen(build_cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
                build_process.wait()
                if build_process.returncode != 0:
                    self.log_output(f"Build failed with code {build_process.returncode}")
                    self.root.after(0, lambda: messagebox.showwarning("Build Failed", f"Build exited with code {build_process.returncode}"))
                    return
                self.log_output("Build succeeded\n")

            exe_path = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Binaries", "Win64", "UnrealEditor-Cmd.exe"))

            # Validate executable exists before attempting spawn
            if not os.path.exists(exe_path):
                raise FileNotFoundError(f"UnrealEditor-Cmd.exe not found at: {exe_path}")

            if not os.path.isfile(exe_path):
                raise ValueError(f"Path exists but is not a file: {exe_path}")

            # Validate all input paths and normalize them
            project_file = os.path.normpath(self.project_file_var.get())
            json_file = os.path.normpath(self.json_file_var.get())
            vrm_file = os.path.normpath(self.vrm_file_var.get())
            output_folder = os.path.normpath(self.output_folder_var.get())

            if not os.path.exists(project_file):
                raise FileNotFoundError(f"Project file not found: {project_file}")
            if not os.path.exists(json_file):
                raise FileNotFoundError(f"JSON file not found: {json_file}")
            if not os.path.exists(vrm_file):
                raise FileNotFoundError(f"VRM file not found: {vrm_file}")
            if not os.path.exists(output_folder):
                self.log_output(f"Creating output folder: {output_folder}")
                os.makedirs(output_folder, exist_ok=True)

            # Log diagnostic info
            self.log_output("=== Diagnostic Info ===")
            self.log_output(f"Executable: {exe_path}")
            self.log_output(f"Executable size: {os.path.getsize(exe_path)} bytes")
            self.log_output(f"Project: {project_file}")
            self.log_output(f"JSON: {json_file}")
            self.log_output(f"VRM: {vrm_file}")
            self.log_output(f"Output: {output_folder}\n")

            # Build command string
            inner_cmd = f'"{exe_path}" "{project_file}" -run=CinevCreateUserCharacter -UserCharacterJsonPath="{json_file}" -UserCharacterVrmPath="{vrm_file}" -OutputPath="{output_folder}" -stdout -nopause -unattended -AllowCommandletRendering -RenderOffScreen'

            self.log_output("=== Command String ===")
            self.log_output(inner_cmd)
            self.log_output("")

            # Execute with visible console window
            try:
                process = subprocess.Popen(
                    inner_cmd,
                    creationflags=subprocess.CREATE_NEW_CONSOLE
                )
            except FileNotFoundError as e:
                raise FileNotFoundError(f"Failed to start process - executable not found: {exe_path}\n{str(e)}")
            except PermissionError as e:
                raise PermissionError(f"Permission denied executing: {exe_path}\n{str(e)}")
            except OSError as e:
                raise OSError(f"Failed to start Unreal Editor process.\nExecutable: {exe_path}\nError: {str(e)}")

            self.log_output("=== Process Started (see console window) ===")

            # Wait for process to complete
            process.wait()

            self.log_output(f"\nProcess completed with code {process.returncode}")
            if process.returncode == 0:
                self.root.after(0, lambda: messagebox.showinfo("Success", "Character created successfully!"))
            else:
                self.root.after(0, lambda: messagebox.showwarning("Completed", f"Process exited with code {process.returncode}\nCheck console window for details."))

        except Exception as e:
            self.log_output(f"\nError: {str(e)}")
            self.root.after(0, lambda: messagebox.showerror("Error", f"Failed to execute: {str(e)}"))

        finally:
            self.restore_commandlet_source()
            self.root.after(0, lambda: self.execute_btn.config(state=tk.NORMAL, text="CREATE CHARACTER"))

    def build_editor(self):
        """Build the CINEVStudioEditor"""
        # Validate paths
        if not self.ue_dir_var.get():
            messagebox.showerror("Error", "UE_CINEV Directory is required")
            return
        if not self.project_file_var.get():
            messagebox.showerror("Error", "Project File is required")
            return

        # Check Build.bat exists
        build_bat = os.path.join(self.ue_dir_var.get(), "Engine", "Build", "BatchFiles", "Build.bat")
        if not os.path.exists(build_bat):
            messagebox.showerror("Error", f"Build.bat not found at:\n{build_bat}")
            return

        # Disable button
        self.build_btn.config(state=tk.DISABLED, text="BUILDING...")
        self.output_text.delete(1.0, tk.END)

        # Run in thread
        thread = threading.Thread(target=self.run_build)
        thread.daemon = True
        thread.start()

    def run_build(self):
        """Run the build command"""
        try:
            build_bat = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Build", "BatchFiles", "Build.bat"))
            project_file = os.path.normpath(self.project_file_var.get())

            # Build command
            inner_cmd = f'"{build_bat}" CINEVStudioEditor Win64 Development -Project="{project_file}" -WaitMutex'

            self.log_output("=== Build Command ===")
            self.log_output(inner_cmd)
            self.log_output("")

            # Execute with visible console window
            process = subprocess.Popen(
                inner_cmd,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )

            self.log_output("=== Build Started (see console window) ===")

            # Wait for process to complete
            process.wait()

            self.log_output(f"\nBuild completed with code {process.returncode}")
            if process.returncode == 0:
                self.root.after(0, lambda: messagebox.showinfo("Success", "Build completed successfully!"))
            else:
                self.root.after(0, lambda: messagebox.showwarning("Completed", f"Build exited with code {process.returncode}\nCheck console window for details."))

        except Exception as e:
            self.log_output(f"\nError: {str(e)}")
            self.root.after(0, lambda: messagebox.showerror("Error", f"Build failed: {str(e)}"))

        finally:
            self.root.after(0, lambda: self.build_btn.config(state=tk.NORMAL, text="BUILD EDITOR"))

    def update_command_display(self):
        """Update the command display with current values"""
        exe_path = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Binaries", "Win64", "UnrealEditor-Cmd.exe")) if self.ue_dir_var.get() else ""
        project_file = os.path.normpath(self.project_file_var.get()) if self.project_file_var.get() else ""
        json_file = os.path.normpath(self.json_file_var.get()) if self.json_file_var.get() else ""
        vrm_file = os.path.normpath(self.vrm_file_var.get()) if self.vrm_file_var.get() else ""
        output_folder = os.path.normpath(self.output_folder_var.get()) if self.output_folder_var.get() else ""

        cmd = f'"{exe_path}" "{project_file}" -run=CinevCreateUserCharacter -UserCharacterJsonPath="{json_file}" -UserCharacterVrmPath="{vrm_file}" -OutputPath="{output_folder}" -stdout -nopause -unattended -AllowCommandletRendering -RenderOffScreen'
        self.cmd_display_var.set(cmd)

    def copy_command(self):
        """Copy command to clipboard"""
        self.update_command_display()
        cmd = self.cmd_display_var.get()
        self.root.clipboard_clear()
        self.root.clipboard_append(cmd)
        self.log_output("Command copied to clipboard!")

    def start_zen_dashboard(self):
        """Start ZenDashboard"""
        if not self.ue_dir_var.get():
            messagebox.showerror("Error", "UE_CINEV Directory is required")
            return

        zen_exe = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Binaries", "Win64", "ZenDashboard.exe"))

        if not os.path.exists(zen_exe):
            messagebox.showerror("Error", f"ZenDashboard.exe not found at:\n{zen_exe}")
            return

        try:
            subprocess.Popen(zen_exe)
            self.log_output(f"Started ZenDashboard: {zen_exe}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to start ZenDashboard:\n{str(e)}")

    def build_and_create_character(self):
        """Build editor first, then create character"""
        # Validate build paths
        if not self.ue_dir_var.get():
            messagebox.showerror("Error", "UE_CINEV Directory is required")
            return
        if not self.project_file_var.get():
            messagebox.showerror("Error", "Project File is required")
            return

        # Check Build.bat exists
        build_bat = os.path.join(self.ue_dir_var.get(), "Engine", "Build", "BatchFiles", "Build.bat")
        if not os.path.exists(build_bat):
            messagebox.showerror("Error", f"Build.bat not found at:\n{build_bat}")
            return

        # Validate character creation paths before starting
        errors = self.validate_paths()
        if errors:
            messagebox.showerror("Validation Error", "Character creation will fail:\n" + "\n".join(errors))
            return

        if not self.warn_if_zen_not_running():
            return

        # Disable buttons
        self.build_and_create_btn.config(state=tk.DISABLED, text="BUILDING...")
        self.execute_btn.config(state=tk.DISABLED)
        self.build_btn.config(state=tk.DISABLED)
        self.output_text.delete(1.0, tk.END)

        # Run in thread
        thread = threading.Thread(target=self.run_build_and_create)
        thread.daemon = True
        thread.start()

    def run_build_and_create(self):
        """Run build then create character"""
        try:
            # Patch source before build
            self.patch_commandlet_source()

            build_bat = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Build", "BatchFiles", "Build.bat"))
            project_file = os.path.normpath(self.project_file_var.get())

            # Build command
            inner_cmd = f'"{build_bat}" CINEVStudioEditor Win64 Development -Project="{project_file}" -WaitMutex'

            self.log_output("=== BUILD PHASE ===")
            self.log_output(inner_cmd)
            self.log_output("")

            # Execute build with visible console window
            process = subprocess.Popen(
                inner_cmd,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )

            self.log_output("=== Build Started (see console window) ===")
            self.root.after(0, lambda: self.build_and_create_btn.config(text="BUILDING..."))

            # Wait for build to complete
            process.wait()

            self.log_output(f"\n Build completed with code {process.returncode}")

            if process.returncode != 0:
                self.root.after(0, lambda: messagebox.showwarning("Build Failed", f"Build exited with code {process.returncode}\nCharacter creation skipped."))
                return

            # Build succeeded, now create character
            self.log_output("\n=== CHARACTER CREATION PHASE ===")
            self.root.after(0, lambda: self.build_and_create_btn.config(text="CREATING..."))

            # Move files to UserCharacter folder if needed
            try:
                self.move_files_to_user_character_folder()
            except Exception as e:
                self.log_output(f"Error moving files: {str(e)}")
                self.root.after(0, lambda: messagebox.showerror("Error", f"Failed to move files:\n{str(e)}"))
                return

            # Run character creation
            exe_path = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Binaries", "Win64", "UnrealEditor-Cmd.exe"))
            json_file = os.path.normpath(self.json_file_var.get())
            vrm_file = os.path.normpath(self.vrm_file_var.get())
            output_folder = os.path.normpath(self.output_folder_var.get())

            if not os.path.exists(output_folder):
                os.makedirs(output_folder, exist_ok=True)

            create_cmd = f'"{exe_path}" "{project_file}" -run=CinevCreateUserCharacter -UserCharacterJsonPath="{json_file}" -UserCharacterVrmPath="{vrm_file}" -OutputPath="{output_folder}" -stdout -nopause -unattended -AllowCommandletRendering -RenderOffScreen'

            self.log_output(create_cmd)
            self.log_output("")

            create_process = subprocess.Popen(
                create_cmd,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )

            self.log_output("=== Character Creation Started (see console window) ===")

            create_process.wait()

            self.log_output(f"\n Character creation completed with code {create_process.returncode}")

            if create_process.returncode == 0:
                self.root.after(0, lambda: messagebox.showinfo("Success", "Build & Character creation completed successfully!"))
            else:
                self.root.after(0, lambda: messagebox.showwarning("Completed", f"Character creation exited with code {create_process.returncode}"))

        except Exception as e:
            self.log_output(f"\n Error: {str(e)}")
            self.root.after(0, lambda: messagebox.showerror("Error", f"Failed: {str(e)}"))

        finally:
            self.restore_commandlet_source()
            self.root.after(0, lambda: self.build_and_create_btn.config(state=tk.NORMAL, text="Build & Create"))
            self.root.after(0, lambda: self.execute_btn.config(state=tk.NORMAL))
            self.root.after(0, lambda: self.build_btn.config(state=tk.NORMAL))


if __name__ == "__main__":
    root = tk.Tk()
    app = CharacterCreatorGUI(root)
    root.mainloop()
