import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { corsOrigins, env } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { suppliersRouter } from "./modules/suppliers/suppliers.routes";
import { articlesRouter } from "./modules/articles/articles.routes";
import { rollsRouter } from "./modules/rolls/rolls.routes";
import { importsRouter } from "./modules/imports/imports.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { financialRouter } from "./modules/financial/financial.routes";
import { fiscalRouter } from "./modules/fiscal/fiscal.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { warehouseRouter } from "./modules/warehouse/warehouse.routes";
import { agentRouter } from "./modules/agent/agent.routes";
import { companyRouter } from "./modules/company/company.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/customers", customersRouter);
  app.use("/api/v1/suppliers", suppliersRouter);
  app.use("/api/v1/articles", articlesRouter);
  app.use("/api/v1/rolls", rollsRouter);
  app.use("/api/v1/import-lots", importsRouter);
  app.use("/api/v1/orders", ordersRouter);
  app.use("/api/v1/financial", financialRouter);
  app.use("/api/v1/fiscal", fiscalRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1/warehouse", warehouseRouter);
  app.use("/api/v1/agent", agentRouter);
  app.use("/api/v1/company", companyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
