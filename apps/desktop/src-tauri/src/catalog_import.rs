//! P2 catalog Excel/CSV adapter. Manual entry and batch entry share canonical tables,
//! foreign keys and SQLite overlap triggers. Prices never write sales facts.
use crate::{import_parse, storage::AppDatabase};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogImportError {
    code: &'static str,
    message: String,
}
type Result<T> = std::result::Result<T, CatalogImportError>;
fn invalid(message: &str) -> CatalogImportError {
    CatalogImportError {
        code: "IMPORT_INVALID",
        message: message.to_string(),
    }
}
fn conflict() -> CatalogImportError {
    CatalogImportError {
        code: "IMPORT_CONFLICT",
        message: "Dữ liệu trùng hoặc không khớp với danh mục hiện có.".into(),
    }
}
fn storage(_: rusqlite::Error) -> CatalogImportError {
    CatalogImportError {
        code: "STORAGE_ERROR",
        message: "Không thể kiểm tra hoặc lưu dữ liệu trên máy.".into(),
    }
}
fn clean(value: &str, max: usize) -> Result<String> {
    let v = value.trim();
    if v.is_empty() || v.chars().count() > max || v.chars().any(char::is_control) {
        return Err(invalid("Thiếu giá trị hoặc nội dung không hợp lệ."));
    }
    Ok(v.to_string())
}
fn date(v: &str) -> bool {
    let b = v.as_bytes();
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !b
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
    {
        return false;
    }
    let (y, m, d) = (
        v[0..4].parse::<usize>().unwrap_or(0),
        v[5..7].parse::<usize>().unwrap_or(0),
        v[8..10].parse::<usize>().unwrap_or(0),
    );
    if y == 0 || !(1..=12).contains(&m) {
        return false;
    }
    let days = [
        31,
        if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
            29
        } else {
            28
        },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    (1..=days[m - 1]).contains(&d)
}
fn range(start: &str, end: &str) -> Result<Option<String>> {
    if !date(start) || (!end.is_empty() && (!date(end) || end < start)) {
        return Err(invalid("Ngày bắt đầu hoặc kết thúc không hợp lệ."));
    }
    Ok(if end.is_empty() {
        None
    } else {
        Some(end.to_string())
    })
}
fn positive(v: &str) -> Result<i64> {
    let n = clean(v, 24)?
        .parse::<i64>()
        .map_err(|_| invalid("Tỷ lệ phải là số nguyên dương."))?;
    if n <= 0 {
        return Err(invalid("Tỷ lệ phải lớn hơn 0."));
    }
    Ok(n)
}
fn new_id(tx: &Transaction<'_>) -> Result<String> {
    tx.query_row("SELECT lower(hex(randomblob(16)))", [], |r| r.get(0))
        .map_err(storage)
}
fn audit(tx: &Transaction<'_>, kind: &str, id: &str) -> Result<()> {
    tx.execute("INSERT INTO audit_events(id,event_type,actor_profile_id,entity_type,entity_id,created_at_utc)
      VALUES(lower(hex(randomblob(16))),'IMPORT',(SELECT id FROM local_operator WHERE id=1),?1,?2,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      params![kind,id]).map_err(storage)?;
    Ok(())
}
fn existing_option(
    tx: &Transaction<'_>,
    table: &str,
    code: &str,
) -> Result<Option<(String, String)>> {
    // Only literal table names selected by the caller; never raw user input.
    let sql = format!("SELECT id,name FROM {table} WHERE code=?1 COLLATE NOCASE");
    tx.query_row(&sql, [code], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()
        .map_err(storage)
}
fn catalog_id(tx: &Transaction<'_>, table: &str, code: &str) -> Result<Option<String>> {
    if code.is_empty() {
        return Ok(None);
    }
    existing_option(tx, table, code)?
        .map(|(id, _)| id)
        .ok_or_else(|| invalid("Nhóm hàng, nhãn hàng hoặc đơn vị chưa có trong danh mục."))
        .map(Some)
}
fn id_for_code(tx: &Transaction<'_>, table: &str, column: &str, code: &str) -> Result<String> {
    let sql = format!("SELECT id FROM {table} WHERE {column}=?1 COLLATE NOCASE AND active=1");
    tx.query_row(&sql, [code], |r| r.get(0))
        .optional()
        .map_err(storage)?
        .ok_or_else(|| invalid("Chưa có sản phẩm, SKU hoặc nhà phân phối tương ứng."))
}
fn field<'a>(v: &'a HashMap<String, String>, k: &str) -> &'a str {
    v.get(k).map(String::as_str).unwrap_or("")
}
fn scope_npp(
    tx: &Transaction<'_>,
    req: &CatalogBatchRequest,
    v: &HashMap<String, String>,
) -> Result<String> {
    let code = field(v, "distributorCode");
    if !code.is_empty() {
        return id_for_code(tx, "distributors", "code", code);
    }
    let id = clean(req.distributor_id.as_deref().unwrap_or(""), 128)?;
    tx.query_row(
        "SELECT id FROM distributors WHERE id=?1 AND active=1",
        [&id],
        |r| r.get(0),
    )
    .optional()
    .map_err(storage)?
    .ok_or_else(|| invalid("Nhà phân phối chưa hợp lệ."))
}
fn apply(
    tx: &Transaction<'_>,
    req: &CatalogBatchRequest,
    v: &HashMap<String, String>,
    row: usize,
) -> Result<(String, &'static str, String)> {
    let kind = req.kind.as_str();
    if matches!(kind, "CATEGORY" | "BRAND" | "UNIT_CATALOG") {
        let table = match kind {
            "CATEGORY" => "catalog_categories",
            "BRAND" => "catalog_brands",
            _ => "catalog_units",
        };
        let code = clean(field(v, "code"), 96)?.to_ascii_uppercase();
        let name = clean(field(v, "name"), 256)?;
        if let Some((id, old)) = existing_option(tx, table, &code)? {
            if old != name {
                return Err(conflict());
            }
            return Ok((id, "UNCHANGED", format!("{kind}:{code}")));
        }
        let id = new_id(tx)?;
        tx.execute(
            &format!("INSERT INTO {table}(id,code,name) VALUES(?1,?2,?3)"),
            params![id, code, name],
        )
        .map_err(storage)?;
        audit(tx, kind, &id)?;
        return Ok((id, "ADDED", format!("{kind}:{code}")));
    }
    if kind == "FAMILY" {
        let code = clean(field(v, "code"), 96)?.to_ascii_uppercase();
        let name = clean(field(v, "name"), 256)?;
        let category_code = field(v, "categoryCode").trim().to_ascii_uppercase();
        let brand_code = field(v, "brandCode").trim().to_ascii_uppercase();
        let category_id = catalog_id(tx, "catalog_categories", &category_code)?;
        let brand_id = catalog_id(tx, "catalog_brands", &brand_code)?;
        let old:Option<(String,String,Option<String>,Option<String>)>=tx.query_row(
            "SELECT id,name,category_id,brand_id FROM product_families WHERE code=?1 COLLATE NOCASE",
            [&code],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional().map_err(storage)?;
        if let Some((id, n, c, b)) = old {
            if n != name || c != category_id || b != brand_id {
                return Err(conflict());
            }
            return Ok((id, "UNCHANGED", format!("FAMILY:{code}")));
        }
        let id = new_id(tx)?;
        tx.execute(
            "INSERT INTO product_families(id,code,name,category_id,brand_id,category,brand)
            VALUES(?1,?2,?3,?4,?5,
              (SELECT name FROM catalog_categories WHERE id=?4),
              (SELECT name FROM catalog_brands WHERE id=?5))",
            params![id, code, name, category_id, brand_id],
        )
        .map_err(storage)?;
        audit(tx, kind, &id)?;
        return Ok((id, "ADDED", format!("FAMILY:{code}")));
    }
    if kind == "SKU" {
        let code = clean(field(v, "code"), 96)?.to_ascii_uppercase();
        let name = clean(field(v, "name"), 256)?;
        let family = id_for_code(
            tx,
            "product_families",
            "code",
            &clean(field(v, "familyCode"), 96)?,
        )?;
        let unit = clean(field(v, "unitCode"), 32)?.to_ascii_uppercase();
        let old:Option<(String,String,String,Option<String>)>=tx.query_row(
            "SELECT id,name,base_unit,product_family_id FROM products WHERE sku_code=?1 COLLATE NOCASE",
            [&code],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional().map_err(storage)?;
        if let Some((id, n, u, f)) = old {
            if n != name || u != unit || f.as_deref() != Some(family.as_str()) {
                return Err(conflict());
            }
            return Ok((id, "UNCHANGED", format!("SKU:{code}")));
        }
        let id = new_id(tx)?;
        tx.execute("INSERT INTO products(id,sku_code,name,base_unit,product_family_id) VALUES(?1,?2,?3,?4,?5)",
            params![id,code,name,unit,family]).map_err(storage)?;
        tx.execute("INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den)
           VALUES(lower(hex(randomblob(16))),?1,?2,1,1)",params![id,unit]).map_err(storage)?;
        audit(tx, kind, &id)?;
        return Ok((id, "ADDED", format!("SKU:{code}")));
    }
    if kind == "CONVERSION" {
        let sku = clean(field(v, "skuCode"), 96)?;
        let sku_id = id_for_code(tx, "products", "sku_code", &sku)?;
        let unit = clean(field(v, "unitCode"), 64)?.to_ascii_uppercase();
        let num = positive(field(v, "ratioNum"))?;
        let den = positive(field(v, "ratioDen"))?;
        let old:Option<(String,i64,i64)>=tx.query_row(
            "SELECT id,conversion_num,conversion_den FROM sku_unit_conversions WHERE product_id=?1 AND unit_code=?2 COLLATE NOCASE",
            params![sku_id,unit],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(storage)?;
        if let Some((id, n, d)) = old {
            if n != num || d != den {
                return Err(conflict());
            }
            return Ok((id, "UNCHANGED", format!("CONVERSION:{sku}:{unit}")));
        }
        let id = new_id(tx)?;
        tx.execute("INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den)
          VALUES(?1,?2,?3,?4,?5)",params![id,sku_id,unit,num,den]).map_err(storage)?;
        audit(tx, kind, &id)?;
        return Ok((id, "ADDED", format!("CONVERSION:{sku}:{unit}")));
    }
    if kind == "ALIAS" {
        let npp = scope_npp(tx, req, v)?;
        let sku = clean(field(v, "skuCode"), 96)?;
        let sku_id = id_for_code(tx, "products", "sku_code", &sku)?;
        let code = clean(field(v, "rawCode"), 128)?;
        let unit = clean(field(v, "unitCode"), 64)?.to_ascii_uppercase();
        let num = positive(field(v, "ratioNum"))?;
        let den = positive(field(v, "ratioDen"))?;
        let start = clean(field(v, "from"), 10)?;
        let end = range(&start, field(v, "to"))?;
        let registered:Option<(i64,i64)>=tx.query_row(
            "SELECT conversion_num,conversion_den FROM sku_unit_conversions WHERE product_id=?1 AND unit_code=?2 COLLATE NOCASE",
            params![sku_id,unit],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(storage)?;
        if registered != Some((num, den)) {
            return Err(invalid("Đơn vị và quy đổi chưa khớp SKU chuẩn."));
        }
        let old:Option<(String,String,i64,i64,Option<String>)>=tx.query_row(
            "SELECT id,product_id,conversion_num,conversion_den,effective_to FROM sku_aliases
             WHERE distributor_id=?1 AND raw_sku_code=?2 AND raw_unit=?3 COLLATE NOCASE AND effective_from=?4",
            params![npp,code,unit,start],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional().map_err(storage)?;
        if let Some((id, s, n, d, until)) = old {
            if s != sku_id || n != num || d != den || until != end {
                return Err(conflict());
            }
            return Ok((
                id,
                "UNCHANGED",
                format!("ALIAS:{npp}:{code}:{unit}:{start}"),
            ));
        }
        let id = new_id(tx)?;
        tx.execute("INSERT INTO sku_aliases(id,distributor_id,raw_sku_code,product_id,raw_unit,
         conversion_num,conversion_den,effective_from,effective_to) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
         params![id,npp,code,sku_id,unit,num,den,start,end]).map_err(storage)?;
        audit(tx, kind, &id)?;
        return Ok((id, "ADDED", format!("ALIAS:{npp}:{code}:{unit}:{start}")));
    }
    if kind == "PRICE" {
        let sku = clean(field(v, "skuCode"), 96)?;
        let sku_id = id_for_code(tx, "products", "sku_code", &sku)?;
        let unit = clean(field(v, "unitCode"), 64)?.to_ascii_uppercase();
        let amount = clean(field(v, "amountVnd"), 20)?
            .parse::<i64>()
            .map_err(|_| invalid("Giá phải là số VND nguyên, không âm."))?;
        if amount < 0 {
            return Err(invalid("Giá VND không được âm."));
        }
        let start = clean(field(v, "from"), 10)?;
        let end = range(&start, field(v, "to"))?;
        let npp = scope_npp(tx, req, v)?;
        let list = if !field(v, "priceListCode").is_empty() {
            tx.query_row("SELECT id FROM price_lists WHERE distributor_id=?1 AND code=?2 COLLATE NOCASE AND active=1",
                params![npp,field(v,"priceListCode")],|r|r.get(0)).optional().map_err(storage)?
                .ok_or_else(||invalid("Không có bảng giá này ở NPP đã chọn."))?
        } else {
            clean(req.price_list_id.as_deref().unwrap_or(""), 128)?
        };
        let bounds:Option<(String,Option<String>)>=tx.query_row(
            "SELECT effective_from,effective_to FROM price_lists WHERE id=?1 AND distributor_id=?2 AND active=1",
            params![list,npp],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(storage)?;
        let (list_from, list_to) =
            bounds.ok_or_else(|| invalid("Bảng giá không thuộc NPP đã chọn."))?;
        if start < list_from
            || list_to
                .as_deref()
                .is_some_and(|t| end.as_deref().is_none_or(|d| d > t))
        {
            return Err(invalid("Ngày giá nằm ngoài kỳ bảng giá."));
        }
        let unit_exists:bool=tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM sku_unit_conversions WHERE product_id=?1 AND unit_code=?2 COLLATE NOCASE)",
            params![sku_id,unit],|r|r.get(0)).map_err(storage)?;
        if !unit_exists {
            return Err(invalid("Đơn vị giá chưa được đăng ký cho SKU."));
        }
        let old:Option<(String,i64,Option<String>)>=tx.query_row(
            "SELECT id,amount_vnd,effective_to FROM price_list_items
             WHERE price_list_id=?1 AND product_id=?2 AND unit_code=?3 COLLATE NOCASE AND effective_from=?4 AND active=1",
            params![list,sku_id,unit,start],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(storage)?;
        if let Some((id, v, until)) = old {
            if v != amount || until != end {
                return Err(conflict());
            }
            return Ok((
                id,
                "UNCHANGED",
                format!("PRICE:{list}:{sku}:{unit}:{start}"),
            ));
        }
        let id = new_id(tx)?;
        let source = format!(
            "Excel: {} / {} / dòng {}",
            req.file_name, req.sheet_name, row
        );
        let source: String = source.chars().take(256).collect();
        tx.execute(
            "INSERT INTO price_list_items(id,price_list_id,product_id,unit_code,amount_vnd,
          effective_from,effective_to,source_note) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, list, sku_id, unit, amount, start, end, source],
        )
        .map_err(storage)?;
        audit(tx, kind, &id)?;
        return Ok((id, "ADDED", format!("PRICE:{list}:{sku}:{unit}:{start}")));
    }
    Err(invalid("Loại danh mục không được hỗ trợ."))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogBatchRequest {
    file_name: String,
    bytes: Vec<u8>,
    sheet_name: String,
    header_row: usize,
    kind: String,
    columns: HashMap<String, usize>,
    #[serde(default)]
    fixed_values: HashMap<String, String>,
    distributor_id: Option<String>,
    price_list_id: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogRowStatus {
    row: usize,
    status: &'static str,
    message: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogBatchPreview {
    fingerprint: String,
    total_rows: usize,
    inserted_rows: usize,
    unchanged_rows: usize,
    error_rows: usize,
    issues: Vec<CatalogRowStatus>,
    sample: Vec<CatalogRowStatus>,
    already_imported: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogBatchResult {
    id: String,
    inserted_rows: usize,
    unchanged_rows: usize,
    already_imported: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogRun {
    id: String,
    kind: String,
    source_file_name: String,
    source_sheet: String,
    total_rows: i64,
    inserted_rows: i64,
    unchanged_rows: i64,
    created_at_utc: String,
}
fn fingerprint(req: &CatalogBatchRequest) -> String {
    let mut parts = vec![
        req.kind.clone(),
        req.sheet_name.clone(),
        req.header_row.to_string(),
        req.distributor_id.clone().unwrap_or_default(),
        req.price_list_id.clone().unwrap_or_default(),
        format!("{:x}", Sha256::digest(&req.bytes)),
    ];
    let mut mappings: Vec<_> = req.columns.iter().collect();
    mappings.sort_by_key(|(k, _)| k.as_str());
    for (k, v) in mappings {
        parts.push(format!("{k}={v}"));
    }
    let mut fixed: Vec<_> = req.fixed_values.iter().collect();
    fixed.sort_by_key(|(k, _)| k.as_str());
    for (k, v) in fixed {
        parts.push(format!("{k}={v}"));
    }
    format!("{:x}", Sha256::digest(parts.join("\u{1f}").as_bytes()))
}
fn valid_request(req: &CatalogBatchRequest) -> Result<()> {
    if ![
        "CATEGORY",
        "BRAND",
        "UNIT_CATALOG",
        "FAMILY",
        "SKU",
        "CONVERSION",
        "ALIAS",
        "PRICE",
    ]
    .contains(&req.kind.as_str())
    {
        return Err(invalid("Loại dữ liệu nhập chưa hợp lệ."));
    }
    clean(&req.file_name, 256)?;
    clean(&req.sheet_name, 128)?;
    if req.header_row == 0 || req.columns.is_empty() {
        return Err(invalid("Chưa chọn dòng tiêu đề và cột dữ liệu."));
    }
    let mut selected = HashSet::new();
    if req
        .columns
        .values()
        .any(|i| *i >= 100 || !selected.insert(*i))
    {
        return Err(invalid("Một cột Excel chỉ được gán cho một trường."));
    }
    Ok(())
}
fn source_rows(req: &CatalogBatchRequest) -> Result<Vec<(usize, HashMap<String, String>)>> {
    valid_request(req)?;
    let sheets = import_parse::parse(&req.file_name, &req.bytes).map_err(|e| invalid(&e))?;
    let sheet = sheets
        .iter()
        .find(|s| s.name == req.sheet_name)
        .ok_or_else(|| invalid("Không tìm thấy trang Excel đã chọn."))?;
    if sheet.has_formulas {
        return Err(invalid(
            "Trang Excel có công thức. Hãy lưu bản chỉ chứa giá trị trước khi nhập.",
        ));
    }
    if !sheet.rows.iter().any(|(i, _)| *i == req.header_row) {
        return Err(invalid("Không thấy dòng tiêu đề."));
    }
    let mut result = Vec::new();
    for (number, values) in sheet.rows.iter().filter(|(i, _)| *i > req.header_row) {
        if values.iter().all(|v| v.trim().is_empty()) {
            continue;
        }
        let mut row = req.fixed_values.clone();
        for (key, index) in &req.columns {
            let value = values
                .get(*index)
                .map(String::as_str)
                .unwrap_or("")
                .trim()
                .to_string();
            row.insert(key.clone(), value);
        }
        result.push((*number, row));
    }
    if result.is_empty() {
        return Err(invalid("Trang Excel không có dòng dữ liệu."));
    }
    Ok(result)
}
fn run(
    conn: &Connection,
    req: &CatalogBatchRequest,
    commit: bool,
    expected: Option<&str>,
) -> Result<(CatalogBatchPreview, Option<String>)> {
    let rows = source_rows(req)?;
    let stamp = fingerprint(req);
    if let Some(expected) = expected {
        if expected != stamp {
            return Err(invalid(
                "Tệp hoặc cách chọn cột đã thay đổi. Hãy xem trước lại.",
            ));
        }
    }
    let old: Option<String> = conn
        .query_row(
            "SELECT id FROM catalog_import_runs WHERE fingerprint=?1",
            [&stamp],
            |r| r.get(0),
        )
        .optional()
        .map_err(storage)?;
    if old.is_some() {
        return Ok((
            CatalogBatchPreview {
                fingerprint: stamp,
                total_rows: rows.len(),
                inserted_rows: 0,
                unchanged_rows: rows.len(),
                error_rows: 0,
                issues: vec![],
                sample: vec![],
                already_imported: true,
            },
            old,
        ));
    }
    let tx = conn.unchecked_transaction().map_err(storage)?;
    let mut seen = HashSet::new();
    let mut events = Vec::new();
    let mut preview = CatalogBatchPreview {
        fingerprint: stamp,
        total_rows: rows.len(),
        inserted_rows: 0,
        unchanged_rows: 0,
        error_rows: 0,
        issues: Vec::new(),
        sample: Vec::new(),
        already_imported: false,
    };
    for (number, fields) in rows {
        match apply(&tx, req, &fields, number) {
            Ok((id, action, key)) => {
                if !seen.insert(key) {
                    preview.error_rows += 1;
                    if preview.issues.len() < 100 {
                        preview.issues.push(CatalogRowStatus {
                            row: number,
                            status: "ERROR",
                            message: "Dòng dữ liệu bị lặp ngay trong tệp.".into(),
                        });
                    }
                    continue;
                }
                if action == "ADDED" {
                    preview.inserted_rows += 1;
                } else {
                    preview.unchanged_rows += 1;
                }
                if preview.sample.len() < 50 {
                    preview.sample.push(CatalogRowStatus {
                        row: number,
                        status: action,
                        message: if action == "ADDED" {
                            "Thêm mới".into()
                        } else {
                            "Đã có, không ghi trùng".into()
                        },
                    });
                }
                events.push((number, action, id));
            }
            Err(e) => {
                preview.error_rows += 1;
                if preview.issues.len() < 100 {
                    preview.issues.push(CatalogRowStatus {
                        row: number,
                        status: "ERROR",
                        message: e.message,
                    });
                }
            }
        }
    }
    if !commit {
        return Ok((preview, None));
    } // Transaction is rolled back; preview never persists.
    if preview.error_rows > 0 {
        return Err(invalid(
            "Có dòng cần xử lý. Không ghi dữ liệu để tránh nhập thiếu hoặc sai.",
        ));
    }
    let run_id = new_id(&tx)?;
    tx.execute("INSERT INTO catalog_import_runs(id,fingerprint,content_sha256,kind,distributor_id,price_list_id,
      source_file_name,source_sheet,total_rows,inserted_rows,unchanged_rows) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
      params![run_id,preview.fingerprint,format!("{:x}",Sha256::digest(&req.bytes)),
       req.kind,req.distributor_id,req.price_list_id,req.file_name,req.sheet_name,
       preview.total_rows as i64,preview.inserted_rows as i64,preview.unchanged_rows as i64]).map_err(storage)?;
    for (number, action, id) in events {
        tx.execute("INSERT INTO catalog_import_row_events(run_id,excel_row,action,entity_kind,entity_id) VALUES(?1,?2,?3,?4,?5)",
          params![run_id,number as i64,action,req.kind,id]).map_err(storage)?;
    }
    tx.commit().map_err(storage)?;
    Ok((preview, Some(run_id)))
}
#[tauri::command]
pub fn preview_catalog_import(
    db: State<'_, AppDatabase>,
    request: CatalogBatchRequest,
) -> Result<CatalogBatchPreview> {
    let conn = db
        .connection
        .lock()
        .map_err(|_| invalid("Không mở được dữ liệu trên máy."))?;
    run(&conn, &request, false, None).map(|(p, _)| p)
}
#[tauri::command]
pub fn commit_catalog_import(
    db: State<'_, AppDatabase>,
    request: CatalogBatchRequest,
    expected_fingerprint: String,
) -> Result<CatalogBatchResult> {
    let conn = db
        .connection
        .lock()
        .map_err(|_| invalid("Không mở được dữ liệu trên máy."))?;
    let (p, id) = run(&conn, &request, true, Some(&expected_fingerprint))?;
    Ok(CatalogBatchResult {
        id: id.unwrap_or_default(),
        inserted_rows: p.inserted_rows,
        unchanged_rows: p.unchanged_rows,
        already_imported: p.already_imported,
    })
}
#[tauri::command]
pub fn list_catalog_import_history(db: State<'_, AppDatabase>) -> Result<Vec<CatalogRun>> {
    let conn = db
        .connection
        .lock()
        .map_err(|_| invalid("Không mở được dữ liệu trên máy."))?;
    let mut stmt=conn.prepare("SELECT id,kind,source_file_name,source_sheet,total_rows,inserted_rows,
         unchanged_rows,created_at_utc FROM catalog_import_runs ORDER BY created_at_utc DESC LIMIT 100").map_err(storage)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CatalogRun {
                id: r.get(0)?,
                kind: r.get(1)?,
                source_file_name: r.get(2)?,
                source_sheet: r.get(3)?,
                total_rows: r.get(4)?,
                inserted_rows: r.get(5)?,
                unchanged_rows: r.get(6)?,
                created_at_utc: r.get(7)?,
            })
        })
        .map_err(storage)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(storage)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn calendar_bounds_and_integer_validation() {
        assert!(date("2026-02-28"));
        assert!(!date("2026-02-30"));
        assert!(date("2024-02-29"));
        assert!(!date("2025-02-29"));
        assert!(range("2026-01-01", "2025-12-31").is_err());
        assert_eq!(positive("12").unwrap(), 12);
        assert!(positive("1.5").is_err());
    }
    #[test]
    fn previews_1446_rows_without_persisting_or_mangling_zero_prefix() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE catalog_categories(id TEXT PRIMARY KEY,code TEXT UNIQUE,name TEXT,active INTEGER DEFAULT 1);
          CREATE TABLE audit_events(id TEXT,event_type TEXT,actor_profile_id TEXT,entity_type TEXT,entity_id TEXT,created_at_utc TEXT);
          CREATE TABLE catalog_import_runs(id TEXT,fingerprint TEXT,content_sha256 TEXT,kind TEXT,distributor_id TEXT,price_list_id TEXT,
             source_file_name TEXT,source_sheet TEXT,total_rows INTEGER,inserted_rows INTEGER,unchanged_rows INTEGER,created_at_utc TEXT);
          CREATE TABLE catalog_import_row_events(run_id TEXT,excel_row INTEGER,action TEXT,entity_kind TEXT,entity_id TEXT);
          CREATE TABLE local_operator(id INTEGER);").unwrap();
        let mut data = String::from("Mã,Tên\n");
        for i in 0..1446 {
            data.push_str(&format!("{:05},Nhóm {}\n", i, i));
        }
        let req = CatalogBatchRequest {
            file_name: "danh-muc.csv".into(),
            bytes: data.into_bytes(),
            sheet_name: "CSV".into(),
            header_row: 1,
            kind: "CATEGORY".into(),
            columns: HashMap::from([("code".into(), 0), ("name".into(), 1)]),
            fixed_values: HashMap::new(),
            distributor_id: None,
            price_list_id: None,
        };
        let (p, _) = run(&c, &req, false, None).unwrap();
        assert_eq!(p.total_rows, 1446);
        assert_eq!(p.inserted_rows, 1446);
        assert_eq!(p.error_rows, 0);
        assert_eq!(
            c.query_row("SELECT count(*) FROM catalog_categories", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
        let (p, id) = run(&c, &req, true, Some(&p.fingerprint)).unwrap();
        assert_eq!(p.inserted_rows, 1446);
        assert!(id.is_some());
        let (p, _) = run(&c, &req, true, Some(&p.fingerprint)).unwrap();
        assert!(p.already_imported);
        assert_eq!(
            c.query_row(
                "SELECT code FROM catalog_categories WHERE code='00001'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "00001"
        );
    }
    #[test]
    fn imports_1446_reference_prices_without_touching_sales() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "CREATE TABLE distributors(id TEXT PRIMARY KEY,code TEXT,active INTEGER DEFAULT 1);
             CREATE TABLE products(id TEXT PRIMARY KEY,sku_code TEXT,active INTEGER DEFAULT 1);
             CREATE TABLE sku_unit_conversions(id TEXT PRIMARY KEY,product_id TEXT,unit_code TEXT,conversion_num INTEGER,conversion_den INTEGER);
             CREATE TABLE price_lists(id TEXT PRIMARY KEY,distributor_id TEXT,code TEXT,active INTEGER DEFAULT 1,effective_from TEXT,effective_to TEXT);
             CREATE TABLE price_list_items(id TEXT PRIMARY KEY,price_list_id TEXT,product_id TEXT,unit_code TEXT,amount_vnd INTEGER,
                 effective_from TEXT,effective_to TEXT,source_note TEXT,active INTEGER DEFAULT 1);
             CREATE TABLE audit_events(id TEXT,event_type TEXT,actor_profile_id TEXT,entity_type TEXT,entity_id TEXT,created_at_utc TEXT);
             CREATE TABLE local_operator(id INTEGER);
             CREATE TABLE catalog_import_runs(id TEXT,fingerprint TEXT,content_sha256 TEXT,kind TEXT,distributor_id TEXT,price_list_id TEXT,
                 source_file_name TEXT,source_sheet TEXT,total_rows INTEGER,inserted_rows INTEGER,unchanged_rows INTEGER,created_at_utc TEXT);
             CREATE TABLE catalog_import_row_events(run_id TEXT,excel_row INTEGER,action TEXT,entity_kind TEXT,entity_id TEXT);
             INSERT INTO distributors(id,code) VALUES('npp','0001');
             INSERT INTO price_lists(id,distributor_id,code,effective_from) VALUES('list','npp','L1','2026-01-01');",
        ).unwrap();
        let mut csv = String::from("SKU,Don vi,Gia,Ngay\n");
        for n in 0..1446 {
            let sku = format!("SKU{n:05}");
            let id = format!("product{n}");
            c.execute(
                "INSERT INTO products(id,sku_code) VALUES(?1,?2)",
                params![id, sku],
            ).unwrap();
            c.execute(
                "INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den) VALUES(?1,?2,'LON',1,1)",
                params![format!("unit{n}"), id],
            ).unwrap();
            csv.push_str(&format!("{sku},LON,{},2026-10-01\n", 10000 + n));
        }
        let req = CatalogBatchRequest {
            file_name: "bang-gia-1446.csv".into(),
            bytes: csv.into_bytes(),
            sheet_name: "CSV".into(),
            header_row: 1,
            kind: "PRICE".into(),
            columns: HashMap::from([
                ("skuCode".into(), 0),
                ("unitCode".into(), 1),
                ("amountVnd".into(), 2),
                ("from".into(), 3),
            ]),
            fixed_values: HashMap::new(),
            distributor_id: Some("npp".into()),
            price_list_id: Some("list".into()),
        };
        let (preview, _) = run(&c, &req, false, None).unwrap();
        assert_eq!(preview.total_rows, 1446);
        assert_eq!(preview.inserted_rows, 1446);
        assert_eq!(preview.error_rows, 0);
        let before: i64 = c.query_row("SELECT count(*) FROM price_list_items", [], |r| r.get(0)).unwrap();
        assert_eq!(before, 0);
        let (saved, _) = run(&c, &req, true, Some(&preview.fingerprint)).unwrap();
        assert_eq!(saved.inserted_rows, 1446);
        let persisted: i64 = c.query_row("SELECT count(*) FROM price_list_items", [], |r| r.get(0)).unwrap();
        assert_eq!(persisted, 1446);
        let (again, _) = run(&c, &req, true, Some(&preview.fingerprint)).unwrap();
        assert!(again.already_imported);
        let unchanged: i64 = c.query_row("SELECT count(*) FROM price_list_items", [], |r| r.get(0)).unwrap();
        assert_eq!(unchanged, 1446);
    }

}
