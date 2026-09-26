-- LLS stage 1 schema. Money: INTEGER UZS. Time: INTEGER unix ms (UTC).

CREATE TABLE businesses (
    id                  TEXT PRIMARY KEY,
    slug                TEXT    NOT NULL UNIQUE,
    name                TEXT    NOT NULL,
    type                TEXT    NOT NULL,
    owner_telegram_id   INTEGER NOT NULL,
    status              TEXT    NOT NULL,
    bot_id              INTEGER NOT NULL UNIQUE,
    bot_username        TEXT    NOT NULL,
    bot_token_enc       TEXT    NOT NULL,
    webhook_secret      TEXT    NOT NULL,
    brand_color         TEXT    NOT NULL,
    logo_key            TEXT,
    address             TEXT,
    latitude            REAL,
    longitude           REAL,
    delivery_fee        INTEGER NOT NULL,
    free_delivery_from  INTEGER,
    min_order           INTEGER,
    delivery_radius_m   INTEGER,
    working_hours       TEXT,              -- JSON schedule, NULL = always open
    features            TEXT    NOT NULL DEFAULT '[]',
    accepting_orders    INTEGER NOT NULL DEFAULT 1,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX idx_businesses_owner ON businesses (owner_telegram_id);

CREATE TABLE products (
    id            TEXT PRIMARY KEY,
    business_id   TEXT    NOT NULL REFERENCES businesses (id),
    name          TEXT    NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL,
    unit          TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    image_key     TEXT,
    is_available  INTEGER NOT NULL DEFAULT 1,
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_products_catalog ON products (business_id, is_available, position, name);

CREATE TABLE customers (
    id           TEXT PRIMARY KEY,
    telegram_id  INTEGER NOT NULL UNIQUE,
    name         TEXT    NOT NULL,
    phone        TEXT,
    language     TEXT    NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);

CREATE TABLE customer_businesses (
    customer_id     TEXT    NOT NULL REFERENCES customers (id),
    business_id     TEXT    NOT NULL REFERENCES businesses (id),
    first_order_at  INTEGER NOT NULL,
    PRIMARY KEY (customer_id, business_id)
);
CREATE INDEX idx_customer_businesses_business ON customer_businesses (business_id);

CREATE TABLE orders (
    id                TEXT PRIMARY KEY,
    business_id       TEXT    NOT NULL REFERENCES businesses (id),
    number            INTEGER NOT NULL,
    customer_id       TEXT    NOT NULL REFERENCES customers (id),
    status            TEXT    NOT NULL,
    subtotal          INTEGER NOT NULL,
    delivery_fee      INTEGER NOT NULL,
    total             INTEGER NOT NULL,
    address           TEXT    NOT NULL,
    landmark          TEXT,
    latitude          REAL,
    longitude         REAL,
    comment           TEXT,
    customer_name     TEXT    NOT NULL,
    customer_phone    TEXT,
    cancel_reason     TEXT,
    cancelled_by      TEXT,
    owner_message_id  INTEGER,             -- Telegram message to edit on status change
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    UNIQUE (business_id, number)
);
CREATE INDEX idx_orders_business_status ON orders (business_id, status, number);
CREATE INDEX idx_orders_business_created ON orders (business_id, created_at);
CREATE INDEX idx_orders_customer ON orders (customer_id, business_id, number);

CREATE TABLE order_items (
    order_id    TEXT    NOT NULL REFERENCES orders (id),
    line        INTEGER NOT NULL,
    product_id  TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    unit        TEXT    NOT NULL,
    unit_price  INTEGER NOT NULL,
    quantity    INTEGER NOT NULL,
    PRIMARY KEY (order_id, line)
);
