import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import json
import os
import socket
import subprocess
import threading
import shutil

class CharacterCreatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CINEV Character Creator")
        self.root.geometry("900x700")
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

        self.create_widgets()

        # Load saved configuration (after widgets are created)
        self.load_config()

        # Add trace to auto-save when config changes
        self.ue_dir_var.trace_add('write', lambda *args: self.save_config())
        self.project_file_var.trace_add('write', lambda *args: self.save_config())
        self.output_folder_var.trace_add('write', lambda *args: self.save_config())

    def create_widgets(self):
        # Main container
        main_frame = tk.Frame(self.root, bg='white', padx=20, pady=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(main_frame, text="CINEV Character Creator",
                        font=('Arial', 18, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 20))

        # Paths Section (moved to first)
        paths_frame = tk.LabelFrame(main_frame, text="1. Configure Paths",
                                    font=('Arial', 10, 'bold'), bg='white',
                                    fg='black', padx=10, pady=10)
        paths_frame.pack(fill=tk.X, pady=(0, 10))

        # UE Directory
        self.create_path_input(paths_frame, "UE_CINEV Directory:",
                              self.ue_dir_var, self.browse_ue_directory)

        # Project File
        self.create_path_input(paths_frame, "Project File (.uproject):",
                              self.project_file_var, self.browse_project_file)

        # Output Folder
        self.create_path_input(paths_frame, "Output Folder:",
                              self.output_folder_var, self.browse_output_folder)

        # UserCharacter folder info label (moved before char_frame)
        self.user_char_label = tk.Label(main_frame, text="",
                                        bg='#f0f0f0', fg='#666666',
                                        font=('Arial', 8), anchor='w',
                                        relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.user_char_label.pack(fill=tk.X, pady=(0, 10))

        # Character Files Section
        char_frame = tk.LabelFrame(main_frame, text="2. Character Files",
                                   font=('Arial', 10, 'bold'), bg='white',
                                   fg='black', padx=10, pady=10)
        char_frame.pack(fill=tk.X, pady=(0, 10))

        # Gender
        gender_frame = tk.Frame(char_frame, bg='white')
        gender_frame.pack(fill=tk.X, pady=5)
        tk.Label(gender_frame, text="Gender:", width=15, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        gender_combo = ttk.Combobox(gender_frame, textvariable=self.gender_var,
                                   values=["Female", "Male"], state='readonly', width=30)
        gender_combo.pack(side=tk.LEFT, padx=5)

        # Scaling Method
        scaling_frame = tk.Frame(char_frame, bg='white')
        scaling_frame.pack(fill=tk.X, pady=5)
        tk.Label(scaling_frame, text="Scaling Method:", width=15, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        scaling_combo = ttk.Combobox(scaling_frame, textvariable=self.scaling_method_var,
                                    values=["Original", "CineV"], state='readonly', width=30)
        scaling_combo.pack(side=tk.LEFT, padx=5)

        # Model Source Type
        source_frame = tk.Frame(char_frame, bg='white')
        source_frame.pack(fill=tk.X, pady=5)
        tk.Label(source_frame, text="Model Source:", width=15, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)
        source_combo = ttk.Combobox(source_frame, textvariable=self.model_source_type_var,
                                    values=["None", "VRM", "VRoid", "Zepeto"], state='readonly', width=30)
        source_combo.pack(side=tk.LEFT, padx=5)

        # Display Name
        name_frame = tk.Frame(char_frame, bg='white')
        name_frame.pack(fill=tk.X, pady=5)
        tk.Label(name_frame, text="Display Name:", width=15, anchor='w',
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
        execute_frame = tk.LabelFrame(main_frame, text="3. Execute",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        execute_frame.pack(fill=tk.X, pady=(0, 10))

        # JSON File
        self.create_path_input(execute_frame, "JSON File:",
                              self.json_file_var, self.browse_json_file)

        # VRM File
        self.create_path_input(execute_frame, "VRM File:",
                              self.vrm_file_var, self.browse_vrm_file)

        # Command display area
        cmd_display_frame = tk.Frame(execute_frame, bg='white')
        cmd_display_frame.pack(fill=tk.X, pady=(10, 5))

        tk.Label(cmd_display_frame, text="Command:", width=20, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)

        self.cmd_display_var = tk.StringVar()
        cmd_entry = tk.Entry(cmd_display_frame, textvariable=self.cmd_display_var,
                            bg='#f5f5f5', fg='black', relief=tk.SOLID,
                            borderwidth=1, state='readonly')
        cmd_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

        tk.Button(cmd_display_frame, text="Copy", command=self.copy_command,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)

        tk.Button(cmd_display_frame, text="Update", command=self.update_command_display,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT, padx=(5, 0))

        # Buttons frame
        buttons_frame = tk.Frame(execute_frame, bg='white')
        buttons_frame.pack(pady=10)

        self.execute_btn = tk.Button(buttons_frame, text="CREATE CHARACTER",
                                     command=self.execute_command, bg='black',
                                     fg='white', relief=tk.FLAT,
                                     font=('Arial', 12, 'bold'),
                                     padx=30, pady=15, cursor='hand2')
        self.execute_btn.pack(side=tk.LEFT, padx=5)

        self.build_btn = tk.Button(buttons_frame, text="BUILD EDITOR",
                                   command=self.build_editor, bg='#444444',
                                   fg='white', relief=tk.FLAT,
                                   font=('Arial', 12, 'bold'),
                                   padx=30, pady=15, cursor='hand2')
        self.build_btn.pack(side=tk.LEFT, padx=5)

        self.zen_btn = tk.Button(buttons_frame, text="ZEN DASHBOARD",
                                 command=self.start_zen_dashboard, bg='#666666',
                                 fg='white', relief=tk.FLAT,
                                 font=('Arial', 12, 'bold'),
                                 padx=30, pady=15, cursor='hand2')
        self.zen_btn.pack(side=tk.LEFT, padx=5)

        self.build_and_create_btn = tk.Button(buttons_frame, text="BUILD & CREATE",
                                              command=self.build_and_create_character, bg='#0066CC',
                                              fg='white', relief=tk.FLAT,
                                              font=('Arial', 12, 'bold'),
                                              padx=30, pady=15, cursor='hand2')
        self.build_and_create_btn.pack(side=tk.LEFT, padx=5)

        # Output Console
        output_frame = tk.LabelFrame(main_frame, text="Output",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        output_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 0))

        self.output_text = scrolledtext.ScrolledText(output_frame, height=12,
                                                     bg='white', fg='black',
                                                     relief=tk.SOLID, borderwidth=1,
                                                     font=('Consolas', 9))
        self.output_text.pack(fill=tk.BOTH, expand=True)

    def create_path_input(self, parent, label_text, var, browse_command):
        frame = tk.Frame(parent, bg='white')
        frame.pack(fill=tk.X, pady=5)

        tk.Label(frame, text=label_text, width=20, anchor='w',
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
                        text=f"ℹ Files will be saved to: {folder} (folder created)",
                        fg='#00AA00'
                    )
                except:
                    self.user_char_label.config(
                        text=f"⚠ UserCharacter folder: {folder} (cannot create)",
                        fg='#CC0000'
                    )
            else:
                self.user_char_label.config(
                    text=f"ℹ Files will be saved to: {folder}",
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

    def generate_json(self):
        display_name = self.display_name_var.get().strip()
        if not display_name:
            messagebox.showerror("Error", "Please enter a Display Name")
            return

        # Check if project file is selected
        if not self.project_file_var.get():
            messagebox.showerror("Error", "Please select Project File first")
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

            self.log_output(f"\n✓ Process completed with code {process.returncode}")
            if process.returncode == 0:
                self.root.after(0, lambda: messagebox.showinfo("Success", "Character created successfully!"))
            else:
                self.root.after(0, lambda: messagebox.showwarning("Completed", f"Process exited with code {process.returncode}\nCheck console window for details."))

        except Exception as e:
            self.log_output(f"\n✗ Error: {str(e)}")
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

            self.log_output(f"\n✓ Build completed with code {process.returncode}")
            if process.returncode == 0:
                self.root.after(0, lambda: messagebox.showinfo("Success", "Build completed successfully!"))
            else:
                self.root.after(0, lambda: messagebox.showwarning("Completed", f"Build exited with code {process.returncode}\nCheck console window for details."))

        except Exception as e:
            self.log_output(f"\n✗ Error: {str(e)}")
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
            self.root.after(0, lambda: self.build_and_create_btn.config(state=tk.NORMAL, text="BUILD & CREATE"))
            self.root.after(0, lambda: self.execute_btn.config(state=tk.NORMAL))
            self.root.after(0, lambda: self.build_btn.config(state=tk.NORMAL))


if __name__ == "__main__":
    root = tk.Tk()
    app = CharacterCreatorGUI(root)
    root.mainloop()
