import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import mammoth from "mammoth";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { extractText } from "unpdf";
import { z } from "zod";
import { htmlToText } from "../canvas/text.js";
import { jsonResult } from "./result.js";

const DEFAULT_MAX_CHARS = 60_000;

export interface ExtractedDocument {
  path: string;
  type: "docx" | "pdf";
  pages?: number;
  chars: number;
  truncated: boolean;
  text: string;
}

async function docxText(filePath: string): Promise<string> {
  // convertToHtml keeps headings and lists; htmlToText then renders them like Canvas pages.
  const { value } = await mammoth.convertToHtml({ path: filePath });
  return htmlToText(value);
}

async function pdfText(filePath: string): Promise<{ text: string; pages: number }> {
  const data = new Uint8Array(await readFile(filePath));
  const { text, totalPages } = await extractText(data, { mergePages: false });
  const bodies = text.map((page) => page.trim());
  // A scanned PDF has no text layer: return "" rather than a string of page separators.
  if (bodies.every((body) => body === "")) return { text: "", pages: totalPages };
  const joined = bodies.map((body, i) => (i === 0 ? body : `--- page ${i + 1} ---\n\n${body}`)).join("\n\n");
  return { text: joined, pages: totalPages };
}

/** Text of a local .docx or .pdf. Pure function used by the read_document tool. */
export async function extractDocument(filePath: string, maxChars = DEFAULT_MAX_CHARS): Promise<ExtractedDocument> {
  const info = await stat(filePath).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") throw new Error(`File not found: ${filePath}`);
    throw err;
  });
  if (!info.isFile()) throw new Error(`Not a file: ${filePath}`);
  const ext = path.extname(filePath).slice(1).toLowerCase();

  let text: string;
  let pages: number | undefined;
  if (ext === "docx") {
    text = await docxText(filePath);
  } else if (ext === "pdf") {
    ({ text, pages } = await pdfText(filePath));
  } else {
    throw new Error(`Unsupported file type .${ext}; read_document handles .docx and .pdf`);
  }

  const truncated = text.length > maxChars;
  return {
    path: filePath,
    type: ext,
    pages,
    chars: text.length,
    truncated,
    text: truncated ? text.slice(0, maxChars) : text,
  };
}

export function registerDocuments(server: McpServer): void {
  server.registerTool(
    "read_document",
    {
      title: "Read a downloaded document",
      description:
        "Extract the text of a local .docx or .pdf (for example a file saved by download_file) so it can be read. Scanned PDFs yield little text. Long documents are truncated; raise max_chars if needed.",
      inputSchema: {
        path: z.string().describe("Absolute path of the .docx or .pdf"),
        max_chars: z.number().int().min(1000).max(500_000).optional().describe(`Truncate after this many characters (default ${DEFAULT_MAX_CHARS})`),
      },
    },
    async ({ path: filePath, max_chars }) => {
      const doc = await extractDocument(filePath, max_chars);
      return jsonResult(doc.text.trim() ? doc : { ...doc, note: "No text layer found; the file may be scanned images. Use the Read tool to view pages." });
    },
  );
}
