import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { APIError } from "encore.dev/api";

const db = new SQLDatabase("restaurant", {
  migrations: "./migrations",
});

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string;
  qr_code_url?: string;
  created_at: Date;
  updated_at: Date;
}

interface CreateRestaurantRequest {
  name: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string;
}

interface Table {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateTableRequest {
  restaurant_id: string;
  table_number: string;
  capacity: number;
}

interface TablesResponse {
  tables: Table[];
}

// Create a new restaurant
export const create = api(
  { method: "POST", expose: true },
  async (req: CreateRestaurantRequest): Promise<Restaurant> => {
    const result = await db.queryRow<Restaurant>`
      INSERT INTO restaurants (name, description, address, phone, email, logo_url)
      VALUES (${req.name}, ${req.description}, ${req.address}, ${req.phone}, ${req.email}, ${req.logo_url})
      RETURNING *
    `;
    
    if (!result) {
      throw APIError.internal("Failed to create restaurant");
    }
    
    return result;
  }
);

// Get restaurant by ID
export const get = api(
  { method: "GET", expose: true, path: "/restaurants/:id" },
  async (params: { id: string }): Promise<Restaurant> => {
    const restaurant = await db.queryRow<Restaurant>`
      SELECT * FROM restaurants WHERE id = ${params.id}
    `;
    
    if (!restaurant) {
      throw APIError.notFound("Restaurant not found");
    }
    
    return restaurant;
  }
);

// Create a new table
export const createTable = api(
  { method: "POST", expose: true, path: "/tables" },
  async (req: CreateTableRequest): Promise<Table> => {
    const result = await db.queryRow<Table>`
      INSERT INTO restaurant_tables (restaurant_id, table_number, capacity)
      VALUES (${req.restaurant_id}, ${req.table_number}, ${req.capacity})
      RETURNING *
    `;
    
    if (!result) {
      throw APIError.internal("Failed to create table");
    }
    
    return result;
  }
);

// Get all tables for a restaurant
export const getTables = api(
  { method: "GET", expose: true, path: "/restaurants/:id/tables" },
  async (params: { id: string }): Promise<TablesResponse> => {
    const tables = await db.query<Table>`
      SELECT * FROM restaurant_tables 
      WHERE restaurant_id = ${params.id}
      ORDER BY number
    `;
    
    const result: Table[] = [];
    for await (const table of tables) {
      result.push(table);
    }
    
    return { tables: result };
  }
); 