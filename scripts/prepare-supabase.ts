import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Render only: never opens a database connection or changes application feature gates.
export function buildSetupSql(contract: string, email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("A valid PERSONAL_OS_OWNER_EMAIL is required.");
  if (!/\ncommit;\s*$/.test(contract))
    throw new Error("Contract must end with one transaction commit.");
  const literal = email.toLowerCase().replaceAll("'", "''");
  // Email is supplied as a SQL literal, never inside a dollar-quoted function body.
  const ownerCheck = `
set local personal_os.setup_email = '${literal}';
do $$ begin
 if (select count(*) from auth.users where lower(email)=current_setting('personal_os.setup_email') and email_confirmed_at is not null) <> 1 then
  raise exception 'Expected exactly one verified existing Auth user. No changes applied.';
 end if;
end $$;
`;
  return contract
    .replace("begin;", () => `begin;\n${ownerCheck}`)
    .replace(
      /\ncommit;\s*$/,
      () => `
insert into public.personal_os_owners(user_id)
 select id from auth.users where lower(email)=current_setting('personal_os.setup_email') and email_confirmed_at is not null;
do $$ begin
 if (select count(*) from public.personal_os_owners) <> 1 then
  raise exception 'Owner initialization failed. No changes applied.';
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
select 'personal_os_v2_installed' as status;
`,
    );
}

async function prepare() {
  try {
    if (existsSync(".env.local")) loadEnvFile(".env.local");
    const contract = await readFile(
      "docs/02-engineering/proposals/private-records-v2.sql",
      "utf8",
    );
    const sql = buildSetupSql(
      contract,
      process.env.PERSONAL_OS_OWNER_EMAIL ?? "",
    );
    await mkdir(".supabase-setup", { recursive: true, mode: 0o700 });
    await writeFile(".supabase-setup/install-private-records-v2.sql", sql, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Prepared .supabase-setup/install-private-records-v2.sql (private; not executed). Copy the complete file into the existing project's SQL Editor. No key is included.",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      console.error(
        "Setup file already exists; left unchanged. Inspect it before regenerating.",
      );
    else
      console.error(
        "Preparation failed. Check owner email configuration and contract file; no remote changes made.",
      );
    process.exitCode = 1;
  }
}
if (process.argv[1]?.endsWith("prepare-supabase.ts")) void prepare();
