export interface OverviewKPIs {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  on_time_delivery_pct: number;
  avg_review_score: number;
  mom_growth_pct: number;
}

export interface RevenueTrendPoint {
  order_month: string;
  total_orders: number;
  total_revenue: number;
  mom_growth_pct: number | null;
  rolling_3m_revenue: number;
}

export interface SellerLeaderboardRow {
  revenue_rank: number;
  seller_id: string;
  seller_name: string;
  seller_city: string;
  seller_state: string;
  orders_fulfilled: number;
  gross_revenue: number;
  avg_review_score: number;
  on_time_sla_pct: number;
}

export interface CategoryPerformanceRow {
  category: string;
  order_count: number;
  revenue: number;
  avg_unit_price: number;
  revenue_share_pct: number;
  category_rank: number;
}

export interface PaymentBreakdownRow {
  payment_type: string;
  order_count: number;
  total_value: number;
  share_pct: number;
}

export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'canceled';

export interface OrderRecord {
  order_id: string;
  order_status: OrderStatus;
  order_purchase_timestamp: string;
  order_estimated_delivery_date: string;
  customer_city: string;
  customer_state: string;
  product_name: string;
  product_category_name: string;
  seller_id: string;
  seller_name: string;
  payment_type: string;
  total_amount: number;
}

export interface PaginatedOrdersResponse {
  total: number;
  items: OrderRecord[];
}

export interface CreateOrderPayload {
  customer_city: string;
  customer_state: string;
  product_id: string;
  seller_id: string;
  payment_type: string;
  price?: number;
}
