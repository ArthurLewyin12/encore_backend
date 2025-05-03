import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { APIError } from "encore.dev/api";
import { Topic, Subscription } from "encore.dev/pubsub";

const db = new SQLDatabase("order", {
  migrations: "./migrations",
});

// Define the order event topic for real-time updates
export interface OrderEvent {
  order_id: string;
  restaurant_id: string;
  table_id: string;
  status: string;
  event_type: "created" | "updated" | "status_changed";
  timestamp: Date;
}

export const orderEvents = new Topic<OrderEvent>("order-events", {
  deliveryGuarantee: "at-least-once",
});

interface Order {
  id: string;
  restaurant_id: string;
  table_id: string;
  status: string;
  total_amount: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface OrderItemOption {
  id: string;
  order_item_id: string;
  option_id: string;
  quantity: number;
  unit_price_adjustment: number;
  total_price_adjustment: number;
  created_at: Date;
  updated_at: Date;
}

interface CreateOrderRequest {
  restaurant_id: string;
  table_id: string;
  client_id: string;
  client_name?: string;
  items: {
    menu_item_id: string;
    quantity: number;
    options?: {
      option_id: string;
      quantity: number;
    }[];
    notes?: string;
  }[];
  notes?: string;
}

interface Review {
  id: string;
  order_id: string;
  restaurant_id: string;
  client_id: string;
  client_name?: string;
  rating: number;
  comment?: string;
  created_at: Date;
}

interface OrderItemsResponse {
  items: OrderItem[];
}

interface OrderItemOptionsResponse {
  options: OrderItemOption[];
}

interface ReviewsResponse {
  reviews: Review[];
}

interface StreamParams {
  restaurant_id: string;
}

// Create a new order
export const create = api(
  { method: "POST", expose: true },
  async (req: CreateOrderRequest): Promise<Order> => {
    // Start a transaction
    const order = await db.queryRow<Order>`
      WITH new_order AS (
        INSERT INTO orders (
          restaurant_id, table_id, client_id, client_name, 
          status, total_amount, notes
        )
        VALUES (
          ${req.restaurant_id}, ${req.table_id}, ${req.client_id}, 
          ${req.client_name}, 'pending', 0, ${req.notes}
        )
        RETURNING *
      )
      SELECT * FROM new_order
    `;

    if (!order) {
      throw APIError.internal("Failed to create order");
    }

    // Calculate total amount and create order items
    let totalAmount = 0;

    for (const item of req.items) {
      // Get menu item price
      const menuItem = await db.queryRow<{ price: number }>`
        SELECT price FROM menu_items WHERE id = ${item.menu_item_id}
      `;

      if (!menuItem) {
        throw APIError.notFound(`Menu item ${item.menu_item_id} not found`);
      }

      const itemTotal = menuItem.price * item.quantity;
      totalAmount += itemTotal;

      // Create order item
      const orderItem = await db.queryRow<OrderItem>`
        INSERT INTO order_items (
          order_id, menu_item_id, quantity, 
          unit_price, total_price, notes
        )
        VALUES (
          ${order.id}, ${item.menu_item_id}, ${item.quantity},
          ${menuItem.price}, ${itemTotal}, ${item.notes}
        )
        RETURNING *
      `;

      if (!orderItem) {
        throw APIError.internal("Failed to create order item");
      }

      // Create order item options if any
      if (item.options) {
        for (const option of item.options) {
          const menuOption = await db.queryRow<{ price_adjustment: number }>`
            SELECT price_adjustment FROM menu_item_options WHERE id = ${option.option_id}
          `;

          if (!menuOption) {
            throw APIError.notFound(`Menu option ${option.option_id} not found`);
          }

          const optionTotal = menuOption.price_adjustment * option.quantity;
          totalAmount += optionTotal;

          await db.exec`
            INSERT INTO order_item_options (
              order_item_id, option_id, quantity,
              unit_price_adjustment, total_price_adjustment
            )
            VALUES (
              ${orderItem.id}, ${option.option_id}, ${option.quantity},
              ${menuOption.price_adjustment}, ${optionTotal}
            )
          `;
        }
      }
    }

    // Update order total amount
    await db.exec`
      UPDATE orders 
      SET total_amount = ${totalAmount}
      WHERE id = ${order.id}
    `;

    // Publish order created event
    await orderEvents.publish({
      order_id: order.id,
      restaurant_id: order.restaurant_id,
      table_id: order.table_id,
      status: order.status,
      event_type: "created",
      timestamp: new Date(),
    });

    return { ...order, total_amount: totalAmount };
  }
);

// Get order by ID
export const get = api(
  { method: "GET", expose: true, path: "/orders/:id" },
  async (params: { id: string }): Promise<Order> => {
    const order = await db.queryRow<Order>`
      SELECT * FROM orders WHERE id = ${params.id}
    `;

    if (!order) {
      throw APIError.notFound("Order not found");
    }

    return order;
  }
);

// Update order status
export const updateStatus = api(
  { method: "POST", expose: true, path: "/orders/:id/status" },
  async (params: { id: string; status: string; notes?: string }): Promise<Order> => {
    const order = await db.queryRow<Order>`
      UPDATE orders 
      SET status = ${params.status}
      WHERE id = ${params.id}
      RETURNING *
    `;

    if (!order) {
      throw APIError.notFound("Order not found");
    }

    // Record status change in history
    await db.exec`
      INSERT INTO order_status_history (order_id, status, notes)
      VALUES (${params.id}, ${params.status}, ${params.notes})
    `;

    // Publish status changed event
    await orderEvents.publish({
      order_id: order.id,
      restaurant_id: order.restaurant_id,
      table_id: order.table_id,
      status: order.status,
      event_type: "status_changed",
      timestamp: new Date(),
    });

    return order;
  }
);

// Get order items
export const getOrderItems = api(
  { method: "GET", expose: true, path: "/orders/:id/items" },
  async (params: { id: string }): Promise<OrderItemsResponse> => {
    const items = await db.query<OrderItem>`
      SELECT * FROM order_items WHERE order_id = ${params.id}
    `;

    const result: OrderItem[] = [];
    for await (const item of items) {
      result.push(item);
    }

    return { items: result };
  }
);

// Get order item options
export const getOrderItemOptions = api(
  { method: "GET", expose: true, path: "/order-items/:item_id/options" },
  async (params: { item_id: string }): Promise<OrderItemOptionsResponse> => {
    const options = await db.query<OrderItemOption>`
      SELECT * FROM order_item_options WHERE order_item_id = ${params.item_id}
    `;

    const result: OrderItemOption[] = [];
    for await (const option of options) {
      result.push(option);
    }

    return { options: result };
  }
);

// WebSocket stream for real-time order updates
export const subscribeToOrders = api.raw(
  { 
    path: "/restaurants/:restaurant_id/orders/stream",
    expose: true 
  },
  async (req, res) => {
    const restaurant_id = req.url?.split('/')[2] || '';
    new Subscription(orderEvents, "order-updates", {
      handler: async (event: OrderEvent) => {
        if (event.restaurant_id === restaurant_id) {
          res.write(JSON.stringify({
            order_id: event.order_id,
            status: event.status,
            event_type: event.event_type,
            timestamp: event.timestamp
          }) + "\n");
        }
      }
    });
  }
);

// Submit a review for an order
export const submitReview = api(
  { method: "POST", expose: true, path: "/orders/:order_id/review" },
  async (params: { 
    order_id: string;
    client_id: string;
    client_name?: string;
    rating: number;
    comment?: string;
  }): Promise<Review> => {
    // Verify the order exists and belongs to the client
    const order = await db.queryRow<{ restaurant_id: string }>`
      SELECT restaurant_id FROM orders
      WHERE id = ${params.order_id}
      AND client_id = ${params.client_id}
    `;

    if (!order) {
      throw APIError.notFound("Order not found or not authorized");
    }

    // Create the review
    const review = await db.queryRow<Review>`
      INSERT INTO reviews (
        order_id, restaurant_id, client_id, client_name,
        rating, comment
      )
      VALUES (
        ${params.order_id}, ${order.restaurant_id}, ${params.client_id},
        ${params.client_name}, ${params.rating}, ${params.comment}
      )
      RETURNING *
    `;

    if (!review) {
      throw APIError.internal("Failed to create review");
    }

    return review;
  }
);

// Get reviews for a restaurant
export const getRestaurantReviews = api(
  { method: "GET", expose: true, path: "/restaurant/:restaurant_id/reviews" },
  async (params: { restaurant_id: string }): Promise<ReviewsResponse> => {
    const reviews = await db.query<Review>`
      SELECT * FROM reviews
      WHERE restaurant_id = ${params.restaurant_id}
      ORDER BY created_at DESC
    `;

    const result: Review[] = [];
    for await (const review of reviews) {
      result.push(review);
    }

    return { reviews: result };
  }
); 