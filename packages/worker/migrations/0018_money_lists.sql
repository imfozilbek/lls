-- «Pul» → «Kuryerlardagi naqd pul»: only the cash a courier still holds. The old indexes either
-- sorted the shop's whole history by number or kept every cash order ever handed over.
CREATE INDEX idx_orders_cash_open ON orders (business_id, number)
    WHERE cash_courier_id IS NOT NULL AND cash_received_at IS NULL;

-- A new transfer screenshot: the customer's earlier refused transfers, not their whole history.
CREATE INDEX idx_orders_customer_rejected ON orders (customer_id)
    WHERE transfer_rejections > 0;
