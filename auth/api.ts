import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { APIError } from "encore.dev/api";
import { Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import bcrypt from "bcrypt";
import crypto from "crypto";

const db = new SQLDatabase("auth", {
  migrations: "./migrations",
});

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
  role: string;
}

interface AuthenticatedRequest {
  auth: AuthData;
}

interface Client {
  id: string;
  name?: string;
  created_at: Date;
  last_active_at: Date;
  current_restaurant_id?: string;
  current_table_id?: string;
}

// Define the authentication handler
export const auth = authHandler<AuthParams, AuthData>(
  async (params) => {
    const token = params.authorization?.replace("Bearer ", "");
    if (!token) {
      throw APIError.unauthenticated("No token provided");
    }

    const session = await db.queryRow<{ user_id: string, role: string }>`
      SELECT u.id as user_id, u.role
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token}
      AND s.expires_at > CURRENT_TIMESTAMP
    `;

    if (!session) {
      throw APIError.unauthenticated("Invalid or expired token");
    }

    return {
      userID: session.user_id,
      role: session.role,
    };
  }
);

// Register a new user
export const register = api(
  { method: "POST", expose: true, path: "/register" },
  async (req: { 
    email: string; 
    password: string; 
    full_name: string;
    role: string;
  }): Promise<User> => {
    // Validate role
    if (!["admin", "restaurant_owner", "staff", "customer"].includes(req.role)) {
      throw APIError.invalidArgument("Invalid role");
    }

    // Check if email already exists
    const existingUser = await db.queryRow<{ id: string }>`
      SELECT id FROM users WHERE email = ${req.email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("Email already registered");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(req.password, salt);

    // Create user
    const user = await db.queryRow<User>`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (${req.email}, ${passwordHash}, ${req.full_name}, ${req.role})
      RETURNING id, email, full_name, role, created_at, updated_at
    `;

    if (!user) {
      throw APIError.internal("Failed to create user");
    }

    return user;
  }
);

// Login user
export const login = api(
  { method: "POST", expose: true, path: "/login" },
  async (req: { email: string; password: string }): Promise<{ 
    token: string;
    user: User;
  }> => {
    // Get user with password hash
    const user = await db.queryRow<User & { password_hash: string }>`
      SELECT * FROM users WHERE email = ${req.email}
    `;

    if (!user) {
      throw APIError.unauthenticated("Invalid email or password");
    }

    // Verify password
    const validPassword = await bcrypt.compare(req.password, user.password_hash);
    if (!validPassword) {
      throw APIError.unauthenticated("Invalid email or password");
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create session
    await db.exec`
      INSERT INTO user_sessions (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `;

    // Remove password hash from user object
    const { password_hash, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
  }
);

// Request password reset
export const requestPasswordReset = api(
  { method: "POST", expose: true, path: "/password-reset/request" },
  async (req: { email: string }): Promise<void> => {
    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM users WHERE email = ${req.email}
    `;

    if (!user) {
      // Don't reveal if email exists or not
      return;
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    // Create reset token
    await db.exec`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `;

    // TODO: Send email with reset link
    // For now, we'll just return success
  }
);

// Reset password
export const resetPassword = api(
  { method: "POST", expose: true, path: "/password-reset/confirm" },
  async (req: { token: string; new_password: string }): Promise<void> => {
    // Get valid reset token
    const resetToken = await db.queryRow<{ user_id: string }>`
      SELECT user_id FROM password_reset_tokens
      WHERE token = ${req.token}
      AND expires_at > CURRENT_TIMESTAMP
      AND used = FALSE
    `;

    if (!resetToken) {
      throw APIError.invalidArgument("Invalid or expired reset token");
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(req.new_password, salt);

    // Update password and mark token as used
    await db.exec`
      BEGIN;
        UPDATE users 
        SET password_hash = ${passwordHash}
        WHERE id = ${resetToken.user_id};

        UPDATE password_reset_tokens
        SET used = TRUE
        WHERE token = ${req.token};
      COMMIT;
    `;
  }
);

// Get current user
export const getCurrentUser = api<AuthenticatedRequest, User>(
  { method: "GET", expose: true, path: "/me", auth: true },
  async (params: AuthenticatedRequest): Promise<User> => {
    const user = await db.queryRow<User>`
      SELECT id, email, full_name, role, created_at, updated_at
      FROM users
      WHERE id = ${params.auth.userID}
    `;

    if (!user) {
      throw APIError.notFound("User not found");
    }

    return user;
  }
);

// Generate a new client ID
export const generateClientId = api(
  { method: "POST", expose: true, path: "/client" },
  async (req: { name?: string }): Promise<{ client_id: string }> => {
    const client = await db.queryRow<Client>`
      INSERT INTO clients (name)
      VALUES (${req.name})
      RETURNING id
    `;

    if (!client) {
      throw APIError.internal("Failed to create client");
    }

    return { client_id: client.id };
  }
);

// Update client activity
export const updateClientActivity = api(
  { method: "POST", expose: true, path: "/client/:id/activity" },
  async (params: { 
    id: string;
    restaurant_id?: string;
    table_id?: string;
  }): Promise<void> => {
    await db.exec`
      UPDATE clients
      SET last_active_at = CURRENT_TIMESTAMP,
          current_restaurant_id = ${params.restaurant_id},
          current_table_id = ${params.table_id}
      WHERE id = ${params.id}
    `;
  }
); 