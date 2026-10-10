-- Read-only parameterized examples for repository implementation.
-- Bind :from_date/:to_date/:month_start/:as_of_date/:npp_id via SQLite prepared statements.

-- 1. Sales Out by NPP. NULL amount = no actual rows (not necessarily zero sales).
SELECT d.id AS distributor_id, d.code AS distributor_code, d.name,
       SUM(so.net_amount_vnd) AS sales_out_vnd,
       COUNT(so.id) AS counted_rows
  FROM distributors d
  LEFT JOIN v_active_sales_out so
    ON so.distributor_id = d.id
   AND so.business_date BETWEEN :from_date AND :to_date
 WHERE d.active = 1
 GROUP BY d.id, d.code, d.name
 ORDER BY sales_out_vnd DESC;

-- 2. NPP monthly KPI (only NPP-level target; does not double count REP targets).
WITH actual AS (
 SELECT distributor_id, SUM(net_amount_vnd) sales_out_vnd
 FROM v_active_sales_out
 WHERE business_date BETWEEN :from_date AND :to_date
 GROUP BY distributor_id
), npp_target AS (
 SELECT distributor_id, SUM(target_vnd) target_vnd
 FROM v_active_targets
 WHERE metric='SALES_OUT' AND scope='NPP' AND month_start = :month_start
 GROUP BY distributor_id
)
SELECT d.code, a.sales_out_vnd, t.target_vnd,
 CASE WHEN t.target_vnd > 0 AND a.sales_out_vnd IS NOT NULL
    THEN ROUND(a.sales_out_vnd * 100.0 / t.target_vnd, 2)
    ELSE NULL END AS achievement_pct_display_only
FROM distributors d
LEFT JOIN actual a ON a.distributor_id=d.id
LEFT JOIN npp_target t ON t.distributor_id=d.id
ORDER BY d.code;
-- WARNING: ROUND(...100.0...) in a read-only presentation sample only.
-- For canonical percent with strict integer math, compute scaled ratio in Rust using i128/decimal.

-- 3. Latest eligible stock snapshot per NPP x SKU (never SUM closing across periods).
WITH ranked AS (
 SELECT x.*,
 ROW_NUMBER() OVER (PARTITION BY x.distributor_id,x.product_id ORDER BY x.period_to DESC,x.id DESC) AS rn
 FROM v_active_inventory_period x
 WHERE x.period_to <= :as_of_date
)
SELECT distributor_id,product_id,period_from,period_to,
 opening_micro,receipts_micro,issues_micro,adjustments_micro,closing_micro,
 reconciliation_variance_micro
FROM ranked WHERE rn=1
ORDER BY distributor_id,product_id;

-- 4. Source provenance to support clicking a report row.
SELECT b.id AS import_batch_id,b.kind,b.source_file_name,b.source_file_sha256,
       b.source_sheet,b.period_from,b.period_to,b.imported_at_utc,
       b.committed_at_utc,b.status,b.active
FROM import_batches b
WHERE b.distributor_id = :npp_id AND b.active=1 AND b.status='COMMITTED'
ORDER BY b.committed_at_utc DESC;
