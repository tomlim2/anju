"""CINEV Creator Launcher - 최신 빌드 자동 다운로드 및 실행"""
import tkinter as tk
from tkinter import messagebox
import os
import json
import zipfile
import shutil
import subprocess
import glob


class CreatorLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("CINEV Creator Launcher")
        self.root.geometry("500x300")
        self.root.configure(bg='white')

        self.config_file = os.path.join(os.path.dirname(__file__), "config.json")
        self.config = self.load_config()

        self.create_widgets()

    def load_config(self):
        default_config = {
            "nas_path": "",
            "project_path": "D:\\CINEVProject"
        }
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    default_config.update(loaded)
            except Exception:
                pass
        return default_config

    def save_config(self):
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

    def create_widgets(self):
        main_frame = tk.Frame(self.root, bg='white', padx=30, pady=30)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(main_frame, text="CINEV Creator Launcher",
                         font=('Arial', 16, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 30))

        # NAS path
        nas_frame = tk.Frame(main_frame, bg='white')
        nas_frame.pack(fill=tk.X, pady=(0, 10))
        tk.Label(nas_frame, text="NAS 경로:", font=('Arial', 10),
                 bg='white', width=12, anchor='w').pack(side=tk.LEFT)
        self.nas_entry = tk.Entry(nas_frame, font=('Arial', 10), bg='white',
                                  relief=tk.SOLID, borderwidth=1)
        self.nas_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.nas_entry.insert(0, self.config.get('nas_path', ''))

        # Project path
        proj_frame = tk.Frame(main_frame, bg='white')
        proj_frame.pack(fill=tk.X, pady=(0, 20))
        tk.Label(proj_frame, text="프로젝트 경로:", font=('Arial', 10),
                 bg='white', width=12, anchor='w').pack(side=tk.LEFT)
        self.proj_entry = tk.Entry(proj_frame, font=('Arial', 10), bg='white',
                                   relief=tk.SOLID, borderwidth=1)
        self.proj_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.proj_entry.insert(0, self.config.get('project_path', ''))

        # Status label
        self.status_label = tk.Label(main_frame, text="", font=('Arial', 9),
                                     bg='white', fg='#666666')
        self.status_label.pack(pady=(0, 10))

        # Launch button
        self.launch_btn = tk.Button(main_frame, text="CINEV 시작",
                                    command=self.launch,
                                    bg='black', fg='white', relief=tk.FLAT,
                                    font=('Arial', 14, 'bold'),
                                    padx=40, pady=15, cursor='hand2')
        self.launch_btn.pack(pady=(10, 0))

    def update_status(self, message, color='#666666'):
        self.status_label.config(text=message, fg=color)
        self.root.update()

    def get_latest_zip(self, nas_path):
        """NAS에서 가장 최신 .zip 파일 찾기 (파일명 기준 정렬)"""
        if not os.path.exists(nas_path):
            return None

        zip_files = glob.glob(os.path.join(nas_path, "*.zip"))
        if not zip_files:
            return None

        # 파일명 기준 내림차순 정렬 (최신이 먼저)
        zip_files.sort(key=lambda x: os.path.basename(x), reverse=True)
        return zip_files[0]

    def get_folder_name_from_zip(self, zip_path):
        """ZIP 파일명에서 폴더명 추출 (확장자 제외)"""
        return os.path.splitext(os.path.basename(zip_path))[0]

    def launch(self):
        # Save config
        self.config['nas_path'] = self.nas_entry.get().strip()
        self.config['project_path'] = self.proj_entry.get().strip()
        self.save_config()

        nas_path = self.config['nas_path']
        project_path = self.config['project_path']

        # Validate paths
        if not nas_path:
            messagebox.showerror("오류", "NAS 경로를 입력해주세요.")
            return
        if not project_path:
            messagebox.showerror("오류", "프로젝트 경로를 입력해주세요.")
            return

        self.launch_btn.config(state=tk.DISABLED, text="처리 중...")

        try:
            # 1. NAS에서 최신 ZIP 찾기
            self.update_status("NAS에서 최신 빌드 검색 중...")
            latest_zip = self.get_latest_zip(nas_path)

            if not latest_zip:
                messagebox.showerror("오류", f"NAS에 .zip 파일이 없습니다.\n{nas_path}")
                return

            folder_name = self.get_folder_name_from_zip(latest_zip)
            self.update_status(f"최신 빌드: {folder_name}")

            # 2. 로컬에 해당 폴더가 있는지 확인
            local_folder = os.path.join(project_path, folder_name)
            exe_path = os.path.join(local_folder, "Windows", "CINEVStudio.exe")

            if os.path.exists(local_folder) and os.path.exists(exe_path):
                # 이미 있음 - 바로 실행
                self.update_status(f"로컬에 존재: {folder_name}", '#00aa00')
            else:
                # 없음 - 다운로드 및 압축 해제
                self.update_status(f"다운로드 중: {folder_name}...")

                # 프로젝트 경로 생성
                os.makedirs(project_path, exist_ok=True)

                # ZIP 압축 해제
                self.update_status(f"압축 해제 중: {folder_name}...")
                with zipfile.ZipFile(latest_zip, 'r') as zf:
                    zf.extractall(project_path)

                # 압축 해제 후 EXE 확인
                if not os.path.exists(exe_path):
                    messagebox.showerror("오류", f"EXE 파일을 찾을 수 없습니다.\n{exe_path}")
                    return

                self.update_status(f"다운로드 완료: {folder_name}", '#00aa00')

            # 3. 프로젝트 실행
            self.update_status("CINEV 시작 중...")
            cmd = f'start "" "{exe_path}" -ProjectSavePath={project_path}'
            subprocess.run(cmd, shell=True)

            self.update_status(f"실행 완료: {folder_name}", '#00aa00')

        except Exception as e:
            messagebox.showerror("오류", str(e))
            self.update_status(f"오류: {e}", '#cc0000')
        finally:
            self.launch_btn.config(state=tk.NORMAL, text="CINEV 시작")


if __name__ == "__main__":
    root = tk.Tk()
    app = CreatorLauncher(root)
    root.mainloop()
