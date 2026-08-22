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
You are the Chief Quantitative Auditor at SignalProof™ — the forensic signal verification authority for financial trading.
You have ingested a Telegram channel's trading signals and simulated their executions tick-by-tick against Dukascopy 1-minute historical tick data.

Here is the JSON dataset of verified trades:
${JSON.stringify(results, null, 2)}

Please write a comprehensive, institutional-grade Markdown Forensic Audit Dossier for this channel.
Structure your report with the following sections:
# 🛡️ SignalProof™ Channel Audit Dossier
- **Audit Verdict**: [VERIFIED AUTHENTIC | HIGH RISK / FRAUD DETECTED | UNRELIABLE / INCONCLUSIVE]
- **Audited Real Win Rate vs Claimed Win Rate**: Compare mathematically.
- **Forensic Discrepancy & Fraud Analysis**: Call out specific trade IDs where 'fraudDetected' is true (phantom wins, moving SLs, post-hoc claims).
- **Survivorship & Omission Bias**: Highlight signals that hit SL and were ignored vs winning signals that were hyped.
- **Risk Assessment & Final Recommendation**: Direct, evidence-backed advice for retail traders.
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
