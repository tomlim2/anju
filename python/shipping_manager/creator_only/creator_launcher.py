"""CINEV Creator Launcher - 최신 빌드 자동 다운로드 및 실행"""
import tkinter as tk
from tkinter import messagebox
import os
import json
import zipfile
import subprocess
import glob
import shutil
import threading
import time

VERSION = "1.2.0"


class CreatorLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title(f"CINEV Creator Launcher v{VERSION}")
        self.root.geometry("600x320")
        self.root.configure(bg='white')

        # config 파일 경로
        self.config_file = os.path.join(os.path.dirname(__file__), "config.json")
        self.shipper_config_file = os.path.join(
            os.path.dirname(__file__), "..", "shipper", "shipping_config.json"
        )
        self.config = self.load_config()
        self.history_file = os.path.join(os.path.dirname(__file__), "update_history.json")

        self.create_widgets()
        self.check_status()
        self.start_process_monitor()

    def load_config(self):
        config = {
            "nas_path": "\\\\nas.cinamon.me\\CineV\\11_Cinema\\CINEVPackageCO",
            "project_save_path": "",
            "access_key": "CompanyName.Divorce"
        }
        # 로컬 config.json 로드
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    config.update(loaded)
            except Exception:
                pass
        # nas_path가 비어있으면 shipper config에서 가져옴
        if not config.get('nas_path'):
            if os.path.exists(self.shipper_config_file):
                try:
                    with open(self.shipper_config_file, 'r', encoding='utf-8') as f:
                        loaded = json.load(f)
                        if 'nas_path' in loaded:
                            config['nas_path'] = loaded['nas_path']
                except Exception:
                    pass
        return config

    def get_base_path(self):
        """스크립트 위치 기준 base path"""
        return os.path.dirname(os.path.abspath(__file__))

    def get_studio_path(self):
        """CinevVStudio 폴더 경로 (빌드 저장 위치)"""
        return os.path.join(self.get_base_path(), "CinevVStudio")

    def get_project_name(self):
        """access_key 기반 프로젝트 이름 반환"""
        access_key = self.config.get('access_key', '')
        if 'Divorce' in access_key:
            return "프로젝트 무조건 이혼한다"
        elif 'BSWorld' in access_key:
            return "프로젝트 남매지만 괜찮아"
        else:
            return "Creator Mode"

    def create_widgets(self):
        outer = tk.Frame(self.root, bg='white')
        outer.pack(fill=tk.BOTH, expand=True)

        main_frame = tk.Frame(outer, bg='white', padx=30)
        main_frame.place(relx=0.5, rely=0.5, anchor='center')

        # Title
        title = tk.Label(main_frame, text="CINEV Creator Launcher",
                         font=('Arial', 24, 'bold'), bg='white', fg='black')
        title.pack(pady=(0, 5))

        # Project name subtitle
        project_name = tk.Label(main_frame, text=self.get_project_name(),
                                font=('Arial', 16), bg='white', fg='#666666')
        project_name.pack(pady=(0, 36))

        # Launch button
        self.launch_btn = tk.Button(main_frame, text="CINEV 시작",
                                    command=self.launch,
                                    bg='black', fg='white', relief=tk.FLAT,
                                    font=('Arial', 12, 'bold'),
                                    padx=40, cursor='hand2')
        self.launch_btn.pack(ipady=12)

        # Status label
        self.status_label = tk.Label(main_frame, text="",
                                     font=('Arial', 8), bg='white', fg='#666666')
        self.status_label.pack(pady=(4, 0))

    def get_latest_zip(self, nas_path):
        """NAS에서 가장 최신 .zip 파일 찾기 (파일명 기준 정렬)"""
        if not os.path.exists(nas_path):
            return None

        zip_files = glob.glob(os.path.join(nas_path, "*.zip"))
        if not zip_files:
            return None

        zip_files.sort(key=lambda x: os.path.basename(x), reverse=True)
        return zip_files[0]

    def get_folder_name_from_zip(self, zip_path):
        """ZIP 파일명에서 폴더명 추출"""
        return os.path.splitext(os.path.basename(zip_path))[0]

    def check_status(self):
        """현재 상태 확인"""
        nas_path = self.config.get('nas_path', '')
        studio_path = self.get_studio_path()

        if not nas_path or not os.path.exists(nas_path):
            self.status_label.config(text="NAS 연결 필요", fg='#cc0000')
            return

        latest_zip = self.get_latest_zip(nas_path)
        if not latest_zip:
            self.status_label.config(text="NAS에 빌드 없음", fg='#cc0000')
            return

        folder_name = self.get_folder_name_from_zip(latest_zip)
        local_folder = os.path.join(studio_path, folder_name)
        exe_path = os.path.join(local_folder, "Windows", "CINEVStudio.exe")

        if os.path.exists(exe_path):
            self.status_label.config(text=f"실행 준비 완료 ({folder_name})", fg='#00aa00')
            self.launch_btn.config(text="CINEV 시작", bg='black')
        else:
            self.status_label.config(text=f"최신화 필요 ({folder_name})", fg='#ff8800')
            self.launch_btn.config(text="업데이트하기", bg='#ff8800')

    def load_history(self):
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def save_history(self, duration):
        history = self.load_history()
        history.append({"duration": round(duration, 1)})
        # 최근 10개만 유지
        history = history[-10:]
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f)

    def get_estimated_time(self):
        history = self.load_history()
        if not history:
            return None
        durations = [h["duration"] for h in history]
        return round(sum(durations) / len(durations))

    def format_time(self, seconds):
        if seconds < 60:
            return f"{seconds}초"
        m, s = divmod(seconds, 60)
        return f"{m}분 {s}초"

    def update_status(self, text, color='#666666'):
        """스레드 안전한 상태 업데이트"""
        self.root.after(0, lambda: self.status_label.config(text=text, fg=color))

    def is_process_running(self, process_name="CINEVStudio.exe"):
        """프로세스가 실행 중인지 확인"""
        try:
            result = subprocess.run(
                f'tasklist /FI "IMAGENAME eq {process_name}" /NH',
                shell=True, capture_output=True, text=True,
                encoding='utf-8', errors='replace'
            )
            return process_name.lower() in result.stdout.lower()
        except Exception:
            return False

    def start_process_monitor(self):
        """프로세스 모니터링 시작 (3초마다 체크)"""
        self.monitor_process()

    def monitor_process(self):
        """프로세스 상태 확인 및 UI 업데이트"""
        if self.is_process_running():
            self.status_label.config(text="CINEV 실행 중...", fg='#0066cc')
            self.launch_btn.config(state=tk.DISABLED, text="실행 중")
        else:
            # 실행 중이 아니면 일반 상태 체크
            self.launch_btn.config(state=tk.NORMAL)
            self.check_status()

        # 3초 후 다시 체크
        self.root.after(3000, self.monitor_process)

    def launch(self):
        nas_path = self.config.get('nas_path', '')

        if not nas_path:
            messagebox.showerror("오류", "NAS 경로가 설정되지 않았습니다.\nconfig.json을 확인하세요.")
            return

        self.launch_btn.config(state=tk.DISABLED, text="처리 중...")

        thread = threading.Thread(target=self.run_launch)
        thread.daemon = True
        thread.start()

    def run_launch(self):
        nas_path = self.config.get('nas_path', '')
        studio_path = self.get_studio_path()

        try:
            latest_zip = self.get_latest_zip(nas_path)
            if not latest_zip:
                self.root.after(0, lambda: messagebox.showerror("오류", f"NAS에 .zip 파일이 없습니다.\n{nas_path}"))
                return

            folder_name = self.get_folder_name_from_zip(latest_zip)
            local_folder = os.path.join(studio_path, folder_name)
            exe_path = os.path.join(local_folder, "Windows", "CINEVStudio.exe")

            if not os.path.exists(exe_path):
                # CinevVStudio 폴더 생성
                os.makedirs(studio_path, exist_ok=True)

                est = self.get_estimated_time()
                est_msg = f" (예상 {self.format_time(est)})" if est else ""
                start_time = time.time()

                # 파일 전송 (NAS → 로컬)
                self.update_status(f"파일전송 중...{est_msg}", '#0066cc')

                local_zip = os.path.join(studio_path, os.path.basename(latest_zip))
                shutil.copy2(latest_zip, local_zip)

                # 압축 해제 (로컬에서)
                elapsed = round(time.time() - start_time)
                if est:
                    remaining = max(0, est - elapsed)
                    self.update_status(f"압축풀기 중... (약 {self.format_time(remaining)} 남음)", '#0066cc')
                else:
                    self.update_status("압축풀기 중...", '#0066cc')

                with zipfile.ZipFile(local_zip, 'r') as zf:
                    zf.extractall(studio_path)

                # 셋팅 (임시 파일 정리)
                self.update_status("셋팅 중...", '#0066cc')

                os.remove(local_zip)

                # 소요 시간 기록
                total_duration = time.time() - start_time
                self.save_history(total_duration)

                if not os.path.exists(exe_path):
                    self.root.after(0, lambda: messagebox.showerror("오류", f"EXE를 찾을 수 없습니다.\n{exe_path}"))
                    return

            # 실행
            project_save_path = self.config.get('project_save_path', '') or studio_path
            access_key = self.config.get('access_key', '')

            cmd = f'start "" "{exe_path}" -ProjectSavePath={project_save_path}'
            if access_key:
                cmd += f' -AccessKey={access_key}'
            subprocess.run(cmd, shell=True)

            self.update_status(f"실행 준비 완료 ({folder_name})", '#00aa00')

        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("오류", str(e)))
            self.update_status("오류 발생", '#cc0000')
            self.root.after(0, lambda: self.launch_btn.config(state=tk.NORMAL))


if __name__ == "__main__":
    root = tk.Tk()
    app = CreatorLauncher(root)
    root.mainloop()
