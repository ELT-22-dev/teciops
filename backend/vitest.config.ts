import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://teciops:teciops@localhost:5432/teciops_test?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-0123456789"
    }
  }
});
