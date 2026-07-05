/**
 * lib/mcp/client.ts
 *
 * This is the MCP client - the other side of the conversation.
 * The server (knowledge-server.ts) runs as a separate process.
 * This client spawns that process and talks to it via stdio.
 *
 * Think of it like this:
 * client.ts = the phone
 * knowledge-server.ts = the person on the other end
 * stdio = the phone line between them
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// singleton - we only want one connection to the MCP server
// not a new one on every user message
let mcpClient: Client | null = null;

export async function getMcpClient(): Promise<Client> {
  // if already connected, return the existing client
  // this is the singleton pattern - expensive connections get reused
  if (mcpClient) return mcpClient;

  // path to the MCP server file we just built
  const serverPath = path.join(process.cwd(), "lib/mcp/knowledge-server.ts");

  // StdioClientTransport spawns the server as a child process
  // and sets up the stdin/stdout pipes automatically
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverPath],
    env: {
      ...process.env,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
      CHROMA_URL: process.env.CHROMA_URL ?? "http://localhost:8000",
    },
  });

  // create the client instance
  mcpClient = new Client({
    name: "novabank-agent",
    version: "2.0.0",
  });

  // connect - this actually spawns the server process
  // and does the MCP handshake
  await mcpClient.connect(transport);

  return mcpClient;
}

/**
 * searchKnowledgeBase
 *
 * The one function the rest of the app uses.
 * Hides all the MCP complexity - callers just pass a query,
 * get back a formatted string of relevant bank documents.
 */
export async function searchKnowledgeBase(
  query: string,
  filterType?: "faq" | "product" | "policy" | "guide" | "any",
): Promise<string> {
  const client = await getMcpClient();

  // call the tool on the MCP server by name
  // args must match the Zod schema we defined in knowledge-server.ts
  const result = await client.callTool({
    name: "search_knowledge_base",
    arguments: {
      query,
      ...(filterType && { filter_type: filterType }),
    },
  });

  // extract the text content from the MCP response
  const content = result.content as Array<{ type: string; text: string }>;
  const textBlock = content.find((c) => c.type === "text");

  return textBlock?.text ?? "No relevant information found.";
}
