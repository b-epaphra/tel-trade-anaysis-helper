import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    const requiresAuth = Boolean(process.env.ADMIN_PASSWORD);
    
    if (!auth.authorized) {
      return NextResponse.json({ success: false, requiresAuth, error: auth.error }, { status: 401 });
    }

    return NextResponse.json({ success: true, requiresAuth, message: "Authorized successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const requiresAuth = Boolean(process.env.ADMIN_PASSWORD);
  return NextResponse.json({ requiresAuth });
}
