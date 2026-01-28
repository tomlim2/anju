import tkinter as tk
from tkinter import messagebox, scrolledtext
import subprocess
import shutil
import os
import json
from datetime import datetime
import threading
import time


class ShippingGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CINEV 연출용 패키지 매니저")
        self.root.geometry("960x720")
        self.root.configure(bg='white')

        self.config_file = os.path.join(os.path.dirname(__file__), "shipping_config.json")

        self.branch_var = tk.StringVar()
        self.config = {}
        self.git_verified = False

        # Timer and animation state
        self.timer_running = False
        self.start_time = None
        self.animation_dots = 0

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
        title = tk.Label(main_frame, text="CINEV 쉬핑 매니저",
                        font=('Arial', 18, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 30))

        # Branch input
        branch_frame = tk.Frame(main_frame, bg='white')
        branch_frame.pack(fill=tk.X, pady=(0, 20))

        tk.Label(branch_frame, text="브랜치:", font=('Arial', 10),
                bg='white', fg='black').pack(side=tk.LEFT)
        tk.Entry(branch_frame, textvariable=self.branch_var,
                font=('Arial', 10), bg='white', fg='black',
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10, 0))

        # Git verify button
        self.verify_btn = tk.Button(branch_frame, text="검증 및 업데이트",
                                    command=self.verify_git,
                                    bg='#444444', fg='white', relief=tk.FLAT,
                                    font=('Arial', 9, 'bold'),
                                    padx=15, pady=5, cursor='hand2')
        self.verify_btn.pack(side=tk.LEFT, padx=(10, 0))

        # Git status label
        self.git_status_label = tk.Label(main_frame, text="",
                                         font=('Arial', 9), bg='white', fg='#999999')
        self.git_status_label.pack(pady=(5, 10))

        # Timer label
        self.timer_label = tk.Label(main_frame, text="",
                                    font=('Consolas', 10), bg='white', fg='#666666')
        self.timer_label.pack(pady=(0, 5))

        # Start button (disabled by default)
        self.start_btn = tk.Button(main_frame, text="쉬핑 시작",
                                   command=self.start_shipping,
                                   bg='#cccccc', fg='#666666', relief=tk.FLAT,
                                   font=('Arial', 14, 'bold'),
                                   padx=40, pady=15, state=tk.DISABLED)
        self.start_btn.pack(pady=(0, 30))

        # Status indicators
        status_frame = tk.Frame(main_frame, bg='white')
        status_frame.pack(fill=tk.X, pady=(0, 20))

        self.status_labels = {}
        steps = [('git', 'Git 업데이트'), ('packaging', '패키징'),
                 ('zip', '압축'), ('upload', '업로드'), ('complete', '완료')]

        for key, text in steps:
            label = tk.Label(status_frame, text=f"○ {text}",
                           font=('Arial', 10), bg='white', fg='#999999')
            label.pack(side=tk.LEFT, padx=(0, 20))
            self.status_labels[key] = label

        # Output console
        output_frame = tk.LabelFrame(main_frame, text="출력",
                                     font=('Arial', 10, 'bold'), bg='white',
                                     fg='black', padx=10, pady=10)
        output_frame.pack(fill=tk.BOTH, expand=True)

        self.output_text = scrolledtext.ScrolledText(output_frame, height=12,
                                                     bg='white', fg='black',
                                                     relief=tk.SOLID, borderwidth=1,
                                                     font=('Consolas', 9))
        self.output_text.pack(fill=tk.BOTH, expand=True)

    def update_status(self, current_step):
        steps = ['git', 'packaging', 'zip', 'upload', 'complete']
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
        for label in self.status_labels.values():
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

    def update_timer_task(self, task_name):
        self.current_task = task_name

    def start_timer(self, task_name):
        self.start_time = time.time()
        self.timer_running = True
        self.current_task = task_name
        self.load_last_duration()
        self.update_timer()

    def stop_timer(self):
        if self.timer_running and self.start_time:
            self.save_last_duration(time.time() - self.start_time)
        self.timer_running = False
        self.timer_label.config(text="")

    def load_last_duration(self):
        duration_file = os.path.join(os.path.dirname(__file__), "last_duration.json")
        self.last_duration = None
        if os.path.exists(duration_file):
            try:
                with open(duration_file, 'r') as f:
                    data = json.load(f)
                    self.last_duration = data.get('duration')
            except Exception:
                pass

    def save_last_duration(self, duration):
        duration_file = os.path.join(os.path.dirname(__file__), "last_duration.json")
        try:
            with open(duration_file, 'w') as f:
                json.dump({'duration': duration, 'timestamp': datetime.now().isoformat()}, f)
        except Exception:
            pass

    def update_timer(self):
        if not self.timer_running:
            return

        elapsed = time.time() - self.start_time
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)

        # Animate dots
        self.animation_dots = (self.animation_dots + 1) % 4
        dots = "." * self.animation_dots + " " * (3 - self.animation_dots)

        # Build timer text with ETA if available
        timer_text = f"{self.current_task}{dots} [{minutes:02d}:{seconds:02d}]"

        if self.last_duration:
            remaining = self.last_duration - elapsed
            if remaining > 0:
                rem_min = int(remaining // 60)
                rem_sec = int(remaining % 60)
                timer_text += f"  (ETA: ~{rem_min:02d}:{rem_sec:02d})"
            else:
                timer_text += "  (마무리 중...)"

        self.timer_label.config(text=timer_text)
        self.root.after(500, self.update_timer)

    def log_heartbeat(self, message):
        """Log a heartbeat message to show progress"""
        elapsed = time.time() - self.start_time
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        self.log(f"  [{minutes:02d}:{seconds:02d}] {message}")

    def update_start_button_state(self):
        if self.git_verified:
            self.start_btn.config(state=tk.NORMAL, bg='black', fg='white', cursor='hand2')
        else:
            self.start_btn.config(state=tk.DISABLED, bg='#cccccc', fg='#666666', cursor='')

    def verify_git(self):
        errors = []
        if not self.branch_var.get():
            errors.append("브랜치를 입력해주세요")
        if not self.config.get('project_path'):
            errors.append("프로젝트 경로가 설정되지 않았습니다")

        if errors:
            messagebox.showerror("오류", "\n".join(errors))
            return

        self.verify_btn.config(state=tk.DISABLED, text="검증 중...")
        self.output_text.delete(1.0, tk.END)
        self.git_status_label.config(text="", fg='#999999')

        thread = threading.Thread(target=self.run_verify_git)
        thread.daemon = True
        thread.start()

    def run_verify_git(self):
        try:
            # Check paths first
            if not self.verify_paths():
                self.git_verified = False
                self.root.after(0, lambda: self.git_status_label.config(
                    text="✗ 경로 검증 실패", fg='#cc0000'))
                return

            # Run git commands
            success = self.run_git()
            if success:
                self.git_verified = True
                self.root.after(0, lambda: self.git_status_label.config(
                    text=f"✓ 검증 완료: {self.branch_var.get()}", fg='#00aa00'))
                self.root.after(0, lambda: self.update_status('git'))
            else:
                self.git_verified = False
                self.root.after(0, lambda: self.git_status_label.config(
                    text="✗ Git 검증 실패", fg='#cc0000'))
        finally:
            self.root.after(0, lambda: self.verify_btn.config(state=tk.NORMAL, text="검증 및 업데이트"))
            self.root.after(0, self.update_start_button_state)

    def verify_paths(self):
        self.log("=== 경로 검증 ===\n")
        all_ok = True

        # UE Engine
        ue_dir = self.config.get('ue_engine_dir', '')
        if ue_dir:
            runuat = os.path.join(ue_dir, "Engine", "Build", "BatchFiles", "RunUAT.bat")
            if os.path.exists(runuat):
                self.log(f"✓ UE 엔진: {ue_dir}")
            else:
                self.log(f"✗ UE 엔진: RunUAT.bat 없음")
                all_ok = False
        else:
            self.log("✗ UE 엔진: 설정 안됨")
            all_ok = False

        # Project path
        project_path = self.config.get('project_path', '')
        if project_path and os.path.isdir(project_path):
            self.log(f"✓ 프로젝트: {project_path}")
        else:
            self.log(f"✗ 프로젝트: 경로 없음")
            all_ok = False

        # Output path
        output_path = self.config.get('output_path', '')
        if output_path and os.path.isdir(output_path):
            self.log(f"✓ 출력: {output_path}")
        else:
            self.log(f"✗ 출력: 경로 없음")
            all_ok = False

        # NAS path (warning only, not blocking)
        nas_path = self.config.get('nas_path', '')
        if nas_path:
            if os.path.exists(nas_path):
                self.log(f"✓ NAS: {nas_path}")
            else:
                self.log(f"⚠ NAS: 접근 불가 (업로드 건너뜀)")
        else:
            self.log("⚠ NAS: 설정 안됨 (업로드 건너뜀)")

        self.log("")
        return all_ok

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
            errors.append("브랜치를 입력해주세요")
        if not self.config.get('ue_engine_dir'):
            errors.append("UE 엔진 경로가 설정되지 않았습니다")
        if not self.config.get('project_path'):
            errors.append("프로젝트 경로가 설정되지 않았습니다")
        if not self.config.get('output_path'):
            errors.append("출력 경로가 설정되지 않았습니다")
        return errors

    def start_shipping(self):
        errors = self.validate()
        if errors:
            messagebox.showerror("오류", "\n".join(errors))
            return

        if not self.git_verified:
            messagebox.showerror("오류", "먼저 브랜치를 검증해주세요")
            return

        self.start_btn.config(state=tk.DISABLED, text="진행 중...")
        self.output_text.delete(1.0, tk.END)
        self.start_timer("패키징")

        thread = threading.Thread(target=self.run_shipping)
        thread.daemon = True
        thread.start()

    def run_shipping(self):
        try:
            output_name = self.generate_output_name()
            self.log(f"출력 이름: {output_name}\n")

            # Step 1: Packaging (Git already verified)
            self.root.after(0, lambda: self.update_status('packaging'))
            if not self.run_packaging(output_name):
                return

            # Step 2: ZIP
            self.root.after(0, lambda: self.update_timer_task("압축"))
            self.root.after(0, lambda: self.update_status('zip'))
            zip_file = self.run_zip(output_name)
            if not zip_file:
                return

            # Step 3: Upload
            self.root.after(0, lambda: self.update_timer_task("업로드"))
            self.root.after(0, lambda: self.update_status('upload'))
            if not self.run_upload(zip_file, output_name):
                return

            # Complete
            self.root.after(0, lambda: self.update_status('complete'))
            self.log("\n" + "=" * 40)
            self.log("쉬핑 완료!")
            self.log("=" * 40)
            self.root.after(0, lambda: messagebox.showinfo("완료", "쉬핑이 완료되었습니다!"))

        except Exception as e:
            self.log(f"\n[오류] {str(e)}")
            self.root.after(0, lambda: messagebox.showerror("오류", str(e)))
        finally:
            self.root.after(0, self.stop_timer)
            self.root.after(0, lambda: self.start_btn.config(text="쉬핑 시작"))
            self.root.after(0, self.update_start_button_state)

    def run_git(self):
        project_path = os.path.normpath(self.config['project_path'])
        branch = self.branch_var.get()

        self.log("=== GIT 업데이트 ===")
        self.log(f"경로: {project_path}")
        self.log(f"브랜치: {branch}\n")

        def run_cmd(cmd, desc, allow_fail=False):
            self.log(f"> {desc}")
            try:
                result = subprocess.run(
                    cmd,
                    cwd=project_path,
                    shell=True,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace'
                )
                if result.stdout:
                    self.log(f"  {result.stdout.strip()}")
                if result.stderr:
                    self.log(f"  {result.stderr.strip()}")
                if result.returncode != 0:
                    self.log("  [실패]" if not allow_fail else "  [경고]")
                    return False
                self.log("  [완료]")
                return True
            except Exception as e:
                self.log(f"  [오류] {str(e)}")
                return False

        # Fetch (only when remotes exist)
        try:
            remotes_result = subprocess.run(
                "git remote",
                cwd=project_path,
                shell=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            remotes = [r.strip() for r in remotes_result.stdout.splitlines() if r.strip()]
        except Exception:
            remotes = []

        if remotes:
            if not run_cmd("git fetch --all", "가져오는 중..."):
                return False
        else:
            self.log("⚠ 원격 리모트 없음. fetch/pull 건너뜀")

        if not run_cmd(f"git checkout {branch}", f"체크아웃: {branch}"):
            return False

        # Pull only when upstream exists (allow local-only branch to pass)
        if remotes:
            upstream_check = subprocess.run(
                f"git rev-parse --abbrev-ref --symbolic-full-name {branch}@{{upstream}}",
                cwd=project_path,
                shell=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            if upstream_check.returncode == 0:
                if not run_cmd("git pull", "풀 받는 중..."):
                    return False
            else:
                self.log("⚠ 원격 추적 브랜치 없음. pull 건너뜀")

        self.log("\nGit 업데이트 완료.\n")
        return True

    def run_packaging(self, output_name):
        ue_dir = os.path.normpath(self.config['ue_engine_dir'])
        project_path = os.path.normpath(self.config['project_path'])
        output_path = os.path.normpath(self.config['output_path'])

        runuat = os.path.join(ue_dir, "Engine", "Build", "BatchFiles", "RunUAT.bat")
        default_uproject = os.path.join(project_path, "CINEVStudio.uproject")
        archive_dir = os.path.join(output_path, output_name)

        self.log("=== 패키징 ===")
        self.log(f"아카이브: {archive_dir}\n")

        # Verify RunUAT exists
        if not os.path.exists(runuat):
            self.log(f"[오류] RunUAT를 찾을 수 없음: {runuat}")
            self.log("ue_engine_dir을 올바른 언리얼 엔진 경로로 설정해주세요.")
            return False

        # Locate .uproject: prefer default, otherwise search recursively under project_path
        uproject = None
        if os.path.exists(default_uproject):
            uproject = default_uproject
            self.log(f"프로젝트 발견: {uproject}")
        else:
            self.log(f"기본 프로젝트 없음: {default_uproject}")
            self.log(f".uproject 파일 검색 중: {project_path} ...")
            matches = []
            try:
                for root, dirs, files in os.walk(project_path):
                    for f in files:
                        if f.lower().endswith('.uproject'):
                            matches.append(os.path.join(root, f))
            except Exception as e:
                self.log(f"[오류] 프로젝트 검색 실패: {e}")

            if not matches:
                self.log(f"[오류] .uproject를 찾을 수 없음: {project_path}")
                self.log("project_path가 프로젝트 루트를 가리키는지 확인해주세요.")
                return False
            # Prefer file named CINEVStudio.uproject if present
            chosen = None
            for m in matches:
                if os.path.basename(m).lower() == 'cinevstudio.uproject':
                    chosen = m
                    break
            if not chosen:
                chosen = matches[0]
                self.log(f"여러 .uproject 발견, 사용: {chosen}")
            else:
                self.log(f".uproject 위치: {chosen}")
            uproject = chosen

        cmd = (
            f'"{runuat}" BuildCookRun '
            f'-project="{uproject}" '
            f'-noP4 -platform=Win64 -clientconfig=Shipping '
            f'-build -cook -stage -pak -archive '
            f'-archivedirectory="{archive_dir}"'
        )

        self.log("UAT 실행 중...")
        self.log(f"명령어: {cmd}\n")

        try:
            process = subprocess.Popen(
                cmd,
                shell=True,
                cwd=project_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1
            )

            last_heartbeat = time.time()
            line_count = 0

            for line in iter(process.stdout.readline, ''):
                line = line.rstrip()
                if not line:
                    continue

                line_count += 1

                # Log important lines
                line_lower = line.lower()
                if any(kw in line_lower for kw in ['error', 'warning', 'failed', 'success', 'complete']):
                    self.log(f"  {line}")
                elif 'cook' in line_lower or 'stage' in line_lower or 'pak' in line_lower:
                    self.log(f"  {line}")

                # Heartbeat every 30 seconds
                now = time.time()
                if now - last_heartbeat >= 30:
                    self.log_heartbeat(f"처리 중... ({line_count} 줄)")
                    last_heartbeat = now

            process.wait()

            if process.returncode == 0:
                self.log("\n[완료] 패키징 완료.\n")
                return True
            else:
                self.log(f"\n[실패] 종료 코드: {process.returncode}")
                appdata = os.getenv('APPDATA') or ''
                if appdata:
                    at_log = os.path.join(appdata, 'Unreal Engine', 'AutomationTool', 'Logs')
                    self.log(f"로그 확인: {at_log}")
                return False
        except Exception as e:
            self.log(f"[오류] {str(e)}")
            return False

    def run_zip(self, output_name):
        """Create ZIP file. Returns zip_file path on success, None on failure."""
        output_path = os.path.normpath(self.config['output_path'])

        package_dir = os.path.join(output_path, output_name)
        zip_base = os.path.join(output_path, output_name)
        zip_file = f"{zip_base}.zip"

        self.log("=== 압축 ===")

        if not os.path.exists(package_dir):
            self.log(f"[오류] 폴더 없음: {package_dir}")
            return None

        self.log(f"ZIP 생성 중: {zip_file}")
        try:
            shutil.make_archive(zip_base, 'zip', output_path, output_name)
            self.log("[완료] ZIP 생성 완료.\n")
            return zip_file
        except Exception as e:
            self.log(f"[오류] {str(e)}")
            return None

    def run_upload(self, zip_file, output_name):
        """Upload ZIP to NAS."""
        nas_path = self.config.get('nas_path', '')

        self.log("=== 업로드 ===")

        if not nas_path:
            self.log("[건너뜀] NAS 미설정.")
            return True

        self.log(f"업로드 경로: {nas_path}")
        try:
            if not os.path.exists(nas_path):
                self.log("[경고] NAS 접근 불가. 건너뜀.")
                return True
            else:
                dest = os.path.join(nas_path, f"{output_name}.zip")
                shutil.copy(zip_file, dest)
                self.log(f"[완료] 업로드됨: {dest}\n")
                return True
        except Exception as e:
            self.log(f"[오류] {str(e)}")
            return False


if __name__ == "__main__":
    root = tk.Tk()
    app = ShippingGUI(root)
    root.mainloop()
