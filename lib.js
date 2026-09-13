/**
 * OpenAPI / Swagger local-file helpers.
 * Reads only user-provided local paths — never fetches remote specs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const HTTP_METHODS = new Set([
  "get", "put", "post", "delete", "options", "head", "patch", "trace",
]);

/**
 * @param {string} filePath
 * @returns {Promise<object>}
 */
export async function loadOpenApi(filePath) {
  const abs = path.resolve(String(filePath));
  const raw = await fs.readFile(abs, "utf8");
  const ext = path.extname(abs).toLowerCase();
  let doc;
  if (ext === ".yaml" || ext === ".yml") {
    doc = YAML.parse(raw);
  } else if (ext === ".json" || raw.trimStart().startsWith("{")) {
    doc = JSON.parse(raw);
  } else {
    // Try YAML then JSON
    try {
      doc = YAML.parse(raw);
    } catch {
      doc = JSON.parse(raw);
    }
  }
  if (!doc || typeof doc !== "object") {
    throw new Error("Parsed OpenAPI document is empty or not an object");
  }
  if (!doc.openapi && !doc.swagger) {
    throw new Error("File does not look like OpenAPI/Swagger (missing openapi/swagger field)");
  }
  return { path: abs, doc, version: doc.openapi || doc.swagger };
}

/**
 * Flatten operations from paths.
 * @param {object} doc
 * @returns {Array<{path:string, method:string, operationId?:string, summary?:string, tags:string[], deprecated:boolean, security:any, hasSecurity:boolean}>}
 */
export function listOperations(doc) {
  const paths = doc.paths || {};
  const globalSecurity = Array.isArray(doc.security) ? doc.security : null;
  const ops = [];
  for (const [p, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const [method, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!op || typeof op !== "object") continue;
      const tags = Array.isArray(op.tags) ? op.tags : ["(untagged)"];
      const opSecurity = op.security !== undefined ? op.security : globalSecurity;
      const hasSecurity =
        opSecurity === null
          ? false
          : Array.isArray(opSecurity)
            ? opSecurity.length > 0
            : Boolean(opSecurity);
      // Empty security array explicitly clears global security (OAS3)
      const explicitlyPublic = Array.isArray(op.security) && op.security.length === 0;
      ops.push({
        path: p,
        method: method.toUpperCase(),
        operationId: op.operationId,
        summary: op.summary || op.description?.slice?.(0, 120),
        tags,
        deprecated: Boolean(op.deprecated),
        security: opSecurity,
        hasSecurity: explicitlyPublic ? false : hasSecurity,
        explicitlyPublic,
      });
    }
  }
  return ops;
}

/**
 * Summarize endpoints grouped by tag.
 * @param {{ filePath: string }} input
 */
export async function summarizeByTag(input) {
  const { doc, path: abs, version } = await loadOpenApi(input.filePath);
  const ops = listOperations(doc);
  /** @type {Record<string, typeof ops>} */
  const byTag = {};
  for (const op of ops) {
    for (const tag of op.tags) {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push({
        method: op.method,
        path: op.path,
        operationId: op.operationId,
        summary: op.summary,
        deprecated: op.deprecated,
      });
    }
  }
  const tags = Object.keys(byTag).sort();
  return {
    file: abs,
    openapiVersion: version,
    title: doc.info?.title,
    totalOperations: ops.length,
    tagCount: tags.length,
    byTag,
  };
}

/**
 * Find operations missing auth/security.
 * @param {{ filePath: string }} input
 */
export async function findMissingAuth(input) {
  const { doc, path: abs, version } = await loadOpenApi(input.filePath);
  const ops = listOperations(doc);
  const securitySchemes =
    doc.components?.securitySchemes || doc.securityDefinitions || {};
  const missing = ops.filter((o) => !o.hasSecurity);
  return {
    file: abs,
    openapiVersion: version,
    definedSchemes: Object.keys(securitySchemes),
    totalOperations: ops.length,
    missingAuthCount: missing.length,
    missingAuth: missing.map((o) => ({
      method: o.method,
      path: o.path,
      operationId: o.operationId,
      tags: o.tags,
      note: o.explicitlyPublic
        ? "Explicitly public (empty security array)"
        : "No operation or global security applied",
    })),
    disclaimer:
      "Heuristic based on OpenAPI security fields only — does not prove runtime auth.",
  };
}

/**
 * List deprecated operations.
 * @param {{ filePath: string }} input
 */
export async function listDeprecated(input) {
  const { doc, path: abs, version } = await loadOpenApi(input.filePath);
  const ops = listOperations(doc).filter((o) => o.deprecated);
  return {
    file: abs,
    openapiVersion: version,
    deprecatedCount: ops.length,
    deprecated: ops.map((o) => ({
      method: o.method,
      path: o.path,
      operationId: o.operationId,
      summary: o.summary,
      tags: o.tags,
    })),
  };
}

/**
 * Generate a short agent-friendly API cheat sheet.
 * @param {{ filePath: string, maxOps?: number }} input
 */
export async function generateCheatSheet(input) {
  const { doc, path: abs, version } = await loadOpenApi(input.filePath);
  const ops = listOperations(doc);
  const maxOps = Math.min(Math.max(input.maxOps ?? 80, 1), 500);
  const servers = (doc.servers || []).map((s) => s.url).filter(Boolean);
  const lines = [];
  lines.push(`# API Cheat Sheet: ${doc.info?.title || path.basename(abs)}`);
  lines.push(`Version: ${doc.info?.version || "?"} | Spec: ${version}`);
  if (servers.length) lines.push(`Servers: ${servers.join(", ")}`);
  if (doc.info?.description) {
    lines.push("");
    lines.push(String(doc.info.description).split("\n")[0].slice(0, 200));
  }
  lines.push("");
  lines.push("## Endpoints");
  const sliced = ops.slice(0, maxOps);
  for (const op of sliced) {
    const auth = op.hasSecurity ? "🔐" : "🔓";
    const dep = op.deprecated ? " [DEPRECATED]" : "";
    const id = op.operationId ? ` (${op.operationId})` : "";
    const sum = op.summary ? ` — ${op.summary}` : "";
    lines.push(`- ${auth} \`${op.method} ${op.path}\`${id}${dep}${sum}`);
  }
  if (ops.length > maxOps) {
    lines.push(`\n… and ${ops.length - maxOps} more operations`);
  }
  lines.push("");
  lines.push("## Legend");
  lines.push("- 🔐 has security requirement  ·  🔓 no security in spec");
  return {
    file: abs,
    openapiVersion: version,
    operationCount: ops.length,
    cheatSheet: lines.join("\n"),
  };
}
