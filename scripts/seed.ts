import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  console.log("🏦  NovaBanк — Database Seeder");
  console.log("══════════════════════════════\n");

  if (
    !process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY.includes("your_")
  ) {
    console.error("❌  GEMINI_API_KEY not set in .env.local");
    console.error(
      "    Get a free key → https://aistudio.google.com/app/apikey\n",
    );
    process.exit(1);
  }

  // ── SQLite ────────────────────────────────────────────────────────────────
  console.log("📦  Step 1/2  SQLite…");
  try {
    const { dbQuery } = await import("../lib/db/sqlite.js");
    const rows = await dbQuery("SELECT COUNT(*) as c FROM users");
    console.log(`✅  SQLite ready — ${rows[0].c} users\n`);
  } catch (e) {
    console.error("❌  SQLite error:", e);
    process.exit(1);
  }

  // ── ChromaDB ──────────────────────────────────────────────────────────────
  console.log("🧠  Step 2/2  ChromaDB embeddings…");
  console.log("    Model : text-embedding-004 (free tier)");
  console.log("    Docs  : 15 FAQs + 5 products + 4 policies = 24 total\n");
  try {
    const { seedChromaDB } = await import("../lib/rag/chroma.js");
    await seedChromaDB();
  } catch (e) {
    console.error("❌  ChromaDB error:", e);
    console.error("    Is ChromaDB running?  →  docker compose up -d\n");
    process.exit(1);
  }

  console.log("\n══════════════════════════════");
  console.log("✅  Seeding complete!");
  console.log("    Run: npm run dev\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
