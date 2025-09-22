from datetime import datetime, timezone

def make_thumbnail_filename(prefix="thumbnail", ext=None, use_utc=True, include_ms=True):
	dt = datetime.now(timezone.utc) if use_utc else datetime.now()
	ts = dt.strftime("%Y%m%d_%H%M%S")
	ms = f"_{dt.microsecond // 1000:03d}" if include_ms else ""
	if isinstance(ext, str) and ext.strip():
		clean_ext = ext[1:] if ext.startswith(".") else ext
		return f"{prefix}_{ts}{ms}.{clean_ext}"
	return f"{prefix}_{ts}{ms}"

thumbnail_filename: str = make_thumbnail_filename()