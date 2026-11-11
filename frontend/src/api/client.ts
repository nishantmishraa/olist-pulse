import type {
  CategoryPerformanceRow,
  CreateOrderPayload,
  OrderRecord,
  OrderStatus,
  OverviewKPIs,
  PaginatedOrdersResponse,
  PaymentBreakdownRow,
  RevenueTrendPoint,
  SellerLeaderboardRow,
} from '../types/olist';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:8000';

async function safeFetch<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const olistApi = {
  getOverview: (sellerId?: string) =>
    safeFetch<OverviewKPIs>(
      `/api/analytics/overview${sellerId ? `?seller_id=${sellerId}` : ''}`,
      {
        total_orders: 1477,
        total_revenue: 712054.04,
        avg_order_value: 482.09,
        on_time_delivery_pct: 82.8,
        avg_review_score: 4.19,
        mom_growth_pct: 11.4,
      }
    ),

  getRevenueTrends: (sellerId?: string) =>
    safeFetch<RevenueTrendPoint[]>(
      `/api/analytics/revenue-trends${sellerId ? `?seller_id=${sellerId}` : ''}`,
      [
        { order_month: '2026-05', total_orders: 118, total_revenue: 56240, mom_growth_pct: 6.2, rolling_3m_revenue: 53810 },
        { order_month: '2026-06', total_orders: 129, total_revenue: 61890, mom_growth_pct: 10.0, rolling_3m_revenue: 57920 },
        { order_month: '2026-07', total_orders: 136, total_revenue: 65420, mom_growth_pct: 5.7, rolling_3m_revenue: 61183 },
        { order_month: '2026-08', total_orders: 144, total_revenue: 70110, mom_growth_pct: 7.2, rolling_3m_revenue: 65806 },
        { order_month: '2026-09', total_orders: 155, total_revenue: 74880, mom_growth_pct: 6.8, rolling_3m_revenue: 70136 },
        { order_month: '2026-10', total_orders: 169, total_revenue: 83415, mom_growth_pct: 11.4, rolling_3m_revenue: 76135 },
      ]
    ),

  getSellerLeaderboard: () =>
    safeFetch<SellerLeaderboardRow[]>('/api/analytics/seller-leaderboard', [
      {
        revenue_rank: 1,
        seller_id: 'sel_07',
        seller_name: 'Prime Relogios & Presentes',
        seller_city: 'Sao Paulo',
        seller_state: 'SP',
        orders_fulfilled: 183,
        gross_revenue: 78269.88,
        avg_review_score: 4.35,
        on_time_sla_pct: 86.7,
      },
      {
        revenue_rank: 2,
        seller_id: 'sel_03',
        seller_name: 'Paulista MegaStore',
        seller_city: 'Campinas',
        seller_state: 'SP',
        orders_fulfilled: 168,
        gross_revenue: 74910.45,
        avg_review_score: 4.48,
        on_time_sla_pct: 89.2,
      },
    ]),

  getCategoryPerformance: (sellerId?: string) =>
    safeFetch<CategoryPerformanceRow[]>(
      `/api/analytics/category-performance${sellerId ? `?seller_id=${sellerId}` : ''}`,
      [
        { category: 'cool_stuff', order_count: 191, revenue: 137500.53, avg_unit_price: 686.65, revenue_share_pct: 19.3, category_rank: 1 },
        { category: 'housewares', order_count: 174, revenue: 102440.12, avg_unit_price: 518.20, revenue_share_pct: 14.4, category_rank: 2 },
      ]
    ),

  getPaymentBreakdown: (sellerId?: string) =>
    safeFetch<PaymentBreakdownRow[]>(
      `/api/analytics/payment-breakdown${sellerId ? `?seller_id=${sellerId}` : ''}`,
      [
        { payment_type: 'credit_card', order_count: 855, total_value: 412991.34, share_pct: 58.0 },
        { payment_type: 'pix', order_count: 325, total_value: 156651.89, share_pct: 22.0 },
      ]
    ),

  getOrders: (params: {
    search?: string;
    status?: string;
    payment_type?: string;
    seller_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.payment_type) qs.set('payment_type', params.payment_type);
    if (params.seller_id) qs.set('seller_id', params.seller_id);
    qs.set('limit', String(params.limit ?? 12));
    qs.set('offset', String(params.offset ?? 0));

    return safeFetch<PaginatedOrdersResponse>(`/api/orders?${qs.toString()}`, {
      total: 1,
      items: [
        {
          order_id: 'ord_01477',
          order_status: 'delivered',
          order_purchase_timestamp: '2026-10-27 14:22:00',
          order_estimated_delivery_date: '2026-11-03 00:00:00',
          customer_city: 'Sao Paulo',
          customer_state: 'SP',
          product_name: 'Portable Smart Projector HD',
          product_category_name: 'cool_stuff',
          seller_id: 'sel_07',
          seller_name: 'Prime Relogios & Presentes',
          payment_type: 'pix',
          total_amount: 714.5,
        },
      ],
    });
  },

  createOrder: (payload: CreateOrderPayload) =>
    safeFetch<{ order_id: string; status: OrderStatus; total_amount: number }>(
      '/api/orders',
      { order_id: 'ord_new01', status: 'processing', total_amount: 324.4 },
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  updateOrderStatus: (orderId: string, orderStatus: OrderStatus) =>
    safeFetch<{ order_id: string; order_status: OrderStatus }>(
      `/api/orders/${orderId}/status`,
      { order_id: orderId, order_status: orderStatus },
      { method: 'PATCH', body: JSON.stringify({ order_status: orderStatus }) }
    ),
};
