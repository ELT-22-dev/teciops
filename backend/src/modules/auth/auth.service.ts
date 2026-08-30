import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import type { CreateUserInput, LoginInput, RegisterCompanyInput } from "./auth.schema";
import type { Role } from "@prisma/client";

const REFRESH_TOKEN_BYTES = 48;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(userId: string, companyId: string, role: Role) {
  return jwt.sign({ sub: userId, companyId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  } as jwt.SignOptions);
}

function expiresInToDate(expiresIn: string): Date {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  const now = Date.now();
  if (!match) return new Date(now + 30 * 24 * 60 * 60 * 1000);
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
  return new Date(now + value * multiplier);
}

async function issueRefreshToken(userId: string) {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = expiresInToDate(env.JWT_REFRESH_EXPIRES_IN);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt }
  });

  return token;
}

async function buildSession(userId: string, companyId: string, role: Role) {
  const accessToken = signAccessToken(userId, companyId, role);
  const refreshToken = await issueRefreshToken(userId);
  return { accessToken, refreshToken };
}

export async function registerCompany(input: RegisterCompanyInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("Ja existe uma conta cadastrada com este e-mail.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.companyName, cnpj: input.companyCnpj }
    });

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        name: input.ownerName,
        email: input.email,
        passwordHash,
        role: "OWNER"
      }
    });

    return { company, user };
  });

  const session = await buildSession(user.id, company.id, user.role);
  return { company, user: sanitizeUser(user), ...session };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.active) {
    throw AppError.unauthorized("E-mail ou senha invalidos.");
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw AppError.unauthorized("E-mail ou senha invalidos.");
  }

  const session = await buildSession(user.id, user.companyId, user.role);
  return { user: sanitizeUser(user), ...session };
}

export async function refreshSession(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized("Sessao expirada. Faca login novamente.");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() }
  });

  const session = await buildSession(stored.user.id, stored.user.companyId, stored.user.role);
  return { user: sanitizeUser(stored.user), ...session };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function createCompanyUser(companyId: string, input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("Ja existe uma conta cadastrada com este e-mail.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { companyId, name: input.name, email: input.email, passwordHash, role: input.role }
  });

  return sanitizeUser(user);
}

export async function listCompanyUsers(companyId: string) {
  const users = await prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
  return users.map(sanitizeUser);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!user) throw AppError.notFound("Usuario");
  return { ...sanitizeUser(user), company: user.company };
}

function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}
