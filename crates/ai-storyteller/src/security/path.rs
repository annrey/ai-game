use std::path::{Path, PathBuf};

use regex::Regex;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

pub fn parse_save_id(id: &str) -> AppResult<Uuid> {
    let re = Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        .expect("save id regex");
    if !re.is_match(id) {
        return Err(AppError::BadRequest("Invalid save id".into()));
    }
    Uuid::parse_str(id).map_err(|_| AppError::BadRequest("Invalid save id".into()))
}

pub fn resolve_save_file(save_root: &Path, id: &str) -> AppResult<PathBuf> {
    let uuid = parse_save_id(id)?;
    let dir = save_root.join("saves");
    let file = dir.join(format!("{uuid}.json"));
    let dir_canon = dunce_like(&dir);
    let file_canon = dunce_like(&file);
    if !file_canon.starts_with(&dir_canon) {
        return Err(AppError::BadRequest("Invalid save path".into()));
    }
    Ok(file)
}

fn dunce_like(path: &Path) -> PathBuf {
    std::path::absolute(path).unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    #[test]
    fn accepts_uuid_and_rejects_traversal() {
        let id = "550e8400-e29b-41d4-a716-446655440000";
        assert!(parse_save_id(id).is_ok());
        assert!(parse_save_id("../../../package").is_err());
        let path = resolve_save_file(&temp_dir().join("ai-saves"), id).unwrap();
        assert!(path.ends_with(format!("{id}.json")));
    }
}
