"""
VRoid Character Creator — UE 없이 .character 파일 생성 + assets.info 등록
VRoid 전용. VRM 내장 메타(이름/썸네일) 자동 추출.
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import shutil
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


def _read_image_from_buffer(vrm_path, gltf, img_idx):
    """glTF images[img_idx]의 bufferView에서 바이너리 데이터 읽기"""
    images = gltf.get("images", [])
    if img_idx is None or img_idx >= len(images):
        return None
    bv_idx = images[img_idx].get("bufferView")
    if bv_idx is None:
        return None
    bvs = gltf.get("bufferViews", [])
    if bv_idx >= len(bvs):
        return None
    bv = bvs[bv_idx]
    offset = bv.get("byteOffset", 0)
    length = bv["byteLength"]
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
        return f.read(length)


def extract_vrm_meta(vrm_path):
    """VRM 0.x / 1.0 에서 title과 썸네일 바이너리 추출.
    Returns (title: str|None, thumb_data: bytes|None)
    """
    gltf = read_vrm_json(vrm_path)
    if not gltf:
        return None, None

    extensions = gltf.get("extensions", {})
    title = None
    thumb_data = None

    # VRM 1.0: extensions.VRMC_vrm.meta
    vrmc = extensions.get("VRMC_vrm", {})
    if vrmc:
        meta = vrmc.get("meta", {})
        title = meta.get("name") or None
        # thumbnailImage → images[idx] 직접 참조
        img_idx = meta.get("thumbnailImage")
        if img_idx is not None:
            thumb_data = _read_image_from_buffer(vrm_path, gltf, img_idx)

    # VRM 0.x: extensions.VRM.meta
    if not vrmc:
        vrm0 = extensions.get("VRM", {})
        meta = vrm0.get("meta", {})
        title = meta.get("title") or None
        # texture → textures[idx].source → images[idx]
        tex_idx = meta.get("texture")
        if tex_idx is not None:
            textures = gltf.get("textures", [])
            if tex_idx < len(textures):
                img_idx = textures[tex_idx].get("source")
                thumb_data = _read_image_from_buffer(vrm_path, gltf, img_idx)

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
        self.root.geometry("1400x950")
        self.root.minsize(1024, 800)
        self.root.configure(bg="white")

        self.user_char_folder_var = tk.StringVar()
        self.gender_var = tk.StringVar(value="Female")
        self.scaling_var = tk.StringVar(value="Original")
        self.pending_vrm_files = []
        self.vrm_meta_cache = {}  # vrm_path → (title, thumb_data)
        self.assets_data = []
        self.selected_asset_idx = None

        self.load_config()
        self.create_widgets()

        self.user_char_folder_var.trace_add("write", lambda *_: self.save_config())

    # ── Config ──

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            self.user_char_folder_var.set(cfg.get("user_char_folder", ""))

        # Auto-load assets.info if available
        folder = self.user_char_folder_var.get()
        if folder:
            assets_path = os.path.join(folder, "assets.info")
            if os.path.exists(assets_path):
                try:
                    with open(assets_path, "r", encoding="utf-8") as f:
                        self.assets_data = json.load(f)
                except Exception:
                    pass

    def save_config(self):
        cfg = {"user_char_folder": self.user_char_folder_var.get()}
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)

    # ── UI ──

    def create_widgets(self):
        main = tk.Frame(self.root, bg="white", padx=16, pady=16)
        main.pack(fill=tk.BOTH, expand=True)

        # Title bar
        title_bar = tk.Frame(main, bg="white")
        title_bar.pack(fill=tk.X, pady=(0, 12))
        tk.Label(title_bar, text="VRoid Character Creator",
                 font=("Arial", 16, "bold"), bg="white").pack(side=tk.LEFT)
        tk.Label(title_bar, text="UE 없이 .character 생성 → assets.info 등록 (VRM 내장 이름/썸네일 자동 추출)",
                 font=("Arial", 9), bg="white", fg="#888").pack(side=tk.LEFT, padx=(10, 0))

        # UserCharacter folder (shared across both panes)
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

        # 2-column layout
        columns_frame = tk.Frame(main, bg="white")
        columns_frame.pack(fill=tk.BOTH, expand=True)
        columns_frame.columnconfigure(0, weight=1)
        columns_frame.columnconfigure(1, weight=1)
        columns_frame.rowconfigure(0, weight=1)

        # === LEFT PANE: VRM registration ===
        left_pane = tk.Frame(columns_frame, bg="white", padx=(0))
        left_pane.grid(row=0, column=0, sticky="nsew", padx=(0, 5))

        # VRM selection
        reg_frame = tk.LabelFrame(left_pane, text="VRM 등록",
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
        log_frame = tk.LabelFrame(left_pane, text="로그", font=("Arial", 10, "bold"),
                                  bg="white", padx=10, pady=8)
        log_frame.pack(fill=tk.BOTH, expand=True)

        self.log_text = tk.Text(log_frame, height=8, bg="white", relief=tk.SOLID,
                                borderwidth=1, font=("Consolas", 9), state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # === RIGHT PANE: assets.info editor ===
        right_pane = tk.Frame(columns_frame, bg="white")
        right_pane.grid(row=0, column=1, sticky="nsew", padx=(5, 0))

        self.create_assets_editor(right_pane)

        self.update_folder_status()
        self.assets_refresh_tree()

    def create_assets_editor(self, parent):
        """Create the assets.info editor panel"""
        editor_frame = tk.LabelFrame(parent, text="assets.info 편집기",
                                     font=("Arial", 10, "bold"), bg="white",
                                     padx=10, pady=10)
        editor_frame.pack(fill=tk.BOTH, expand=True)

        # Treeview
        tree_frame = tk.Frame(editor_frame, bg="white")
        tree_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        columns = ("preset_id", "character_file", "category", "display_name", "gender", "scaling", "source")
        self.assets_tree = ttk.Treeview(tree_frame, columns=columns, show="headings", height=15,
                                        selectmode="extended")

        self.assets_tree.heading("preset_id", text="프리셋 ID")
        self.assets_tree.heading("character_file", text="캐릭터 파일")
        self.assets_tree.heading("category", text="카테고리")
        self.assets_tree.heading("display_name", text="표시 이름")
        self.assets_tree.heading("gender", text="성별")
        self.assets_tree.heading("scaling", text="스케일링")
        self.assets_tree.heading("source", text="출처")

        self.assets_tree.column("preset_id", width=90, minwidth=70)
        self.assets_tree.column("character_file", width=160, minwidth=100)
        self.assets_tree.column("category", width=130, minwidth=80)
        self.assets_tree.column("display_name", width=100, minwidth=60)
        self.assets_tree.column("gender", width=50, minwidth=40)
        self.assets_tree.column("scaling", width=70, minwidth=50)
        self.assets_tree.column("source", width=60, minwidth=40)

        scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.assets_tree.yview)
        self.assets_tree.configure(yscrollcommand=scrollbar.set)

        self.assets_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.assets_tree.bind("<<TreeviewSelect>>", self.assets_on_select)

        # Count + Move + Refresh
        count_frame = tk.Frame(editor_frame, bg="white")
        count_frame.pack(fill=tk.X, pady=(0, 5))
        self.assets_count_label = tk.Label(count_frame, text="", bg="white", fg="#666",
                                           font=("Arial", 9))
        self.assets_count_label.pack(side=tk.LEFT)
        tk.Button(count_frame, text="새로고침", command=self.assets_load,
                 bg="white", relief=tk.SOLID, borderwidth=1,
                 padx=8, cursor="hand2", font=("Arial", 8)).pack(side=tk.RIGHT)
        self.move_down_btn = tk.Button(count_frame, text="▼", command=self.assets_move_down,
                 bg="white", relief=tk.SOLID, borderwidth=1,
                 padx=6, cursor="hand2", font=("Arial", 9), state=tk.DISABLED)
        self.move_down_btn.pack(side=tk.RIGHT, padx=(0, 3))
        self.move_up_btn = tk.Button(count_frame, text="▲", command=self.assets_move_up,
                 bg="white", relief=tk.SOLID, borderwidth=1,
                 padx=6, cursor="hand2", font=("Arial", 9), state=tk.DISABLED)
        self.move_up_btn.pack(side=tk.RIGHT, padx=(0, 3))

        # --- Edit form ---
        form_frame = tk.LabelFrame(editor_frame, text="항목 편집",
                                   font=("Arial", 9, "bold"), bg="white",
                                   padx=10, pady=10)
        form_frame.pack(fill=tk.X)

        # assets.info fields
        self.asset_preset_id_var = tk.StringVar()
        self.asset_char_file_var = tk.StringVar()
        self.asset_category_var = tk.StringVar()
        self.asset_display_name_var = tk.StringVar()
        self.asset_gender_var = tk.StringVar()
        self.asset_thumbnail_var = tk.StringVar()
        self.asset_scaling_var = tk.StringVar()
        self.asset_source_var = tk.StringVar()

        # Change detection traces
        self._populating_form = False
        self._char_meta_original = {}
        for var in (self.asset_preset_id_var, self.asset_char_file_var, self.asset_category_var,
                    self.asset_display_name_var, self.asset_gender_var, self.asset_thumbnail_var,
                    self.asset_scaling_var, self.asset_source_var):
            var.trace_add("write", self._on_form_field_changed)

        fields = [
            ("프리셋 ID:", self.asset_preset_id_var, None),
            ("캐릭터 파일:", self.asset_char_file_var, None),
            ("카테고리:", self.asset_category_var, ["CharacterCategory.VRM"]),
            ("표시 이름:", self.asset_display_name_var, None),
            ("성별:", self.asset_gender_var, ["Female", "Male"]),
            ("스케일링:", self.asset_scaling_var, ["Original", "CineV"]),
            ("출처:", self.asset_source_var, ["None", "VRM", "VRoid", "Zepeto"]),
        ]

        for label_text, var, combo_values in fields:
            frow = tk.Frame(form_frame, bg="white")
            frow.pack(fill=tk.X, pady=2)
            tk.Label(frow, text=label_text, width=16, anchor="w",
                    bg="white", font=("Arial", 9)).pack(side=tk.LEFT)
            if combo_values is not None:
                ttk.Combobox(frow, textvariable=var, values=combo_values,
                            width=40).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
            else:
                tk.Entry(frow, textvariable=var, bg="white",
                        relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        # Thumbnail row
        thumb_row = tk.Frame(form_frame, bg="white")
        thumb_row.pack(fill=tk.X, pady=2)
        tk.Label(thumb_row, text="썸네일:", width=16, anchor="w",
                bg="white", font=("Arial", 9)).pack(side=tk.LEFT)
        tk.Entry(thumb_row, textvariable=self.asset_thumbnail_var, bg="white",
                relief=tk.SOLID, borderwidth=1).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        tk.Button(thumb_row, text="찾기", command=self._browse_thumbnail,
                 bg="white", relief=tk.SOLID, borderwidth=1,
                 padx=6, cursor="hand2", font=("Arial", 8)).pack(side=tk.LEFT, padx=(0, 5))

        # Thumbnail preview
        self._thumb_preview_label = tk.Label(form_frame, bg="white", text="(썸네일 미리보기)",
                                             fg="#999", font=("Arial", 8))
        self._thumb_preview_label.pack(anchor="w", padx=(130, 0), pady=(2, 0))
        self._thumb_photo = None

        # Buttons row
        btn_row = tk.Frame(form_frame, bg="white")
        btn_row.pack(pady=(10, 5))
        self.assets_apply_btn = tk.Button(btn_row, text="변경사항 적용", command=self.assets_apply_changes,
                 bg="#0066CC", fg="white", relief=tk.FLAT,
                 padx=20, pady=5, font=("Arial", 9, "bold"),
                 cursor="hand2", state=tk.DISABLED)
        self.assets_apply_btn.pack(side=tk.LEFT, padx=5)
        self.assets_delete_btn = tk.Button(btn_row, text="항목 삭제", command=self.assets_delete_entry,
                 bg="#CC0000", fg="white", relief=tk.FLAT,
                 padx=20, pady=5, font=("Arial", 9, "bold"),
                 cursor="hand2", state=tk.DISABLED)
        self.assets_delete_btn.pack(side=tk.LEFT, padx=5)

    # ── Logging ──

    def log(self, msg):
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)

    # ── Folder actions ──

    def browse_folder(self):
        path = filedialog.askdirectory(title="UserCharacter 폴더 선택")
        if path:
            self.user_char_folder_var.set(os.path.normpath(path))
            self.update_folder_status()
            self.assets_load()

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

    # ── VRM selection ──

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

    # ── Registration ──

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

        # Refresh assets.info editor
        self.assets_data = assets_data
        self.assets_refresh_tree()

        messagebox.showinfo("완료", f"{added}개 VRoid 캐릭터 등록 완료")

    # ── .character metadata helpers ──

    @staticmethod
    def read_character_metadata(char_path):
        """Read metadata JSON embedded in a .character file"""
        with open(char_path, "rb") as f:
            data = f.read()
        idx = data.find(b"{")
        if idx < 0:
            return None
        depth = 0
        end = idx
        for i in range(idx, len(data)):
            if data[i:i+1] == b"{":
                depth += 1
            elif data[i:i+1] == b"}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        json_str = data[idx:end].decode("utf-8", errors="replace")
        return json.loads(json_str)

    @staticmethod
    def write_character_metadata(char_path, updates):
        """Update metadata JSON embedded in a .character file"""
        with open(char_path, "rb") as f:
            data = f.read()
        idx = data.find(b"{")
        if idx < 0:
            return False
        depth = 0
        end = idx
        for i in range(idx, len(data)):
            if data[i:i+1] == b"{":
                depth += 1
            elif data[i:i+1] == b"}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        json_str = data[idx:end].decode("utf-8", errors="replace")
        meta = json.loads(json_str)
        meta.update(updates)
        new_json = json.dumps(meta, indent=2, ensure_ascii=False).encode("utf-8")
        with open(char_path, "wb") as f:
            f.write(data[:idx] + new_json + data[end:])
        return True

    def _get_character_file_path(self, char_filename):
        """Resolve full path for a .character file in UserCharacter folder"""
        folder = self.user_char_folder_var.get()
        if not folder or not char_filename:
            return None
        full_path = os.path.join(folder, char_filename)
        return full_path if os.path.exists(full_path) else None

    # ── Assets.info editor ──

    def assets_load(self):
        """Load assets.info file"""
        folder = self.user_char_folder_var.get()
        if not folder or not os.path.isdir(folder):
            messagebox.showerror("오류", "UserCharacter 폴더를 먼저 설정하세요.")
            return
        assets_path = os.path.join(folder, "assets.info")
        if not os.path.exists(assets_path):
            messagebox.showerror("오류", f"assets.info를 찾을 수 없습니다:\n{assets_path}")
            return

        try:
            with open(assets_path, "r", encoding="utf-8") as f:
                self.assets_data = json.load(f)
            self.assets_refresh_tree()
            self.log(f"assets.info 로드: {len(self.assets_data)}개")
        except Exception as e:
            self.log(f"assets.info 로드 실패: {str(e)}")
            messagebox.showerror("오류", "assets.info 로드에 실패했습니다.")

    def assets_auto_save(self):
        """Auto-save assets.info after any change"""
        folder = self.user_char_folder_var.get()
        if not folder:
            return
        assets_path = os.path.join(folder, "assets.info")
        try:
            with open(assets_path, "w", encoding="utf-8") as f:
                json.dump(self.assets_data, f, indent=2, ensure_ascii=False)
            self.log(f"assets.info 자동 저장 ({len(self.assets_data)}개)")
            self.assets_count_label.config(text="저장됨", fg="#00AA00")
            self.root.after(2000, lambda: self.assets_count_label.config(
                text=f"{len(self.assets_data)}개", fg="#666"))
        except Exception as e:
            self.log(f"자동 저장 실패: {str(e)}")

    def assets_refresh_tree(self):
        """Refresh the treeview with current data"""
        self.assets_tree.delete(*self.assets_tree.get_children())
        for i, entry in enumerate(self.assets_data):
            preset_id = entry.get("Preset_id", "")
            short_id = preset_id[:8] + "..." if len(preset_id) > 12 else preset_id
            self.assets_tree.insert("", tk.END, iid=str(i), values=(
                short_id,
                entry.get("CharacterFilePath", ""),
                entry.get("CategoryName", ""),
                entry.get("DisplayName", ""),
                entry.get("Gender", ""),
                entry.get("ScalingMethod", ""),
                entry.get("ModelSourceType", ""),
            ))
        self.assets_count_label.config(text=f"{len(self.assets_data)}개")

        if not self.assets_data:
            self.assets_tree.insert("", tk.END, iid="empty_placeholder", values=(
                "", "항목 없음", "", "", "", "", ""
            ))
            self.assets_apply_btn.config(state=tk.DISABLED)
            self.assets_delete_btn.config(state=tk.DISABLED)
            self.move_up_btn.config(state=tk.DISABLED)
            self.move_down_btn.config(state=tk.DISABLED)

    def _get_selected_indices(self):
        """Get sorted list of selected indices from treeview"""
        selection = self.assets_tree.selection()
        if not selection:
            return []
        return sorted(int(s) for s in selection if s != "empty_placeholder")

    def _clear_edit_form(self):
        """Clear all edit form fields"""
        self._populating_form = True
        self.asset_preset_id_var.set("")
        self.asset_char_file_var.set("")
        self.asset_category_var.set("")
        self.asset_display_name_var.set("")
        self.asset_gender_var.set("")
        self.asset_thumbnail_var.set("")
        self.asset_scaling_var.set("")
        self.asset_source_var.set("")
        self._char_meta_original = {}
        self._populating_form = False
        self._thumb_preview_label.config(image="", text="(썸네일 미리보기)")
        self._thumb_photo = None

    def assets_on_select(self, event):
        """Handle treeview selection - populate edit form"""
        indices = self._get_selected_indices()
        if not indices:
            return

        idx = indices[-1]
        if idx >= len(self.assets_data):
            return
        self.selected_asset_idx = idx
        entry = self.assets_data[idx]

        self._populating_form = True

        self.asset_preset_id_var.set(entry.get("Preset_id", ""))
        self.asset_char_file_var.set(entry.get("CharacterFilePath", ""))
        self.asset_category_var.set(entry.get("CategoryName", ""))
        self.asset_gender_var.set(entry.get("Gender", ""))
        self.asset_thumbnail_var.set(entry.get("ThumbnailFileName", ""))

        # Read DisplayName, ScalingMethod, ModelSourceType from .character file
        self.asset_display_name_var.set("")
        self.asset_scaling_var.set("")
        self.asset_source_var.set("")
        self._char_meta_original = {}
        char_path = self._get_character_file_path(entry.get("CharacterFilePath", ""))
        if char_path:
            try:
                meta = self.read_character_metadata(char_path)
                if meta:
                    dn = meta.get("displayName", meta.get("DisplayName", ""))
                    sc = meta.get("scalingMethod", meta.get("ScalingMethod", ""))
                    sr = meta.get("modelSourceType", meta.get("ModelSourceType", ""))
                    self.asset_display_name_var.set(dn)
                    self.asset_scaling_var.set(sc)
                    self.asset_source_var.set(sr)
                    self._char_meta_original = {"DisplayName": dn, "ScalingMethod": sc, "ModelSourceType": sr}
            except Exception as e:
                self.log(f".character 읽기 실패: {str(e)}")
        else:
            self.asset_display_name_var.set(entry.get("DisplayName", ""))
            self.asset_scaling_var.set(entry.get("ScalingMethod", ""))
            self.asset_source_var.set(entry.get("ModelSourceType", ""))

        self._populating_form = False
        self._update_thumb_preview()

        # Enable apply button if .character metadata differs from assets.info
        meta_mismatch = False
        if self._char_meta_original and len(indices) == 1:
            meta_mismatch = (
                self._char_meta_original.get("DisplayName", "") != entry.get("DisplayName", "") or
                self._char_meta_original.get("ScalingMethod", "") != entry.get("ScalingMethod", "") or
                self._char_meta_original.get("ModelSourceType", "") != entry.get("ModelSourceType", "")
            )

        self.assets_apply_btn.config(state=tk.NORMAL if meta_mismatch else tk.DISABLED)
        self.assets_delete_btn.config(state=tk.NORMAL)
        min_idx, max_idx = indices[0], indices[-1]
        self.move_up_btn.config(state=tk.NORMAL if min_idx > 0 else tk.DISABLED)
        self.move_down_btn.config(state=tk.NORMAL if max_idx < len(self.assets_data) - 1 else tk.DISABLED)

    def _on_form_field_changed(self, *args):
        """Enable apply button when form values differ from original"""
        if getattr(self, "_populating_form", False):
            return
        if self.selected_asset_idx is None:
            return
        idx = self.selected_asset_idx
        if idx >= len(self.assets_data):
            return
        entry = self.assets_data[idx]
        orig_meta = getattr(self, "_char_meta_original", {})

        changed = (
            self.asset_preset_id_var.get() != entry.get("Preset_id", "") or
            self.asset_char_file_var.get() != entry.get("CharacterFilePath", "") or
            self.asset_category_var.get() != entry.get("CategoryName", "") or
            self.asset_gender_var.get() != entry.get("Gender", "") or
            self.asset_thumbnail_var.get() != entry.get("ThumbnailFileName", "") or
            self.asset_display_name_var.get() != orig_meta.get("DisplayName", "") or
            self.asset_scaling_var.get() != orig_meta.get("ScalingMethod", "") or
            self.asset_source_var.get() != orig_meta.get("ModelSourceType", "")
        )
        self.assets_apply_btn.config(state=tk.NORMAL if changed else tk.DISABLED)

    def assets_apply_changes(self):
        """Apply edit form changes to selected entry + write .character metadata"""
        if self.selected_asset_idx is None:
            messagebox.showwarning("경고", "항목을 먼저 선택하세요.")
            return
        idx = self.selected_asset_idx

        self.assets_data[idx]["Preset_id"] = self.asset_preset_id_var.get()
        self.assets_data[idx]["Gender"] = self.asset_gender_var.get()
        self.assets_data[idx]["DisplayName"] = self.asset_display_name_var.get()
        self.assets_data[idx]["CharacterFilePath"] = self.asset_char_file_var.get()
        self.assets_data[idx]["CategoryName"] = self.asset_category_var.get()
        self.assets_data[idx]["ThumbnailFileName"] = self.asset_thumbnail_var.get()

        # Write metadata back to .character file
        char_path = self._get_character_file_path(self.asset_char_file_var.get())
        if char_path:
            try:
                updates = {
                    "displayName": self.asset_display_name_var.get(),
                    "scalingMethod": self.asset_scaling_var.get(),
                    "modelSourceType": self.asset_source_var.get(),
                }
                self.write_character_metadata(char_path, updates)
                self.log(f".character 업데이트: {os.path.basename(char_path)}")
            except Exception as e:
                self.log(f".character 쓰기 실패: {str(e)}")

        self._char_meta_original = {
            "DisplayName": self.asset_display_name_var.get(),
            "ScalingMethod": self.asset_scaling_var.get(),
            "ModelSourceType": self.asset_source_var.get(),
        }

        self.assets_refresh_tree()
        self.assets_tree.selection_set(str(idx))
        self.assets_tree.see(str(idx))
        self.assets_auto_save()
        self.assets_apply_btn.config(state=tk.DISABLED)

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

    def assets_delete_entry(self):
        """Delete all selected entries"""
        indices = self._get_selected_indices()
        if not indices:
            messagebox.showwarning("경고", "항목을 선택하세요.")
            return

        count = len(indices)
        if count == 1:
            name = self.assets_data[indices[0]].get("CharacterFilePath", "")
            msg = f"삭제하시겠습니까?\n{name}"
        else:
            msg = f"{count}개 항목을 삭제하시겠습니까?"

        if messagebox.askyesno("삭제 확인", msg):
            self.selected_asset_idx = None
            self._clear_edit_form()
            for idx in reversed(indices):
                self.assets_data.pop(idx)
            self.assets_refresh_tree()
            self.assets_auto_save()
            self.assets_apply_btn.config(state=tk.DISABLED)
            self.assets_delete_btn.config(state=tk.DISABLED)
            self.move_up_btn.config(state=tk.DISABLED)
            self.move_down_btn.config(state=tk.DISABLED)

    # ── Thumbnail ──

    def _browse_thumbnail(self):
        """Browse for a thumbnail image file"""
        folder = self.user_char_folder_var.get()
        initial_dir = folder if folder and os.path.isdir(folder) else os.path.expanduser("~")
        path = filedialog.askopenfilename(
            title="썸네일 이미지 선택",
            initialdir=initial_dir,
            filetypes=[("이미지 파일", "*.png *.jpg *.jpeg *.bmp"), ("모든 파일", "*.*")]
        )
        if path:
            if folder and os.path.dirname(os.path.abspath(path)) == os.path.abspath(folder):
                self.asset_thumbnail_var.set(os.path.basename(path))
            else:
                dest = os.path.join(folder, os.path.basename(path))
                try:
                    shutil.copy2(path, dest)
                    self.asset_thumbnail_var.set(os.path.basename(path))
                    self.log(f"썸네일 복사: {os.path.basename(path)}")
                except Exception as e:
                    self.log(f"썸네일 복사 실패: {str(e)}")
                    self.asset_thumbnail_var.set(os.path.basename(path))

    def _update_thumb_preview(self):
        """Update thumbnail preview image"""
        thumb_name = self.asset_thumbnail_var.get()
        folder = self.user_char_folder_var.get()
        if not thumb_name or not folder:
            self._thumb_preview_label.config(image="", text="(썸네일 미리보기)")
            self._thumb_photo = None
            return
        thumb_path = os.path.join(folder, thumb_name)
        if not os.path.exists(thumb_path):
            self._thumb_preview_label.config(image="", text=f"({thumb_name} 없음)")
            self._thumb_photo = None
            return
        try:
            from PIL import Image, ImageTk
            img = Image.open(thumb_path)
            img.thumbnail((80, 80))
            self._thumb_photo = ImageTk.PhotoImage(img)
            self._thumb_preview_label.config(image=self._thumb_photo, text="")
        except ImportError:
            self._thumb_preview_label.config(image="", text=f"[{thumb_name}]")
            self._thumb_photo = None
        except Exception:
            self._thumb_preview_label.config(image="", text=f"({thumb_name} 로드 실패)")
            self._thumb_photo = None


if __name__ == "__main__":
    root = tk.Tk()
    app = VRoidCreatorGUI(root)
    root.mainloop()
