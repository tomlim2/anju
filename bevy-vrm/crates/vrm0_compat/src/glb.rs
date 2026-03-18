use crate::ConvertError;

const GLB_MAGIC: &[u8; 4] = b"glTF";
const GLB_VERSION: u32 = 2;
const CHUNK_TYPE_JSON: u32 = 0x4E4F534A;
const CHUNK_TYPE_BIN: u32 = 0x004E4942;
const GLB_HEADER_SIZE: usize = 12;
const CHUNK_HEADER_SIZE: usize = 8;

/// Parsed GLB components
pub struct GlbParts {
    pub json: serde_json::Value,
    pub bin: Vec<u8>,
}

/// Parse a GLB binary into JSON value + BIN chunk bytes.
pub fn parse(data: &[u8]) -> Result<GlbParts, ConvertError> {
    if data.len() < GLB_HEADER_SIZE {
        return Err(ConvertError::InvalidGlb("file too small"));
    }

    // Validate magic
    if &data[0..4] != GLB_MAGIC {
        return Err(ConvertError::InvalidGlb("bad magic"));
    }

    // Validate version
    let version = u32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    if version != GLB_VERSION {
        return Err(ConvertError::InvalidGlb("unsupported glTF version"));
    }

    // Parse JSON chunk
    let mut offset = GLB_HEADER_SIZE;
    if data.len() < offset + CHUNK_HEADER_SIZE {
        return Err(ConvertError::InvalidGlb("missing JSON chunk header"));
    }

    let json_len = read_u32(data, offset) as usize;
    let json_type = read_u32(data, offset + 4);
    if json_type != CHUNK_TYPE_JSON {
        return Err(ConvertError::InvalidGlb("first chunk is not JSON"));
    }
    offset += CHUNK_HEADER_SIZE;

    if data.len() < offset + json_len {
        return Err(ConvertError::InvalidGlb("JSON chunk truncated"));
    }

    let json_bytes = &data[offset..offset + json_len];
    let json: serde_json::Value =
        serde_json::from_slice(json_bytes).map_err(|e| ConvertError::Json(e.to_string()))?;
    offset += json_len;

    // Parse BIN chunk (optional)
    let bin = if data.len() >= offset + CHUNK_HEADER_SIZE {
        let bin_len = read_u32(data, offset) as usize;
        let bin_type = read_u32(data, offset + 4);
        if bin_type != CHUNK_TYPE_BIN {
            return Err(ConvertError::InvalidGlb("second chunk is not BIN"));
        }
        offset += CHUNK_HEADER_SIZE;
        if data.len() < offset + bin_len {
            return Err(ConvertError::InvalidGlb("BIN chunk truncated"));
        }
        data[offset..offset + bin_len].to_vec()
    } else {
        Vec::new()
    };

    Ok(GlbParts { json, bin })
}

/// Rebuild a GLB binary from JSON value + BIN chunk bytes.
/// JSON chunk is padded with 0x20 (space) to 4-byte alignment.
/// BIN chunk is padded with 0x00 to 4-byte alignment.
pub fn rebuild(json: serde_json::Value, bin: Vec<u8>) -> Result<Vec<u8>, ConvertError> {
    let json_bytes = serde_json::to_vec(&json).map_err(|e| ConvertError::Json(e.to_string()))?;

    // Pad JSON to 4-byte alignment
    let json_padded_len = align4(json_bytes.len());
    let mut json_padded = json_bytes;
    json_padded.resize(json_padded_len, 0x20); // space padding

    // Pad BIN to 4-byte alignment
    let bin_padded_len = align4(bin.len());
    let mut bin_padded = bin;
    bin_padded.resize(bin_padded_len, 0x00);

    let total_length = GLB_HEADER_SIZE
        + CHUNK_HEADER_SIZE
        + json_padded_len
        + CHUNK_HEADER_SIZE
        + bin_padded_len;

    let mut out = Vec::with_capacity(total_length);

    // GLB header
    out.extend_from_slice(GLB_MAGIC);
    out.extend_from_slice(&GLB_VERSION.to_le_bytes());
    out.extend_from_slice(&(total_length as u32).to_le_bytes());

    // JSON chunk
    out.extend_from_slice(&(json_padded_len as u32).to_le_bytes());
    out.extend_from_slice(&CHUNK_TYPE_JSON.to_le_bytes());
    out.extend_from_slice(&json_padded);

    // BIN chunk
    out.extend_from_slice(&(bin_padded_len as u32).to_le_bytes());
    out.extend_from_slice(&CHUNK_TYPE_BIN.to_le_bytes());
    out.extend_from_slice(&bin_padded);

    Ok(out)
}

fn read_u32(data: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ])
}

fn align4(n: usize) -> usize {
    (n + 3) & !3
}
