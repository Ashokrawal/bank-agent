import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createApplication, updateApplicationStatus } from "@/lib/db/sqlite";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, accountType, documents } = body;

    if (!email || !name || !accountType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = uuidv4();

    // Create the application record
    await createApplication({
      id,
      email,
      name,
      type: accountType,
      documents: JSON.stringify(documents || []),
    });

    // Simulate KYC — in production: call a real KYC provider (Onfido, Jumio, etc.)
    // For demo: auto-approve after 2s delay
    await new Promise(r => setTimeout(r, 2000));
    await updateApplicationStatus(id, "approved", "Auto-approved via simulated KYC");

    return NextResponse.json({
      success: true,
      applicationId: id,
      status: "approved",
      message: "Your application has been approved. Welcome to NovaBanк!",
    });
  } catch (err) {
    console.error("Onboard API error:", err);
    return NextResponse.json({ error: "Application processing failed" }, { status: 500 });
  }
}
