import { describe, it, expect } from 'vitest';
import { register, login, generateClientId, updateClientActivity } from "./api";
import { db } from "./db";

describe('Auth Service', () => {
  it('should handle user authentication flow', async () => {
    // Test user registration
    const user = await register({
      email: "test@example.com",
      password: "password123",
      full_name: "Test User",
      role: "restaurant_owner"
    });

    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
    expect(user.role).toBe("restaurant_owner");

    // Test login
    const loginResponse = await login({
      email: "test@example.com",
      password: "password123"
    });

    expect(loginResponse).toBeDefined();
    expect(loginResponse.token).toBeDefined();
    expect(loginResponse.user.email).toBe("test@example.com");

    // Test invalid login
    await expect(login({
      email: "test@example.com",
      password: "wrongpassword"
    })).rejects.toThrow();
  });

  it('should handle client management', async () => {
    // Test client ID generation
    const clientResponse = await generateClientId({
      name: "Test Client"
    });

    expect(clientResponse).toBeDefined();
    expect(clientResponse.client_id).toBeDefined();

    // Test client activity update
    await updateClientActivity({
      id: clientResponse.client_id,
      restaurant_id: "test-restaurant",
      table_id: "test-table"
    });

    // Verify client activity was updated
    const client = await db.queryRow<{ last_active_at: Date }>`
      SELECT last_active_at FROM clients WHERE id = ${clientResponse.client_id}
    `;

    expect(client).not.toBeNull();
    expect(client!.last_active_at).toBeDefined();
  });

  it('should validate user roles', async () => {
    // Test invalid role
    await expect(register({
      email: "invalid@example.com",
      password: "password123",
      full_name: "Invalid User",
      role: "invalid_role"
    })).rejects.toThrow();

    // Test valid roles
    const validRoles = ["admin", "restaurant_owner", "staff"];
    for (const role of validRoles) {
      const user = await register({
        email: `${role}@example.com`,
        password: "password123",
        full_name: `${role} User`,
        role: role
      });
      expect(user.role).toBe(role);
    }
  });
}); 