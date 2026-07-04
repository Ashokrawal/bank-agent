/**
 * data/knowledge/index.ts
 * Single import point for all RAG documents
 *
 * Usage:
 *   import { ALL_DOCUMENTS } from "@/data/knowledge"
 *
 * Each document in ALL_DOCUMENTS is one chunk that goes
 * into ChromaDB with its own embedding vector.
 */

import { FAQ_DATA } from "./Faqs";
import { PRODUCT_DATA } from "@/data/knowledge/products";
import { POLICY_DATA, GUIDE_DATA } from "@/data/knowledge/guides";

export { FAQ_DATA, PRODUCT_DATA, POLICY_DATA, GUIDE_DATA };

// ── Unified document format for ChromaDB seeding ─────────────────────────────
export interface KnowledgeDocument {
  id: string;
  content: string; // this is what gets embedded
  category: string;
  type: "faq" | "product" | "policy" | "guide";
}

// Flatten everything into a single array the seed script can loop over
export const ALL_DOCUMENTS: KnowledgeDocument[] = [
  ...FAQ_DATA.map((f) => ({
    id: f.id,
    // embed question + answer together so both surface in semantic search
    content: `${f.question} ${f.answer}`,
    category: f.category,
    type: "faq" as const,
  })),
  ...PRODUCT_DATA.map((p) => ({
    id: p.id,
    content: `${p.name}: ${p.content}`,
    category: p.type,
    type: "product" as const,
  })),
  ...POLICY_DATA.map((p) => ({
    id: p.id,
    content: `${p.title}: ${p.content}`,
    category: p.category,
    type: "policy" as const,
  })),
  ...GUIDE_DATA.map((g) => ({
    id: g.id,
    content: `${g.title}: ${g.content}`,
    category: g.category,
    type: "guide" as const,
  })),
];

export const DOCUMENT_COUNT = ALL_DOCUMENTS.length;
