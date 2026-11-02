"""Generate the sample CSVs the app is demonstrated with.

Deliberately domain-neutral retail data: a wide orders table, a small product
catalogue to join against, and a small per-store daily summary. Regenerate with:

    python gen_data.py
"""
import os

import numpy as np
import pandas as pd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

N_PRODUCTS = 2_000
N_ORDERS = 40_000

# ---------------------------------------------------------------- products
product_ids = np.arange(1_000_001, 1_000_001 + N_PRODUCTS)
categories = {
    "Home":        ["Kitchen", "Lighting", "Storage", "Textiles"],
    "Garden":      ["Tools", "Outdoor", "Plants", "Furniture"],
    "Electronics": ["Audio", "Computing", "Accessories", "Smart Home"],
    "Clothing":    ["Outerwear", "Footwear", "Tops", "Accessories"],
    "Sports":      ["Cycling", "Training", "Outdoor", "Water"],
}
cat_names = list(categories)
main_cat = rng.choice(cat_names, N_PRODUCTS, p=[.28, .18, .24, .18, .12])

products = pd.DataFrame({
    "product_id": product_ids,
    "sku": [f"SKU-{i:06d}" for i in rng.integers(100000, 999999, N_PRODUCTS)],
    "product_name": [f"{a} {b}" for a, b in zip(
        rng.choice(["Classic", "Compact", "Pro", "Everyday", "Studio"], N_PRODUCTS),
        rng.choice(["Chair", "Lamp", "Bottle", "Jacket", "Speaker", "Mat",
                    "Kettle", "Shelf", "Shoe", "Glove"], N_PRODUCTS))],
    "category": main_cat,
    "subcategory": [rng.choice(categories[c]) for c in main_cat],
    "brand": rng.choice(["Northwind", "Halden", "Kirkwood", "Vantage", "Aurea"],
                        N_PRODUCTS, p=[.3, .22, .2, .16, .12]),
    "unit_cost_gbp": np.round(rng.lognormal(2.6, 0.7, N_PRODUCTS), 2),
    "stock_units": rng.integers(0, 900, N_PRODUCTS),
    "discontinued": rng.random(N_PRODUCTS) < 0.07,
})
products.to_csv(os.path.join(OUT, "products.csv"), index=False)
print(f"products.csv         {len(products):>6} rows x {products.shape[1]} cols")

# ------------------------------------------------------------------ orders
pick = rng.integers(0, N_PRODUCTS, N_ORDERS)
quantity = rng.integers(1, 7, N_ORDERS)
unit_price = np.round(products["unit_cost_gbp"].to_numpy()[pick]
                      * rng.uniform(1.5, 2.6, N_ORDERS), 2)
discount = np.round(rng.choice([0, .05, .1, .15, .2, .25], N_ORDERS,
                               p=[.45, .15, .15, .1, .1, .05]), 2)
gross = np.round(quantity * unit_price, 2)
net = np.round(gross * (1 - discount), 2)

channel = rng.choice(["web", "app", "phone", "store"], N_ORDERS, p=[.4, .3, .12, .18])
status = rng.choice(["delivered", "shipped", "pending", "cancelled", "refunded"],
                    N_ORDERS, p=[.72, .12, .09, .05, .02])
has_promo = rng.random(N_ORDERS)

orders = pd.DataFrame({
    "order_id": np.arange(2_400_001, 2_400_001 + N_ORDERS),
    "order_date": (pd.Timestamp("2026-01-01")
                   + pd.to_timedelta(rng.integers(0, 300 * 86400, N_ORDERS), unit="s")),
    "customer_id": [f"C-{i:07d}" for i in rng.integers(1, 400_000, N_ORDERS)],
    "product_id": product_ids[pick],
    "store_id": rng.integers(101, 160, N_ORDERS),
    "channel": channel,
    "payment_method": rng.choice(["card", "apple_pay", "gift_card", "invoice",
                                  "direct_debit"], N_ORDERS,
                                 p=[.44, .26, .1, .12, .08]),
    "quantity": quantity,
    "unit_price_gbp": unit_price,
    "discount_pct": discount,
    "gross_amount_gbp": gross,
    "net_amount_gbp": net,
    "vat_gbp": np.round(net * 0.2, 2),
    "shipping_cost_gbp": np.where(channel == "store", np.nan,
                                  np.round(rng.uniform(0, 12.5, N_ORDERS), 2)),
    "order_status": status,
    "delivery_days": np.where(np.isin(status, ["delivered", "shipped"]),
                              rng.integers(1, 12, N_ORDERS), np.nan),
    "returned": rng.random(N_ORDERS) < np.where(status == "refunded", .9, .04),
    "postcode_district": rng.choice(["S70", "S71", "S72", "DN1", "DN2", "WF1", "LS1", "S60"],
                                    N_ORDERS),
    "region": rng.choice(["Yorkshire", "North West", "Midlands", "South East", "Scotland"],
                         N_ORDERS, p=[.34, .2, .22, .18, .06]),
    "country": "United Kingdom",
    "loyalty_tier": rng.choice(["none", "bronze", "silver", "gold"], N_ORDERS,
                               p=[.52, .24, .16, .08]),
    "campaign_id": np.where(has_promo < .4,
                            "CMP-" + pd.Series(rng.integers(100, 140, N_ORDERS)).astype(str),
                            None),
    "promo_code": np.where(has_promo > .65,
                           "PROMO" + pd.Series(rng.integers(10, 60, N_ORDERS)).astype(str),
                           None),
    "basket_items": rng.integers(1, 24, N_ORDERS),
    "weight_kg": np.round(rng.gamma(2.0, 1.6, N_ORDERS), 2),
    "notes": np.where(rng.random(N_ORDERS) < .01, "customer called", None),
})

# pad out to 100 columns, the way a wide export ends up wide: measures, flags
# and category codes, with nulls in the measures
need = 100 - orders.shape[1]
fillers, i = {}, 0
while len(fillers) < need:
    i += 1
    kind = i % 3
    if kind == 1:
        col = np.round(rng.normal(50, 15, N_ORDERS), 3)
        col[rng.random(N_ORDERS) < .1] = np.nan
        fillers[f"line_item_{i:03d}"] = col
    elif kind == 2:
        fillers[f"promo_flag_{i:03d}"] = rng.integers(0, 2, N_ORDERS)
    else:
        fillers[f"segment_{i:03d}"] = rng.choice(["a", "b", "c", "d"], N_ORDERS)
for name, col in list(fillers.items())[:need]:
    orders[name] = col

orders.to_csv(os.path.join(OUT, "orders.csv"), index=False)
print(f"orders.csv           {len(orders):>6} rows x {orders.shape[1]} cols")

# ------------------------------------------------------------- store_daily
daily = pd.DataFrame({
    "date": np.tile(pd.date_range("2026-01-01", periods=30, freq="D").strftime("%Y-%m-%d"), 20),
    "store_id": rng.choice(np.arange(101, 160), 600),
    "orders": rng.integers(20, 900, 600),
    "revenue_gbp": np.round(rng.lognormal(8.0, 0.6, 600), 2),
    "returns": rng.integers(0, 40, 600),
})
daily.to_csv(os.path.join(OUT, "store_daily.csv"), index=False)
print(f"store_daily.csv      {len(daily):>6} rows x {daily.shape[1]} cols")

for f in sorted(os.listdir(OUT)):
    if f.endswith(".csv"):
        print(f"  {f:20} {os.path.getsize(os.path.join(OUT, f)) / 1e6:6.1f} MB")
