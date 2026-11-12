import React, { useEffect, useState } from 'react';
import { olistApi } from './api/client';
import type {
  CategoryPerformanceRow,
  OrderRecord,
  OrderStatus,
  OverviewKPIs,
  PaymentBreakdownRow,
  RevenueTrendPoint,
  SellerLeaderboardRow,
} from './types/olist';

const SQL_SNIPPETS: Record<string, { title: string; sql: string }> = {
  trends: {
    title: 'Monthly Revenue + MoM Growth (LAG) & 3M Rolling Avg (Window Function)',
    sql: `WITH monthly_metrics AS (
  SELECT strftime('%Y-%m', o.order_purchase_timestamp) AS order_month,
         COUNT(DISTINCT o.order_id) AS total_orders,
         ROUND(SUM(oi.price + oi.freight_value), 2) AS total_revenue
  FROM orders o
  JOIN order_items oi ON o.order_id = oi.order_id
  WHERE o.order_status != 'canceled'
  GROUP BY 1
)
SELECT order_month, total_orders, total_revenue,
       ROUND((total_revenue - LAG(total_revenue) OVER (ORDER BY order_month)) * 100.0
             / NULLIF(LAG(total_revenue) OVER (ORDER BY order_month), 0), 1) AS mom_growth_pct,
       ROUND(AVG(total_revenue) OVER (
             ORDER BY order_month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ), 2) AS rolling_3m_revenue
FROM monthly_metrics ORDER BY order_month;`,
  },
  leaderboard: {
    title: 'Seller Leaderboard with DENSE_RANK() & SLA On-Time Compliance',
    sql: `WITH seller_agg AS (
  SELECT s.seller_id, s.seller_name, s.seller_city, s.seller_state,
         COUNT(DISTINCT o.order_id) AS orders_fulfilled,
         ROUND(SUM(oi.price + oi.freight_value), 2) AS gross_revenue,
         ROUND(AVG(r.review_score), 2) AS avg_review_score
  FROM sellers s
  JOIN order_items oi ON s.seller_id = oi.seller_id
  JOIN orders o ON oi.order_id = o.order_id
  LEFT JOIN order_reviews r ON o.order_id = r.order_id
  WHERE o.order_status != 'canceled'
  GROUP BY 1, 2, 3, 4
)
SELECT DENSE_RANK() OVER (ORDER BY gross_revenue DESC) AS revenue_rank, *
FROM seller_agg ORDER BY revenue_rank;`,
  },
  categories: {
    title: 'Category Revenue Share Using SUM() OVER () Window Partition',
    sql: `WITH category_totals AS (
  SELECT p.product_category_name AS category,
         COUNT(DISTINCT oi.order_id) AS order_count,
         ROUND(SUM(oi.price + oi.freight_value), 2) AS revenue
  FROM order_items oi
  JOIN products p ON oi.product_id = p.product_id
  JOIN orders o ON oi.order_id = o.order_id
  WHERE o.order_status != 'canceled'
  GROUP BY 1
)
SELECT category, order_count, revenue,
       ROUND(revenue * 100.0 / SUM(revenue) OVER (), 1) AS revenue_share_pct,
       RANK() OVER (ORDER BY revenue DESC) AS category_rank
FROM category_totals ORDER BY revenue DESC;`,
  },
};

