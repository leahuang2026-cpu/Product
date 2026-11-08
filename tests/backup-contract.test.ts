import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { parseSnapshot } from "../src/lib/backup/format";
import { fixture, recordId, attachmentId } from "./backup-fixture";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("BKP snapshot contract in isolated PostgreSQL (no real Supabase)", async (t) => {
  const db = new PGlite();
  async function as(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  async function read() {
    return (
      await db.query<{ value: unknown }>(
        "select personal_os_backup_snapshot_v1() as value",
      )
    ).rows[0].value;
  }
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id serial primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;insert into auth.users values('${owner}'),('${other}');alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant execute on functions to anon,authenticated;`,
    );
    for (const file of ["private-records-v2", "recycle-bin-v1"])
      await db.exec(
        await readFile(`docs/02-engineering/proposals/${file}.sql`, "utf8"),
      );
    await db.query("insert into personal_os_owners values($1)", [owner]);
    const s = await fixture();
    // Synthetic archived originals are inserted before installing the new read-only function.
    await db.query(
      "insert into personal_os_records(id,owner_id,original_text,domains,is_idea,attachment_ids,created_at,deleted_at) values($1,$2,$3,$4,true,$5,$6,$6)",
      [
        recordId,
        owner,
        s.records[0].originalText,
        ["生活", "能力"],
        [attachmentId],
        s.snapshotAt,
      ],
    );
    await db.query(
      "insert into personal_os_attachments(id,owner_id,record_id,object_key,mime,name,bytes,sha256) values($1,$2,$3,$4,'image/png',$5,$6,$7)",
      [
        attachmentId,
        owner,
        recordId,
        `${owner}/${attachmentId}`,
        s.attachments[0].name,
        s.attachments[0].bytes,
        s.attachments[0].sha256,
      ],
    );
    for (const e of s.entries) {
      const { createdAt, deletedAt, sourceVersion, ...payload } = e;
      await db.query(
        "insert into personal_os_entries(id,owner_id,kind,payload,version,created_at,deleted_at) values($1,$2,$3,$4,$5,$6,$7)",
        [
          e.id,
          owner,
          e.kind,
          { ...payload, version: sourceVersion },
          sourceVersion,
          createdAt,
          deletedAt,
        ],
      );
    }
    const before = (await db.query("select * from personal_os_records")).rows;
    const sql = await readFile(
      "docs/02-engineering/proposals/backup-export-v1.sql",
      "utf8",
    );
    await db.exec(sql);
    await as(owner);
    await t.test(
      "complete snapshot includes hidden records/entries and unchanged original bytes metadata",
      async () => {
        const snap = parseSnapshot(await read());
        assert.equal(snap.records.length, 1);
        assert.equal(snap.entries.length, 3);
        assert.equal(snap.records[0].originalText, s.records[0].originalText);
        assert.ok(snap.records[0].deletedAt);
        assert.equal(snap.attachments[0].sha256, s.attachments[0].sha256);
        assert.equal(
          snap.entries.find((e) => e.kind === "reflection")?.cadence,
          "monthly",
        );
        assert.equal(
          snap.entries.find((e) => e.kind === "focus")?.active,
          false,
        );
        assert.ok(!JSON.stringify(snap).includes(owner));
        assert.deepEqual(
          (await db.query("select * from personal_os_records")).rows,
          before,
        );
        assert.deepEqual(
          (
            await db.query<{ v: unknown }>(
              "select personal_os_list_records() as v",
            )
          ).rows[0].v,
          [],
        );
        assert.deepEqual(
          Object.keys(
            (
              await db.query<{ v: object }>(
                "select personal_os_get_record($1) as v",
                [recordId],
              )
            ).rows[0].v,
          ).sort(),
          ["deletedAt", "id"],
        );
      },
    );
    await t.test(
      "anonymous/non-owner denied, even another allowlisted identity sees only own empty space",
      async () => {
        await as(other);
        await assert.rejects(read(), { code: "42501" });
        await db.exec("reset role;set role anon");
        await assert.rejects(read(), { code: "42501" });
        await db.exec("reset role");
        await db.query("insert into personal_os_owners values($1)", [other]);
        await as(other);
        assert.equal(parseSnapshot(await read()).records.length, 0);
        await as(owner);
      },
    );
    await t.test(
      "function is STABLE/invoker and adds no destructive privilege; repeated install stops",
      async () => {
        const r = await db.query<{ provolatile: string; prosecdef: boolean }>(
          "select provolatile,prosecdef from pg_proc where oid='personal_os_backup_snapshot_v1()'::regprocedure",
        );
        assert.deepEqual(r.rows[0], { provolatile: "s", prosecdef: false });
        assert.equal(
          (
            await db.query<{ v: boolean }>(
              "select has_table_privilege('authenticated','personal_os_records','DELETE,TRUNCATE') as v",
            )
          ).rows[0].v,
          false,
        );
        await db.exec("reset role");
        await assert.rejects(db.exec(sql), /already installed/);
        await db.exec("rollback");
        await as(owner);
      },
    );
    await t.test("six read-only installation checks pass", async () => {
      await db.exec("reset role");
      const check = await db.query<Record<string, boolean>>(
        await readFile(
          "docs/02-engineering/verify-backup-export-v1.sql",
          "utf8",
        ),
      );
      assert.equal(Object.keys(check.rows[0]).length, 6);
      assert.ok(Object.values(check.rows[0]).every(Boolean));
      await as(owner);
    });
    await t.test(
      "more than 1000 rows are included, over 5000 fail instead of truncating",
      async () => {
        await db.exec("begin");
        await db.query(
          "insert into personal_os_records(id,owner_id,original_text) select md5('synthetic-'||i)::uuid,$1,'合成数据' from generate_series(1,1001) i",
          [owner],
        );
        assert.equal(parseSnapshot(await read()).records.length, 1002);
        await db.query(
          "insert into personal_os_records(id,owner_id,original_text) select md5('synthetic-'||i)::uuid,$1,'合成数据' from generate_series(1002,5001) i",
          [owner],
        );
        await assert.rejects(read(), { code: "54000" });
        await db.exec("rollback");
      },
    );
    await t.test(
      "unknown payload/columns fail closed and do not silently disappear",
      async () => {
        await db.exec("begin");
        await db.query(
          "update personal_os_entries set payload=payload||'{\"future\":true}'::jsonb where kind='focus'",
        );
        assert.throws(() => parseSnapshot({}), /格式/);
        const v = await read();
        assert.throws(() => parseSnapshot(v), /格式/);
        await db.exec("rollback");
        await db.exec(
          "reset role;begin;alter table personal_os_records add column future text",
        );
        await db.exec("set local role authenticated");
        await assert.rejects(read(), { code: "22023" });
        await db.exec("rollback");
        await as(owner);
      },
    );
  } finally {
    await db.close();
  }
});
