//! P1: catalog lookups and NPP-scoped reference prices. No revenue is calculated here.
use crate::storage::AppDatabase;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogError {
    code: &'static str,
    message: &'static str,
}
impl CatalogError {
    fn invalid() -> Self {
        Self {
            code: "VALIDATION_ERROR",
            message: "Thông tin danh mục, giá hoặc ngày hiệu lực chưa hợp lệ.",
        }
    }
    fn conflict() -> Self {
        Self {
            code: "MASTER_CONFLICT",
            message: "Dữ liệu trùng, xung đột đơn vị hoặc khoảng thời gian áp dụng.",
        }
    }
    fn missing() -> Self {
        Self {
            code: "MASTER_NOT_FOUND",
            message: "Không tìm thấy danh mục hoặc bảng giá.",
        }
    }
    fn storage(error: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(ref failure, _) = error {
            if failure.code == rusqlite::ErrorCode::ConstraintViolation {
                return Self::conflict();
            }
        }
        Self {
            code: "STORAGE_ERROR",
            message: "Không thể đọc hoặc lưu dữ liệu trên máy.",
        }
    }
    fn unavailable() -> Self {
        Self {
            code: "STORAGE_ERROR",
            message: "Không thể truy cập dữ liệu trên máy.",
        }
    }
}
type Result<T> = std::result::Result<T, CatalogError>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewCatalogOption {
    kind: String,
    code: String,
    name: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssignFamilyCatalog {
    family_id: String,
    category_id: Option<String>,
    brand_id: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewPriceList {
    distributor_id: String,
    code: String,
    name: String,
    price_type: String,
    effective_from: String,
    effective_to: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewPriceItem {
    price_list_id: String,
    product_id: String,
    unit_code: String,
    amount_vnd: i64,
    effective_from: String,
    effective_to: Option<String>,
    source_note: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClosePriceItem {
    id: String,
    effective_to: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResolveCatalogRequest {
    distributor_id: String,
    raw_sku_code: String,
    raw_unit: String,
    business_date: String,
    price_type: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogMutation {
    id: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogOption {
    id: String,
    code: String,
    name: String,
    active: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceList {
    id: String,
    distributor_id: String,
    code: String,
    name: String,
    price_type: String,
    effective_from: String,
    effective_to: Option<String>,
    active: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceItem {
    id: String,
    price_list_id: String,
    product_id: String,
    unit_code: String,
    amount_vnd: i64,
    effective_from: String,
    effective_to: Option<String>,
    source_note: Option<String>,
    active: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSnapshot {
    categories: Vec<CatalogOption>,
    brands: Vec<CatalogOption>,
    units: Vec<CatalogOption>,
    price_lists: Vec<PriceList>,
    price_items: Vec<PriceItem>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedProduct {
    id: String,
    sku_code: String,
    sku_name: String,
    family_name: Option<String>,
    base_unit: String,
    conversion_num: i64,
    conversion_den: i64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferencePrice {
    price_list_id: String,
    amount_vnd: i64,
    unit_code: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogResolution {
    sku_status: &'static str,
    product: Option<ResolvedProduct>,
    price_status: &'static str,
    reference_price: Option<ReferencePrice>,
}

fn clean(raw: &str, limit: usize) -> Result<String> {
    let value = raw.trim();
    if value.is_empty() || value.chars().count() > limit || value.chars().any(char::is_control) {
        return Err(CatalogError::invalid());
    }
    Ok(value.to_string())
}
fn calendar_date(value: &str) -> bool {
    let b = value.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    if !b.iter().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit()) {
        return false;
    }
    let year: i32 = value[0..4].parse().unwrap_or(0);
    let month: usize = value[5..7].parse().unwrap_or(0);
    let day: usize = value[8..10].parse().unwrap_or(0);
    if year == 0 || !(1..=12).contains(&month) {
        return false;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    (1..=days[month - 1]).contains(&day)
}
fn period(start: &str, end: Option<&str>) -> Result<()> {
    if !calendar_date(start) || end.is_some_and(|d| !calendar_date(d) || d < start) {
        return Err(CatalogError::invalid());
    }
    Ok(())
}
fn audit(tx: &Transaction<'_>, action: &str, kind: &str, id: &str) -> Result<()> {
    tx.execute(
        "INSERT INTO audit_events(id,event_type,actor_profile_id,entity_type,entity_id,created_at_utc)
         VALUES(lower(hex(randomblob(16))),?1,(SELECT id FROM local_operator WHERE id=1),?2,?3,
         strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
        params![action, kind, id],
    )
    .map_err(CatalogError::storage)?;
    Ok(())
}
fn new_id(tx: &Transaction<'_>) -> Result<String> {
    tx.query_row("SELECT lower(hex(randomblob(16)))", [], |r| r.get(0))
        .map_err(CatalogError::storage)
}
fn read_rows<T>(
    conn: &Connection,
    sql: &str,
    mapper: impl FnMut(&Row<'_>) -> rusqlite::Result<T>,
) -> Result<Vec<T>> {
    let mut stmt = conn.prepare(sql).map_err(CatalogError::storage)?;
    let rows = stmt.query_map([], mapper).map_err(CatalogError::storage)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CatalogError::storage)
}
fn catalog_option(row: &Row<'_>) -> rusqlite::Result<CatalogOption> {
    Ok(CatalogOption {
        id: row.get(0)?,
        code: row.get(1)?,
        name: row.get(2)?,
        active: row.get(3)?,
    })
}

#[tauri::command]
pub fn list_catalog(db: State<'_, AppDatabase>) -> Result<CatalogSnapshot> {
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    let categories = read_rows(
        &conn,
        "SELECT id,code,name,active FROM catalog_categories ORDER BY name",
        catalog_option,
    )?;
    let brands = read_rows(
        &conn,
        "SELECT id,code,name,active FROM catalog_brands ORDER BY name",
        catalog_option,
    )?;
    let units = read_rows(
        &conn,
        "SELECT id,code,name,active FROM catalog_units ORDER BY code",
        catalog_option,
    )?;
    let price_lists = read_rows(
        &conn,
        "SELECT id,distributor_id,code,name,price_type,effective_from,effective_to,active
         FROM price_lists ORDER BY distributor_id,price_type,code",
        |r| {
            Ok(PriceList {
                id: r.get(0)?,
                distributor_id: r.get(1)?,
                code: r.get(2)?,
                name: r.get(3)?,
                price_type: r.get(4)?,
                effective_from: r.get(5)?,
                effective_to: r.get(6)?,
                active: r.get(7)?,
            })
        },
    )?;
    let price_items = read_rows(
        &conn,
        "SELECT id,price_list_id,product_id,unit_code,amount_vnd,effective_from,effective_to,
         source_note,active FROM price_list_items ORDER BY price_list_id,product_id,effective_from",
        |r| {
            Ok(PriceItem {
                id: r.get(0)?,
                price_list_id: r.get(1)?,
                product_id: r.get(2)?,
                unit_code: r.get(3)?,
                amount_vnd: r.get(4)?,
                effective_from: r.get(5)?,
                effective_to: r.get(6)?,
                source_note: r.get(7)?,
                active: r.get(8)?,
            })
        },
    )?;
    Ok(CatalogSnapshot {
        categories,
        brands,
        units,
        price_lists,
        price_items,
    })
}
fn option_table(kind: &str) -> Result<&'static str> {
    match kind {
        "CATEGORY" => Ok("catalog_categories"),
        "BRAND" => Ok("catalog_brands"),
        "UNIT" => Ok("catalog_units"),
        _ => Err(CatalogError::invalid()),
    }
}
#[tauri::command]
pub fn create_catalog_option(
    db: State<'_, AppDatabase>,
    request: NewCatalogOption,
) -> Result<CatalogMutation> {
    let table = option_table(&request.kind)?;
    let code = clean(&request.code, 96)?.to_ascii_uppercase();
    let name = clean(&request.name, 256)?;
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(CatalogError::storage)?;
    let id = new_id(&tx)?;
    let sql = format!("INSERT INTO {table}(id,code,name) VALUES(?1,?2,?3)");
    tx.execute(&sql, params![id, code, name])
        .map_err(CatalogError::storage)?;
    audit(&tx, "CREATE", &request.kind, &id)?;
    tx.commit().map_err(CatalogError::storage)?;
    Ok(CatalogMutation { id })
}
#[tauri::command]
pub fn assign_family_catalog(
    db: State<'_, AppDatabase>,
    request: AssignFamilyCatalog,
) -> Result<CatalogMutation> {
    let family = clean(&request.family_id, 128)?;
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(CatalogError::storage)?;
    let changed = tx
        .execute(
            "UPDATE product_families SET category_id=?1,brand_id=?2,
             category=(SELECT name FROM catalog_categories WHERE id=?1),
             brand=(SELECT name FROM catalog_brands WHERE id=?2) WHERE id=?3",
            params![request.category_id, request.brand_id, family],
        )
        .map_err(CatalogError::storage)?;
    if changed == 0 {
        return Err(CatalogError::missing());
    }
    audit(&tx, "ASSIGN", "FAMILY_CATALOG", &family)?;
    tx.commit().map_err(CatalogError::storage)?;
    Ok(CatalogMutation { id: family })
}
#[tauri::command]
pub fn create_price_list(
    db: State<'_, AppDatabase>,
    request: NewPriceList,
) -> Result<CatalogMutation> {
    let distributor = clean(&request.distributor_id, 128)?;
    let code = clean(&request.code, 96)?.to_ascii_uppercase();
    let name = clean(&request.name, 256)?;
    let price_type = clean(&request.price_type, 64)?.to_ascii_uppercase();
    period(&request.effective_from, request.effective_to.as_deref())?;
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(CatalogError::storage)?;
    let id = new_id(&tx)?;
    tx.execute(
        "INSERT INTO price_lists(id,distributor_id,code,name,price_type,effective_from,effective_to)
         VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            id,
            distributor,
            code,
            name,
            price_type,
            request.effective_from,
            request.effective_to
        ],
    )
    .map_err(CatalogError::storage)?;
    audit(&tx, "CREATE", "PRICE_LIST", &id)?;
    tx.commit().map_err(CatalogError::storage)?;
    Ok(CatalogMutation { id })
}
#[tauri::command]
pub fn create_price_item(
    db: State<'_, AppDatabase>,
    request: NewPriceItem,
) -> Result<CatalogMutation> {
    let list_id = clean(&request.price_list_id, 128)?;
    let product_id = clean(&request.product_id, 128)?;
    let unit = clean(&request.unit_code, 64)?.to_ascii_uppercase();
    let source = request
        .source_note
        .as_deref()
        .map(|s| clean(s, 256))
        .transpose()?;
    if request.amount_vnd < 0 {
        return Err(CatalogError::invalid());
    }
    period(&request.effective_from, request.effective_to.as_deref())?;
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(CatalogError::storage)?;
    let scope: Option<(String, Option<String>)> = tx
        .query_row(
            "SELECT effective_from,effective_to FROM price_lists
             WHERE id=?1 AND active=1",
            [&list_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(CatalogError::storage)?;
    let (from, to) = scope.ok_or_else(CatalogError::missing)?;
    if request.effective_from < from
        || to
            .as_deref()
            .is_some_and(|until| request.effective_to.as_deref().is_none_or(|end| end > until))
    {
        return Err(CatalogError::invalid());
    }
    let id = new_id(&tx)?;
    tx.execute(
        "INSERT INTO price_list_items
         (id,price_list_id,product_id,unit_code,amount_vnd,effective_from,effective_to,source_note)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            id,
            list_id,
            product_id,
            unit,
            request.amount_vnd,
            request.effective_from,
            request.effective_to,
            source
        ],
    )
    .map_err(CatalogError::storage)?;
    audit(&tx, "CREATE", "PRICE_ITEM", &id)?;
    tx.commit().map_err(CatalogError::storage)?;
    Ok(CatalogMutation { id })
}
#[tauri::command]
pub fn close_price_item(
    db: State<'_, AppDatabase>,
    request: ClosePriceItem,
) -> Result<CatalogMutation> {
    let id = clean(&request.id, 128)?;
    if !calendar_date(&request.effective_to) {
        return Err(CatalogError::invalid());
    }
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    let tx = conn.unchecked_transaction().map_err(CatalogError::storage)?;
    let changed = tx
        .execute(
            "UPDATE price_list_items SET effective_to=?1
             WHERE id=?2 AND active=1 AND effective_from<=?1
             AND (effective_to IS NULL OR effective_to>=?1)",
            params![request.effective_to, id],
        )
        .map_err(CatalogError::storage)?;
    if changed == 0 {
        return Err(CatalogError::missing());
    }
    audit(&tx, "END_PRICE", "PRICE_ITEM", &id)?;
    tx.commit().map_err(CatalogError::storage)?;
    Ok(CatalogMutation { id })
}

fn resolve(conn: &Connection, request: &ResolveCatalogRequest) -> Result<CatalogResolution> {
    let npp = clean(&request.distributor_id, 128)?;
    let raw_code = clean(&request.raw_sku_code, 128)?;
    let raw_unit = clean(&request.raw_unit, 64)?;
    if !calendar_date(&request.business_date) {
        return Err(CatalogError::invalid());
    }
    let price_type = request
        .price_type
        .as_deref()
        .map(|value| clean(value, 64).map(|s| s.to_ascii_uppercase()))
        .transpose()?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id,p.sku_code,p.name,f.name,p.base_unit,a.conversion_num,a.conversion_den
             FROM sku_aliases a JOIN products p ON p.id=a.product_id
             LEFT JOIN product_families f ON f.id=p.product_family_id
             WHERE a.distributor_id=?1 AND a.raw_sku_code=?2 AND a.raw_unit=?3
               AND a.effective_from<=?4 AND (a.effective_to IS NULL OR a.effective_to>=?4)
             LIMIT 2",
        )
        .map_err(CatalogError::storage)?;
    let matches = stmt
        .query_map(
            params![npp, raw_code, raw_unit, request.business_date],
            |row| {
                Ok(ResolvedProduct {
                    id: row.get(0)?,
                    sku_code: row.get(1)?,
                    sku_name: row.get(2)?,
                    family_name: row.get(3)?,
                    base_unit: row.get(4)?,
                    conversion_num: row.get(5)?,
                    conversion_den: row.get(6)?,
                })
            },
        )
        .map_err(CatalogError::storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CatalogError::storage)?;
    if matches.len() != 1 {
        return Ok(CatalogResolution {
            sku_status: if matches.is_empty() { "NOT_FOUND" } else { "AMBIGUOUS" },
            product: None,
            price_status: "NOT_REQUESTED",
            reference_price: None,
        });
    }
    let product = matches.into_iter().next().ok_or_else(CatalogError::missing)?;
    let Some(price_type) = price_type else {
        return Ok(CatalogResolution {
            sku_status: "FOUND",
            product: Some(product),
            price_status: "NOT_REQUESTED",
            reference_price: None,
        });
    };
    let mut stmt = conn
        .prepare(
            "SELECT pl.id,pi.amount_vnd,pi.unit_code FROM price_list_items pi
             JOIN price_lists pl ON pl.id=pi.price_list_id
             WHERE pl.distributor_id=?1 AND pl.price_type=?2 AND pl.active=1
               AND pl.effective_from<=?3 AND (pl.effective_to IS NULL OR pl.effective_to>=?3)
               AND pi.product_id=?4 AND pi.unit_code=?5 COLLATE NOCASE AND pi.active=1
               AND pi.effective_from<=?3 AND (pi.effective_to IS NULL OR pi.effective_to>=?3)
             LIMIT 2",
        )
        .map_err(CatalogError::storage)?;
    let prices = stmt
        .query_map(
            params![npp, price_type, request.business_date, product.id, raw_unit],
            |row| {
                Ok(ReferencePrice {
                    price_list_id: row.get(0)?,
                    amount_vnd: row.get(1)?,
                    unit_code: row.get(2)?,
                })
            },
        )
        .map_err(CatalogError::storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CatalogError::storage)?;
    let (price_status, reference_price) = match prices.len() {
        0 => ("NOT_FOUND", None),
        1 => ("FOUND", prices.into_iter().next()),
        _ => ("AMBIGUOUS", None),
    };
    Ok(CatalogResolution {
        sku_status: "FOUND",
        product: Some(product),
        price_status,
        reference_price,
    })
}
#[tauri::command]
pub fn resolve_catalog_sku(
    db: State<'_, AppDatabase>,
    request: ResolveCatalogRequest,
) -> Result<CatalogResolution> {
    let conn = db.connection.lock().map_err(|_| CatalogError::unavailable())?;
    resolve(&conn, &request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn fixture() -> AppDatabase {
        let dir = tempdir().unwrap();
        let db = AppDatabase::open(dir.path()).unwrap();
        let conn = db.connection.lock().unwrap();
        conn.execute_batch(
            "INSERT INTO distributors(id,code,name,created_at_utc)
              VALUES('n1','N1','NPP 1','2026'),('n2','N2','NPP 2','2026');
             INSERT INTO product_families(id,code,name,category,brand)
              VALUES('f','F','Sản phẩm','Nước','Nhãn');
             INSERT INTO products(id,sku_code,name,base_unit,product_family_id)
              VALUES('p','0001','Nước 330 ml','LON','f');
             INSERT INTO sku_unit_conversions(id,product_id,unit_code,conversion_num,conversion_den)
              VALUES('thung','p','THUNG',24,1);
             INSERT INTO sku_aliases
              (id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den)
              VALUES('a1','n1','0007','p','THUNG',24,1),
                    ('a2','n2','0007','p','LON',1,1);
             INSERT INTO price_lists(id,distributor_id,code,name,price_type,effective_from)
              VALUES('list1','n1','L1','Giá bán N1','OUT','2026-01-01'),
                    ('list2','n2','L2','Giá bán N2','OUT','2026-01-01');
             INSERT INTO price_list_items(id,price_list_id,product_id,unit_code,amount_vnd,effective_from,effective_to)
              VALUES('item1','list1','p','THUNG',240000,'2026-01-01','2026-06-30'),
                    ('item2','list1','p','THUNG',260000,'2026-07-01',NULL),
                    ('item3','list2','p','LON',11000,'2026-01-01',NULL);",
        )
        .unwrap();
        drop(conn);
        // Keep the app-data tempdir alive for the lifetime of this SQLite connection.
        // The test performs all assertions before db is dropped; SQLite holds an open handle.
        db
    }

    fn query(npp: &str, unit: &str, date: &str, price_type: Option<&str>) -> ResolveCatalogRequest {
        ResolveCatalogRequest {
            distributor_id: npp.to_string(),
            raw_sku_code: "0007".into(),
            raw_unit: unit.into(),
            business_date: date.into(),
            price_type: price_type.map(str::to_string),
        }
    }

    #[test]
    fn npp_date_unit_scope_and_absent_prices() {
        let db = fixture();
        let conn = db.connection.lock().unwrap();
        let june = resolve(&conn, &query("n1", "THUNG", "2026-06-30", Some("OUT"))).unwrap();
        assert_eq!(june.product.as_ref().unwrap().sku_code, "0001");
        assert_eq!(june.product.as_ref().unwrap().conversion_num, 24);
        assert_eq!(june.reference_price.unwrap().amount_vnd, 240000);
        let july = resolve(&conn, &query("n1", "THUNG", "2026-07-01", Some("OUT"))).unwrap();
        assert_eq!(july.reference_price.unwrap().amount_vnd, 260000);
        let other = resolve(&conn, &query("n2", "LON", "2026-07-01", Some("OUT"))).unwrap();
        assert_eq!(other.reference_price.unwrap().amount_vnd, 11000);
        let unrequested = resolve(&conn, &query("n1", "THUNG", "2026-07-01", None)).unwrap();
        assert_eq!(unrequested.price_status, "NOT_REQUESTED");
        let missing = resolve(&conn, &query("n1", "THUNG", "2026-07-01", Some("IN"))).unwrap();
        assert_eq!(missing.price_status, "NOT_FOUND");
        let wrong_unit = resolve(&conn, &query("n1", "LON", "2026-07-01", Some("OUT"))).unwrap();
        assert_eq!(wrong_unit.sku_status, "NOT_FOUND");
    }

    #[test]
    fn overlap_and_ambiguous_price_do_not_pick_arbitrary_results() {
        let db = fixture();
        let conn = db.connection.lock().unwrap();
        assert!(conn.execute(
            "INSERT INTO price_list_items(id,price_list_id,product_id,unit_code,amount_vnd,effective_from)
             VALUES('bad','list1','p','THUNG',250000,'2026-06-20')",
            [],
        ).is_err());
        conn.execute_batch(
            "INSERT INTO price_lists(id,distributor_id,code,name,price_type,effective_from)
              VALUES('list3','n1','L3','Nguồn thứ hai','OUT','2026-01-01');
             INSERT INTO price_list_items(id,price_list_id,product_id,unit_code,amount_vnd,effective_from)
              VALUES('extra','list3','p','THUNG',280000,'2026-07-01');",
        ).unwrap();
        let result = resolve(&conn, &query("n1", "THUNG", "2026-07-01", Some("OUT"))).unwrap();
        assert_eq!(result.price_status, "AMBIGUOUS");
        assert!(result.reference_price.is_none());
    }

    #[test]
    fn dates_are_real_calendar_dates() {
        assert!(period("2024-02-29", Some("2024-03-01")).is_ok());
        assert!(period("2026-02-29", None).is_err());
        assert!(period("2026-03-01", Some("2026-02-28")).is_err());
    }
}
