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
        self.root.title("유저 캐릭터 로컬 관리")
        self.root.geometry("1600x900")
        self.root.minsize(1024, 600)
        self.root.configure(bg='white')

        # Config file path
        self.config_file = os.path.join(os.path.dirname(__file__), "character_creator_config.json")

        # Variables
        self.gender_var = tk.StringVar(value="Female")
        self.ue_dir_var = tk.StringVar()
        self.project_file_var = tk.StringVar()
        self.output_folder_var = tk.StringVar()

        # Settings panel toggle state
        self.settings_visible = False

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

        # Title bar with Settings and Zen Dashboard
        title_bar = tk.Frame(main_frame, bg='white')
        title_bar.pack(fill=tk.X, pady=(0, 10))

        title = tk.Label(title_bar, text="유저 캐릭터 로컬 관리",
                        font=('Arial', 18, 'bold'), bg='white', fg='black')
        title.pack(side=tk.LEFT)

        self.settings_btn = tk.Button(title_bar, text="설정",
                 command=self.toggle_settings, bg='white', fg='black',
                 relief=tk.SOLID, borderwidth=1, padx=10, cursor='hand2',
                 font=('Arial', 9))
        self.settings_btn.pack(side=tk.RIGHT)

        self.zen_btn = tk.Button(title_bar, text="Zen 대시보드",
                                 command=self.start_zen_dashboard, bg='#666666',
                                 fg='white', relief=tk.FLAT,
                                 font=('Arial', 9, 'bold'),
                                 padx=10, pady=2, cursor='hand2')
        self.zen_btn.pack(side=tk.RIGHT, padx=(0, 5))

        # UserCharacter folder summary label
        self.user_char_summary_label = tk.Label(title_bar, text="",
                                                 bg='white', fg='#666666',
                                                 font=('Arial', 8), anchor='e')
        self.user_char_summary_label.pack(side=tk.RIGHT, padx=(0, 10))

        # 2-column layout
        columns_frame = tk.Frame(main_frame, bg='white')
        columns_frame.pack(fill=tk.BOTH, expand=True)
        columns_frame.columnconfigure(0, weight=1)
        columns_frame.columnconfigure(1, weight=1)
        columns_frame.rowconfigure(0, weight=1)

        # === LEFT PANE: character creation ===
        left_pane = tk.Frame(columns_frame, bg='white', padx=10)
        left_pane.grid(row=0, column=0, sticky='nsew')

        # Paths Section (collapsible)
        self.paths_frame = tk.LabelFrame(left_pane, text="경로 설정",
                                    font=('Arial', 10, 'bold'), bg='white',
                                    fg='black', padx=10, pady=10)
        # Hidden by default - don't pack

        self.create_path_input(self.paths_frame, "UE_CINEV 경로:",
                              self.ue_dir_var, self.browse_ue_directory)
        self.create_path_input(self.paths_frame, "프로젝트 파일:",
                              self.project_file_var, self.browse_project_file)
        # Output Folder with Open button
        output_folder_frame = tk.Frame(self.paths_frame, bg='white')
        output_folder_frame.pack(fill=tk.X, pady=5)
        tk.Label(output_folder_frame, text="출력 폴더:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        tk.Entry(output_folder_frame, textvariable=self.output_folder_var, bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        tk.Button(output_folder_frame, text="찾아보기", command=self.browse_output_folder,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)
        tk.Button(output_folder_frame, text="폴더 열기", command=self.open_output_folder,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT, padx=(5, 0))

        # UserCharacter folder info label (inside settings panel)
        self.user_char_label = tk.Label(self.paths_frame, text="",
                                        bg='#f0f0f0', fg='#666666',
                                        font=('Arial', 8), anchor='w',
                                        relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.user_char_label.pack(fill=tk.X, pady=(5, 0))

        # --- Bulk Registration ---
        self.reg_frame = reg_frame = tk.LabelFrame(left_pane, text="일괄 등록",
                                   font=('Arial', 10, 'bold'), bg='white',
                                   fg='black', padx=10, pady=10)
        reg_frame.pack(fill=tk.X, pady=(0, 10))

        # VRM file selection
        pick_frame = tk.Frame(reg_frame, bg='white')
        pick_frame.pack(fill=tk.X, pady=(0, 5))
        tk.Button(pick_frame, text="VRM 파일 선택",
                 command=self.pick_vrm_files, bg='white', fg='black',
                 relief=tk.SOLID, borderwidth=1, padx=10, cursor='hand2',
                 font=('Arial', 9)).pack(side=tk.LEFT)
        self.vrm_count_label = tk.Label(pick_frame, text="선택된 파일 없음",
                                         bg='white', fg='#999999', font=('Arial', 9))
        self.vrm_count_label.pack(side=tk.LEFT, padx=(10, 0))

        # Selected files list
        self.vrm_listbox = tk.Listbox(reg_frame, height=5, bg='white', fg='black',
                                       relief=tk.SOLID, borderwidth=1,
                                       font=('Consolas', 9), selectmode=tk.EXTENDED)
        self.vrm_listbox.pack(fill=tk.X, pady=(0, 5))

        # Gender
        gender_frame = tk.Frame(reg_frame, bg='white')
        gender_frame.pack(fill=tk.X, pady=3)
        tk.Label(gender_frame, text="성별:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        ttk.Combobox(gender_frame, textvariable=self.gender_var,
                     values=["Female", "Male"], state='readonly', width=30).pack(side=tk.LEFT, padx=5)

        # Scaling Method
        scaling_frame = tk.Frame(reg_frame, bg='white')
        scaling_frame.pack(fill=tk.X, pady=3)
        tk.Label(scaling_frame, text="스케일링:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        self.scaling_method_var = tk.StringVar(value="Original")
        ttk.Combobox(scaling_frame, textvariable=self.scaling_method_var,
                     values=["Original", "CineV"], state='readonly', width=30).pack(side=tk.LEFT, padx=5)

        # Model Source
        source_frame = tk.Frame(reg_frame, bg='white')
        source_frame.pack(fill=tk.X, pady=3)
        tk.Label(source_frame, text="모델 소스:", width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        self.model_source_var = tk.StringVar(value="VRM")
        ttk.Combobox(source_frame, textvariable=self.model_source_var,
                     values=["None", "VRM", "VRoid", "Zepeto"], state='readonly', width=30).pack(side=tk.LEFT, padx=5)

        # Register button
        self.bulk_btn = tk.Button(reg_frame, text="assets.info에 등록",
                 command=self.bulk_register, bg='#0066CC',
                 fg='white', relief=tk.FLAT,
                 font=('Arial', 11, 'bold'),
                 padx=30, pady=10, cursor='hand2')
        self.bulk_btn.pack(pady=(8, 5))

        # Output Console
        output_frame = tk.LabelFrame(left_pane, text="출력",
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
        ToolTip(self.bulk_btn, "VRM 파일 여러 개 선택하여 assets.info에 일괄 등록")
        ToolTip(self.zen_btn, "Zen Dashboard를 열어 서버 상태 확인")
        ToolTip(self.assets_apply_btn, "선택한 항목에 수정사항 저장")
        ToolTip(self.assets_delete_btn, "선택한 항목을 assets.info에서 삭제")

    def toggle_settings(self):
        """Toggle the settings/paths panel visibility"""
        if self.settings_visible:
            self.paths_frame.pack_forget()
            self.settings_visible = False
            self.settings_btn.config(text="설정")
        else:
            # Pack before register frame (first packed child of right_pane)
            self.paths_frame.pack(fill=tk.X, pady=(0, 10),
                                  before=self.reg_frame)
            self.settings_visible = True
            self.settings_btn.config(text="설정 (닫기)")

    def pick_vrm_files(self):
        """Select multiple VRM files and show them in the list"""
        user_char_folder = self.get_user_character_folder()
        initial_dir = user_char_folder if user_char_folder and os.path.exists(user_char_folder) else None

        filenames = filedialog.askopenfilenames(
            title="VRM 파일 선택 (여러 개 가능)",
            initialdir=initial_dir,
            filetypes=[("VRM Files", "*.vrm"), ("All Files", "*.*")]
        )
        if not filenames:
            return

        self.pending_vrm_files = [os.path.normpath(f) for f in filenames]
        self.vrm_listbox.delete(0, tk.END)
        for f in self.pending_vrm_files:
            stem = os.path.splitext(os.path.basename(f))[0]
            self.vrm_listbox.insert(tk.END, f"{stem[:12]}  ←  {os.path.basename(f)}")
        self.vrm_count_label.config(text=f"{len(self.pending_vrm_files)}개 선택됨", fg='black')

    def bulk_register(self):
        """Register selected VRM files to assets.info"""
        if not hasattr(self, 'pending_vrm_files') or not self.pending_vrm_files:
            messagebox.showwarning("경고", "먼저 VRM 파일을 선택하세요.")
            return

        self.output_text.delete(1.0, tk.END)
        added = 0

        for vrm_path in self.pending_vrm_files:
            stem = os.path.splitext(os.path.basename(vrm_path))[0]
            display_name = stem[:12]

            new_entry = {
                "Preset_id": str(uuid.uuid4()),
                "CharacterFilePath": f"{display_name}.character",
                "CategoryName": "CharacterCategory.VRM"
            }
            self.assets_data.append(new_entry)
            added += 1
            self.log_output(f"등록: {display_name} ({os.path.basename(vrm_path)})")

        self.assets_refresh_tree()
        self.assets_auto_save()
        self.log_output(f"\n총 {added}개 등록 완료")

        # Clear selection
        self.pending_vrm_files = []
        self.vrm_listbox.delete(0, tk.END)
        self.vrm_count_label.config(text="선택된 파일 없음", fg='#999999')

        messagebox.showinfo("완료", f"{added}개 캐릭터가 assets.info에 등록되었습니다.")

    def create_assets_editor(self, parent):
        """Create the assets.info editor panel"""
        editor_frame = tk.LabelFrame(parent, text="assets.info 편집기",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        editor_frame.pack(fill=tk.BOTH, expand=True)

        # Treeview for entries (3 columns)
        tree_frame = tk.Frame(editor_frame, bg='white')
        tree_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        columns = ('preset_id', 'character_file', 'category')
        self.assets_tree = ttk.Treeview(tree_frame, columns=columns, show='headings', height=15,
                                        selectmode='extended')

        self.assets_tree.heading('preset_id', text='프리셋 ID')
        self.assets_tree.heading('character_file', text='캐릭터 파일')
        self.assets_tree.heading('category', text='카테고리')

        self.assets_tree.column('preset_id', width=100, minwidth=80)
        self.assets_tree.column('character_file', width=220, minwidth=150)
        self.assets_tree.column('category', width=150, minwidth=100)

        scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.assets_tree.yview)
        self.assets_tree.configure(yscrollcommand=scrollbar.set)

        self.assets_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.assets_tree.bind('<<TreeviewSelect>>', self.assets_on_select)

        self.selected_asset_idx = None

        # Count + Move + Refresh (between tree and edit form)
        count_frame = tk.Frame(editor_frame, bg='white')
        count_frame.pack(fill=tk.X, pady=(0, 5))
        self.assets_count_label = tk.Label(count_frame, text="", bg='white', fg='#666666',
                                           font=('Arial', 9))
        self.assets_count_label.pack(side=tk.LEFT)
        tk.Button(count_frame, text="새로고침", command=self.assets_load,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=8, cursor='hand2', font=('Arial', 8)).pack(side=tk.RIGHT)
        self.move_down_btn = tk.Button(count_frame, text="▼", command=self.assets_move_down,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=6, cursor='hand2', font=('Arial', 9), state=tk.DISABLED)
        self.move_down_btn.pack(side=tk.RIGHT, padx=(0, 3))
        self.move_up_btn = tk.Button(count_frame, text="▲", command=self.assets_move_up,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=6, cursor='hand2', font=('Arial', 9), state=tk.DISABLED)
        self.move_up_btn.pack(side=tk.RIGHT, padx=(0, 3))

        # --- Edit form ---
        form_frame = tk.LabelFrame(editor_frame, text="항목 편집",
                                   font=('Arial', 9, 'bold'), bg='white',
                                   fg='black', padx=10, pady=10)
        form_frame.pack(fill=tk.X)

        # assets.info fields
        self.asset_preset_id_var = tk.StringVar()
        self.asset_char_file_var = tk.StringVar()
        self.asset_category_var = tk.StringVar()

        fields = [
            ("프리셋 ID:", self.asset_preset_id_var, None),
            ("캐릭터 파일:", self.asset_char_file_var, None),
            ("카테고리:", self.asset_category_var, ["CharacterCategory.VRM"]),
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

        # .character metadata fields (read from binary)
        sep = ttk.Separator(form_frame, orient=tk.HORIZONTAL)
        sep.pack(fill=tk.X, pady=(8, 4))

        self.asset_meta_display_name_var = tk.StringVar()
        self.asset_meta_scaling_var = tk.StringVar()
        self.asset_meta_source_var = tk.StringVar()

        # DisplayName (text entry)
        dn_row = tk.Frame(form_frame, bg='white')
        dn_row.pack(fill=tk.X, pady=2)
        tk.Label(dn_row, text="표시 이름:", width=16, anchor='w',
                bg='white', fg='black', font=('Arial', 9)).pack(side=tk.LEFT)
        tk.Entry(dn_row, textvariable=self.asset_meta_display_name_var, bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        meta_fields = [
            ("스케일링:", self.asset_meta_scaling_var, ["Original", "CineV"]),
            ("모델 소스:", self.asset_meta_source_var, ["None", "VRM", "VRoid", "Zepeto"]),
        ]

        for label_text, var, combo_values in meta_fields:
            row = tk.Frame(form_frame, bg='white')
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label_text, width=16, anchor='w',
                    bg='white', fg='black', font=('Arial', 9)).pack(side=tk.LEFT)
            ttk.Combobox(row, textvariable=var, values=combo_values,
                        width=40).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        # Buttons row
        btn_row = tk.Frame(form_frame, bg='white')
        btn_row.pack(pady=(10, 5))
        self.assets_apply_btn = tk.Button(btn_row, text="변경사항 적용", command=self.assets_apply_changes,
                 bg='#0066CC', fg='white', relief=tk.FLAT,
                 padx=20, pady=5, font=('Arial', 9, 'bold'),
                 cursor='hand2', state=tk.DISABLED)
        self.assets_apply_btn.pack(side=tk.LEFT, padx=5)
        self.assets_delete_btn = tk.Button(btn_row, text="항목 삭제", command=self.assets_delete_entry,
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
            self.log_output(f"Loaded assets.info: {len(self.assets_data)} 개")
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
            self.assets_count_label.config(text="저장됨", fg='#00AA00')
            self.root.after(2000, lambda: self.assets_count_label.config(
                text=f"{len(self.assets_data)} 개", fg='#666666'))
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
            self.log_output(f"Saved assets.info: {len(self.assets_data)} 개")
            messagebox.showinfo("Success", f"assets.info saved!\n{path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save assets.info:\n{str(e)}")

    def assets_refresh_tree(self):
        """Refresh the treeview with current data"""
        self.assets_tree.delete(*self.assets_tree.get_children())
        for i, entry in enumerate(self.assets_data):
            preset_id = entry.get('Preset_id', '')
            short_id = preset_id[:8] + '...' if len(preset_id) > 12 else preset_id
            self.assets_tree.insert('', tk.END, iid=str(i), values=(
                short_id,
                entry.get('CharacterFilePath', ''),
                entry.get('CategoryName', ''),
            ))
        self.assets_count_label.config(text=f"{len(self.assets_data)} 개")

        # Empty state guidance
        if not self.assets_data:
            self.assets_tree.insert('', tk.END, iid='empty_placeholder', values=(
                '', '항목 없음', ''
            ))
            self.assets_apply_btn.config(state=tk.DISABLED)
            self.assets_delete_btn.config(state=tk.DISABLED)
            self.move_up_btn.config(state=tk.DISABLED)
            self.move_down_btn.config(state=tk.DISABLED)

    @staticmethod
    def read_character_metadata(char_path):
        """Read metadata JSON embedded in a .character file (after binary header)"""
        with open(char_path, 'rb') as f:
            data = f.read()
        idx = data.find(b'{')
        if idx < 0:
            return None
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

    @staticmethod
    def write_character_metadata(char_path, updates):
        """Update metadata JSON embedded in a .character file"""
        with open(char_path, 'rb') as f:
            data = f.read()
        idx = data.find(b'{')
        if idx < 0:
            return False
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
        meta = json.loads(json_str)
        meta.update(updates)
        new_json = json.dumps(meta, indent=2, ensure_ascii=False).encode('utf-8')
        with open(char_path, 'wb') as f:
            f.write(data[:idx] + new_json + data[end:])
        return True

    def _get_character_file_path(self, char_filename):
        """Resolve full path for a .character file in UserCharacter folder"""
        user_char_folder = self.get_user_character_folder()
        if not user_char_folder or not char_filename:
            return None
        full_path = os.path.join(user_char_folder, char_filename)
        return full_path if os.path.exists(full_path) else None

    def _get_selected_indices(self):
        """Get sorted list of selected indices from treeview"""
        selection = self.assets_tree.selection()
        if not selection:
            return []
        return sorted(int(s) for s in selection if s != 'empty_placeholder')

    def assets_on_select(self, event):
        """Handle treeview selection - populate edit form + .character metadata"""
        indices = self._get_selected_indices()
        if not indices:
            return

        # Use last selected for edit form
        idx = indices[-1]
        self.selected_asset_idx = idx
        entry = self.assets_data[idx]

        self.asset_preset_id_var.set(entry.get('Preset_id', ''))
        self.asset_char_file_var.set(entry.get('CharacterFilePath', ''))
        self.asset_category_var.set(entry.get('CategoryName', ''))

        # Read .character metadata
        self.asset_meta_display_name_var.set('')
        self.asset_meta_scaling_var.set('')
        self.asset_meta_source_var.set('')
        char_path = self._get_character_file_path(entry.get('CharacterFilePath', ''))
        if char_path:
            try:
                meta = self.read_character_metadata(char_path)
                if meta:
                    self.asset_meta_display_name_var.set(meta.get('displayName', meta.get('DisplayName', '')))
                    self.asset_meta_scaling_var.set(meta.get('scalingMethod', meta.get('ScalingMethod', '')))
                    self.asset_meta_source_var.set(meta.get('modelSourceType', meta.get('ModelSourceType', '')))
            except Exception as e:
                self.log_output(f"Failed to read .character metadata: {str(e)}")

        # Enable buttons
        self.assets_apply_btn.config(state=tk.NORMAL if len(indices) == 1 else tk.DISABLED)
        self.assets_delete_btn.config(state=tk.NORMAL)
        min_idx, max_idx = indices[0], indices[-1]
        self.move_up_btn.config(state=tk.NORMAL if min_idx > 0 else tk.DISABLED)
        self.move_down_btn.config(state=tk.NORMAL if max_idx < len(self.assets_data) - 1 else tk.DISABLED)

    def assets_apply_changes(self):
        """Apply edit form changes to selected entry + write .character metadata"""
        if self.selected_asset_idx is None:
            messagebox.showwarning("Warning", "Select an entry first")
            return
        idx = self.selected_asset_idx

        self.assets_data[idx]['Preset_id'] = self.asset_preset_id_var.get()
        self.assets_data[idx]['CharacterFilePath'] = self.asset_char_file_var.get()
        self.assets_data[idx]['CategoryName'] = self.asset_category_var.get()

        # Write .character metadata if file exists
        char_path = self._get_character_file_path(self.asset_char_file_var.get())
        if char_path:
            display_name = self.asset_meta_display_name_var.get()
            scaling = self.asset_meta_scaling_var.get()
            source = self.asset_meta_source_var.get()
            if display_name or scaling or source:
                try:
                    updates = {}
                    if display_name:
                        updates['displayName'] = display_name
                    if scaling:
                        updates['scalingMethod'] = scaling
                    if source:
                        updates['modelSourceType'] = source
                    self.write_character_metadata(char_path, updates)
                    self.log_output(f"Updated .character metadata: {os.path.basename(char_path)}")
                except Exception as e:
                    self.log_output(f"Failed to write .character metadata: {str(e)}")

        self.assets_refresh_tree()
        self.assets_tree.selection_set(str(idx))
        self.assets_tree.see(str(idx))
        self.assets_auto_save()

    def assets_move_up(self):
        """Move selected entries up by one"""
        indices = self._get_selected_indices()
        if not indices or indices[0] <= 0:
            return
        for idx in indices:
            self.assets_data[idx], self.assets_data[idx - 1] = self.assets_data[idx - 1], self.assets_data[idx]
        new_indices = [i - 1 for i in indices]
        self.assets_refresh_tree()
        for i in new_indices:
            self.assets_tree.selection_add(str(i))
        self.assets_tree.see(str(new_indices[0]))
        self.selected_asset_idx = new_indices[-1]
        self.assets_auto_save()

    def assets_move_down(self):
        """Move selected entries down by one"""
        indices = self._get_selected_indices()
        if not indices or indices[-1] >= len(self.assets_data) - 1:
            return
        for idx in reversed(indices):
            self.assets_data[idx], self.assets_data[idx + 1] = self.assets_data[idx + 1], self.assets_data[idx]
        new_indices = [i + 1 for i in indices]
        self.assets_refresh_tree()
        for i in new_indices:
            self.assets_tree.selection_add(str(i))
        self.assets_tree.see(str(new_indices[-1]))
        self.selected_asset_idx = new_indices[-1]
        self.assets_auto_save()

    def assets_add_entry(self):
        """Add a new entry to assets data"""
        new_entry = {
            "Preset_id": str(uuid.uuid4()),
            "CharacterFilePath": "",
            "CategoryName": "CharacterCategory.VRM"
        }
        self.assets_data.append(new_entry)
        self.assets_refresh_tree()
        # Select the new entry
        new_idx = str(len(self.assets_data) - 1)
        self.assets_tree.selection_set(new_idx)
        self.assets_tree.see(new_idx)
        self.assets_on_select(None)

    def assets_delete_entry(self):
        """Delete all selected entries"""
        indices = self._get_selected_indices()
        if not indices:
            messagebox.showwarning("경고", "항목을 선택하세요.")
            return

        count = len(indices)
        if count == 1:
            name = self.assets_data[indices[0]].get('CharacterFilePath', '')
            msg = f"삭제하시겠습니까?\n{name}"
        else:
            msg = f"{count}개 항목을 삭제하시겠습니까?"

        if messagebox.askyesno("삭제 확인", msg):
            for idx in reversed(indices):
                self.assets_data.pop(idx)
            self.selected_asset_idx = None
            self.assets_refresh_tree()
            self.assets_auto_save()
            self.assets_apply_btn.config(state=tk.DISABLED)
            self.assets_delete_btn.config(state=tk.DISABLED)
            self.move_up_btn.config(state=tk.DISABLED)
            self.move_down_btn.config(state=tk.DISABLED)

    # --- existing methods below (unchanged) ---

    def create_path_input(self, parent, label_text, var, browse_command):
        frame = tk.Frame(parent, bg='white')
        frame.pack(fill=tk.X, pady=5)

        tk.Label(frame, text=label_text, width=16, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)

        entry = tk.Entry(frame, textvariable=var, bg='white', fg='black',
                       relief=tk.SOLID, borderwidth=1)
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

        tk.Button(frame, text="찾아보기", command=browse_command,
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
            # Update summary label
            self.user_char_summary_label.config(text=f"UserCharacter: {folder}")
        else:
            self.user_char_label.config(text="", fg='#666666')
            self.user_char_summary_label.config(text="")

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

        # Check if output folder is set
        if not self.output_folder_var.get():
            messagebox.showerror("Error", "Set Output Folder first")
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

        # Use output folder
        output_folder = os.path.normpath(self.output_folder_var.get())

        # Create folder if it doesn't exist
        if not os.path.exists(output_folder):
            try:
                os.makedirs(output_folder, exist_ok=True)
            except Exception as e:
                messagebox.showerror("Error", f"Cannot create output folder: {str(e)}")
                return

        # Auto-generate filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(output_folder, f"{display_name}_{timestamp}.json")

        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2)

            self.json_file_var.set(filename)
            self.log_output(f"JSON file saved: {filename}")
            messagebox.showinfo("Success", f"JSON file saved!\n\n{filename}")
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

    def update_command_display(self):
        """Update the command display with current values"""
        exe_path = os.path.normpath(os.path.join(self.ue_dir_var.get(), "Engine", "Binaries", "Win64", "UnrealEditor-Cmd.exe")) if self.ue_dir_var.get() else ""
        project_file = os.path.normpath(self.project_file_var.get()) if self.project_file_var.get() else ""
        json_file = os.path.normpath(self.json_file_var.get()) if self.json_file_var.get() else ""
        vrm_file = os.path.normpath(self.vrm_file_var.get()) if self.vrm_file_var.get() else ""
        output_folder = os.path.normpath(self.output_folder_var.get()) if self.output_folder_var.get() else ""

        cmd = f'"{exe_path}" "{project_file}" -run=CinevCreateUserCharacter -UserCharacterJsonPath="{json_file}" -UserCharacterVrmPath="{vrm_file}" -OutputPath="{output_folder}" -stdout -nopause -unattended -AllowCommandletRendering -RenderOffScreen'
        return cmd

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


if __name__ == "__main__":
    root = tk.Tk()
    app = CharacterCreatorGUI(root)
    root.mainloop()
