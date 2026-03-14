/**
 * lib/rag/chroma.ts — OPTIMISED
 *
 * Changes vs original:
 *  1. Seeding: stores answer-only (no "Q: ... \nA:" prefix) — saves ~8 tokens/chunk
 *  2. Retrieval: drops [1]/[2] numbering prefix — saves ~4 tokens per call
 *  3. Product docs: stripped to name+key features only (removes Requirements block)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { FAQ_DATA, PRODUCT_DATA, POLICY_DATA } from "@/data/mock-bank-data";

const COLLECTION = "novabank_knowledge_v2"; // new name avoids conflict with old seed

let _chroma: import("chromadb").ChromaClient | null = null;
let _genAI:  GoogleGenerativeAI | null = null;

function getChroma() {
  if (!_chroma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ChromaClient } = require("chromadb") as typeof import("chromadb");
    _chroma = new ChromaClient({ path: process.env.CHROMA_URL ?? "http://localhost:8000" });
  }
  return _chroma;
}

function getGenAI() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return _genAI;
}

async function embed(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: "text-embedding-004" });
  const res = await model.embedContent(text);
  return (res.embedding as { values: number[] }).values;
}

export async function seedChromaDB() {
  const client = getChroma();
  try { await client.deleteCollection({ name: COLLECTION }); } catch { /* ok */ }

  const collection = await client.createCollection({
    name: COLLECTION,
    metadata: { "hnsw:space": "cosine" },
  });

  const docs:  string[]                 = [];
  const ids:   string[]                 = [];
  const metas: Record<string, string>[] = [];

  // OPTIMISED: store answer-only — the question is implicit in the embedding.
  // "Q: ...\nA: ..." format wasted ~8 tokens per chunk on retrieval.
  for (const f of FAQ_DATA) {
    docs.push(f.answer);
    ids.push(f.id);
    metas.push({ type: "faq", category: f.category });
  }

  // OPTIMISED: name + description + features only — no Requirements block
  for (const p of PRODUCT_DATA) {
    docs.push(`${p.name}: ${p.description} Features: ${p.features.join(", ")}`);
    ids.push(p.id);
    metas.push({ type: "product", category: p.type });
  }

  for (const pol of POLICY_DATA) {
    docs.push(`${pol.title}: ${pol.content}`);
    ids.push(pol.id);
    metas.push({ type: "policy", category: pol.metadata.category });
  }

  console.log(`📄 Embedding ${docs.length} docs…`);
  const embeddings: number[][] = [];

  for (let i = 0; i < docs.length; i++) {
    try {
      embeddings.push(await embed(docs[i]));
    } catch {
      embeddings.push(new Array(768).fill(0));
    }
    if (i < docs.length - 1) await new Promise(r => setTimeout(r, 250));
    process.stdout.write(`\r  ${i + 1}/${docs.length} embedded`);
  }

  await collection.add({ ids, documents: docs, embeddings, metadatas: metas });
  console.log(`\n✅ ChromaDB seeded — ${docs.length} documents`);
}

export async function retrieveContext(query: string, k = 2): Promise<string> {
  try {
    const client     = getChroma();
    const collection = await client.getCollection({ name: COLLECTION });
    const qEmbed     = await embed(query);

    const results = await collection.query({
      queryEmbeddings: [qEmbed],
      nResults: k,
    });

    // OPTIMISED: no [1]/[2] numbering prefix — saves 4 tokens per query
    return (results.documents[0] ?? [])
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

export async function isChromaSeeded(): Promise<boolean> {
  try {
    const col = await getChroma().getCollection({ name: COLLECTION });
    return (await col.count()) > 0;
  } catch {
    return false;
  }
}
