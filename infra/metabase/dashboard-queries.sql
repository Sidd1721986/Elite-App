-- =============================================================================
-- Elite App — Metabase Dashboard Queries
-- =============================================================================
-- How to use:
--   1. Open Metabase → New Question → Native query
--   2. Select the "Elite App (Read Replica)" database
--   3. Paste each query below
--   4. Save as a Question, then pin to a Dashboard
--
-- These queries are read-only and run against the analytics read replica.
-- No writes, no impact on production.
-- =============================================================================


-- =============================================================================
-- DASHBOARD 1: Demand by Zip Code
-- "Where are customers requesting the most work?"
-- Use case: Sell to contractors expanding into new areas
--           Sell to insurance companies targeting active home-repair zip codes
-- =============================================================================
-- Paste into Metabase as: "Job Demand by Zip Code (Last 90 Days)"

SELECT
    REGEXP_REPLACE(address, '^.*?(\d{5})(-\d{4})?.*$', '\1') AS zip_code,
    COUNT(*)                                                   AS total_jobs,
    COUNT(CASE WHEN urgency = 'IMMEDIATE' THEN 1 END)         AS urgent_jobs,
    ROUND(AVG(contract_amount)::numeric, 2)                   AS avg_contract_value,
    SUM(contract_amount)                                       AS total_revenue,
    COUNT(CASE WHEN status = 'INVOICED' THEN 1 END)           AS completed_jobs
FROM jobs
WHERE created_at >= NOW() - INTERVAL '90 days'
  AND address IS NOT NULL
GROUP BY zip_code
HAVING COUNT(*) >= 2
ORDER BY total_jobs DESC
LIMIT 50;


-- =============================================================================
-- DASHBOARD 2: Top Services by Revenue & Volume
-- "Which services make the most money?"
-- Use case: Show material suppliers which products will be in demand
--           Show financing partners which loan sizes to expect
-- =============================================================================
-- Paste into Metabase as: "Revenue & Volume by Service Type"
-- Note: services is a text[] / jsonb array — unnest expands one row per service

SELECT
    TRIM(service_name)                                        AS service,
    COUNT(DISTINCT j.id)                                      AS job_count,
    COUNT(CASE WHEN j.status = 'INVOICED' THEN 1 END)        AS completed,
    ROUND(AVG(j.contract_amount)::numeric, 2)                 AS avg_value,
    SUM(j.contract_amount)                                    AS total_revenue,
    ROUND(
        COUNT(CASE WHEN j.status = 'INVOICED' THEN 1 END)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
    )                                                         AS completion_rate_pct
FROM jobs j,
     LATERAL UNNEST(j.services) AS service_name
WHERE j.created_at >= NOW() - INTERVAL '90 days'
GROUP BY service_name
ORDER BY total_revenue DESC NULLS LAST;


-- =============================================================================
-- DASHBOARD 3: Weekly Demand Trend
-- "Is the business growing week over week?"
-- Use case: Internal KPI tracking + show to investors/partners
-- =============================================================================
-- Paste into Metabase as: "Weekly Job Volume & Revenue Trend"

SELECT
    DATE_TRUNC('week', created_at)                            AS week_start,
    COUNT(*)                                                  AS new_jobs,
    COUNT(CASE WHEN urgency = 'IMMEDIATE' THEN 1 END)         AS urgent_jobs,
    COUNT(CASE WHEN status = 'INVOICED' THEN 1 END)           AS completed_jobs,
    COALESCE(SUM(contract_amount), 0)                         AS total_contracted,
    ROUND(AVG(contract_amount)::numeric, 2)                   AS avg_contract
FROM jobs
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY week_start
ORDER BY week_start ASC;


-- =============================================================================
-- DASHBOARD 4: User Acquisition & Role Breakdown
-- "Who is using the app and how did they find it?"
-- Use case: Identify high-value segments (Property Managers, Realtors)
--           Sell targeted ads or referral fees based on role + referral source
-- =============================================================================
-- Paste into Metabase as: "User Acquisition by Role & Referral Source"

SELECT
    role,
    referral_source,
    COUNT(*)                                                  AS user_count,
    COUNT(CASE WHEN is_approved = true THEN 1 END)            AS approved,
    COUNT(CASE WHEN is_phone_verified = true THEN 1 END)      AS phone_verified,
    MIN(created_at)                                           AS first_signup,
    MAX(created_at)                                           AS latest_signup
