import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "olist_pulse.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    customer_unique_id TEXT NOT NULL,
    customer_city TEXT NOT NULL,
    customer_state TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
    seller_id TEXT PRIMARY KEY,
    seller_name TEXT NOT NULL,
    seller_city TEXT NOT NULL,
    seller_state TEXT NOT NULL,
    rating REAL NOT NULL DEFAULT 4.5
);

CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    product_category_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    order_status TEXT NOT NULL CHECK (order_status IN ('delivered', 'shipped', 'processing', 'canceled')),
    order_purchase_timestamp TEXT NOT NULL,
    order_delivered_customer_date TEXT,
    order_estimated_delivery_date TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL,
    order_item_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    price REAL NOT NULL,
    freight_value REAL NOT NULL,
    PRIMARY KEY (order_id, order_item_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (seller_id) REFERENCES sellers(seller_id)
);

CREATE TABLE IF NOT EXISTS order_payments (
    order_id TEXT NOT NULL,
    payment_sequential INTEGER NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('credit_card', 'boleto', 'voucher', 'debit_card', 'pix')),
    payment_installments INTEGER NOT NULL DEFAULT 1,
    payment_value REAL NOT NULL,
    PRIMARY KEY (order_id, payment_sequential),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_reviews (
    review_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    review_score INTEGER NOT NULL CHECK (review_score BETWEEN 1 AND 5),
    review_comment_title TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_purchase_ts ON orders(order_purchase_timestamp);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_and_seed_db(target_orders: int = 1500) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript(SCHEMA_SQL)

    existing = cur.execute("SELECT COUNT(*) AS cnt FROM orders").fetchone()["cnt"]
    if existing > 0:
        conn.close()
        return

    rng = random.Random(42)

    states = [
        ("SP", "Sao Paulo", 3),
        ("RJ", "Rio de Janeiro", 5),
        ("MG", "Belo Horizonte", 6),
        ("RS", "Porto Alegre", 8),
        ("PR", "Curitiba", 5),
        ("SC", "Florianopolis", 6),
        ("BA", "Salvador", 10),
        ("DF", "Brasilia", 7),
        ("PE", "Recife", 12),
        ("GO", "Goiania", 8),
    ]

    sellers_data = [
        ("sel_01", "TechBrasil Distribuidora", "Sao Paulo", "SP", 4.8),
        ("sel_02", "Casa & Conforto Ltda", "Curitiba", "PR", 4.6),
        ("sel_03", "Paulista MegaStore", "Campinas", "SP", 4.9),
        ("sel_04", "SulEletronicos", "Porto Alegre", "RS", 4.5),
        ("sel_05", "Beleza Pura Cosmeticos", "Rio de Janeiro", "RJ", 4.7),
        ("sel_06", "Minas Esporte & Lazer", "Belo Horizonte", "MG", 4.3),
        ("sel_07", "Prime Relogios & Presentes", "Sao Paulo", "SP", 4.8),
        ("sel_08", "AutoParts Express BR", "Guarulhos", "SP", 4.4),
        ("sel_09", "Conecta Informatica", "Florianopolis", "SC", 4.7),
        ("sel_10", "Nordeste Home Center", "Salvador", "BA", 4.2),
    ]
    cur.executemany(
        "INSERT INTO sellers (seller_id, seller_name, seller_city, seller_state, rating) VALUES (?, ?, ?, ?, ?)",
        sellers_data,
    )

    products_data = [
        ("prd_01", "health_beauty", "DermaCare Vitamin C Serum", 149.90),
        ("prd_02", "watches_gifts", "Chronograph Steel Watch", 389.00),
        ("prd_03", "bed_bath_table", "Egyptian Cotton Queen Sheet Set", 245.50),
        ("prd_04", "sports_leisure", "Carbon Pro Running Shoes", 319.90),
        ("prd_05", "computers_accessories", "Mechanical Wireless Keyboard RGB", 279.00),
        ("prd_06", "furniture_decor", "Scandinavian Oak Desk Lamp", 185.00),
        ("prd_07", "housewares", "Stainless Espresso Maker 15-Bar", 520.00),
        ("prd_08", "auto", "Smart Dashcam 1440p NightVision", 340.00),
        ("prd_09", "electronics", "ANC Bluetooth 5.3 Headphones", 459.00),
        ("prd_10", "cool_stuff", "Portable Smart Projector HD", 690.00),
    ]
    cur.executemany(
        "INSERT INTO products (product_id, product_category_name, product_name, unit_price) VALUES (?, ?, ?, ?)",
        products_data,
    )

    customers_batch = []
    for i in range(1, 501):
        st, city, _ = rng.choices(states, weights=[42, 14, 12, 7, 6, 5, 4, 4, 3, 3])[0]
        customers_batch.append((f"cus_{i:04d}", f"uniq_{i:04d}", city, st))
    cur.executemany(
        "INSERT INTO customers (customer_id, customer_unique_id, customer_city, customer_state) VALUES (?, ?, ?, ?)",
        customers_batch,
    )

    base_date = datetime(2025, 11, 1)
    orders_batch = []
    items_batch = []
    payments_batch = []
    reviews_batch = []

    payment_types = ["credit_card", "pix", "boleto", "voucher", "debit_card"]
    payment_weights = [58, 22, 12, 4, 4]

    for idx in range(1, target_orders + 1):
        order_id = f"ord_{idx:05d}"
        cust_id, _, _, cust_state = rng.choice(customers_batch)
        state_base_days = next(s[2] for s in states if s[0] == cust_state)

        month_offset = rng.choices(
            range(12),
            weights=[6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12, 13],
        )[0]
        day_offset = rng.randint(0, 27)
        purchase_dt = base_date + timedelta(days=month_offset * 30 + day_offset, hours=rng.randint(8, 22))
        est_dt = purchase_dt + timedelta(days=state_base_days + rng.randint(4, 9))

        status = rng.choices(
            ["delivered", "shipped", "processing", "canceled"],
            weights=[88, 6, 4, 2],
        )[0]

        if status == "delivered":
            actual_days = state_base_days + rng.randint(-1, 8)
            delivered_dt_str = (purchase_dt + timedelta(days=max(1, actual_days))).strftime("%Y-%m-%d %H:%M:%S")
        else:
            delivered_dt_str = None

        orders_batch.append(
            (
                order_id,
                cust_id,
                status,
                purchase_dt.strftime("%Y-%m-%d %H:%M:%S"),
                delivered_dt_str,
                est_dt.strftime("%Y-%m-%d %H:%M:%S"),
            )
        )

        num_items = rng.choices([1, 2, 3], weights=[78, 17, 5])[0]
        order_total = 0.0
        for item_seq in range(1, num_items + 1):
            prd_id, _, _, base_price = rng.choice(products_data)
            seller_id = rng.choice(sellers_data)[0]
            price = round(base_price * rng.uniform(0.92, 1.08), 2)
            freight = round(rng.uniform(12.50, 48.00), 2)
            order_total += price + freight
            items_batch.append((order_id, item_seq, prd_id, seller_id, price, freight))

        pay_type = rng.choices(payment_types, weights=payment_weights)[0]
        installments = rng.choice([1, 2, 3, 6, 10]) if pay_type == "credit_card" else 1
        payments_batch.append((order_id, 1, pay_type, installments, round(order_total, 2)))

        score = rng.choices([5, 4, 3, 2, 1], weights=[56, 23, 10, 5, 6])[0]
        reviews_batch.append((f"rev_{idx:05d}", order_id, score, "Order feedback"))

    cur.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)", orders_batch)
    cur.executemany("INSERT INTO order_items VALUES (?, ?, ?, ?, ?, ?)", items_batch)
    cur.executemany("INSERT INTO order_payments VALUES (?, ?, ?, ?, ?)", payments_batch)
    cur.executemany("INSERT INTO order_reviews VALUES (?, ?, ?, ?)", reviews_batch)

    conn.commit()
    conn.close()
