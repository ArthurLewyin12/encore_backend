import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { APIError } from "encore.dev/api";

const db = new SQLDatabase("menu", {
  migrations: "./migrations",
});

interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  created_at: Date;
  updated_at: Date;
}

interface MenuItemOption {
  id: string;
  menu_item_id: string;
  name: string;
  price_adjustment: number;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateCategoryRequest {
  restaurant_id: string;
  name: string;
  description?: string;
  display_order: number;
}

interface CreateMenuItemRequest {
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  preparation_time?: number;
}

interface CreateMenuItemOptionRequest {
  menu_item_id: string;
  name: string;
  price_adjustment: number;
}

interface MenuCategoriesResponse {
  categories: MenuCategory[];
}

interface MenuItemsResponse {
  items: MenuItem[];
}

interface MenuItemOptionsResponse {
  options: MenuItemOption[];
}

interface Promotion {
  id: string;
  menu_item_id: string;
  discount_percentage: number;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
}

// Create a new menu category
export const createCategory = api(
  { method: "POST", expose: true, path: "/categories" },
  async (req: CreateCategoryRequest): Promise<MenuCategory> => {
    const result = await db.queryRow<MenuCategory>`
      INSERT INTO menu_categories (restaurant_id, name, description, display_order)
      VALUES (${req.restaurant_id}, ${req.name}, ${req.description}, ${req.display_order})
      RETURNING *
    `;
    
    if (!result) {
      throw APIError.internal("Failed to create menu category");
    }
    
    return result;
  }
);

// Get all categories for a restaurant
export const getCategories = api(
  { method: "GET", expose: true, path: "/:restaurant_id/categories" },
  async (params: { restaurant_id: string }): Promise<MenuCategoriesResponse> => {
    const categories = await db.query<MenuCategory>`
      SELECT * FROM menu_categories 
      WHERE restaurant_id = ${params.restaurant_id}
      ORDER BY display_order
    `;
    
    const result: MenuCategory[] = [];
    for await (const category of categories) {
      result.push(category);
    }
    
    return { categories: result };
  }
);

// Create a new menu item
export const createMenuItem = api(
  { method: "POST", expose: true, path: "/items" },
  async (req: CreateMenuItemRequest): Promise<MenuItem> => {
    const result = await db.queryRow<MenuItem>`
      INSERT INTO menu_items (
        restaurant_id, category_id, name, description, 
        price, image_url, preparation_time
      )
      VALUES (
        ${req.restaurant_id}, ${req.category_id}, ${req.name}, 
        ${req.description}, ${req.price}, ${req.image_url}, 
        ${req.preparation_time}
      )
      RETURNING *
    `;
    
    if (!result) {
      throw APIError.internal("Failed to create menu item");
    }
    
    return result;
  }
);

// Get all items for a restaurant
export const getMenuItems = api(
  { method: "GET", expose: true, path: "/restaurants/:restaurant_id/menu-items" },
  async (params: { restaurant_id: string }): Promise<MenuItemsResponse> => {
    const items = await db.query<MenuItem>`
      SELECT * FROM menu_items 
      WHERE restaurant_id = ${params.restaurant_id}
      ORDER BY category_id, name
    `;
    
    const result: MenuItem[] = [];
    for await (const item of items) {
      result.push(item);
    }
    
    return { items: result };
  }
);

// Create a menu item option
export const createMenuItemOption = api(
  { method: "POST", expose: true, path: "/menu-items/:item_id/options" },
  async (params: { item_id: string } & CreateMenuItemOptionRequest): Promise<MenuItemOption> => {
    const result = await db.queryRow<MenuItemOption>`
      INSERT INTO menu_item_options (menu_item_id, name, price_adjustment)
      VALUES (${params.item_id}, ${params.name}, ${params.price_adjustment})
      RETURNING *
    `;
    
    if (!result) {
      throw APIError.internal("Failed to create menu item option");
    }
    
    return result;
  }
);

// Get all options for a menu item
export const getMenuItemOptions = api(
  { method: "GET", expose: true, path: "/menu-items/:item_id/options" },
  async (params: { item_id: string }): Promise<MenuItemOptionsResponse> => {
    const options = await db.query<MenuItemOption>`
      SELECT * FROM menu_item_options 
      WHERE menu_item_id = ${params.item_id}
      ORDER BY name
    `;
    
    const result: MenuItemOption[] = [];
    for await (const option of options) {
      result.push(option);
    }
    
    return { options: result };
  }
);

// Create a promotion for a menu item
export const createPromotion = api(
  { method: "POST", expose: true, path: "/menu-items/:item_id/promotions" },
  async (params: { item_id: string } & Omit<Promotion, "id" | "menu_item_id" | "is_active">): Promise<Promotion> => {
    const promotion = await db.queryRow<Promotion>`
      INSERT INTO promotions (
        menu_item_id,
        discount_percentage,
        start_date,
        end_date,
        is_active
      )
      VALUES (
        ${params.item_id},
        ${params.discount_percentage},
        ${params.start_date},
        ${params.end_date},
        true
      )
      RETURNING *
    `;

    if (!promotion) {
      throw APIError.internal("Failed to create promotion");
    }

    return promotion;
  }
);

// Get active promotions for a restaurant
export const getActivePromotions = api(
  { method: "GET", expose: true, path: "/restaurants/:restaurant_id/promotions" },
  async (params: { restaurant_id: string }): Promise<{ promotions: Promotion[] }> => {
    const promotions = await db.query<Promotion>`
      SELECT p.*
      FROM promotions p
      JOIN menu_items mi ON mi.id = p.menu_item_id
      WHERE mi.restaurant_id = ${params.restaurant_id}
      AND p.is_active = true
      AND CURRENT_TIMESTAMP BETWEEN p.start_date AND p.end_date
    `;

    const result: Promotion[] = [];
    for await (const promotion of promotions) {
      result.push(promotion);
    }

    return { promotions: result };
  }
); 