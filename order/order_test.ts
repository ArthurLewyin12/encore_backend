import { describe, it, expect } from 'vitest';
import { create, get, updateStatus, getOrderItems, getOrderNotifications } from "./api";
import { db } from './db';
import { generateClientId } from "../auth/api";

describe('Order Service', () => {
  it('should handle order lifecycle', async () => {
    // Create test data
    const restaurant = await db.queryRow<{ id: string }>`
      INSERT INTO restaurants (name, address)
      VALUES ('Test Restaurant', '123 Test St')
      RETURNING id
    `;
    expect(restaurant).not.toBeNull();

    const table = await db.queryRow<{ id: string }>`
      INSERT INTO restaurant_tables (restaurant_id, number, capacity)
      VALUES (${restaurant!.id}, 1, 4)
      RETURNING id
    `;
    expect(table).not.toBeNull();

    // Generate anonymous client ID
    const { client_id } = await generateClientId({ name: "Test Client" });

    const category = await db.queryRow<{ id: string }>`
      INSERT INTO menu_categories (restaurant_id, name, display_order)
      VALUES (${restaurant!.id}, 'Test Category', 1)
      RETURNING id
    `;
    expect(category).not.toBeNull();

    const menuItem = await db.queryRow<{ id: string }>`
      INSERT INTO menu_items (restaurant_id, category_id, name, price)
      VALUES (${restaurant!.id}, ${category!.id}, 'Test Item', 10.00)
      RETURNING id
    `;
    expect(menuItem).not.toBeNull();

    // Test order creation with anonymous client
    const order = await create({
      restaurant_id: restaurant!.id,
      table_id: table!.id,
      client_id: client_id,
      client_name: "Test Client",
      items: [
        {
          menu_item_id: menuItem!.id,
          quantity: 2,
          notes: "Test notes"
        }
      ]
    });

    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
    expect(order.total_amount).toBe(20.00);

    // Test getting order
    const retrievedOrder = await get({ id: order.id });
    expect(retrievedOrder).toBeDefined();
    expect(retrievedOrder.id).toBe(order.id);

    // Test getting order items
    const items = await getOrderItems({ id: order.id });
    expect(items.items).toHaveLength(1);
    expect(items.items[0].quantity).toBe(2);

    // Test updating order status
    const updatedOrder = await updateStatus({
      id: order.id,
      status: "preparing"
    });
    expect(updatedOrder.status).toBe("preparing");

    // Test getting notifications
    const notifications = await getOrderNotifications({ id: order.id });
    expect(notifications.notifications).toHaveLength(2); // Created and status update
    expect(notifications.notifications[0].status).toBe("preparing");
  });

  it('should validate order operations', async () => {
    // Test invalid restaurant
    const { client_id } = await generateClientId({ name: "Test Client" });

    await expect(create({
      restaurant_id: "invalid-id",
      table_id: "invalid-id",
      client_id: client_id,
      items: []
    })).rejects.toThrow();

    // Test invalid items
    await expect(create({
      restaurant_id: "valid-id",
      table_id: "valid-id",
      client_id: client_id,
      items: [
        {
          menu_item_id: "invalid-id",
          quantity: 0
        }
      ]
    })).rejects.toThrow();
  });
}); 