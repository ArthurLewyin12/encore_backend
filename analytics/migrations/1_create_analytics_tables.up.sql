CREATE TABLE daily_restaurant_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  average_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, date)
);

CREATE TABLE daily_menu_item_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, menu_item_id, date)
);

CREATE TABLE order_processing_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  processing_time_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_sales (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_orders INTEGER NOT NULL,
    total_revenue DECIMAL(10,2) NOT NULL,
    average_order_value DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_item_analytics (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    date DATE NOT NULL,
    quantity_sold INTEGER NOT NULL,
    total_revenue DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_analytics (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_orders INTEGER NOT NULL,
    total_spent DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_daily_restaurant_metrics_restaurant_date ON daily_restaurant_metrics(restaurant_id, date);
CREATE INDEX idx_daily_menu_item_metrics_restaurant_date ON daily_menu_item_metrics(restaurant_id, date);
CREATE INDEX idx_order_processing_times_restaurant ON order_processing_times(restaurant_id);
CREATE UNIQUE INDEX idx_daily_sales_unique ON daily_sales (restaurant_id, date);
CREATE UNIQUE INDEX idx_menu_item_analytics_unique ON menu_item_analytics (restaurant_id, menu_item_id, date);
CREATE UNIQUE INDEX idx_client_analytics_unique ON client_analytics (restaurant_id, client_id, date); 