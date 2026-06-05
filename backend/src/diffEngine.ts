import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export async function getDiff(dbUrl: string, lastSchema: string | null, tempDir: string) {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const currentSchemaPath = path.join(tempDir, "current.prisma");
  const provider = getProvider(dbUrl);
  
  const schemaContent = `
datasource db {
  provider = "${provider}"
  url      = "${dbUrl}"
}

generator client {
  provider = "prisma-client-js"
}
`;

  fs.writeFileSync(currentSchemaPath, schemaContent.trim());

  // Execute database introspection via Prisma Engine
  const pullResult = spawnSync("bunx", ["prisma", "db", "pull", "--schema", currentSchemaPath], { 
    encoding: "utf-8",
    shell: true 
  });
  
  if (pullResult.status !== 0) {
    let details = pullResult.stderr || pullResult.stdout || "";
    
    // Intercept Prisma P4001 (Empty DB)
    // We append our comment helper at the end of a structurally valid schema.
    if (details.includes("P4001") || details.includes("database was empty")) {
      const emptySchema = `${schemaContent.trim()}\n\n// Your SQLite database is currently empty. Create a table to begin watching changes.`;
      return { newSchema: emptySchema, diff: null };
    }

    if (details.includes("P1003") || details.includes("does not exist")) {
      details = `SQLite database file was not found at path: ${dbUrl}. Please verify the file exists on your disk.`;
    }
    return { error: "Schema retrieval failed", details };
  }

  const newSchema = fs.readFileSync(currentSchemaPath, "utf-8");

  if (!lastSchema) {
    return { newSchema, diff: "Initial schema loaded successfully." };
  }

  if (newSchema.trim() === lastSchema.trim()) {
    return { newSchema, diff: null };
  }

  const oldSchemaPath = path.join(tempDir, "old.prisma");
  fs.writeFileSync(oldSchemaPath, lastSchema);

  // Compute programmatic DDL diff
  const diffResult = spawnSync("bunx", [
    "prisma", "migrate", "diff",
    "--from-schema-datamodel", oldSchemaPath,
    "--to-schema-datamodel", currentSchemaPath,
    "--script"
  ], { 
    encoding: "utf-8",
    shell: true
  });

  return {
    newSchema,
    diff: diffResult.stdout || diffResult.stderr
  };
}

function getProvider(url: string): string {
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) return "postgresql";
  if (url.startsWith("mysql://")) return "mysql";
  if (url.startsWith("file:") || url.endsWith(".db") || url.endsWith(".sqlite")) return "sqlite";
  if (url.startsWith("sqlserver://")) return "sqlserver";
  if (url.startsWith("mongodb://")) return "mongodb";
  return "sqlite";
}