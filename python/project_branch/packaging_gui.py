import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import subprocess
import shutil
import os
import json
from datetime import datetime
import threading


class PackagingGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CINEV Packaging Tool")
        self.root.geometry("900x750")
        self.root.configure(bg='white')

        # Config file for saving paths
        self.config_file = os.path.join(os.path.dirname(__file__), "packaging_config.json")

        # Variables
        self.ue_engine_dir_var = tk.StringVar()
        self.project_path_var = tk.StringVar()
        self.output_path_var = tk.StringVar()
        self.nas_path_var = tk.StringVar()
        self.branch_var = tk.StringVar()
        self.output_name_var = tk.StringVar()

        self.create_widgets()
        self.load_config()

        # Auto-save on change
        self.ue_engine_dir_var.trace_add('write', lambda *args: self.save_config())
        self.project_path_var.trace_add('write', lambda *args: self.save_config())
        self.output_path_var.trace_add('write', lambda *args: self.save_config())
        self.nas_path_var.trace_add('write', lambda *args: self.save_config())
        self.branch_var.trace_add('write', lambda *args: self.on_branch_change())

    def create_widgets(self):
        # Main container
        main_frame = tk.Frame(self.root, bg='white', padx=20, pady=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(main_frame, text="CINEV Packaging Tool",
                        font=('Arial', 18, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 20))

        # 1. Configure Paths Section
        paths_frame = tk.LabelFrame(main_frame, text="1. Configure Paths",
                                    font=('Arial', 10, 'bold'), bg='white',
                                    fg='black', padx=10, pady=10)
        paths_frame.pack(fill=tk.X, pady=(0, 10))

        # UE Engine Directory
        self.create_path_input(paths_frame, "UE_CINEV Engine Dir:",
                              self.ue_engine_dir_var, self.browse_ue_engine_dir)

        # Project Path
        self.create_path_input(paths_frame, "Project Path:",
                              self.project_path_var, self.browse_project_path)

        # Output Path
        self.create_path_input(paths_frame, "Output Path:",
                              self.output_path_var, self.browse_output_path)

        # NAS Path
        self.create_path_input(paths_frame, "NAS Path:",
                              self.nas_path_var, self.browse_nas_path)

        # 2. Branch Settings Section
        branch_frame = tk.LabelFrame(main_frame, text="2. Branch Settings",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        branch_frame.pack(fill=tk.X, pady=(0, 10))

        # Branch Name
        branch_input_frame = tk.Frame(branch_frame, bg='white')
        branch_input_frame.pack(fill=tk.X, pady=5)

        tk.Label(branch_input_frame, text="Branch Name:", width=20, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)

        tk.Entry(branch_input_frame, textvariable=self.branch_var,
                bg='white', fg='black', relief=tk.SOLID,
                borderwidth=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

        # Output Name (read-only, auto-generated)
        output_name_frame = tk.Frame(branch_frame, bg='white')
        output_name_frame.pack(fill=tk.X, pady=5)

        tk.Label(output_name_frame, text="Output Name:", width=20, anchor='w',
                bg='white', fg='black').pack(side=tk.LEFT)

        self.output_name_entry = tk.Entry(output_name_frame, textvariable=self.output_name_var,
                                          bg='#f0f0f0', fg='black', relief=tk.SOLID,
                                          borderwidth=1, state='readonly')
        self.output_name_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

        tk.Button(output_name_frame, text="Refresh", command=self.update_output_name,
                 bg='white', fg='black', relief=tk.SOLID, borderwidth=1,
                 padx=10, cursor='hand2').pack(side=tk.LEFT)

        # 3. Execute Section
        execute_frame = tk.LabelFrame(main_frame, text="3. Execute",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        execute_frame.pack(fill=tk.X, pady=(0, 10))

        # Buttons frame
        buttons_frame = tk.Frame(execute_frame, bg='white')
        buttons_frame.pack(pady=10)

        self.package_btn = tk.Button(buttons_frame, text="START PACKAGING",
                                     command=self.start_packaging, bg='black',
                                     fg='white', relief=tk.FLAT,
                                     font=('Arial', 12, 'bold'),
                                     padx=30, pady=15, cursor='hand2')
        self.package_btn.pack(side=tk.LEFT, padx=5)

        self.git_only_btn = tk.Button(buttons_frame, text="GIT CHECKOUT ONLY",
                                      command=self.git_checkout_only, bg='#444444',
                                      fg='white', relief=tk.FLAT,
                                      font=('Arial', 10, 'bold'),
                                      padx=20, pady=15, cursor='hand2')
        self.git_only_btn.pack(side=tk.LEFT, padx=5)

        self.zip_only_btn = tk.Button(buttons_frame, text="ZIP & UPLOAD ONLY",
                                      command=self.zip_and_upload_only, bg='#666666',
                                      fg='white', relief=tk.FLAT,
                                      font=('Arial', 10, 'bold'),
                                      padx=20, pady=15, cursor='hand2')
        self.zip_only_btn.pack(side=tk.LEFT, padx=5)

        # Output Console
        output_frame = tk.LabelFrame(main_frame, text="Output",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        output_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 0))

        self.output_text = scrolledtext.ScrolledText(output_frame, height=15,
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

    def browse_ue_engine_dir(self):
        directory = filedialog.askdirectory(title="Select UE_CINEV Engine Directory")
        if directory:
            self.ue_engine_dir_var.set(directory)

    def browse_project_path(self):
        directory = filedialog.askdirectory(title="Select Project Path (contains .uproject)")
        if directory:
            self.project_path_var.set(directory)

    def browse_output_path(self):
        directory = filedialog.askdirectory(title="Select Output Path")
        if directory:
            self.output_path_var.set(directory)

    def browse_nas_path(self):
        directory = filedialog.askdirectory(title="Select NAS Path")
        if directory:
            self.nas_path_var.set(directory)

    def load_config(self):
        """Load saved configuration from file"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.ue_engine_dir_var.set(config.get('ue_engine_dir', ''))
                    self.project_path_var.set(config.get('project_path', ''))
                    self.output_path_var.set(config.get('output_path', ''))
                    self.nas_path_var.set(config.get('nas_path', r'\\nas.cinamon.me\CineV\11_Cinema\CINEVPackageCO'))
                    self.branch_var.set(config.get('branch', ''))
                    self.update_output_name()
            except Exception as e:
                print(f"Error loading config: {e}")
        else:
            # Set defaults
            self.nas_path_var.set(r'\\nas.cinamon.me\CineV\11_Cinema\CINEVPackageCO')

    def save_config(self):
        """Save current configuration to file"""
        try:
            config = {
                'ue_engine_dir': self.ue_engine_dir_var.get(),
                'project_path': self.project_path_var.get(),
                'output_path': self.output_path_var.get(),
                'nas_path': self.nas_path_var.get(),
                'branch': self.branch_var.get()
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    def on_branch_change(self):
        """Called when branch name changes"""
        self.save_config()
        self.update_output_name()

    def generate_output_name(self, branch):
        """Generate output name from branch name

        Example: contents/production/divorce-unconditionally-v1.3.11
        Split by "/": ["contents", "production", "divorce-unconditionally-v1.3.11"]
        First letter of each: c + p + d = cpd
        Result: cpd_20260121_181500
        """
        if not branch:
            return ""

        parts = branch.split('/')
        prefix = ''.join(part[0].lower() for part in parts if part)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}"

    def update_output_name(self):
        """Update the output name based on current branch"""
        branch = self.branch_var.get()
        output_name = self.generate_output_name(branch)
        self.output_name_var.set(output_name)

    def log_output(self, message):
        self.output_text.insert(tk.END, message + "\n")
        self.output_text.see(tk.END)
        self.output_text.update()

    def validate_paths(self):
        """Validate all required paths"""
        errors = []

        if not self.ue_engine_dir_var.get():
            errors.append("UE_CINEV Engine Directory is required")
        elif not os.path.exists(self.ue_engine_dir_var.get()):
            errors.append("UE_CINEV Engine Directory does not exist")
        else:
            runuat_path = os.path.join(self.ue_engine_dir_var.get(), "Engine", "Build", "BatchFiles", "RunUAT.bat")
            if not os.path.exists(runuat_path):
                errors.append(f"RunUAT.bat not found at: {runuat_path}")

        if not self.project_path_var.get():
            errors.append("Project Path is required")
        elif not os.path.exists(self.project_path_var.get()):
            errors.append("Project Path does not exist")
        else:
            uproject_path = os.path.join(self.project_path_var.get(), "CINEVStudio.uproject")
            if not os.path.exists(uproject_path):
                errors.append(f"CINEVStudio.uproject not found at: {uproject_path}")

        if not self.output_path_var.get():
            errors.append("Output Path is required")

        if not self.branch_var.get():
            errors.append("Branch Name is required")

        return errors

    def set_buttons_state(self, state):
        """Enable or disable all buttons"""
        self.package_btn.config(state=state)
        self.git_only_btn.config(state=state)
        self.zip_only_btn.config(state=state)

    def run_git_commands(self):
        """Run git fetch, checkout, pull commands"""
        project_path = os.path.normpath(self.project_path_var.get())
        branch = self.branch_var.get()

        self.log_output("=== GIT OPERATIONS ===")
        self.log_output(f"Working directory: {project_path}")
        self.log_output(f"Target branch: {branch}")
        self.log_output("")

        commands = [
            ("git fetch --all", "Fetching all remotes..."),
            (f"git checkout {branch}", f"Checking out branch: {branch}"),
            ("git pull", "Pulling latest changes...")
        ]

        for cmd, description in commands:
            self.log_output(f"> {description}")
            self.log_output(f"  Command: {cmd}")

            try:
                result = subprocess.run(
                    cmd,
                    cwd=project_path,
                    shell=True,
                    capture_output=True,
                    text=True
                )

                if result.stdout:
                    self.log_output(f"  {result.stdout.strip()}")
                if result.stderr:
                    self.log_output(f"  {result.stderr.strip()}")

                if result.returncode != 0:
                    self.log_output(f"  [ERROR] Command failed with code {result.returncode}")
                    return False
                else:
                    self.log_output(f"  [OK]")

            except Exception as e:
                self.log_output(f"  [ERROR] {str(e)}")
                return False

            self.log_output("")

        self.log_output("Git operations completed successfully!")
        return True

    def run_packaging(self):
        """Run UAT BuildCookRun command"""
        ue_engine_dir = os.path.normpath(self.ue_engine_dir_var.get())
        project_path = os.path.normpath(self.project_path_var.get())
        output_path = os.path.normpath(self.output_path_var.get())
        output_name = self.output_name_var.get()

        runuat_path = os.path.join(ue_engine_dir, "Engine", "Build", "BatchFiles", "RunUAT.bat")
        uproject_path = os.path.join(project_path, "CINEVStudio.uproject")
        archive_dir = os.path.join(output_path, output_name)

        self.log_output("")
        self.log_output("=== PACKAGING ===")
        self.log_output(f"RunUAT: {runuat_path}")
        self.log_output(f"Project: {uproject_path}")
        self.log_output(f"Archive Directory: {archive_dir}")
        self.log_output("")

        cmd = (
            f'"{runuat_path}" BuildCookRun '
            f'-project="{uproject_path}" '
            f'-noP4 '
            f'-platform=Win64 '
            f'-clientconfig=Shipping '
            f'-build '
            f'-cook '
            f'-stage '
            f'-pak '
            f'-archive '
            f'-archivedirectory="{archive_dir}"'
        )

        self.log_output(f"Command: {cmd}")
        self.log_output("")
        self.log_output("Starting packaging process (this may take a while)...")
        self.log_output("Check the console window for detailed progress.")
        self.log_output("")

        try:
            process = subprocess.Popen(
                cmd,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )

            process.wait()

            if process.returncode == 0:
                self.log_output("[OK] Packaging completed successfully!")
                return True
            else:
                self.log_output(f"[ERROR] Packaging failed with code {process.returncode}")
                return False

        except Exception as e:
            self.log_output(f"[ERROR] {str(e)}")
            return False

    def run_zip_and_upload(self):
        """ZIP the package and upload to NAS"""
        output_path = os.path.normpath(self.output_path_var.get())
        output_name = self.output_name_var.get()
        nas_path = self.nas_path_var.get()

        package_dir = os.path.join(output_path, output_name)
        zip_base = os.path.join(output_path, output_name)
        zip_file = f"{zip_base}.zip"

        self.log_output("")
        self.log_output("=== ZIP & UPLOAD ===")

        # Check if package directory exists
        if not os.path.exists(package_dir):
            self.log_output(f"[ERROR] Package directory not found: {package_dir}")
            return False

        # Create ZIP
        self.log_output(f"Creating ZIP: {zip_file}")
        self.log_output("This may take a while for large packages...")

        try:
            shutil.make_archive(
                base_name=zip_base,
                format='zip',
                root_dir=output_path,
                base_dir=output_name
            )
            self.log_output(f"[OK] ZIP created: {zip_file}")
        except Exception as e:
            self.log_output(f"[ERROR] Failed to create ZIP: {str(e)}")
            return False

        # Upload to NAS
        if nas_path:
            self.log_output("")
            self.log_output(f"Uploading to NAS: {nas_path}")

            try:
                if not os.path.exists(nas_path):
                    self.log_output(f"[WARNING] NAS path not accessible: {nas_path}")
                    self.log_output("Skipping NAS upload.")
                else:
                    dest_file = os.path.join(nas_path, f"{output_name}.zip")
                    shutil.copy(zip_file, dest_file)
                    self.log_output(f"[OK] Uploaded to: {dest_file}")
            except Exception as e:
                self.log_output(f"[ERROR] Failed to upload to NAS: {str(e)}")
                return False

        self.log_output("")
        self.log_output("ZIP & Upload completed!")
        return True

    def start_packaging(self):
        """Start the full packaging process"""
        errors = self.validate_paths()
        if errors:
            messagebox.showerror("Validation Error", "\n".join(errors))
            return

        # Update output name with fresh timestamp
        self.update_output_name()

        self.set_buttons_state(tk.DISABLED)
        self.package_btn.config(text="RUNNING...")
        self.output_text.delete(1.0, tk.END)

        thread = threading.Thread(target=self.run_full_packaging)
        thread.daemon = True
        thread.start()

    def run_full_packaging(self):
        """Run the full packaging process in a thread"""
        try:
            self.log_output("Starting full packaging process...")
            self.log_output(f"Output name: {self.output_name_var.get()}")
            self.log_output("")

            # Step 1: Git operations
            if not self.run_git_commands():
                self.root.after(0, lambda: messagebox.showerror("Error", "Git operations failed"))
                return

            # Step 2: Packaging
            if not self.run_packaging():
                self.root.after(0, lambda: messagebox.showerror("Error", "Packaging failed"))
                return

            # Step 3: ZIP and Upload
            if not self.run_zip_and_upload():
                self.root.after(0, lambda: messagebox.showerror("Error", "ZIP/Upload failed"))
                return

            self.log_output("")
            self.log_output("=" * 50)
            self.log_output("ALL STEPS COMPLETED SUCCESSFULLY!")
            self.log_output("=" * 50)

            self.root.after(0, lambda: messagebox.showinfo("Success", "Packaging completed successfully!"))

        except Exception as e:
            self.log_output(f"\n[ERROR] {str(e)}")
            self.root.after(0, lambda: messagebox.showerror("Error", f"Packaging failed: {str(e)}"))

        finally:
            self.root.after(0, lambda: self.set_buttons_state(tk.NORMAL))
            self.root.after(0, lambda: self.package_btn.config(text="START PACKAGING"))

    def git_checkout_only(self):
        """Run only git operations"""
        errors = []
        if not self.project_path_var.get():
            errors.append("Project Path is required")
        if not self.branch_var.get():
            errors.append("Branch Name is required")

        if errors:
            messagebox.showerror("Validation Error", "\n".join(errors))
            return

        self.set_buttons_state(tk.DISABLED)
        self.git_only_btn.config(text="RUNNING...")
        self.output_text.delete(1.0, tk.END)

        def run():
            try:
                if self.run_git_commands():
                    self.root.after(0, lambda: messagebox.showinfo("Success", "Git checkout completed!"))
                else:
                    self.root.after(0, lambda: messagebox.showerror("Error", "Git operations failed"))
            finally:
                self.root.after(0, lambda: self.set_buttons_state(tk.NORMAL))
                self.root.after(0, lambda: self.git_only_btn.config(text="GIT CHECKOUT ONLY"))

        thread = threading.Thread(target=run)
        thread.daemon = True
        thread.start()

    def zip_and_upload_only(self):
        """Run only ZIP and upload"""
        errors = []
        if not self.output_path_var.get():
            errors.append("Output Path is required")
        if not self.output_name_var.get():
            errors.append("Output Name is required (enter branch first)")

        if errors:
            messagebox.showerror("Validation Error", "\n".join(errors))
            return

        self.set_buttons_state(tk.DISABLED)
        self.zip_only_btn.config(text="RUNNING...")
        self.output_text.delete(1.0, tk.END)

        def run():
            try:
                if self.run_zip_and_upload():
                    self.root.after(0, lambda: messagebox.showinfo("Success", "ZIP & Upload completed!"))
                else:
                    self.root.after(0, lambda: messagebox.showerror("Error", "ZIP/Upload failed"))
            finally:
                self.root.after(0, lambda: self.set_buttons_state(tk.NORMAL))
                self.root.after(0, lambda: self.zip_only_btn.config(text="ZIP & UPLOAD ONLY"))

        thread = threading.Thread(target=run)
        thread.daemon = True
        thread.start()


if __name__ == "__main__":
    root = tk.Tk()
    app = PackagingGUI(root)
    root.mainloop()
