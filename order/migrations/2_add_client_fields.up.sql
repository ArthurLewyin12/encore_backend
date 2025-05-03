-- Add client fields to orders table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'orders' AND column_name = 'client_id') THEN
        ALTER TABLE orders
        ADD COLUMN client_id UUID NOT NULL,
        ADD COLUMN client_name TEXT,
        ADD FOREIGN KEY (client_id) REFERENCES clients(id);
    END IF;
END $$;

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  client_name TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
); 