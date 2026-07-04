/**
 * lib/mcp/knowledge-server.ts
 *
 * This is a real MCP (Model Context Protocol) server.
 * It exposes ONE tool: search_knowledge_base
 *
 * What MCP actually means here:
 * - This file runs as a SEPARATE process alongside your Next.js app
 * - It speaks the MCP protocol over HTTP (Server-Sent Events)
 * - Gemini connects to it and can call its tools like a function
 * - The agent doesn't need to know HOW ChromaDB works
 *   it just calls the tool and gets results back
 *
 * Why a separate process?
 * - Swappable: replace ChromaDB with Pinecone tomorrow, agent doesnt care
 * - Reusable: any other app can connect to this same server
 * - That's the whole point of MCP - standardised tool protocol
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";
import * as dotenv from "dotenv";

dotenv.config();

// ── Constants ────────────────────────────────────────────────────────────────
// Must match the collection name in seed-chroma.ts
// If these dont match, search returns nothing - common bug
const COLLECTION_NAME = "novabank_knowledge_v3";
const EMBED_MODEL = "text-embedding-004";

// How many chunks to return per search
// k=4 is the sweet spot - enough context without flooding the prompt
// Prototype.1 used k=2 which was too few for complex questions
const TOP_K = 4;

// ── Embed helper ─────────────────────────────────────────────────────────────
// Same function as seed-chroma.ts - converts text to a vector
// We need it here because the USER QUERY must be embedded
// before we can compare it against the stored document vectors
async function embedQuery(
  genAI: GoogleGenerativeAI,
  text: string,
): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(text);
  return (result.embedding as { values: number[] }).values;
}

// ── Build the MCP server ─────────────────────────────────────────────────────
async function main() {
  const API_KEY = process.env.GEMINI_API_KEY?.trim();
  const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";

  if (!API_KEY) {
    console.error("GEMINI_API_KEY missing");
    process.exit(1);
  }

  // initialise clients
  const genAI = new GoogleGenerativeAI(API_KEY);
  const chroma = new ChromaClient({ path: CHROMA_URL });

  // ── Create the MCP server instance ────────────────────────────────────────
  // This is the server that Gemini will connect to
  // Name and version appear in the MCP handshake
  const server = new McpServer({
    name: "novabank-knowledge-base",
    version: "2.0.0",
  });

  // ── Register the search tool ───────────────────────────────────────────────
  // This is what Gemini sees when it asks "what tools do you have?"
  // The description is critical - Gemini reads it to decide WHEN to call this tool
  // Write it like you're explaining to a smart person what this does
  server.tool(
    "search_knowledge_base",

    // Description: Gemini reads this to decide when to call this tool
    // Be specific - vague descriptions lead to wrong tool selection
    "Search NovaBanк's knowledge base for information about products, " +
      "policies, fees, mortgage rates, savings rates, account types, " +
      "how-to guides, and general banking questions. " +
      "Use this for any question that requires knowledge of NovaBanк " +
      "products or services rather than the user's personal account data.",

    // Schema: defines what arguments this tool accepts
    // Gemini fills these in based on the user's question
    {
      query: z
        .string()
        .describe(
          "The search query - rephrase the user question to maximise " +
            "semantic match against banking documents",
        ),
      filter_type: z
        .enum(["faq", "product", "policy", "guide", "any"])
        .optional()
        .describe(
          "Optional filter by document type. " +
            "Use 'product' for rate/feature questions, " +
            "'guide' for how-to questions, " +
            "'faq' for general questions, " +
            "'any' or omit for broad searches",
        ),
    },

    // Handler: this runs when Gemini calls the tool
    // Gets the args Gemini provided, returns results
    async ({ query, filter_type }) => {
      try {
        // get the collection we seeded earlier
        const collection = await chroma.getCollection({
          name: COLLECTION_NAME,
        });

        // embed the query into a vector
        // this is what gets compared against the stored document vectors
        const queryVector = await embedQuery(genAI, query);

        // build the where clause if a filter was provided
        // this narrows the search to only docs of that type
        const whereClause =
          filter_type && filter_type !== "any"
            ? { type: { $eq: filter_type } }
            : undefined;

        // run the semantic search
        // nResults: how many chunks to return
        // queryEmbeddings: our query vector to compare against
        const results = await collection.query({
          queryEmbeddings: [queryVector],
          nResults: TOP_K,
          ...(whereClause && { where: whereClause }),
        });

        // format the results for Gemini to read
        const docs = results.documents[0] ?? [];
        const metas = results.metadatas[0] ?? [];
        const distances = results.distances?.[0] ?? [];

        if (docs.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No relevant information found in the knowledge base.",
              },
            ],
          };
        }

        // build a clean string Gemini can read and reason over
        // include the relevance score so Gemini knows how confident to be
        const formatted = docs
          .map((doc, i) => {
            const meta = metas[i] as Record<string, string>;
            const score = distances[i]
              ? (1 - distances[i]).toFixed(3)
              : "unknown";
            return (
              `[${i + 1}] Type: ${meta.type} | Category: ${meta.category} | Relevance: ${score}\n` +
              `${doc}`
            );
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: formatted,
            },
          ],
        };
      } catch (err) {
        // return error as text so the agent can handle it gracefully
        // rather than crashing the whole request
        return {
          content: [
            {
              type: "text",
              text: `Knowledge base search failed: ${err instanceof Error ? err.message : "unknown error"}`,
            },
          ],
        };
      }
    },
  );

  // ── Start the server ───────────────────────────────────────────────────────
  // StdioServerTransport means this server communicates over stdin/stdout
  // That's how MCP works - the client (your Next.js app) spawns this process
  // and they talk through standard input/output pipes
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("NovaBanк Knowledge Base MCP Server running");
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
