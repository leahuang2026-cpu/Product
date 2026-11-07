import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildSetupSql } from "../scripts/prepare-supabase";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  record = "11111111-1111-4111-8111-111111111111",
  attachment = "22222222-2222-4222-8222-222222222222";
test("已批准云契约：独立内存 PostgreSQL，不连接 Supabase", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id serial primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;grant select,insert,update,delete on storage.objects to authenticated;grant usage on sequence storage.objects_id_seq to authenticated;insert into auth.users values('${owner}'),('${other}');`,
    );
    // Supabase may grant new public tables broadly by default. RLS does not guard TRUNCATE.
    await db.exec(
      "alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant execute on functions to anon,authenticated;",
    );
    await db.exec(
      await readFile(
        "docs/02-engineering/proposals/private-records-v2.sql",
        "utf8",
      ),
    );
    await db.query("insert into personal_os_owners values($1)", [owner]);
    async function as(id: string) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    }
    async function rpc(name: string, values: unknown[]) {
      const args = values.map((_, i) => `$${i + 1}`).join(",");
      const result = await db.query<{ value: unknown }>(
        `select public.${name}(${args}) as value`,
        values,
      );
      return result.rows[0].value;
    }
    await as(owner);
    await t.test(
      "默认宽授权被收紧：本人不能删除/清空，匿名无表权限，白名单不能自改",
      async () => {
        for (const table of [
          "personal_os_owners",
          "personal_os_records",
          "personal_os_attachments",
          "personal_os_entries",
          "personal_os_requests",
        ]) {
          const { rows } = await db.query<{
            deleted: boolean;
            truncated: boolean;
            anonymous: boolean;
          }>(
            "select has_table_privilege('authenticated',$1,'DELETE') as deleted, has_table_privilege('authenticated',$1,'TRUNCATE') as truncated, has_table_privilege('anon',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as anonymous",
            [table],
          );
          assert.deepEqual(rows[0], {
            deleted: false,
            truncated: false,
            anonymous: false,
          });
        }
        await assert.rejects(db.query("delete from personal_os_records"));
        await assert.rejects(db.query("truncate personal_os_records cascade"));
        await assert.rejects(
          db.query("insert into personal_os_owners values($1)", [other]),
        );
      },
    );
    const payload = {
      id: record,
      originalText: "  原文\n不得覆盖。  ",
      attachmentIds: [],
      links: [],
    };
    await t.test("保存重试只有一条记录，内容变更不能重放旧 ID", async () => {
      const first = await rpc("personal_os_save_record", [payload]);
      assert.deepEqual(await rpc("personal_os_save_record", [payload]), first);
      const rows = await db.query("select * from personal_os_records");
      assert.equal(rows.rows.length, 1);
      await assert.rejects(
        rpc("personal_os_save_record", [
          { ...payload, originalText: "different" },
        ]),
      );
    });
    await t.test(
      "多领域、标记取消保留原文；元数据重放不重复推进版本",
      async () => {
        const key = "33333333-3333-4333-8333-333333333333";
        const data = { version: 1, domains: ["职业", "能力"], isIdea: true };
        const first = await rpc("personal_os_update_metadata", [
          record,
          data,
          key,
        ]);
        assert.deepEqual(
          await rpc("personal_os_update_metadata", [record, data, key]),
          first,
        );
        const cleared = (await rpc("personal_os_update_metadata", [
          record,
          { version: 2, isIdea: false },
          "44444444-4444-4444-8444-444444444444",
        ])) as { originalText: string; isIdea: boolean; version: number };
        assert.equal(cleared.originalText, payload.originalText);
        assert.equal(cleared.isIdea, false);
        assert.equal(cleared.version, 3);
        await assert.rejects(
          rpc("personal_os_update_metadata", [
            record,
            { version: 1, note: "stale" },
            "55555555-5555-4555-8555-555555555555",
          ]),
        );
      },
    );
    await t.test("数据库拒绝直接覆盖原文及重复领域", async () => {
      await assert.rejects(
        db.query(
          "update personal_os_records set original_text=$1 where id=$2",
          ["覆盖", record],
        ),
      );
      await assert.rejects(
        db.query("update personal_os_records set domains=$1 where id=$2", [
          ["职业", "职业"],
          record,
        ]),
      );
    });
    await t.test("附件原子绑定，上传后原件与归属不可改写", async () => {
      await db.query(
        "insert into personal_os_attachments(id,owner_id,object_key,mime,name,bytes,sha256) values($1,$2,$3,$4,$5,$6,$7)",
        [
          attachment,
          owner,
          `${owner}/${attachment}`,
          "image/png",
          "fixture.png",
          100,
          "synthetic-hash",
        ],
      );
      const id = "66666666-6666-4666-8666-666666666666";
      const saved = (await rpc("personal_os_save_record", [
        { id, originalText: "", attachmentIds: [attachment], links: [] },
      ])) as { attachments: unknown[] };
      assert.equal(saved.attachments.length, 1);
      await assert.rejects(
        rpc("personal_os_save_record", [
          {
            id: "77777777-7777-4777-8777-777777777777",
            originalText: "",
            attachmentIds: [attachment],
            links: [],
          },
        ]),
      );
      await assert.rejects(
        db.query("update personal_os_attachments set sha256=$1 where id=$2", [
          "changed",
          attachment,
        ]),
      );
    });
    await t.test("第二身份看不到本人记录也不能伪造归属", async () => {
      await as(other);
      assert.deepEqual(await rpc("personal_os_list_records", []), []);
      await assert.rejects(
        rpc("personal_os_save_record", [
          { ...payload, id: "88888888-8888-4888-8888-888888888888" },
        ]),
      );
      await as(owner);
    });
    await t.test("存储路径限定本人，禁止覆盖与删除原件", async () => {
      await db.query(
        "insert into storage.objects(bucket_id,name) values($1,$2)",
        ["personal-os-private", `${owner}/file`],
      );
      await assert.rejects(
        db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
          "personal-os-private",
          `${other}/file`,
        ]),
      );
      await db.query("update storage.objects set name=$1", ["rewritten"]);
      await db.query("delete from storage.objects");
      const result = await db.query<{ name: string }>(
        "select name from storage.objects",
      );
      assert.equal(result.rows[0].name, `${owner}/file`);
    });
    await t.test(
      "Focus 可空关联，复盘无来源也能保存；匿名不能调用 RPC",
      async () => {
        const value = {
          id: "99999999-9999-4999-8999-999999999999",
          kind: "focus",
          title: "",
          body: "一个关注",
          domains: [],
          next: "",
          relationId: null,
          sourceIds: [],
          active: true,
          version: 0,
        };
        const saved = (await rpc("personal_os_save_entry", [
          value,
          "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        ])) as { version: number };
        assert.equal(saved.version, 1);
        await rpc("personal_os_save_entry", [
          {
            ...value,
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            kind: "reflection",
            cadence: "weekly",
          },
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
        ]);
        await db.exec("reset role;set role anon");
        await assert.rejects(rpc("personal_os_list_records", []));
      },
    );
  } finally {
    await db.close();
  }
});

test("安装脚本：绑定已验证本人，事务回滚和已有对象保护", async (t) => {
  const contract = await readFile(
    "docs/02-engineering/proposals/private-records-v2.sql",
    "utf8",
  );
  const email = "synthetic'owner@example.test";
  const sql = buildSetupSql(contract, email);
  async function fixture() {
    const db = new PGlite();
    await db.exec(`create role authenticated; create role anon; create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
      create table storage.objects(id uuid primary key,bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
    return db;
  }
  await t.test("已验证邮箱自动绑定 UID；重复执行不覆盖既有记录", async () => {
    const db = await fixture();
    try {
      await db.query("insert into auth.users values($1,$2,now())", [
        owner,
        email,
      ]);
      await db.exec(sql);
      assert.deepEqual(
        (await db.query("select user_id from personal_os_owners")).rows,
        [{ user_id: owner }],
      );
      const inspection = (
        await readFile(
          "docs/02-engineering/verify-private-records-v2.sql",
          "utf8",
        )
      ).replaceAll("YOUR_LOGIN_EMAIL", () => email.replaceAll("'", "''"));
      const checked = await db.query<Record<string, boolean>>(inspection);
      assert.equal(Object.keys(checked.rows[0]).length, 7);
      assert.ok(Object.values(checked.rows[0]).every(Boolean));
      await db.exec(
        "alter table personal_os_records disable row level security",
      );
      assert.equal(
        (await db.query<Record<string, boolean>>(inspection)).rows[0].rls_ok,
        false,
      );
      await db.exec(
        "alter table personal_os_records enable row level security",
      );
      assert.equal(
        (
          await db.query<Record<string, boolean>>(
            inspection.replaceAll(
              email.replaceAll("'", "''"),
              "not-owner@example.test",
            ),
          )
        ).rows[0].owner_matches_login,
        false,
      );
      await assert.rejects(db.exec(sql), /Existing Personal OS objects/);
      await db.exec("rollback");
      assert.equal(
        (await db.query("select * from personal_os_owners")).rows.length,
        1,
      );
    } finally {
      await db.close();
    }
  });
  await t.test("无已验证本人时不留下表或 bucket", async () => {
    const db = await fixture();
    try {
      await db.query("insert into auth.users values($1,$2,null)", [
        owner,
        email,
      ]);
      await assert.rejects(db.exec(sql), /exactly one verified/);
      await db.exec("rollback");
      assert.equal(
        (
          await db.query<{ name: string | null }>(
            "select to_regclass('public.personal_os_owners')::text as name",
          )
        ).rows[0].name,
        null,
      );
      assert.equal(
        (await db.query("select * from storage.buckets")).rows.length,
        0,
      );
    } finally {
      await db.close();
    }
  });
  await t.test("既有 Storage 策略阻断安装，不擅自删改旧策略", async () => {
    const db = await fixture();
    try {
      await db.query("insert into auth.users values($1,$2,now())", [
        owner,
        email,
      ]);
      await db.exec(
        "create policy legacy_policy on storage.objects for select using(true)",
      );
      await assert.rejects(db.exec(sql), /Existing Storage policies/);
      await db.exec("rollback");
      assert.equal(
        (
          await db.query(
            "select * from pg_policies where policyname='legacy_policy'",
          )
        ).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from storage.buckets")).rows.length,
        0,
      );
    } finally {
      await db.close();
    }
  });
});
