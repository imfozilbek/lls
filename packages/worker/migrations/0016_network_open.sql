-- Network orders nobody took yet (the courier's «Yaqinda» list, the late check): only the open
-- ones. The old idx_orders_network_waiting also keeps every finished order of the network that
-- went without a courier, so it grows forever. Additive: the previous Worker never uses it.
CREATE INDEX idx_orders_network_open ON orders (network_requested_at)
    WHERE network_requested_at IS NOT NULL AND courier_id IS NULL
        AND status IN ('accepted', 'preparing', 'ready');
