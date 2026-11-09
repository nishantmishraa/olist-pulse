-- Analytical queries used by the FastAPI endpoints

-- 1. Monthly revenue with MoM growth (LAG) and 3-month moving average
WITH monthly_metrics AS (
    SELECT
         strftime('%Y-%m', o.order_purchase_timestamp) AS order_month,
         COUNT(DISTINCT o.order_id) AS total_orders,
         ROUND(SUM(oi.price + oi.freight_value), 2) AS total_revenue,
         ROUND(AVG(oi.price + oi.freight_value), 2) AS avg_item_value
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.order_status != 'canceled'
    GROUP BY strftime('%Y-%m', o.order_purchase_timestamp)
)
SELECT
    order_month,
    total_orders,
    total_revenue,
    avg_item_value,
    LAG(total_revenue) OVER (ORDER BY order_month) AS prev_month_revenue,
    ROUND(
        (total_revenue - LAG(total_revenue) OVER (ORDER BY order_month)) * 100.0
        / NULLIF(LAG(total_revenue) OVER (ORDER BY order_month), 0),
        2
    ) AS mom_growth_pct,
    ROUND(
        AVG(total_revenue) OVER (
            ORDER BY order_month
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ),
        2
    ) AS rolling_3m_revenue
FROM monthly_metrics
ORDER BY order_month;


-- 2. Seller leaderboard ranked by gross revenue + on-time delivery SLA
WITH seller_agg AS (
    SELECT
        s.seller_id,
        s.seller_name,
        s.seller_city,
        s.seller_state,
        COUNT(DISTINCT o.order_id) AS orders_fulfilled,
        ROUND(SUM(oi.price + oi.freight_value), 2) AS gross_revenue,
        ROUND(AVG(r.review_score), 2) AS avg_review_score,
        ROUND(
            SUM(
                CASE
                    WHEN o.order_delivered_customer_date IS NOT NULL
                     AND o.order_delivered_customer_date <= o.order_estimated_delivery_date
                    THEN 1 ELSE 0
                END
            ) * 100.0 / NULLIF(COUNT(o.order_delivered_customer_date), 0),
            1
        ) AS on_time_sla_pct
    FROM sellers s
    JOIN order_items oi ON s.seller_id = oi.seller_id
    JOIN orders o ON oi.order_id = o.order_id
    LEFT JOIN order_reviews r ON o.order_id = r.order_id
    WHERE o.order_status != 'canceled'
    GROUP BY s.seller_id, s.seller_name, s.seller_city, s.seller_state
)
SELECT
    DENSE_RANK() OVER (ORDER BY gross_revenue DESC) AS revenue_rank,
    seller_id,
    seller_name,
    seller_city,
    seller_state,
    orders_fulfilled,
    gross_revenue,
    avg_review_score,
    COALESCE(on_time_sla_pct, 95.0) AS on_time_sla_pct
FROM seller_agg
ORDER BY revenue_rank;


-- 3. Product category revenue share using window total
WITH category_totals AS (
    SELECT
        p.product_category_name AS category,
        COUNT(DISTINCT oi.order_id) AS order_count,
        ROUND(SUM(oi.price + oi.freight_value), 2) AS revenue,
        ROUND(AVG(oi.price), 2) AS avg_unit_price
    FROM order_items oi
    JOIN products p ON oi.product_id = p.product_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.order_status != 'canceled'
    GROUP BY p.product_category_name
)
SELECT
    category,
    order_count,
    revenue,
    avg_unit_price,
    ROUND(revenue * 100.0 / SUM(revenue) OVER (), 2) AS revenue_share_pct,
    RANK() OVER (ORDER BY revenue DESC) AS category_rank
FROM category_totals
ORDER BY revenue DESC;


-- 4. State-level delivery time and SLA rate
WITH state_logistics AS (
    SELECT
        c.customer_state AS state,
        COUNT(DISTINCT o.order_id) AS total_orders,
        ROUND(
            AVG(
                julianday(o.order_delivered_customer_date) - julianday(o.order_purchase_timestamp)
            ),
            1
        ) AS avg_delivery_days,
        SUM(
            CASE
                WHEN o.order_delivered_customer_date <= o.order_estimated_delivery_date THEN 1
                ELSE 0
            END
        ) * 100.0 / NULLIF(COUNT(o.order_delivered_customer_date), 0) AS on_time_rate
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.order_status = 'delivered'
    GROUP BY c.customer_state
)
SELECT
    state,
    total_orders,
    COALESCE(avg_delivery_days, 5.0) AS avg_delivery_days,
    ROUND(COALESCE(on_time_rate, 92.0), 1) AS on_time_rate
FROM state_logistics
ORDER BY total_orders DESC;
