# Architecture Notes

## Database Schema
The database uses 7 tables modeled after the Olist dataset:
- `customers` (`customer_id`, `customer_unique_id`, `customer_city`, `customer_state`)
- `sellers` (`seller_id`, `seller_name`, `seller_city`, `seller_state`, `rating`)
- `products` (`product_id`, `product_category_name`, `product_name`, `unit_price`)
- `orders` (`order_id`, `customer_id`, `order_status`, `order_purchase_timestamp`, `order_delivered_customer_date`, `order_estimated_delivery_date`)
- `order_items` (`order_id`, `order_item_id`, `product_id`, `seller_id`, `price`, `freight_value`)
- `order_payments` (`order_id`, `payment_sequential`, `payment_type`, `payment_installments`, `payment_value`)
- `order_reviews` (`review_id`, `order_id`, `review_score`, `review_comment_title`)

### Indexes
To keep dashboard filtering fast as order count grows, `database.py` creates indexes on the main join and filter columns:
- `idx_orders_purchase_ts` on `orders(order_purchase_timestamp)`
- `idx_orders_status` on `orders(order_status)`
- `idx_order_items_seller` on `order_items(seller_id)`
- `idx_order_items_product` on `order_items(product_id)`

## Analytical SQL Queries (`backend/queries.sql`)
Instead of pulling raw rows into Python and aggregating in memory, the backend runs CTEs and window functions directly in SQL:
1. **Monthly Trends (`get_revenue_trends`):** Groups active orders by month in a CTE, then uses `LAG(total_revenue) OVER (ORDER BY order_month)` for month-over-month growth and `AVG(total_revenue) OVER (ORDER BY order_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` for the 3-month rolling average.
2. **Seller Leaderboard (`get_seller_leaderboard`):** Uses `DENSE_RANK() OVER (ORDER BY gross_revenue DESC)` to rank sellers without skipping ranks on ties, and calculates on-time delivery rate by comparing `order_delivered_customer_date <= order_estimated_delivery_date`.
3. **Category Share (`get_category_performance`):** Divides each category's revenue by `SUM(revenue) OVER ()` to get its percentage share of total GMV in a single query.
