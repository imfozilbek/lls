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
    bottle_deposit      INTEGER NOT NULL DEFAULT 0,  -- UZS per kept returnable bottle
    marketplace_commission_bps INTEGER,             -- NULL = not in the LLS marketplace
    marketplace_joined_at      INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX idx_businesses_owner ON businesses (owner_telegram_id);

CREATE TABLE products (
    id            TEXT PRIMARY KEY,
    business_id   TEXT    NOT NULL REFERENCES businesses (id),
    name          TEXT    NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL,              -- per piece, or per kg
    unit          TEXT    NOT NULL,
    step          INTEGER NOT NULL DEFAULT 1,    -- grams for kg, 1 for pieces
    category      TEXT    NOT NULL,
    image_key     TEXT,
    is_available  INTEGER NOT NULL DEFAULT 1,
    unavailable_until INTEGER,                   -- stop-list: hidden until this moment
    returnable    INTEGER NOT NULL DEFAULT 0,    -- 19 l bottle with a deposit
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
    channel           TEXT    NOT NULL,            -- shop_bot | marketplace
    status            TEXT    NOT NULL,
    subtotal          INTEGER NOT NULL,
    delivery_fee      INTEGER NOT NULL,
    deposit_total     INTEGER NOT NULL DEFAULT 0,
    bottles_returned  INTEGER NOT NULL DEFAULT 0,
    total             INTEGER NOT NULL,
    commission_bps    INTEGER NOT NULL DEFAULT 0,  -- snapshot of the deal when placed
    commission        INTEGER NOT NULL DEFAULT 0,  -- LLS share of the goods, UZS
    courier_id        TEXT,
    courier_name      TEXT,
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
    courier_message_id INTEGER,            -- the courier's order card
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    UNIQUE (business_id, number)
);
CREATE INDEX idx_orders_business_status ON orders (business_id, status, number);
CREATE INDEX idx_orders_business_created ON orders (business_id, created_at);
CREATE INDEX idx_orders_customer ON orders (customer_id, business_id, number);
CREATE INDEX idx_orders_courier ON orders (courier_id, status, updated_at);

CREATE TABLE order_items (
    order_id    TEXT    NOT NULL REFERENCES orders (id),
    line        INTEGER NOT NULL,
    product_id  TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    unit        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    unit_price  INTEGER NOT NULL,
    quantity    INTEGER NOT NULL,              -- pieces, or grams for kg
    total       INTEGER NOT NULL,
    PRIMARY KEY (order_id, line)
);

-- A shop's own delivery people. One row per person per shop.
CREATE TABLE couriers (
    id           TEXT PRIMARY KEY,
    business_id  TEXT    NOT NULL REFERENCES businesses (id),
    telegram_id  INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    phone        TEXT,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    UNIQUE (business_id, telegram_id)
);
CREATE INDEX idx_couriers_telegram ON couriers (telegram_id);

-- One-time invite links. Only a hash of the code is stored.
CREATE TABLE courier_invites (
    code_hash    TEXT PRIMARY KEY,
    business_id  TEXT    NOT NULL REFERENCES businesses (id),
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    used_at      INTEGER
);
