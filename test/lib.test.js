import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadOpenApi,
  listOperations,
  summarizeByTag,
  findMissingAuth,
  listDeprecated,
  generateCheatSheet,
} from "../lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, "../fixtures/petstore.json");

describe("loadOpenApi", () => {
  it("loads JSON OpenAPI", async () => {
    const { doc, version } = await loadOpenApi(fixture);
    assert.equal(doc.info.title, "Petstore");
    assert.equal(version, "3.0.3");
  });
});

describe("listOperations", () => {
  it("finds all methods", async () => {
    const { doc } = await loadOpenApi(fixture);
    const ops = listOperations(doc);
    assert.equal(ops.length, 5);
  });
});

describe("summarizeByTag", () => {
  it("groups by tag", async () => {
    const r = await summarizeByTag({ filePath: fixture });
    assert.ok(r.byTag.pets);
    assert.ok(r.byTag.meta);
    assert.equal(r.totalOperations, 5);
  });
});

describe("findMissingAuth", () => {
  it("flags explicitly public ops", async () => {
    const r = await findMissingAuth({ filePath: fixture });
    assert.ok(r.missingAuthCount >= 2);
    assert.ok(r.missingAuth.some((o) => o.path === "/health"));
  });
});

describe("listDeprecated", () => {
  it("lists deprecated getPet", async () => {
    const r = await listDeprecated({ filePath: fixture });
    assert.equal(r.deprecatedCount, 1);
    assert.equal(r.deprecated[0].operationId, "getPet");
  });
});

describe("generateCheatSheet", () => {
  it("returns markdown", async () => {
    const r = await generateCheatSheet({ filePath: fixture });
    assert.match(r.cheatSheet, /API Cheat Sheet/);
    assert.match(r.cheatSheet, /GET \/pets/);
  });
});
