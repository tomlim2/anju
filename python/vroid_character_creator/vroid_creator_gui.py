"""
VRoid Character Creator — UE 없이 .character 파일 생성 + assets.info 등록
VRoid 전용. VRM 내장 메타(이름/썸네일) 자동 추출.
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import struct
import uuid


CONFIG_FILE = os.path.join(os.path.dirname(__file__), "vroid_creator_config.json")

# 1x1 투명 PNG (썸네일 추출 실패 시 fallback)
EMPTY_THUMB_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def read_vrm_json(vrm_path):
    """VRM (glTF 2.0) 파일에서 JSON chunk 파싱"""
    with open(vrm_path, "rb") as f:
        # glTF header: magic(4) + version(4) + length(4)
        magic = f.read(4)
        if magic != b"glTF":
            return None
        f.read(4)  # version
        f.read(4)  # total length
        # Chunk 0: JSON
        chunk_len = struct.unpack("<I", f.read(4))[0]
        chunk_type = f.read(4)  # b"JSON"
        if chunk_type != b"JSON":
            return None
        json_bytes = f.read(chunk_len)
        return json.loads(json_bytes.decode("utf-8"))


def extract_vrm_meta(vrm_path):
    """VRM에서 title과 썸네일 바이너리 추출.
    Returns (title: str|None, thumb_data: bytes|None)
    """
    gltf = read_vrm_json(vrm_path)
    if not gltf:
        return None, None

    vrm_ext = gltf.get("extensions", {}).get("VRM", {})
    meta = vrm_ext.get("meta", {})
    title = meta.get("title") or None

    # 썸네일: meta.texture → textures[idx].source → images[idx]
    thumb_data = None
    tex_idx = meta.get("texture")
    if tex_idx is not None:
        textures = gltf.get("textures", [])
        if tex_idx < len(textures):
            img_idx = textures[tex_idx].get("source")
            if img_idx is not None:
                images = gltf.get("images", [])
                if img_idx < len(images):
                    img = images[img_idx]
                    bv_idx = img.get("bufferView")
                    if bv_idx is not None:
                        bvs = gltf.get("bufferViews", [])
                        if bv_idx < len(bvs):
                            bv = bvs[bv_idx]
                            offset = bv.get("byteOffset", 0)
                            length = bv["byteLength"]
                            # BIN chunk starts after JSON chunk
                            with open(vrm_path, "rb") as f:
                                f.read(12)  # glTF header
                                json_chunk_len = struct.unpack("<I", f.read(4))[0]
                                f.read(4)  # JSON type
                                f.read(json_chunk_len)  # skip JSON data
                                # BIN chunk header
                                f.read(4)  # bin chunk len
                                f.read(4)  # bin chunk type (b"BIN\x00")
                                bin_start = f.tell()
                                f.seek(bin_start + offset)
                                thumb_data = f.read(length)

    return title, thumb_data


def create_character_file(output_path, vrm_path, metadata, thumb_data=None):
    """순수 Python으로 .character 바이너리 생성"""
    vrm_name = os.path.basename(vrm_path)

    meta_json = json.dumps(metadata, indent="\t", ensure_ascii=False)
    # UE FBufferArchive: CRLF + trailing space
    meta_json = meta_json.replace("\n", "\r\n") + " "
    meta_bytes = meta_json.encode("utf-8")

    header = b"CINEV_CHAR_V1\x00"
    vrm_name_bytes = vrm_name.encode("utf-8") + b"\x00"

    with open(vrm_path, "rb") as f:
        vrm_data = f.read()

    if thumb_data is None:
        thumb_data = EMPTY_THUMB_PNG

    with open(output_path, "wb") as f:
        f.write(struct.pack("<I", len(header)))
        f.write(header)
        f.write(struct.pack("<I", len(meta_bytes)))
        f.write(meta_bytes)
        f.write(struct.pack("<I", len(vrm_name_bytes)))
        f.write(vrm_name_bytes)
        f.write(struct.pack("<I", len(vrm_data)))
        f.write(vrm_data)
        f.write(struct.pack("<I", len(thumb_data)))
        f.write(thumb_data)


class VRoidCreatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("VRoid Character Creator")
        self.root.geometry("700x650")
        self.root.minsize(600, 500)
        self.root.configure(bg="white")

        self.user_char_folder_var = tk.StringVar()
        self.gender_var = tk.StringVar(value="Female")
        self.scaling_var = tk.StringVar(value="Original")
        self.pending_vrm_files = []
        self.vrm_meta_cache = {}  # vrm_path → (title, thumb_data)

        self.load_config()
        self.create_widgets()

        self.user_char_folder_var.trace_add("write", lambda *_: self.save_config())

    # ── Config ──

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            self.user_char_folder_var.set(cfg.get("user_char_folder", ""))

    def save_config(self):
        cfg = {"user_char_folder": self.user_char_folder_var.get()}
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)

    # ── UI ──

    def create_widgets(self):
        main = tk.Frame(self.root, bg="white", padx=16, pady=16)
        main.pack(fill=tk.BOTH, expand=True)

        # Title
        tk.Label(main, text="VRoid Character Creator",
                 font=("Arial", 16, "bold"), bg="white").pack(anchor="w")
        tk.Label(main, text="UE 없이 .character 생성 → assets.info 등록 (VRM 내장 이름/썸네일 자동 추출)",
                 font=("Arial", 9), bg="white", fg="#888").pack(anchor="w", pady=(0, 12))

        # UserCharacter folder
        folder_frame = tk.LabelFrame(main, text="UserCharacter 폴더",
                                     font=("Arial", 10, "bold"), bg="white", padx=10, pady=8)
        folder_frame.pack(fill=tk.X, pady=(0, 10))

        row = tk.Frame(folder_frame, bg="white")
        row.pack(fill=tk.X)
        tk.Entry(row, textvariable=self.user_char_folder_var, bg="white",
                 relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        tk.Button(row, text="찾아보기", command=self.browse_folder,
                  bg="white", relief=tk.SOLID, borderwidth=1, padx=8, cursor="hand2"
                  ).pack(side=tk.LEFT)
        tk.Button(row, text="열기", command=self.open_folder,
                  bg="white", relief=tk.SOLID, borderwidth=1, padx=8, cursor="hand2"
                  ).pack(side=tk.LEFT, padx=(4, 0))

        self.folder_status = tk.Label(folder_frame, text="", bg="white", fg="#888", font=("Arial", 8))
        self.folder_status.pack(anchor="w", pady=(4, 0))

        # VRM selection
        reg_frame = tk.LabelFrame(main, text="VRM 등록",
                                  font=("Arial", 10, "bold"), bg="white", padx=10, pady=8)
        reg_frame.pack(fill=tk.X, pady=(0, 10))

        pick_row = tk.Frame(reg_frame, bg="white")
        pick_row.pack(fill=tk.X, pady=(0, 5))
        tk.Button(pick_row, text="VRM 파일 선택", command=self.pick_vrm,
                  bg="white", relief=tk.SOLID, borderwidth=1, padx=10, cursor="hand2"
                  ).pack(side=tk.LEFT)
        tk.Button(pick_row, text="선택 제거", command=self.remove_selected,
                  bg="white", relief=tk.SOLID, borderwidth=1, padx=10, cursor="hand2"
                  ).pack(side=tk.LEFT, padx=(5, 0))
        self.count_label = tk.Label(pick_row, text="선택된 파일 없음",
                                    bg="white", fg="#999", font=("Arial", 9))
        self.count_label.pack(side=tk.LEFT, padx=(10, 0))

        self.vrm_listbox = tk.Listbox(reg_frame, height=5, bg="white",
                                       relief=tk.SOLID, borderwidth=1,
                                       font=("Consolas", 9), selectmode=tk.EXTENDED)
        self.vrm_listbox.pack(fill=tk.X, pady=(0, 5))

        # Options
        opt_row = tk.Frame(reg_frame, bg="white")
        opt_row.pack(fill=tk.X, pady=3)
        tk.Label(opt_row, text="성별:", width=10, anchor="w", bg="white").pack(side=tk.LEFT)
        ttk.Combobox(opt_row, textvariable=self.gender_var,
                     values=["Female", "Male"], state="readonly", width=20).pack(side=tk.LEFT, padx=5)

        scale_row = tk.Frame(reg_frame, bg="white")
        scale_row.pack(fill=tk.X, pady=3)
        tk.Label(scale_row, text="스케일링:", width=10, anchor="w", bg="white").pack(side=tk.LEFT)
        ttk.Combobox(scale_row, textvariable=self.scaling_var,
                     values=["Original", "CineV"], state="readonly", width=20).pack(side=tk.LEFT, padx=5)

        src_row = tk.Frame(reg_frame, bg="white")
        src_row.pack(fill=tk.X, pady=3)
        tk.Label(src_row, text="모델 소스:", width=10, anchor="w", bg="white").pack(side=tk.LEFT)
        tk.Label(src_row, text="VRoid (고정)", bg="white", fg="#666",
                 font=("Arial", 9)).pack(side=tk.LEFT, padx=5)

        # Register button
        self.reg_btn = tk.Button(reg_frame, text="등록", command=self.register,
                                  bg="#0066CC", fg="white", relief=tk.FLAT,
                                  font=("Arial", 11, "bold"), padx=30, pady=8, cursor="hand2")
        self.reg_btn.pack(pady=(8, 5))

        # Log
        log_frame = tk.LabelFrame(main, text="로그", font=("Arial", 10, "bold"),
                                  bg="white", padx=10, pady=8)
        log_frame.pack(fill=tk.BOTH, expand=True)

        self.log_text = tk.Text(log_frame, height=8, bg="white", relief=tk.SOLID,
                                borderwidth=1, font=("Consolas", 9), state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True)

        self.update_folder_status()

    def log(self, msg):
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)

    # ── Actions ──

    def browse_folder(self):
        path = filedialog.askdirectory(title="UserCharacter 폴더 선택")
        if path:
            self.user_char_folder_var.set(os.path.normpath(path))
            self.update_folder_status()

    def open_folder(self):
        folder = self.user_char_folder_var.get()
        if folder and os.path.isdir(folder):
            os.startfile(folder)

    def update_folder_status(self):
        folder = self.user_char_folder_var.get()
        if not folder or not os.path.isdir(folder):
            self.folder_status.config(text="폴더를 설정해주세요", fg="#CC0000")
            return
        assets_path = os.path.join(folder, "assets.info")
        if os.path.exists(assets_path):
            with open(assets_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.folder_status.config(text=f"assets.info: {len(data)}개 캐릭터", fg="#666")
        else:
            self.folder_status.config(text="assets.info 없음 (새로 생성됩니다)", fg="#888")

    def pick_vrm(self):
        folder = self.user_char_folder_var.get()
        initial = folder if folder and os.path.isdir(folder) else None
        files = filedialog.askopenfilenames(
            title="VRM 파일 선택",
            initialdir=initial,
            filetypes=[("VRM Files", "*.vrm"), ("All Files", "*.*")]
        )
        if not files:
            return
        self.pending_vrm_files = [os.path.normpath(f) for f in files]
        self.vrm_meta_cache.clear()
        self.vrm_listbox.delete(0, tk.END)
        for f in self.pending_vrm_files:
            title, thumb = extract_vrm_meta(f)
            self.vrm_meta_cache[f] = (title, thumb)
            basename = os.path.basename(f)
            label = f"{basename}  [{title}]" if title else basename
            self.vrm_listbox.insert(tk.END, label)
        self.count_label.config(text=f"{len(self.pending_vrm_files)}개 선택됨", fg="black")

    def remove_selected(self):
        sel = list(self.vrm_listbox.curselection())
        if not sel:
            return
        for i in reversed(sel):
            self.vrm_listbox.delete(i)
            removed = self.pending_vrm_files.pop(i)
            self.vrm_meta_cache.pop(removed, None)
        n = len(self.pending_vrm_files)
        self.count_label.config(
            text=f"{n}개 선택됨" if n else "선택된 파일 없음",
            fg="black" if n else "#999")

    def register(self):
        if not self.pending_vrm_files:
            messagebox.showwarning("경고", "VRM 파일을 선택하세요.")
            return

        folder = self.user_char_folder_var.get()
        if not folder or not os.path.isdir(folder):
            messagebox.showerror("오류", "UserCharacter 폴더를 설정하세요.")
            return

        # Load existing assets.info
        assets_path = os.path.join(folder, "assets.info")
        if os.path.exists(assets_path):
            with open(assets_path, "r", encoding="utf-8") as f:
                assets_data = json.load(f)
        else:
            assets_data = []

        gender = self.gender_var.get()
        scaling = self.scaling_var.get()
        added = 0

        for i, vrm_path in enumerate(self.pending_vrm_files):
            vrm_name = os.path.basename(vrm_path)
            stem = os.path.splitext(vrm_name)[0]

            # VRM 내장 메타 추출
            title, thumb_data = self.vrm_meta_cache.get(vrm_path, (None, None))
            if title is None and thumb_data is None:
                title, thumb_data = extract_vrm_meta(vrm_path)

            # displayName: VRM 내장 title → 파일명 fallback (12자 제한)
            display_name = (title or stem)[:12]

            self.log(f"\n[{i+1}/{len(self.pending_vrm_files)}] {vrm_name}")
            if title:
                self.log(f"  VRM 내장 이름: {title}")

            # VRM이 UserCharacter 폴더에 없으면 복사
            vrm_dest = os.path.join(folder, vrm_name)
            if os.path.normpath(vrm_path) != os.path.normpath(vrm_dest):
                import shutil
                shutil.copy2(vrm_path, vrm_dest)
                self.log(f"  VRM 복사 → UserCharacter/")

            # 썸네일 로그
            if thumb_data:
                thumb_kb = len(thumb_data) / 1024
                self.log(f"  VRM 내장 썸네일 ({thumb_kb:.0f} KB) → .character에 삽입")
            else:
                self.log(f"  썸네일 없음 (빈 이미지 사용)")

            # .character 생성
            char_name = f"{stem}.character"
            char_path = os.path.join(folder, char_name)

            metadata = {
                "format": "VRM",
                "gender": gender,
                "displayName": display_name,
                "vRMFileName": vrm_name,
                "scalingMethod": scaling,
                "modelSourceType": "VRoid",
            }

            create_character_file(char_path, vrm_dest, metadata, thumb_data)
            size_mb = os.path.getsize(char_path) / (1024 * 1024)
            self.log(f"  .character 생성: {char_name} ({size_mb:.1f} MB)")

            # assets.info에 추가
            preset_id = str(uuid.uuid4())
            entry = {
                "Preset_id": preset_id,
                "Gender": gender,
                "DisplayName": display_name,
                "CharacterFilePath": char_name,
                "CategoryName": "CharacterCategory.VRM",
                "ThumbnailFileName": "",
            }
            assets_data.insert(0, entry)
            added += 1
            self.log(f"  assets.info 등록 완료 (ID: {preset_id[:8]}...)")

        # Save assets.info
        with open(assets_path, "w", encoding="utf-8") as f:
            json.dump(assets_data, f, indent=2, ensure_ascii=False)

        self.log(f"\n=== {added}개 등록 완료 ===")
        self.update_folder_status()

        # Clear list
        self.pending_vrm_files = []
        self.vrm_meta_cache.clear()
        self.vrm_listbox.delete(0, tk.END)
        self.count_label.config(text="선택된 파일 없음", fg="#999")

        messagebox.showinfo("완료", f"{added}개 VRoid 캐릭터 등록 완료")


if __name__ == "__main__":
    root = tk.Tk()
    app = VRoidCreatorGUI(root)
    root.mainloop()