FROM users
WHERE role != 'Admin'
GROUP BY role, referral_source
ORDER BY user_count DESC;


-- =============================================================================
-- DASHBOARD 5: Vendor Performance Leaderboard
-- "Which vendors complete the most jobs and generate the most revenue?"
-- Use case: Internal ops — identify top vendors for premium tier
--           Featured listing upsell based on performance data
-- =============================================================================
-- Paste into Metabase as: "Vendor Performance Leaderboard"

SELECT
    u.name                                                    AS vendor_name,
    u.email                                                   AS vendor_email,
    COUNT(j.id)                                               AS total_assigned,
    COUNT(CASE WHEN j.status = 'INVOICED' THEN 1 END)         AS completed,
    COUNT(CASE WHEN j.status IN ('ASSIGNED','ACCEPTED') THEN 1 END) AS in_progress,
    COALESCE(SUM(j.contract_amount), 0)                       AS total_revenue,
    ROUND(AVG(j.contract_amount)::numeric, 2)                 AS avg_job_value,
    ROUND(
        COUNT(CASE WHEN j.status = 'INVOICED' THEN 1 END)::numeric
        / NULLIF(COUNT(j.id), 0) * 100, 1
    )                                                         AS completion_rate_pct,
    -- Average days from assigned to completed
    ROUND(AVG(
        CASE WHEN j.status = 'INVOICED' AND j.assigned_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (j.invoiced_at - j.assigned_at)) / 86400
        END
    )::numeric, 1)                                            AS avg_days_to_complete
FROM users u
JOIN jobs j ON j.vendor_id = u.id
WHERE u.role = 'Vendor'
  AND j.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.id, u.name, u.email
ORDER BY total_revenue DESC NULLS LAST;


-- =============================================================================
-- DASHBOARD 6: High-Value Leads for Financing Partners
-- "Jobs above $5,000 that are actively progressing — hot leads"
-- Use case: Export this list weekly to GreenSky / Mosaic Finance
--           Each qualified lead = $25–150 revenue for you
-- =============================================================================
-- Paste into Metabase as: "High-Value Active Jobs (Financing Leads)"
-- Schedule as weekly email export to your financing partner contact

SELECT
    j.job_number,
    j.address,
    REGEXP_REPLACE(j.address, '^.*?(\d{5})(-\d{4})?.*$', '\1') AS zip_code,
    ARRAY_TO_STRING(j.services, ', ')                          AS services,
    j.urgency,
    j.contract_amount,
    j.status,
    j.created_at::date                                         AS submitted_date,
    u.name                                                     AS customer_name,
    j.contact_phone,
    j.contact_email
FROM jobs j
JOIN users u ON u.id::text = j.customer_id
WHERE j.contract_amount >= 5000
  AND j.status IN ('APPT_SET', 'SALE', 'COMPLETED')
  AND j.created_at >= NOW() - INTERVAL '30 days'
ORDER BY j.contract_amount DESC;


-- =============================================================================
-- DASHBOARD 7: Monthly Executive Summary
-- "One-page snapshot of the whole business"
-- Use case: Send to investors, advisors, or potential acquirers
-- =============================================================================
-- Paste into Metabase as: "Monthly Executive Summary"

SELECT
    DATE_TRUNC('month', j.created_at)                         AS month,
    COUNT(*)                                                   AS total_jobs_submitted,
    COUNT(CASE WHEN j.status = 'INVOICED' THEN 1 END)          AS jobs_completed,
    COUNT(CASE WHEN j.status = 'EXPIRED' THEN 1 END)           AS jobs_expired,
    COALESCE(SUM(j.contract_amount), 0)                        AS gross_revenue,
    ROUND(AVG(j.contract_amount)::numeric, 2)                  AS avg_job_value,
    COUNT(DISTINCT j.customer_id)                              AS active_customers,
    COUNT(DISTINCT j.vendor_id)                                AS active_vendors,
    COUNT(CASE WHEN j.urgency = 'IMMEDIATE' THEN 1 END)        AS urgent_jobs,
    ROUND(
        COUNT(CASE WHEN j.status = 'INVOICED' THEN 1 END)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
    )                                                          AS overall_completion_pct
FROM jobs j
WHERE j.created_at >= NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month DESC;
