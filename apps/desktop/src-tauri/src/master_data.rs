//! Explicit SQLite-backed M2.1 master-data APIs; no renderer SQL or web backend.
use crate::storage::AppDatabase;
use rusqlite::{params, Connection, Row, Transaction};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterError {
    code: &'static str,
    message: &'static str,
}

impl MasterError {
    fn invalid() -> Self {
        Self { code: "VALIDATION_ERROR", message: "Thông tin danh mục hoặc ngày hiệu lực không hợp lệ." }
    }
    fn storage(error: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(ref failure, _) = error {
            if failure.code == rusqlite::ErrorCode::ConstraintViolation {
                return Self { code: "MASTER_CONFLICT", message: "Dữ liệu trùng, chồng hiệu lực hoặc quan hệ không hợp lệ." };
            }
        }
        Self { code: "STORAGE_ERROR", message: "Không thể lưu dữ liệu trên máy." }
    }
    fn unavailable() -> Self {
        Self { code: "STORAGE_ERROR", message: "Không thể truy cập dữ liệu trên máy." }
    }
    fn missing() -> Self {
        Self { code: "MASTER_NOT_FOUND", message: "Không tìm thấy bản ghi cần thay đổi." }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterItem {
    id: String,
    code: String,
    name: String,
    detail: Option<String>,
    parent_id: Option<String>,
    active: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterLink {
    id: String,
    kind: String,
    subject_id: String,
    related_id: Option<String>,
    distributor_id: Option<String>,
    external_code: Option<String>,
    unit_code: Option<String>,
    ratio_num: Option<i64>,
    ratio_den: Option<i64>,
    effective_from: Option<String>,
    effective_to: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterSnapshot {
    distributors: Vec<MasterItem>,
    families: Vec<MasterItem>,
    skus: Vec<MasterItem>,
    employees: Vec<MasterItem>,
    routes: Vec<MasterItem>,
    links: Vec<MasterLink>,
}
fn fetch<T>(conn: &Connection, sql: &str, mapper: impl FnMut(&Row<'_>) -> rusqlite::Result<T>) -> rusqlite::Result<Vec<T>> {
    let mut stmt = conn.prepare(sql)?;
    stmt.query_map([], mapper)?.collect()
}
fn item(row: &Row<'_>) -> rusqlite::Result<MasterItem> {
    Ok(MasterItem { id: row.get(0)?, code: row.get(1)?, name: row.get(2)?, detail: row.get(3)?, parent_id: row.get(4)?, active: row.get(5)? })
}
fn link(row: &Row<'_>) -> rusqlite::Result<MasterLink> {
    Ok(MasterLink {
        id: row.get(0)?, kind: row.get(1)?, subject_id: row.get(2)?, related_id: row.get(3)?,
        distributor_id: row.get(4)?, external_code: row.get(5)?, unit_code: row.get(6)?,
        ratio_num: row.get(7)?, ratio_den: row.get(8)?, effective_from: row.get(9)?, effective_to: row.get(10)?,
    })
}

#[tauri::command]
pub fn list_master_data(db: State<'_, AppDatabase>) -> Result<MasterSnapshot, MasterError> {
    let conn = db.connection.lock().map_err(|_| MasterError::unavailable())?;
    let distributors = fetch(&conn, "SELECT id,code,name,NULL,NULL,active FROM distributors ORDER BY code", item).map_err(MasterError::storage)?;
    let families = fetch(&conn, "SELECT id,code,name,category,brand,active FROM product_families ORDER BY code", item).map_err(MasterError::storage)?;
    let skus = fetch(&conn, "SELECT id,sku_code,name,base_unit,product_family_id,active FROM products ORDER BY sku_code", item).map_err(MasterError::storage)?;
    let employees = fetch(&conn, "SELECT id,code,full_name,role,NULL,active FROM employees ORDER BY role,code", item).map_err(MasterError::storage)?;
    let routes = fetch(&conn, "SELECT id,code,name,NULL,distributor_id,active FROM routes ORDER BY distributor_id,code", item).map_err(MasterError::storage)?;
    let links = fetch(&conn, "
        SELECT id,'SKU_ALIAS',product_id,NULL,distributor_id,raw_sku_code,raw_unit,conversion_num,conversion_den,effective_from,effective_to FROM sku_aliases
        UNION ALL SELECT id,'EMPLOYEE_ALIAS',employee_id,NULL,distributor_id,raw_employee_code,NULL,NULL,NULL,effective_from,effective_to FROM employee_code_aliases
        UNION ALL SELECT id,'MANAGER',employee_id,manager_employee_id,NULL,NULL,NULL,NULL,NULL,effective_from,effective_to FROM employee_hierarchy_assignments
        UNION ALL SELECT id,'NPP_STAFF',employee_id,NULL,distributor_id,NULL,NULL,NULL,NULL,effective_from,effective_to FROM employee_distributor_assignments
        UNION ALL SELECT id,'ROUTE_STAFF',employee_id,route_id,distributor_id,NULL,NULL,NULL,NULL,effective_from,effective_to FROM employee_route_assignments
        UNION ALL SELECT id,'SKU_UNIT',product_id,NULL,NULL,NULL,unit_code,conversion_num,conversion_den,NULL,NULL FROM sku_unit_conversions
        ORDER BY kind,subject_id,effective_from", link).map_err(MasterError::storage)?;
    Ok(MasterSnapshot { distributors, families, skus, employees, routes, links })
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewMasterItem {
    kind: String,
    code: String,
    name: String,
    parent_id: Option<String>,
    detail: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MasterItemStatus {
    kind: String,
    id: String,
    active: bool,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MasterItemName {
    kind: String,
    id: String,
    name: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewMasterLink {
    kind: String,
    subject_id: String,
    related_id: Option<String>,
    distributor_id: Option<String>,
    external_code: Option<String>,
    unit_code: Option<String>,
    ratio_num: Option<i64>,
    ratio_den: Option<i64>,
    effective_from: Option<String>,
    effective_to: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EndMasterLink {
    kind: String,
    id: String,
    effective_to: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterMutation {
    id: String,
}
fn clean_text(raw: &str, max: usize) -> Result<String, MasterError> {
    let s = raw.trim();
    if s.is_empty() || s.chars().count() > max || s.chars().any(char::is_control) {
        return Err(MasterError::invalid());
    }
    Ok(s.into())
}
fn valid_date(raw: &str) -> bool {
    let b = raw.as_bytes();
    b.len() == 10 && b[4] == b'-' && b[7] == b'-' && b.iter().enumerate().all(|(i, v)| i == 4 || i == 7 || v.is_ascii_digit())
}
fn date_range(start: &Option<String>, end: &Option<String>) -> Result<String, MasterError> {
    let value = start.as_deref().ok_or_else(MasterError::invalid)?;
    if !valid_date(value) || end.as_deref().is_some_and(|e| !valid_date(e) || e < value) {
        return Err(MasterError::invalid());
    }
    Ok(value.to_string())
}
fn audit(tx: &Transaction<'_>, action: &str, kind: &str, id: &str) -> rusqlite::Result<()> {
    tx.execute("INSERT INTO audit_events(id,event_type,actor_profile_id,entity_type,entity_id,created_at_utc)
        VALUES(lower(hex(randomblob(16))),?1,(SELECT id FROM local_operator WHERE id=1),?2,?3,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
        params![action, kind, id])?;
    Ok(())
}
fn new_id(tx: &Transaction<'_>) -> rusqlite::Result<String> {
    tx.query_row("SELECT lower(hex(randomblob(16)))", [], |r| r.get(0))
}
fn table_for(kind: &str) -> Option<&'static str> {
    match kind {
        "NPP" => Some("distributors"),
        "FAMILY" => Some("product_families"),
        "SKU" => Some("products"),
        "EMPLOYEE" => Some("employees"),
        "ROUTE" => Some("routes"),
        _ => None,
    }
}
fn link_table(kind: &str) -> Option<&'static str> {
    match kind {
        "SKU_ALIAS" => Some("sku_aliases"),
        "EMPLOYEE_ALIAS" => Some("employee_code_aliases"),
        "MANAGER" => Some("employee_hierarchy_assignments"),
        "NPP_STAFF" => Some("employee_distributor_assignments"),
        "ROUTE_STAFF" => Some("employee_route_assignments"),
        _ => None,
    }
}
#[tauri::command]
pub fn create_master_item(db: State<'_, AppDatabase>, request: NewMasterItem) -> Result<MasterMutation, MasterError> {
    let name = clean_text(&request.name, 256)?;
    let code = clean_text(&request.code, 96)?;
    let code = code.to_ascii_uppercase();
    let conn = db.connection.lock().map_err(|_| MasterError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(MasterError::storage)?;
    let id = new_id(&tx).map_err(MasterError::storage)?;
    match request.kind.as_str() {
        "NPP" => { tx.execute("INSERT INTO distributors(id,code,name,created_at_utc) VALUES(?1,?2,?3,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![id,code,name]).map_err(MasterError::storage)?; }
        "FAMILY" => { tx.execute("INSERT INTO product_families(id,code,name) VALUES(?1,?2,?3)",
            params![id,code,name]).map_err(MasterError::storage)?; }
        "SKU" => {
            let unit = clean_text(request.detail.as_deref().unwrap_or(""), 32)?;
            tx.execute("INSERT INTO products(id,sku_code,name,base_unit,product_family_id) VALUES(?1,?2,?3,?4,?5)",
                params![id,code,name,unit,request.parent_id]).map_err(MasterError::storage)?;
            tx.execute("INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den) VALUES(lower(hex(randomblob(16))),?1,?2,1,1)",
                params![id,unit]).map_err(MasterError::storage)?;
        }
        "EMPLOYEE" => {
            let role = request.detail.as_deref().ok_or_else(MasterError::invalid)?;
            if !["SALES","SUP","ASM"].contains(&role) { return Err(MasterError::invalid()); }
            tx.execute("INSERT INTO employees(id,code,full_name,role) VALUES(?1,?2,?3,?4)",
                params![id,code,name,role]).map_err(MasterError::storage)?;
        }
        "ROUTE" => {
            let npp = request.parent_id.as_deref().ok_or_else(MasterError::invalid)?;
            tx.execute("INSERT INTO routes(id,distributor_id,code,name) VALUES(?1,?2,?3,?4)",
                params![id,npp,code,name]).map_err(MasterError::storage)?;
        }
        _ => return Err(MasterError::invalid()),
    }
    audit(&tx,"CREATE",&request.kind,&id).map_err(MasterError::storage)?;
    tx.commit().map_err(MasterError::storage)?;
    Ok(MasterMutation { id })
}
#[tauri::command]
pub fn set_master_active(db: State<'_, AppDatabase>, request: MasterItemStatus) -> Result<MasterMutation, MasterError> {
    let table = table_for(&request.kind).ok_or_else(MasterError::invalid)?;
    let id = clean_text(&request.id, 128)?;
    let conn = db.connection.lock().map_err(|_| MasterError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(MasterError::storage)?;
    if !request.active && request.kind == "FAMILY" {
        let count: i64 = tx.query_row("SELECT count(*) FROM products WHERE product_family_id=?1 AND active=1", [&id], |r| r.get(0)).map_err(MasterError::storage)?;
        if count > 0 { return Err(MasterError::invalid()); }
    }
    let sql = format!("UPDATE {table} SET active=?1 WHERE id=?2");
    if tx.execute(&sql, params![request.active, id]).map_err(MasterError::storage)? != 1 {
        return Err(MasterError::missing());
    }
    audit(&tx, if request.active { "ACTIVATE" } else { "DEACTIVATE" }, &request.kind, &id).map_err(MasterError::storage)?;
    tx.commit().map_err(MasterError::storage)?;
    Ok(MasterMutation { id })
}
#[tauri::command]
pub fn rename_master_item(db: State<'_, AppDatabase>, request: MasterItemName) -> Result<MasterMutation, MasterError> {
    let table = table_for(&request.kind).ok_or_else(MasterError::invalid)?;
    let id = clean_text(&request.id, 128)?;
    let name = clean_text(&request.name, 256)?;
    let column = if request.kind == "EMPLOYEE" { "full_name" } else { "name" };
    let conn = db.connection.lock().map_err(|_| MasterError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(MasterError::storage)?;
    let sql = format!("UPDATE {table} SET {column}=?1 WHERE id=?2");
    if tx.execute(&sql, params![name, id]).map_err(MasterError::storage)? != 1 {
        return Err(MasterError::missing());
    }
    audit(&tx,"RENAME",&request.kind,&id).map_err(MasterError::storage)?;
    tx.commit().map_err(MasterError::storage)?;
    Ok(MasterMutation { id })
}
#[tauri::command]
pub fn create_master_link(db: State<'_, AppDatabase>, request: NewMasterLink) -> Result<MasterMutation, MasterError> {
    let kind = request.kind.as_str();
    let subject = clean_text(&request.subject_id, 128)?;
    let from = if kind == "SKU_UNIT" { String::new() } else { date_range(&request.effective_from,&request.effective_to)? };
    let conn = db.connection.lock().map_err(|_| MasterError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(MasterError::storage)?;
    let id = new_id(&tx).map_err(MasterError::storage)?;
    match kind {
        "SKU_ALIAS" => {
            let npp = request.distributor_id.as_deref().ok_or_else(MasterError::invalid)?;
            let code = clean_text(request.external_code.as_deref().unwrap_or(""),128)?;
            let unit = clean_text(request.unit_code.as_deref().unwrap_or(""),64)?;
            let (num,den) = (request.ratio_num.unwrap_or(0),request.ratio_den.unwrap_or(0));
            if num <= 0 || den <= 0 { return Err(MasterError::invalid()); }
            tx.execute("INSERT INTO sku_aliases(id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den,effective_from,effective_to)
                VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                params![id,npp,code,subject,unit,num,den,from,request.effective_to]).map_err(MasterError::storage)?;
        }
        "EMPLOYEE_ALIAS" => {
            let npp = request.distributor_id.as_deref().ok_or_else(MasterError::invalid)?;
            let code = clean_text(request.external_code.as_deref().unwrap_or(""),128)?;
            tx.execute("INSERT INTO employee_code_aliases(id,distributor_id,raw_employee_code,employee_id,effective_from,effective_to)
                VALUES(?1,?2,?3,?4,?5,?6)",
                params![id,npp,code,subject,from,request.effective_to]).map_err(MasterError::storage)?;
        }
        "MANAGER" => {
            let manager = request.related_id.as_deref().ok_or_else(MasterError::invalid)?;
            let child_role: String = tx.query_row("SELECT role FROM employees WHERE id=?1", [&subject], |r| r.get(0)).map_err(MasterError::storage)?;
            let manager_role: String = tx.query_row("SELECT role FROM employees WHERE id=?1", [manager], |r| r.get(0)).map_err(MasterError::storage)?;
            if !matches!((child_role.as_str(),manager_role.as_str()),
                ("SALES","SUP" | "ASM") | ("SUP","ASM")) { return Err(MasterError::invalid()); }
            tx.execute("INSERT INTO employee_hierarchy_assignments(id,employee_id,manager_employee_id,effective_from,effective_to)
                VALUES(?1,?2,?3,?4,?5)",
                params![id,subject,manager,from,request.effective_to]).map_err(MasterError::storage)?;
        }
        "NPP_STAFF" => {
            let npp = request.distributor_id.as_deref().ok_or_else(MasterError::invalid)?;
            tx.execute("INSERT INTO employee_distributor_assignments(id,employee_id,distributor_id,effective_from,effective_to)
                VALUES(?1,?2,?3,?4,?5)", params![id,subject,npp,from,request.effective_to]).map_err(MasterError::storage)?;
        }
        "ROUTE_STAFF" => {
            let npp = request.distributor_id.as_deref().ok_or_else(MasterError::invalid)?;
            let route = request.related_id.as_deref().ok_or_else(MasterError::invalid)?;
            tx.execute("INSERT INTO employee_route_assignments(id,employee_id,distributor_id,route_id,effective_from,effective_to)
                VALUES(?1,?2,?3,?4,?5,?6)",params![id,subject,npp,route,from,request.effective_to]).map_err(MasterError::storage)?;
        }
        "SKU_UNIT" => {
            let unit = clean_text(request.unit_code.as_deref().unwrap_or(""),64)?;
            let (num,den) = (request.ratio_num.unwrap_or(0),request.ratio_den.unwrap_or(0));
            if num <= 0 || den <= 0 { return Err(MasterError::invalid()); }
            tx.execute("INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den)
                VALUES(?1,?2,?3,?4,?5)",params![id,subject,unit,num,den]).map_err(MasterError::storage)?;
        }
        _ => return Err(MasterError::invalid()),
    }
    audit(&tx,"MAP",kind,&id).map_err(MasterError::storage)?;
    tx.commit().map_err(MasterError::storage)?;
    Ok(MasterMutation { id })
}
#[tauri::command]
pub fn end_master_link(db: State<'_, AppDatabase>, request: EndMasterLink) -> Result<MasterMutation, MasterError> {
    let table = link_table(&request.kind).ok_or_else(MasterError::invalid)?;
    if !valid_date(&request.effective_to) { return Err(MasterError::invalid()); }
    let id = clean_text(&request.id, 128)?;
    let conn = db.connection.lock().map_err(|_| MasterError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(MasterError::storage)?;
    let sql = format!("UPDATE {table} SET effective_to=?1 WHERE id=?2 AND effective_to IS NULL AND effective_from<=?1");
    if tx.execute(&sql,params![request.effective_to,id]).map_err(MasterError::storage)? != 1 {
        return Err(MasterError::missing());
    }
    audit(&tx,"END_MAPPING",&request.kind,&id).map_err(MasterError::storage)?;
    tx.commit().map_err(MasterError::storage)?;
    Ok(MasterMutation { id })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn master_schema_preserves_cross_npp_codes_and_historical_hierarchy() {
        let dir = tempdir().unwrap();
        let db = AppDatabase::open(dir.path()).unwrap();
        let conn = db.connection.lock().unwrap();
        conn.execute_batch("
            INSERT INTO distributors(id,code,name,created_at_utc) VALUES('a','A','NPP A','2026'),('b','B','NPP B','2026');
            INSERT INTO employees(id,code,full_name,role) VALUES('asm','ASM','ASM','ASM'),('sup','SUP','SUP','SUP'),('rep','001','Sales','SALES');
            INSERT INTO employee_code_aliases(id,distributor_id,raw_employee_code,employee_id,effective_from)
              VALUES('a1','a','0001','rep','2026-01-01'),('b1','b','0001','rep','2026-01-01');
            INSERT INTO employee_hierarchy_assignments(id,employee_id,manager_employee_id,effective_from,effective_to)
              VALUES('h1','rep','sup','2026-01-01','2026-06-30');
            INSERT INTO employee_hierarchy_assignments(id,employee_id,manager_employee_id,effective_from)
              VALUES('h2','sup','asm','2026-01-01');
            INSERT INTO product_families(id,code,name) VALUES('f','F','Sản phẩm');
            INSERT INTO products(id,sku_code,name,base_unit,product_family_id) VALUES('sku','S001','SKU','LON','f');
            INSERT INTO sku_aliases(id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den)
              VALUES('s1','a','0007','sku','THUNG',24,1),('s2','b','0007','sku','LON',1,1);
        ").unwrap();
        assert!(conn.execute("INSERT INTO employee_code_aliases(id,distributor_id,raw_employee_code,employee_id,effective_from) VALUES('a2','a','0001','rep','2026-05-01')", []).is_err());
        assert!(conn.execute("INSERT INTO employee_hierarchy_assignments(id,employee_id,manager_employee_id,effective_from) VALUES('h3','asm','rep','2026-05-01')", []).is_err());
        assert!(conn.execute("INSERT INTO employee_hierarchy_assignments(id,employee_id,manager_employee_id,effective_from) VALUES('h4','rep','asm','2026-05-01')", []).is_err());
        assert!(conn.execute("INSERT INTO sku_aliases(id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den,effective_from) VALUES('s3','a','0007','sku','THUNG',24,1,'2026-01-01')", []).is_err());
        let rows: i64 = conn.query_row("SELECT count(*) FROM employee_code_aliases WHERE raw_employee_code='0001'", [], |r| r.get(0)).unwrap();
        assert_eq!(rows, 2);
    }

    #[test]
    fn zero_prefix_and_explicit_unit_conversion_are_retained() {
        let dir = tempdir().unwrap();
        let db = AppDatabase::open(dir.path()).unwrap();
        let conn = db.connection.lock().unwrap();
        conn.execute_batch("
            INSERT INTO products(id,sku_code,name,base_unit) VALUES('0001','0001','Mặt hàng','LON');
            INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den)
              VALUES('box','0001','THUNG',24,1);
        ").unwrap();
        let result: (String,i64,i64) = conn.query_row("SELECT p.sku_code,u.conversion_num,u.conversion_den FROM products p JOIN sku_unit_conversions u ON p.id=u.product_id WHERE u.unit_code='THUNG'", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert_eq!(result, ("0001".into(),24,1));
    }
}
