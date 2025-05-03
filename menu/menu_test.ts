import { describe, it, expect } from 'vitest';
import { createCategory, createMenuItem, getCategories, getMenuItems, createMenuItemOption, getMenuItemOptions, createPromotion, getActivePromotions } from "./api";
import { db } from "./db";

describe('Menu Service', () => {
  it('should handle menu management', async () => {
    // Create test restaurant
    const restaurant = await db.queryRow<{ id: string }>`
      INSERT INTO restaurants (name, address)
      VALUES ('Test Restaurant', '123 Test St')
      RETURNING id
    `;
    expect(restaurant).not.toBeNull();

    // Test category creation
    const category = await createCategory({
      restaurant_id: restaurant!.id,
      name: "Test Category",
      description: "Test Description",
      display_order: 1
    });

    expect(category).toBeDefined();
    expect(category.name).toBe("Test Category");

    // Test getting categories
    const categories = await getCategories({ restaurant_id: restaurant!.id });
    expect(categories.categories).toHaveLength(1);
    expect(categories.categories[0].id).toBe(category.id);

    // Test menu item creation
    const menuItem = await createMenuItem({
      restaurant_id: restaurant!.id,
      category_id: category.id,
      name: "Test Item",
      description: "Test Description",
      price: 10.00
    });

    expect(menuItem).toBeDefined();
    expect(menuItem.price).toBe(10.00);

    // Test getting menu items
    const items = await getMenuItems({ restaurant_id: restaurant!.id });
    expect(items.items).toHaveLength(1);
    expect(items.items[0].id).toBe(menuItem.id);

    // Test menu item option creation
    const option = await createMenuItemOption({
      item_id: menuItem.id,
      menu_item_id: menuItem.id,
      name: "Test Option",
      price_adjustment: 2.00
    });

    expect(option).toBeDefined();
    expect(option.price_adjustment).toBe(2.00);

    // Test getting menu item options
    const options = await getMenuItemOptions({ item_id: menuItem.id });
    expect(options.options).toHaveLength(1);
    expect(options.options[0].id).toBe(option.id);

    // Test promotion creation
    const promotion = await createPromotion({
      item_id: menuItem.id,
      discount_percentage: 20,
      start_date: new Date(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });

    expect(promotion).toBeDefined();
    expect(promotion.discount_percentage).toBe(20);

    // Test getting active promotions
    const promotions = await getActivePromotions({ restaurant_id: restaurant!.id });
    expect(promotions.promotions).toHaveLength(1);
    expect(promotions.promotions[0].id).toBe(promotion.id);
  });

  it('should validate menu operations', async () => {
    // Test invalid restaurant
    await expect(createCategory({
      restaurant_id: "invalid-id",
      name: "Test Category",
      display_order: 1
    })).rejects.toThrow();

    // Test invalid category
    await expect(createMenuItem({
      restaurant_id: "valid-id",
      category_id: "invalid-id",
      name: "Test Item",
      price: 10.00
    })).rejects.toThrow();

    // Test invalid menu item
    await expect(createMenuItemOption({
      item_id: "invalid-id",
      menu_item_id: "invalid-id",
      name: "Test Option",
      price_adjustment: 2.00
    })).rejects.toThrow();

    // Test invalid promotion
    await expect(createPromotion({
      item_id: "invalid-id",
      discount_percentage: 20,
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow();
  });
}); 