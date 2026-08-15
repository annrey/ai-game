use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::process::Command;

use crate::config::RuntimeSettings;
use crate::error::{AppError, AppResult};

pub const PROMPT_MAX: usize = 500;
const GENERATE_TIMEOUT: Duration = Duration::from_secs(180);

/// 1x1 PNG used when no script, no model, and no existing cover is available.
const TINY_PNG: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];

pub fn validate_prompt(raw: &str) -> AppResult<String> {
    let prompt = raw.trim();
    if prompt.is_empty() {
        return Err(AppError::BadRequest("prompt is required".into()));
    }
    if prompt.chars().count() > PROMPT_MAX {
        return Err(AppError::BadRequest(format!("prompt must be at most {PROMPT_MAX} characters")));
    }
    if prompt.contains('\0') {
        return Err(AppError::BadRequest("prompt must not contain null bytes".into()));
    }
    Ok(prompt.to_string())
}

pub fn output_path(settings: &RuntimeSettings) -> PathBuf {
    settings.ui_dir.join("generated").join("latest-preview.png")
}

pub async fn generate(settings: &RuntimeSettings, prompt: &str) -> AppResult<Value> {
    let prompt = validate_prompt(prompt)?;
    let model_dir = settings
        .preview_model_dir
        .clone()
        .ok_or_else(|| AppError::Forbidden("PIXEL_MODEL_DIR is not set".into()))?;
    let out = output_path(settings);
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let script = resolve_script(settings);
    let python = resolve_python(settings);
    if let (Some(script), Some(python)) = (script, python) {
        match run_script(&python, &script, &prompt, &out, &model_dir).await {
            Ok(mut meta) => {
                if let Some(obj) = meta.as_object_mut() {
                    obj.insert("url".into(), json!(format!("/generated/latest-preview.png?v={}", now_ms())));
                }
                return Ok(meta);
            }
            Err(err) => {
                tracing::warn!("preview script failed, writing fallback: {err}");
            }
        }
    }

    write_fallback(&out, settings, &model_dir)?;
    Ok(json!({
        "success": true,
        "fallback": true,
        "modelFile": serde_json::Value::Null,
        "message": "预览脚本不可用，已输出占位预览图",
        "outputPath": out.to_string_lossy(),
        "url": format!("/generated/latest-preview.png?v={}", now_ms()),
    }))
}

fn resolve_script(settings: &RuntimeSettings) -> Option<PathBuf> {
    if let Some(p) = &settings.preview_script {
        return p.exists().then(|| p.clone());
    }
    let cwd = std::env::current_dir().ok()?;
    let candidate = cwd.join("scripts").join("generate_preview.py");
    candidate.exists().then_some(candidate)
}

fn resolve_python(settings: &RuntimeSettings) -> Option<PathBuf> {
    if let Some(p) = &settings.preview_python {
        if p.as_os_str().is_empty() {
            return None;
        }
        return Some(p.clone());
    }
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for candidate in [
        cwd.join(".sdxl-venv/Scripts/python.exe"),
        cwd.join(".sdxl-venv/bin/python3"),
        cwd.join(".sdxl-venv/bin/python"),
    ] {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    Some(PathBuf::from(if cfg!(windows) { "python" } else { "python3" }))
}

async fn run_script(python: &Path, script: &Path, prompt: &str, out: &Path, model_dir: &Path) -> AppResult<Value> {
    let child = Command::new(python)
        .arg(script)
        .arg(prompt)
        .arg(out)
        .env("PIXEL_MODEL_DIR", model_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| AppError::Internal(format!("failed to start preview python: {e}")))?;

    let output = tokio::time::timeout(GENERATE_TIMEOUT, child.wait_with_output())
        .await
        .map_err(|_| AppError::Internal("preview generation timed out".into()))?
        .map_err(|e| AppError::Internal(format!("preview python failed: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Internal(format!(
            "preview script exited {}: {}",
            output.status,
            stderr.chars().take(400).collect::<String>()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let last = stdout
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("{}");
    let meta: Value = serde_json::from_str(last).unwrap_or_else(|_| {
        json!({
            "success": true,
            "message": "preview script finished",
        })
    });
    if meta.get("success").and_then(|v| v.as_bool()) == Some(false) {
        let err = meta.get("error").and_then(|v| v.as_str()).unwrap_or("preview script reported failure");
        return Err(AppError::Internal(err.into()));
    }
    Ok(meta)
}

fn write_fallback(out: &Path, settings: &RuntimeSettings, model_dir: &Path) -> AppResult<()> {
    let cover = model_dir.join("_cover_images_").join("cover_image.png");
    let existing = settings.ui_dir.join("generated").join("test-preview.png");
    let latest = settings.ui_dir.join("generated").join("latest-preview.png");
    let src = [cover.as_path(), existing.as_path(), latest.as_path()]
        .into_iter()
        .find(|p| p.exists() && p != &out);
    if let Some(src) = src {
        if src != out {
            std::fs::copy(src, out)?;
            return Ok(());
        }
    }
    if !out.exists() {
        std::fs::write(out, TINY_PNG)?;
    }
    Ok(())
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_and_overlong_prompt() {
        assert!(validate_prompt("   ").is_err());
        assert!(validate_prompt(&"啊".repeat(PROMPT_MAX + 1)).is_err());
        assert_eq!(validate_prompt("  雾港夜景  ").unwrap(), "雾港夜景");
    }
}
