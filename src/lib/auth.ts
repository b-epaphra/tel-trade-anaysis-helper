import { NextRequest, NextResponse } from "next/server";

export function verifyAdminAuth(req: Request): { authorized: boolean; error?: string } {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  // If no password configured in .env, allow by default (or set default)
  if (!configuredPassword) {
    return { authorized: true };
  }

  const authHeader = req.headers.get("x-admin-password") || 
                     req.headers.get("authorization")?.replace("Bearer ", "");

  if (!authHeader || authHeader !== configuredPassword) {
    return { authorized: false, error: "Unauthorized: Invalid or missing Admin Password" };
  }

  return { authorized: true };
}