export function App() {
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [kpis, setKpis] = useState<OverviewKPIs | null>(null);
  const [trends, setTrends] = useState<RevenueTrendPoint[]>([]);
  const [leaderboard, setLeaderboard] = useState<SellerLeaderboardRow[]>([]);
  const [categories, setCategories] = useState<CategoryPerformanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentBreakdownRow[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);

  // Filters & CRUD modal state
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [activeSqlKey, setActiveSqlKey] = useState<string | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);
  const [newOrderCity, setNewOrderCity] = useState<string>('Sao Paulo');
  const [newOrderState, setNewOrderState] = useState<string>('SP');
  const [newOrderProduct, setNewOrderProduct] = useState<string>('prd_09');
  const [newOrderPayment, setNewOrderPayment] = useState<string>('pix');

  const loadDashboardData = async () => {
    const sellerParam = selectedSeller || undefined;
    const [ov, tr, lb, cat, pay, ord] = await Promise.all([
      olistApi.getOverview(sellerParam),
      olistApi.getRevenueTrends(sellerParam),
      olistApi.getSellerLeaderboard(),
      olistApi.getCategoryPerformance(sellerParam),
      olistApi.getPaymentBreakdown(sellerParam),
      olistApi.getOrders({
        search,
        status: statusFilter,
        payment_type: paymentFilter,
        seller_id: selectedSeller,
        limit: 12,
      }),
    ]);
    setKpis(ov);
    setTrends(tr);
    setLeaderboard(lb);
    setCategories(cat);
    setPayments(pay);
    setOrders(ord.items);
    setTotalOrdersCount(ord.total);
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedSeller, search, statusFilter, paymentFilter]);

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    await olistApi.updateOrderStatus(orderId, nextStatus);
    loadDashboardData();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    await olistApi.createOrder({
      customer_city: newOrderCity,
      customer_state: newOrderState,
      product_id: newOrderProduct,
      seller_id: selectedSeller || 'sel_07',
      payment_type: newOrderPayment,
    });
    setShowNewOrderModal(false);
    loadDashboardData();
  };

  const maxTrendRevenue = Math.max(...trends.map((t) => t.total_revenue), 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-600/30">
              OP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Olist Pulse</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                  Full-Stack SQL + React Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                E-Commerce Operations, CTE Window Analytics & Seller Fulfillment Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Role: Global Admin (All Sellers)</option>
              {leaderboard.map((s) => (
                <option key={s.seller_id} value={s.seller_id}>
                  Merchant View: {s.seller_name} ({s.seller_state})
                </option>
              ))}
            </select>

            <button
              onClick={() => setActiveSqlKey('trends')}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 transition"
            >
              Inspect SQL CTEs
            </button>

            <button
              onClick={() => setShowNewOrderModal(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
            >
              + New Order
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Executive KPI Cards */}
        {kpis && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase font-medium">Gross Merchandise Value</p>
              <p className="text-2xl font-bold text-white mt-1">
                R$ {kpis.total_revenue.toLocaleString()}
              </p>
              <span className="text-xs text-emerald-400 font-medium">
                LAG() MoM: {kpis.mom_growth_pct >= 0 ? `+${kpis.mom_growth_pct}%` : `${kpis.mom_growth_pct}%`}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase font-medium">Orders Analyzed</p>
              <p className="text-2xl font-bold text-white mt-1">
                {kpis.total_orders.toLocaleString()}
              </p>
              <span className="text-xs text-slate-400">Indexed relational ledger</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase font-medium">Avg Order Value (AOV)</p>
              <p className="text-2xl font-bold text-white mt-1">R$ {kpis.avg_order_value}</p>
              <span className="text-xs text-indigo-400">Item price + freight</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase font-medium">On-Time Delivery SLA</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {kpis.on_time_delivery_pct}%
              </p>
              <span className="text-xs text-slate-400">Delivered &le; Estimated Date</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase font-medium">Customer Review Score</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{kpis.avg_review_score} / 5.0</p>
              <span className="text-xs text-slate-400">Verified buyer ratings</span>
            </div>
          </section>
        )}

        {/* Revenue Trend + Category Share Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue & Rolling 3M Chart */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Monthly GMV & 3-Month Rolling Average
                </h2>
                <p className="text-xs text-slate-400">
                  Powered by SQL <code className="text-indigo-300">AVG() OVER (ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)</code>
                </p>
              </div>
              <button
                onClick={() => setActiveSqlKey('trends')}
                className="text-xs text-indigo-400 hover:underline"
              >
                View SQL
              </button>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end h-52 pt-6 px-2 border-b border-slate-800">
              {trends.map((pt) => {
                const heightPct = Math.max(12, Math.round((pt.total_revenue / maxTrendRevenue) * 100));
                return (
                  <div key={pt.order_month} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                      R${Math.round(pt.total_revenue / 1000)}k
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-emerald-500 group-hover:to-emerald-400 transition-all"
                      title={`${pt.order_month}: R$ ${pt.total_revenue.toLocaleString()} (Rolling 3M: R$ ${pt.rolling_3m_revenue.toLocaleString()})`}
                    />
                    <span className="text-[10px] text-slate-400 font-mono">
                      {pt.order_month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Revenue Share */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Category Share</h2>
                <p className="text-xs text-slate-400">
                  Window <code className="text-indigo-300">SUM(rev) OVER ()</code>
                </p>
              </div>
              <button
                onClick={() => setActiveSqlKey('categories')}
                className="text-xs text-indigo-400 hover:underline"
              >
                View SQL
              </button>
            </div>

            <div className="space-y-3">
              {categories.slice(0, 6).map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-200 capitalize">
                      #{cat.category_rank} {cat.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400">
                      R$ {cat.revenue.toLocaleString()} ({cat.revenue_share_pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, cat.revenue_share_pct * 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Seller Leaderboard + Payment Mix */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Merchant Leaderboard (<code className="text-indigo-300">DENSE_RANK() OVER</code>)
                </h2>
                <p className="text-xs text-slate-400">
                  Ranked by gross revenue, fulfillment volume, and delivery SLA compliance
                </p>
              </div>
              <button
                onClick={() => setActiveSqlKey('leaderboard')}
                className="text-xs text-indigo-400 hover:underline"
              >
                View SQL
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 pr-3">Rank</th>
                    <th className="py-2.5 px-3">Merchant</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Orders</th>
                    <th className="py-2.5 px-3">Gross GMV</th>
                    <th className="py-2.5 px-3">On-Time SLA</th>
                    <th className="py-2.5 pl-3">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {leaderboard.slice(0, 6).map((s) => (
                    <tr key={s.seller_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-bold text-indigo-400">#{s.revenue_rank}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{s.seller_name}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {s.seller_city}, {s.seller_state}
                      </td>
                      <td className="py-2.5 px-3">{s.orders_fulfilled}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400">
                        R$ {s.gross_revenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">{s.on_time_sla_pct}%</td>
                      <td className="py-2.5 pl-3 text-amber-400">{s.avg_review_score} ★</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-1">Payment Instrument Split</h2>
            <p className="text-xs text-slate-400 mb-4">
              Share of total transaction volume by payment method
            </p>
            <div className="space-y-3">
              {payments.map((p) => (
                <div
                  key={p.payment_type}
                  className="p-3 rounded-lg bg-slate-800/60 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-white">
                      {p.payment_type.replace('_', ' ')}
                    </p>
                    <p className="text-[11px] text-slate-400">{p.order_count} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-indigo-300">
                      R$ {p.total_value.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-emerald-400">{p.share_pct}% share</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Order Operations & Fulfillment CRUD Table */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Order Operations & Live Fulfillment Manager ({totalOrdersCount.toLocaleString()} matching)
              </h2>
              <p className="text-xs text-slate-400">
                Search across multi-table SQL joins and update real-time order statuses
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search order ID, city, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="">All Statuses</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="canceled">Canceled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="">All Payments</option>
                <option value="credit_card">Credit Card</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-3">Order ID</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Customer City</th>
                  <th className="py-2.5 px-3">Seller</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3">Update Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((ord) => (
                  <tr key={ord.order_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 font-mono text-indigo-300">{ord.order_id}</td>
                    <td className="py-2.5 px-3 font-medium text-white">{ord.product_name}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {ord.customer_city}, {ord.customer_state}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{ord.seller_name}</td>
                    <td className="py-2.5 px-3 uppercase text-slate-400">{ord.payment_type}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      R$ {ord.total_amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          ord.order_status === 'delivered'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : ord.order_status === 'shipped'
                            ? 'bg-sky-500/15 text-sky-400'
                            : ord.order_status === 'processing'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {ord.order_status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3">
                      <select
                        value={ord.order_status}
                        onChange={(e) =>
                          handleStatusChange(ord.order_id, e.target.value as OrderStatus)
                        }
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                      >
                        <option value="processing">processing</option>
                        <option value="shipped">shipped</option>
                        <option value="delivered">delivered</option>
                        <option value="canceled">canceled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* SQL CTE Inspector Modal */}
      {activeSqlKey && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {SQL_SNIPPETS[activeSqlKey].title}
              </h3>
              <button
                onClick={() => setActiveSqlKey(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close ✕
              </button>
            </div>
            <div className="flex gap-2">
              {Object.keys(SQL_SNIPPETS).map((k) => (
                <button
                  key={k}
                  onClick={() => setActiveSqlKey(k)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize ${
                    activeSqlKey === k
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {k} Query
                </button>
              ))}
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-indigo-300 overflow-x-auto font-mono leading-relaxed">
              {SQL_SNIPPETS[activeSqlKey].sql}
            </pre>
          </div>
        </div>
      )}

      {/* Create New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateOrder}
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Create New E-Commerce Order</h3>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Customer City & State</label>
                <div className="flex gap-2">
                  <input
                    value={newOrderCity}
                    onChange={(e) => setNewOrderCity(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                    required
                  />
                  <input
                    value={newOrderState}
                    onChange={(e) => setNewOrderState(e.target.value)}
                    className="w-16 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Product</label>
                <select
                  value={newOrderProduct}
                  onChange={(e) => setNewOrderProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="prd_10">Portable Smart Projector HD (R$ 690)</option>
                  <option value="prd_07">Stainless Espresso Maker 15-Bar (R$ 520)</option>
                  <option value="prd_09">ANC Bluetooth 5.3 Headphones (R$ 459)</option>
                  <option value="prd_02">Chronograph Steel Watch (R$ 389)</option>
                  <option value="prd_05">Mechanical Wireless Keyboard RGB (R$ 279)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Method</label>
                <select
                  value={newOrderPayment}
                  onChange={(e) => setNewOrderPayment(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="pix">PIX (Instant)</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="px-4 py-2 rounded bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Create Order
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
export default App;
