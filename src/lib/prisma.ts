import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getCleanConnectionString(): string {
  const candidates = [
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
  ];
  for (const c of candidates) {
    if (c && !c.includes("[SENSITIVE]") && (c.startsWith("postgres://") || c.startsWith("postgresql://"))) {
      return c;
    }
  }
  return "postgresql://user:pass@localhost:5432/db";
}

function createPrismaClient() {
  const connectionString = getCleanConnectionString();
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
