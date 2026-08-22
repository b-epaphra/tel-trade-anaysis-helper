import { NextResponse } from "next/server";
import OpenAI from "openai";
import { verifyAdminAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { results, apiKey, baseURL, model } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL || "https://api.openai.com/v1",
    });

    const prompt = `
You are a quantitative financial analyst and fraud detection expert.
I have scraped a Telegram channel and simulated their trading signals against real Dukascopy market data.

Here is the JSON array of their trades:
${JSON.stringify(results, null, 2)}

Please write a highly professional, detailed Markdown report analyzing this channel.
Include:
1. Executive Summary (Total trades, Real Win Rate vs Claimed Win Rate).
2. Fraud Analysis (Highlight specific IDs where 'fraudDetected' is true, meaning they claimed a win but the market hit their Stop Loss).
3. Survivorship Bias (Trades they ignored vs trades they replied to).
4. Conclusion (Should users trust this provider?).
`;

    const response = await openai.chat.completions.create({
      model: model || "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    return NextResponse.json({ report: response.choices[0].message.content });
  } catch (error: any) {
    console.error("AI Report Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
