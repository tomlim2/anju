use crate::ConvertError;
use serde_json::{json, Value};

/// Convert VRM 0.x meta → VRM 1.0 meta.
///
/// Key mappings:
/// - `title` → `name`
/// - `author` → `authors[]`
/// - Fills required 1.0 fields with defaults
pub fn convert(meta: &Value) -> Result<Value, ConvertError> {
    let name = meta
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled");

    let authors = if let Some(author) = meta.get("author").and_then(|v| v.as_str()) {
        json!([author])
    } else {
        json!(["Unknown"])
    };

    let version = meta
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // VRM 1.0 requires these fields
    Ok(json!({
        "name": name,
        "version": version,
        "authors": authors,
        "licenseUrl": "https://vrm.dev/licenses/1.0/",
        "avatarPermission": "everyone",
        "commercialUsage": "personalNonProfit",
        "creditNotation": "unnecessary",
        "modification": "allowModification",
        "allowExcessivelyViolentUsage": false,
        "allowExcessivelySexualUsage": false,
        "allowPoliticalOrReligiousUsage": false,
        "allowAntisocialOrHateUsage": false,
        "allowRedistribution": false,
    }))
}
