use crate::error::{AppError, AppResult};

pub fn parse_model_json<T: serde::de::DeserializeOwned>(raw: &str) -> AppResult<T> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("Empty model JSON".into()));
    }
    let re = regex::Regex::new(r"(?is)```(?:json)?\s*([\s\S]*?)```").expect("fence regex");
    let candidate = re
        .captures(trimmed)
        .and_then(|c| c.get(1).map(|m| m.as_str().trim().to_string()))
        .unwrap_or_else(|| trimmed.to_string());

    if let Ok(v) = serde_json::from_str::<T>(&candidate) {
        return Ok(v);
    }
    if let (Some(start), Some(end)) = (candidate.find('{'), candidate.rfind('}')) {
        if end > start {
            return serde_json::from_str::<T>(&candidate[start..=end])
                .map_err(|_| AppError::BadRequest("Model output is not valid JSON".into()));
        }
    }
    Err(AppError::BadRequest("Model output is not valid JSON".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize, Debug, PartialEq)]
    struct Sample {
        ok: bool,
    }

    #[test]
    fn strips_fences_and_prose() {
        let v: Sample = parse_model_json("```json\n{\"ok\":true}\n```").unwrap();
        assert_eq!(v, Sample { ok: true });
        let v: Sample = parse_model_json("here\n{\"ok\":true}\nthanks").unwrap();
        assert_eq!(v, Sample { ok: true });
    }
}
