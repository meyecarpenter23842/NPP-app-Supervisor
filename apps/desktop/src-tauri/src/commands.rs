//! The renderer's entire allowlisted native API in M1.3.
use crate::storage::{AppDatabase, LocalOperator, OperatorRole};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    code: &'static str,
    message: &'static str,
}

impl ApiError {
    fn validation() -> Self {
        Self { code: "VALIDATION_ERROR", message: "Thông tin người sử dụng không hợp lệ." }
    }
    fn conflict() -> Self {
        Self { code: "OPERATOR_EXISTS", message: "Ứng dụng đã có một người sử dụng. Không thể tạo thêm." }
    }
    fn not_found() -> Self {
        Self { code: "OPERATOR_NOT_FOUND", message: "Chưa có thông tin người sử dụng." }
    }
    fn storage() -> Self {
        // Never propagate SQLite messages, physical paths or migration internals to JS.
        Self { code: "STORAGE_ERROR", message: "Không thể truy cập dữ liệu cục bộ. Vui lòng thử lại." }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OperatorInput {
    display_name: String,
    role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorView {
    display_name: String,
    role: &'static str,
}

impl From<LocalOperator> for OperatorView {
    fn from(value: LocalOperator) -> Self {
        Self { display_name: value.display_name, role: value.role.as_str() }
    }
}

fn validated(input: OperatorInput) -> Result<(String, OperatorRole), ApiError> {
    let display_name = input.display_name.trim();
    if display_name.chars().count() < 2 || display_name.chars().count() > 80
       || display_name.chars().any(char::is_control) {
        return Err(ApiError::validation());
    }
    let role = match input.role.as_str() {
        "SALES" => OperatorRole::Sales,
        "SUP" => OperatorRole::Sup,
        "ASM" => OperatorRole::Asm,
        _ => return Err(ApiError::validation()),
    };
    Ok((display_name.to_string(), role))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    status: &'static str,
    storage_ready: bool,
}

#[tauri::command]
pub fn health(_db: State<'_, AppDatabase>) -> Health {
    Health { status: "ready", storage_ready: true }
}

#[tauri::command]
pub fn get_operator(db: State<'_, AppDatabase>) -> Result<Option<OperatorView>, ApiError> {
    db.operator().map(|value| value.map(Into::into)).map_err(|_| ApiError::storage())
}

#[tauri::command]
pub fn create_operator(
    db: State<'_, AppDatabase>, request: OperatorInput,
) -> Result<OperatorView, ApiError> {
    let (name, role) = validated(request)?;
    if db.operator().map_err(|_| ApiError::storage())?.is_some() {
        return Err(ApiError::conflict());
    }
    db.create_operator(&name, role).map_err(|_| ApiError::storage())?;
    Ok(OperatorView { display_name: name, role: role.as_str() })
}

#[tauri::command]
pub fn update_operator(
    db: State<'_, AppDatabase>, request: OperatorInput,
) -> Result<OperatorView, ApiError> {
    let (name, role) = validated(request)?;
    let changed = db.update_operator(&name, role).map_err(|_| ApiError::storage())?;
    if !changed { return Err(ApiError::not_found()); }
    Ok(OperatorView { display_name: name, role: role.as_str() })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(name: &str, role: &str) -> OperatorInput {
        OperatorInput { display_name: name.into(), role: role.into() }
    }
    #[test]
    fn allows_exactly_three_operator_roles() {
        for role in ["SALES", "SUP", "ASM"] {
            assert!(validated(request("  Người dùng  ", role)).is_ok());
        }
        for role in ["REP", "ADMIN", "ASM; DROP TABLE", "", "sales"] {
            assert!(validated(request("Demo", role)).is_err());
        }
    }
    #[test]
    fn validates_name_and_does_not_expose_sql_errors() {
        for name in ["", " ", "A", "bad\nname"] {
            assert!(validated(request(name, "SALES")).is_err());
        }
        assert_eq!(validated(request("  Demo  ", "SALES")).unwrap().0, "Demo");
        assert_eq!(ApiError::storage().code, "STORAGE_ERROR");
    }
}
