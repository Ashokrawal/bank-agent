/**
 * lib/rag/chroma.ts
 * ChromaDB vector store — stores FAQ / product / policy embeddings.
 *
 * TOKEN STRATEGY
 * ─────────────
 * • Embeddings are generated ONCE at seed time (cheap one-off cost).
 * • Retrieval: top-2 chunks per query  (~260 tokens context max).
 * • Model: text-embedding-004 (free tier, 768-dim, fast).
 * • On failure: graceful empty string  → agent still responds.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { FAQ_DATA, PRODUCT_DATA, POLICY_DATA } from "@/data/mock-bank-data";

const COLLECTION = "novabank_knowledge";

// ── Lazy singletons ───────────────────────────────────────────────────────────
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
  // @ts-ignore – embedContent exists on embedding models
  const res = await model.embedContent(text);
  return (res.embedding as { values: number[] }).values;
}

// ── Seeding ───────────────────────────────────────────────────────────────────
export async function seedChromaDB() {
  const client = getChroma();

  // Wipe existing collection so re-runs are idempotent
  try { await client.deleteCollection({ name: COLLECTION }); } catch { /* ok */ }

  const collection = await client.createCollection({
    name: COLLECTION,
    metadata: { "hnsw:space": "cosine" },
  });

  const docs:  string[]                      = [];
  const ids:   string[]                      = [];
  const metas: Record<string, string>[]      = [];

  for (const f of FAQ_DATA) {
    docs.push(`Q: ${f.question}\nA: ${f.answer}`);
    ids.push(f.id);
    metas.push({ type: "faq", category: f.category });
  }
  for (const p of PRODUCT_DATA) {
    docs.push(
      `Product: ${p.name}\n${p.description}\n` +
      `Features: ${p.features.join(", ")}\n` +
      `Requirements: ${p.requirements.join(", ")}`,
    );
    ids.push(p.id);
    metas.push({ type: "product", category: p.type });
  }
  for (const pol of POLICY_DATA) {
    docs.push(`${pol.title}\n${pol.content}`);
    ids.push(pol.id);
    metas.push({ type: "policy", category: pol.metadata.category });
  }

  console.log(`📄 Embedding ${docs.length} docs…`);
  const embeddings: number[][] = [];

  for (let i = 0; i < docs.length; i++) {
    try {
      embeddings.push(await embed(docs[i]));
    } catch {
      embeddings.push(new Array(768).fill(0));   // fallback zero-vector
    }
    // Rate-limit guard for free tier (1 500 rpm / 30 000 tokens-per-min)
    if (i < docs.length - 1) await new Promise(r => setTimeout(r, 250));
    process.stdout.write(`\r  ${i + 1}/${docs.length} embedded`);
  }

  await collection.add({ ids, documents: docs, embeddings, metadatas: metas });
  console.log(`\n✅ ChromaDB seeded — ${docs.length} documents`);
}

// ── Retrieval ─────────────────────────────────────────────────────────────────
export async function retrieveContext(query: string, k = 3): Promise<string> {
  try {
    const client     = getChroma();
    const collection = await client.getCollection({ name: COLLECTION });
    const qEmbed     = await embed(query);

    const results = await collection.query({
      queryEmbeddings: [qEmbed],
      nResults: k,
    });

    return (results.documents[0] ?? [])
      .filter(Boolean)
      .map((d, i) => `[${i + 1}] ${d}`)
      .join("\n\n");
  } catch {
    return "";   // silent fallback — agent responds without RAG context
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
