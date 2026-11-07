// Official Prisma WASM validator: no database connection or native engine download.
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const prismaInternals: typeof import("@prisma/internals") = require("@prisma/internals");
async function main() {
  const datamodel = await fs.readFile("prisma/schema.prisma", "utf8");
  const dmmf = await prismaInternals.getDMMF({ datamodel });
  console.log(
    `Prisma schema validated: ${dmmf.datamodel.models.length} models.`,
  );
  console.log(
    "This checks schema syntax and relations; it does not apply migrations or test PostgreSQL.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
