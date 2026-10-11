//! Read-only real SKU sales metrics. Never derives turnover from reference prices.
use crate::storage::AppDatabase;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkuMetric {
    distributor_id: String,
    product_id: String,
    source_kind: String,
    quantity_micro: i64,
    net_amount_vnd: i64,
    first_date: String,
    last_date: String,
    transaction_rows: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkuMetricsError {
    code: &'static str,
    message: &'static str,
}
fn storage() -> SkuMetricsError {
    SkuMetricsError {
        code: "STORAGE_ERROR",
        message: "Không thể đọc doanh số SKU đã nhập trên máy.",
    }
}
fn read(conn: &Connection) -> Result<Vec<SkuMetric>, SkuMetricsError> {
    let mut stmt = conn.prepare(
        "SELECT distributor_id,product_id,source_kind,
                SUM(quantity_micro),SUM(net_amount_vnd),MIN(business_date),
                MAX(business_date),COUNT(*)
         FROM (
             SELECT distributor_id,product_id,'SALES_IN' AS source_kind,quantity_micro,net_amount_vnd,business_date
               FROM v_active_sales_in
             UNION ALL
             SELECT distributor_id,product_id,'SALES_OUT' AS source_kind,quantity_micro,net_amount_vnd,business_date
               FROM v_active_sales_out
         ) AS facts
         GROUP BY distributor_id,product_id,source_kind
         ORDER BY distributor_id,source_kind,product_id",
    ).map_err(|_| storage())?;
    let rows = stmt.query_map([], |r| Ok(SkuMetric {
        distributor_id: r.get(0)?,
        product_id: r.get(1)?,
        source_kind: r.get(2)?,
        quantity_micro: r.get(3)?,
        net_amount_vnd: r.get(4)?,
        first_date: r.get(5)?,
        last_date: r.get(6)?,
        transaction_rows: r.get(7)?,
    })).map_err(|_| storage())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|_| storage())
}

#[tauri::command]
pub fn list_sku_metrics(db: State<'_, AppDatabase>) -> Result<Vec<SkuMetric>, SkuMetricsError> {
    let conn = db.connection.lock().map_err(|_| storage())?;
    read(&conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn derives_revenue_from_active_facts_and_keeps_in_out_separate() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE sales_facts (
                distributor_id TEXT, product_id TEXT,source_kind TEXT,quantity_micro INTEGER,
                net_amount_vnd INTEGER,business_date TEXT,active INTEGER
             );
             CREATE VIEW v_active_sales_in AS SELECT distributor_id,product_id,quantity_micro,
                  net_amount_vnd,business_date FROM sales_facts WHERE source_kind='SALES_IN' AND active=1;
             CREATE VIEW v_active_sales_out AS SELECT distributor_id,product_id,quantity_micro,
                  net_amount_vnd,business_date FROM sales_facts WHERE source_kind='SALES_OUT' AND active=1;
             INSERT INTO sales_facts VALUES('n1','s1','SALES_IN',1000000,25000,'2026-10-01',1);
             INSERT INTO sales_facts VALUES('n1','s1','SALES_OUT',1000000,20000,'2026-10-02',1);
             INSERT INTO sales_facts VALUES('n1','s1','SALES_OUT',-1000000,-20000,'2026-10-03',1);
             INSERT INTO sales_facts VALUES('n1','s1','SALES_OUT',1000000,999999,'2026-10-04',0);",
        ).unwrap();
        let results = read(&conn).unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].source_kind, "SALES_IN");
        assert_eq!(results[0].net_amount_vnd, 25000);
        assert_eq!(results[1].source_kind, "SALES_OUT");
        assert_eq!(results[1].net_amount_vnd, 0);
        assert_eq!(results[1].quantity_micro, 0);
        assert_eq!(results[1].transaction_rows, 2);
    }
}
