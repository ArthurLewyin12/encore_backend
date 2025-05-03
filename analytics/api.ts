import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { APIError } from "encore.dev/api";
import { auth } from "../auth/api";

const db = new SQLDatabase("analytics", {
  migrations: "./migrations",
});

interface RestaurantMetrics {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
}

interface MenuItemMetrics {
  menu_item_id: string;
  quantity_sold: number;
  total_revenue: number;
}

interface ProcessingTimeMetrics {
  average_processing_time: number;
  min_processing_time: number;
  max_processing_time: number;
}

interface AuthContext {
  auth: {
    userID: string;
    role: string;
  };
}

interface MetricsParams {
  id: string;
  start_date: string;
  end_date: string;
}

interface MenuItemMetricsResponse {
  metrics: MenuItemMetrics[];
}

// Get restaurant metrics for a date range
export const getRestaurantMetrics = api<MetricsParams & AuthContext, RestaurantMetrics>(
  { method: "GET", expose: true, path: "/restaurant/:id/metrics", auth: true },
  async (params) => {
    // Verify restaurant ownership or admin access
    if (params.auth.role !== "admin") {
      const isOwner = await db.queryRow<{ exists: boolean }>`
        SELECT EXISTS(
          SELECT 1 FROM restaurants 
          WHERE id = ${params.id} AND owner_id = ${params.auth.userID}
        ) as exists
      `;

      if (!isOwner?.exists) {
        throw APIError.permissionDenied("Not authorized to view these metrics");
      }
    }

    const metrics = await db.queryRow<RestaurantMetrics>`
      SELECT 
        SUM(total_orders) as total_orders,
        SUM(total_revenue) as total_revenue,
        CASE 
          WHEN SUM(total_orders) > 0 THEN SUM(total_revenue) / SUM(total_orders)
          ELSE 0
        END as average_order_value
      FROM daily_restaurant_metrics
      WHERE restaurant_id = ${params.id}
      AND date BETWEEN ${params.start_date} AND ${params.end_date}
    `;

    if (!metrics) {
      return {
        total_orders: 0,
        total_revenue: 0,
        average_order_value: 0,
      };
    }

    return metrics;
  }
);

// Get menu item metrics for a date range
export const getMenuItemMetrics = api<MetricsParams & AuthContext, MenuItemMetricsResponse>(
  { method: "GET", expose: true, path: "/restaurant/:id/menu-metrics", auth: true },
  async (params) => {
    // Verify restaurant ownership or admin access
    if (params.auth.role !== "admin") {
      const isOwner = await db.queryRow<{ exists: boolean }>`
        SELECT EXISTS(
          SELECT 1 FROM restaurants 
          WHERE id = ${params.id} AND owner_id = ${params.auth.userID}
        ) as exists
      `;

      if (!isOwner?.exists) {
        throw APIError.permissionDenied("Not authorized to view these metrics");
      }
    }

    const metrics = await db.query<MenuItemMetrics>`
      SELECT 
        menu_item_id,
        SUM(quantity_sold) as quantity_sold,
        SUM(total_revenue) as total_revenue
      FROM daily_menu_item_metrics
      WHERE restaurant_id = ${params.id}
      AND date BETWEEN ${params.start_date} AND ${params.end_date}
      GROUP BY menu_item_id
      ORDER BY quantity_sold DESC
    `;

    const result: MenuItemMetrics[] = [];
    for await (const metric of metrics) {
      result.push(metric);
    }

    return { metrics: result };
  }
);

// Get order processing time metrics
export const getProcessingTimeMetrics = api<MetricsParams & AuthContext, ProcessingTimeMetrics>(
  { method: "GET", expose: true, path: "/restaurant/:id/processing-times", auth: true },
  async (params) => {
    // Verify restaurant ownership or admin access
    if (params.auth.role !== "admin") {
      const isOwner = await db.queryRow<{ exists: boolean }>`
        SELECT EXISTS(
          SELECT 1 FROM restaurants 
          WHERE id = ${params.id} AND owner_id = ${params.auth.userID}
        ) as exists
      `;

      if (!isOwner?.exists) {
        throw APIError.permissionDenied("Not authorized to view these metrics");
      }
    }

    const metrics = await db.queryRow<ProcessingTimeMetrics>`
      SELECT 
        AVG(processing_time_seconds) as average_processing_time,
        MIN(processing_time_seconds) as min_processing_time,
        MAX(processing_time_seconds) as max_processing_time
      FROM order_processing_times
      WHERE restaurant_id = ${params.id}
      AND start_time BETWEEN ${params.start_date} AND ${params.end_date}
      AND processing_time_seconds IS NOT NULL
    `;

    if (!metrics) {
      return {
        average_processing_time: 0,
        min_processing_time: 0,
        max_processing_time: 0,
      };
    }

    return metrics;
  }
); 