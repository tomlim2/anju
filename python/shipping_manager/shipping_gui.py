import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import subprocess
import shutil
import os
import json
from datetime import datetime
import threading


class ShippingGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CINEV Shipping Manager")
        self.root.geometry("600x500")
        self.root.configure(bg='white')

        self.config_file = os.path.join(os.path.dirname(__file__), "shipping_config.json")

        self.branch_var = tk.StringVar()
        self.config = {}
        self.git_verified = False

        self.load_config()
        self.create_widgets()

        self.branch_var.trace_add('write', lambda *args: self.on_branch_change())

    def load_config(self):
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
                self.branch_var.set(self.config.get('branch', ''))

    def save_branch(self):
        self.config['branch'] = self.branch_var.get()
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2)

    def on_branch_change(self):
        self.save_branch()
        self.git_verified = False
        self.update_start_button_state()

    def create_widgets(self):
        main_frame = tk.Frame(self.root, bg='white', padx=30, pady=30)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(main_frame, text="CINEV Shipping Manager",
                        font=('Arial', 18, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 30))

        # Branch input
        branch_frame = tk.Frame(main_frame, bg='white')
        branch_frame.pack(fill=tk.X, pady=(0, 20))

        tk.Label(branch_frame, text="Branch:", font=('Arial', 10),
                bg='white', fg='black').pack(side=tk.LEFT)
        tk.Entry(branch_frame, textvariable=self.branch_var,
                font=('Arial', 10), bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10, 0))

        # Git verify button
        self.verify_btn = tk.Button(branch_frame, text="VERIFY & UPDATE",
                                    command=self.verify_git,
                                    bg='#444444', fg='white', relief=tk.FLAT,
                                    font=('Arial', 9, 'bold'),
                                    padx=15, pady=5, cursor='hand2')
        self.verify_btn.pack(side=tk.LEFT, padx=(10, 0))

        # Git status label
        self.git_status_label = tk.Label(main_frame, text="",
                                         font=('Arial', 9), bg='white', fg='#999999')
        self.git_status_label.pack(pady=(5, 10))

        # Start button (disabled by default)
        self.start_btn = tk.Button(main_frame, text="START SHIPPING",
                                   command=self.start_shipping,
                                   bg='#cccccc', fg='#666666', relief=tk.FLAT,
                                   font=('Arial', 14, 'bold'),
                                   padx=40, pady=15, state=tk.DISABLED)
        self.start_btn.pack(pady=(0, 30))

        # Status indicators
        status_frame = tk.Frame(main_frame, bg='white')
        status_frame.pack(fill=tk.X, pady=(0, 20))

        self.status_labels = {}
        steps = [('git', 'Git Update'), ('packaging', 'Packaging'),
                 ('zip', 'ZIP & Upload'), ('complete', 'Complete')]

        for i, (key, text) in enumerate(steps):
            label = tk.Label(status_frame, text=f"○ {text}",
                           font=('Arial', 10), bg='white', fg='#999999')
            label.pack(side=tk.LEFT, padx=(0, 20))
            self.status_labels[key] = label

        # Output console
        output_frame = tk.LabelFrame(main_frame, text="Output",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        output_frame.pack(fill=tk.BOTH, expand=True)

        self.output_text = scrolledtext.ScrolledText(output_frame, height=12,
                                                     bg='white', fg='black',
                                                     relief=tk.SOLID, borderwidth=1,
                                                     font=('Consolas', 9))
        self.output_text.pack(fill=tk.BOTH, expand=True)

    def update_status(self, current_step):
        steps = ['git', 'packaging', 'zip', 'complete']
        for step in steps:
            label = self.status_labels[step]
            text = label.cget('text')[2:]
            if step == current_step:
                label.config(text=f"■ {text}", fg='black')
            elif steps.index(step) < steps.index(current_step):
                label.config(text=f"✓ {text}", fg='#00aa00')
            else:
                label.config(text=f"○ {text}", fg='#999999')

    def reset_status(self):
        for key, label in self.status_labels.items():
            text = label.cget('text')
            if text.startswith('■') or text.startswith('✓'):
                text = text[2:]
            elif text.startswith('○'):
                text = text[2:]
            label.config(text=f"○ {text}", fg='#999999')

    def log(self, message):
        self.output_text.insert(tk.END, message + "\n")
        self.output_text.see(tk.END)
        self.output_text.update()

    def update_start_button_state(self):
        if self.git_verified:
            self.start_btn.config(state=tk.NORMAL, bg='black', fg='white', cursor='hand2')
        else:
            self.start_btn.config(state=tk.DISABLED, bg='#cccccc', fg='#666666', cursor='')

    def verify_git(self):
        errors = []
        if not self.branch_var.get():
            errors.append("Branch is required")
        if not self.config.get('project_path'):
            errors.append("project_path not configured")

        if errors:
            messagebox.showerror("Error", "\n".join(errors))
            return

        self.verify_btn.config(state=tk.DISABLED, text="VERIFYING...")
        self.output_text.delete(1.0, tk.END)
        self.git_status_label.config(text="", fg='#999999')

        thread = threading.Thread(target=self.run_verify_git)
        thread.daemon = True
        thread.start()

    def run_verify_git(self):
        try:
            success = self.run_git()
            if success:
                self.git_verified = True
                self.root.after(0, lambda: self.git_status_label.config(
                    text=f"✓ Branch verified: {self.branch_var.get()}", fg='#00aa00'))
                self.root.after(0, lambda: self.update_status('git'))
            else:
                self.git_verified = False
                self.root.after(0, lambda: self.git_status_label.config(
                    text="✗ Git verification failed", fg='#cc0000'))
        finally:
            self.root.after(0, lambda: self.verify_btn.config(state=tk.NORMAL, text="VERIFY & UPDATE"))
            self.root.after(0, self.update_start_button_state)

    def generate_output_name(self):
        branch = self.branch_var.get()
        if not branch:
            return ""
        parts = branch.split('/')
        prefix = ''.join(part[0].lower() for part in parts if part)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}"

    def validate(self):
        errors = []
        if not self.branch_var.get():
            errors.append("Branch is required")
        if not self.config.get('ue_engine_dir'):
            errors.append("ue_engine_dir not configured")
        if not self.config.get('project_path'):
            errors.append("project_path not configured")
        if not self.config.get('output_path'):
            errors.append("output_path not configured")
        return errors

    def start_shipping(self):
        errors = self.validate()
        if errors:
            messagebox.showerror("Error", "\n".join(errors))
            return

        if not self.git_verified:
            messagebox.showerror("Error", "Please verify git branch first")
            return

        self.start_btn.config(state=tk.DISABLED, text="RUNNING...")
        self.output_text.delete(1.0, tk.END)

        thread = threading.Thread(target=self.run_shipping)
        thread.daemon = True
        thread.start()

    def run_shipping(self):
        try:
            output_name = self.generate_output_name()
            self.log(f"Output name: {output_name}\n")

            # Step 1: Packaging (Git already verified)
            self.root.after(0, lambda: self.update_status('packaging'))
            if not self.run_packaging(output_name):
                return

            # Step 4: ZIP & Upload
            self.root.after(0, lambda: self.update_status('zip'))
            if not self.run_zip_upload(output_name):
                return

            # Complete
            self.root.after(0, lambda: self.update_status('complete'))
            self.log("\n" + "=" * 40)
            self.log("SHIPPING COMPLETED!")
            self.log("=" * 40)
            self.root.after(0, lambda: messagebox.showinfo("완료", "Shipping 완료!"))

        except Exception as e:
            self.log(f"\n[ERROR] {str(e)}")
            self.root.after(0, lambda: messagebox.showerror("Error", str(e)))
        finally:
            self.root.after(0, lambda: self.start_btn.config(text="START SHIPPING"))
            self.root.after(0, self.update_start_button_state)

    def run_git(self):
        project_path = os.path.normpath(self.config['project_path'])
        branch = self.branch_var.get()

        self.log("=== GIT UPDATE ===")
        self.log(f"Path: {project_path}")
        self.log(f"Branch: {branch}\n")

        commands = [
            ("git fetch --all", "Fetching..."),
            (f"git checkout {branch}", f"Checkout: {branch}"),
            ("git pull", "Pulling...")
        ]

        for cmd, desc in commands:
            self.log(f"> {desc}")
            try:
                result = subprocess.run(cmd, cwd=project_path, shell=True,
                                       capture_output=True, text=True)
                if result.stdout:
                    self.log(f"  {result.stdout.strip()}")
                if result.stderr:
                    self.log(f"  {result.stderr.strip()}")
                if result.returncode != 0:
                    self.log(f"  [FAILED]")
                    return False
                self.log(f"  [OK]")
            except Exception as e:
                self.log(f"  [ERROR] {str(e)}")
                return False

        self.log("\nGit update complete.\n")
        return True

    def run_packaging(self, output_name):
        ue_dir = os.path.normpath(self.config['ue_engine_dir'])
        project_path = os.path.normpath(self.config['project_path'])
        output_path = os.path.normpath(self.config['output_path'])

        runuat = os.path.join(ue_dir, "Engine", "Build", "BatchFiles", "RunUAT.bat")
        uproject = os.path.join(project_path, "CINEVStudio.uproject")
        archive_dir = os.path.join(output_path, output_name)

        self.log("=== PACKAGING ===")
        self.log(f"Archive: {archive_dir}\n")

        cmd = (
            f'"{runuat}" BuildCookRun '
            f'-project="{uproject}" '
            f'-noP4 -platform=Win64 -clientconfig=Shipping '
            f'-build -cook -stage -pak -archive '
            f'-archivedirectory="{archive_dir}"'
        )

        self.log("Running UAT (check console window)...")

        try:
            process = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
            process.wait()

            if process.returncode == 0:
                self.log("[OK] Packaging complete.\n")
                return True
            else:
                self.log(f"[FAILED] Exit code: {process.returncode}")
                return False
        except Exception as e:
            self.log(f"[ERROR] {str(e)}")
            return False

    def run_zip_upload(self, output_name):
        output_path = os.path.normpath(self.config['output_path'])
        nas_path = self.config.get('nas_path', '')

        package_dir = os.path.join(output_path, output_name)
        zip_base = os.path.join(output_path, output_name)
        zip_file = f"{zip_base}.zip"

        self.log("=== ZIP & UPLOAD ===")

        if not os.path.exists(package_dir):
            self.log(f"[ERROR] Not found: {package_dir}")
            return False

        self.log(f"Creating ZIP: {zip_file}")
        try:
            shutil.make_archive(zip_base, 'zip', output_path, output_name)
            self.log("[OK] ZIP created.\n")
        except Exception as e:
            self.log(f"[ERROR] {str(e)}")
            return False

        if nas_path:
            self.log(f"Uploading to: {nas_path}")
            try:
                if not os.path.exists(nas_path):
                    self.log("[WARNING] NAS not accessible. Skipping.")
                else:
                    dest = os.path.join(nas_path, f"{output_name}.zip")
                    shutil.copy(zip_file, dest)
                    self.log(f"[OK] Uploaded: {dest}\n")
            except Exception as e:
                self.log(f"[ERROR] {str(e)}")
                return False

        return True


if __name__ == "__main__":
    root = tk.Tk()
    app = ShippingGUI(root)
    root.mainloop()
