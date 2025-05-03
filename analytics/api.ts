import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { APIError } from "encore.dev/api";
import { auth } from "../auth/api";
import { CronJob } from "encore.dev/cron";
import { db } from "./db";

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

interface RestaurantStats {
  total_orders: number;
  total_revenue: number;
  average_rating: number;
  total_reviews: number;
  popular_items: {
    item_id: string;
    name: string;
    order_count: number;
  }[];
  peak_hours: {
    hour: number;
    order_count: number;
  }[];
}

interface TimeRange {
  start_date: Date;
  end_date: Date;
}

// Interface pour les statistiques quotidiennes
interface DailyAnalytics {
  restaurant_id: string;
  date: Date;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
}

interface DailyAnalyticsResponse {
  analytics: DailyAnalytics[];
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

// Get restaurant statistics
export const getRestaurantStats = api(
  { method: "GET", expose: true, path: "/restaurants/:restaurant_id/stats" },
  async (params: { restaurant_id: string } & TimeRange): Promise<RestaurantStats> => {
    // Get total orders and revenue
    const stats = await db.queryRow<{ total_orders: number; total_revenue: number }>`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM orders
      WHERE restaurant_id = ${params.restaurant_id}
      AND created_at BETWEEN ${params.start_date} AND ${params.end_date}
    `;

    if (!stats) {
      throw APIError.internal("Failed to get restaurant statistics");
    }

    // Get average rating and total reviews
    const reviews = await db.queryRow<{ average_rating: number; total_reviews: number }>`
      SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_reviews
      FROM reviews
      WHERE restaurant_id = ${params.restaurant_id}
      AND created_at BETWEEN ${params.start_date} AND ${params.end_date}
    `;

    if (!reviews) {
      throw APIError.internal("Failed to get review statistics");
    }

    // Get popular items
    const popularItems = await db.query<{ item_id: string; name: string; order_count: number }>`
      SELECT 
        mi.id as item_id,
        mi.name,
        COUNT(oi.id) as order_count
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = ${params.restaurant_id}
      AND o.created_at BETWEEN ${params.start_date} AND ${params.end_date}
      GROUP BY mi.id, mi.name
      ORDER BY order_count DESC
      LIMIT 5
    `;

    const items: { item_id: string; name: string; order_count: number }[] = [];
    for await (const item of popularItems) {
      items.push(item);
    }

    // Get peak hours
    const peakHours = await db.query<{ hour: number; order_count: number }>`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as order_count
      FROM orders
      WHERE restaurant_id = ${params.restaurant_id}
      AND created_at BETWEEN ${params.start_date} AND ${params.end_date}
      GROUP BY hour
      ORDER BY order_count DESC
      LIMIT 5
    `;

    const hours: { hour: number; order_count: number }[] = [];
    for await (const hour of peakHours) {
      hours.push(hour);
    }

    return {
      total_orders: stats.total_orders,
      total_revenue: stats.total_revenue,
      average_rating: reviews.average_rating,
      total_reviews: reviews.total_reviews,
      popular_items: items,
      peak_hours: hours,
    };
  }
);

// Générer les statistiques quotidiennes
export const generateDailyAnalytics = api(
  { method: "POST" },
  async (): Promise<void> => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Récupérer les commandes de la veille
    const orders = await db.query<{
      restaurant_id: string;
      total_amount: number;
    }>`
      SELECT restaurant_id, total_amount
      FROM orders
      WHERE DATE(created_at) = ${dateStr}
      AND status != 'cancelled'
    `;

    // Calculer les statistiques par restaurant
    const restaurantStats = new Map<string, {
      total_orders: number;
      total_revenue: number;
    }>();

    for await (const order of orders) {
      const stats = restaurantStats.get(order.restaurant_id) || {
        total_orders: 0,
        total_revenue: 0,
      };
      stats.total_orders++;
      stats.total_revenue += Number(order.total_amount);
      restaurantStats.set(order.restaurant_id, stats);
    }

    // Insérer les statistiques dans la base de données
    for (const [restaurant_id, stats] of restaurantStats) {
      const average_order_value = stats.total_orders > 0 
        ? stats.total_revenue / stats.total_orders 
        : 0;

      await db.exec`
        INSERT INTO daily_sales (
          restaurant_id, date, total_orders, 
          total_revenue, average_order_value
        )
        VALUES (
          ${restaurant_id}, ${dateStr}, ${stats.total_orders},
          ${stats.total_revenue}, ${average_order_value}
        )
        ON CONFLICT (restaurant_id, date) DO UPDATE
        SET total_orders = EXCLUDED.total_orders,
            total_revenue = EXCLUDED.total_revenue,
            average_order_value = EXCLUDED.average_order_value
      `;
    }
  }
);

// Nettoyer les données anciennes
export const cleanupOldData = api(
  { method: "POST" },
  async (): Promise<void> => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().split('T')[0];

    await db.exec`
      DELETE FROM daily_sales
      WHERE date < ${dateStr}
    `;

    await db.exec`
      DELETE FROM menu_item_analytics
      WHERE date < ${dateStr}
    `;

    await db.exec`
      DELETE FROM client_analytics
      WHERE date < ${dateStr}
    `;
  }
);

// Cron job pour générer les statistiques quotidiennes
const _ = new CronJob("daily-analytics", {
  title: "Generate Daily Analytics",
  every: "24h",
  endpoint: generateDailyAnalytics,
});

// Cron job pour nettoyer les données anciennes
const __ = new CronJob("cleanup-old-data", {
  title: "Cleanup Old Analytics Data",
  every: "24h",
  endpoint: cleanupOldData,
});

// API pour récupérer les statistiques quotidiennes
export const getDailyAnalytics = api(
  { method: "GET", expose: true, path: "/daily/:restaurant_id" },
  async (params: { restaurant_id: string }): Promise<DailyAnalyticsResponse> => {
    const analytics = await db.query<DailyAnalytics>`
      SELECT * FROM daily_sales
      WHERE restaurant_id = ${params.restaurant_id}
      ORDER BY date DESC
      LIMIT 30
    `;

    const result: DailyAnalytics[] = [];
    for await (const analytic of analytics) {
      result.push(analytic);
    }
    return { analytics: result };
  }
); 