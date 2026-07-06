/**
 * scripts/seed-chroma.ts
 * Reads ALL_DOCUMENTS from data/knowledge/index.ts
 * Embeds each one with Gemini text-embedding-004
 * Stores vectors + text in ChromaDB
 *
 * Run with: npm run seed:chroma
 * Needs ChromaDB running: npm run chroma
 */

import * as dotenv from "dotenv";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";
import { ALL_DOCUMENTS, DOCUMENT_COUNT } from "../data/knowledge/index";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const COLLECTION_NAME = "novabank_knowledge_v3";
const EMBED_MODEL = "gemini-embedding-001";
const DELAY_MS = 250; // avoid Gemini rate limits

async function embed(
  genAI: GoogleGenerativeAI,
  text: string,
): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(text);
  return (result.embedding as { values: number[] }).values;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // check env
  const API_KEY = process.env.GEMINI_API_KEY?.trim();
  if (!API_KEY) {
    console.error("GEMINI_API_KEY missing in .env");
    process.exit(1);
  }

  const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";

  console.log("\n================================================");
  console.log("  NovaBank ChromaDB Seeder - Prototype.2");
  console.log("================================================");
  console.log(`  Documents to embed : ${DOCUMENT_COUNT}`);
  console.log(`  Embedding model    : ${EMBED_MODEL}`);
  console.log(`  ChromaDB URL       : ${CHROMA_URL}`);
  console.log(`  Collection         : ${COLLECTION_NAME}`);
  console.log("================================================\n");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const chroma = new ChromaClient({ path: CHROMA_URL });

  // delete old collection if exists - fresh seed every time
  try {
    await chroma.deleteCollection({ name: COLLECTION_NAME });
    console.log("Deleted old collection");
  } catch {
    console.log("No existing collection found - creating fresh");
  }

  // create collection with cosine similarity
  const collection = await chroma.createCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });
  console.log("Collection created\n");

  // embed and store each document
  const ids: string[] = [];
  const embeddings: number[][] = [];
  const documents: string[] = [];
  const metadatas: Record<string, string>[] = [];

  let success = 0;
  let failed = 0;

  for (let i = 0; i < ALL_DOCUMENTS.length; i++) {
    const doc = ALL_DOCUMENTS[i];
    process.stdout.write(
      `\r  Embedding ${i + 1}/${DOCUMENT_COUNT} [${doc.type}] ${doc.id}...`,
    );

    try {
      const vector = await embed(genAI, doc.content);
      ids.push(doc.id);
      embeddings.push(vector);
      documents.push(doc.content);
      metadatas.push({ type: doc.type, category: doc.category });
      success++;
    } catch (err) {
      console.error(`\n  Failed to embed ${doc.id}:`, err);
      // store a zero vector so the collection stays intact
      ids.push(doc.id);
      embeddings.push(new Array(768).fill(0));
      documents.push(doc.content);
      metadatas.push({ type: doc.type, category: doc.category });
      failed++;
    }

    // rate limit buffer between calls
    if (i < ALL_DOCUMENTS.length - 1) await sleep(DELAY_MS);
  }

  console.log("\n");

  // batch insert everything into ChromaDB
  await collection.add({ ids, embeddings, documents, metadatas });

  const count = await collection.count();

  console.log("================================================");
  console.log(`  Done`);
  console.log(`  Embedded successfully : ${success}`);
  console.log(`  Failed (zero vector)  : ${failed}`);
  console.log(`  Total in ChromaDB     : ${count}`);
  console.log("================================================\n");

  if (failed > 0) {
    console.warn(`  ${failed} docs used zero vectors - re-run to fix them`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
