import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const record = "11111111-1111-4111-8111-111111111111",
  attachment = "22222222-2222-4222-8222-222222222222";
const direction = "33333333-3333-4333-8333-333333333333",
  focus = "44444444-4444-4444-8444-444444444444",
  review = "55555555-5555-4555-8555-555555555555";
test("回收站增量契约：在已有合成数据上安装，不连接真实数据库", async (t) => {
  const db = new PGlite();
  const rpc = async <T = Record<string, unknown>>(
    name: string,
    values: unknown[] = [],
  ): Promise<T> => {
    const { rows } = await db.query<{ value: T }>(
      `select public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      values,
    );
    return rows[0].value;
  };
  async function as(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  const base = {
    title: "虚构内容",
    body: "保留正文",
    domains: ["生活"],
    next: "",
    relationId: null,
    sourceIds: [],
    active: true,
    version: 0,
  };
  const move = (
    id: string,
    kind: string,
    version: number,
    deleted = true,
    key = crypto.randomUUID(),
  ) => rpc("personal_os_set_trash", [{ id, kind, version, deleted }, key]);
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id serial primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;insert into auth.users values('${owner}'),('${other}');alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant execute on functions to anon,authenticated;`,
    );
    await db.exec(
      await readFile(
        "docs/02-engineering/proposals/private-records-v2.sql",
        "utf8",
      ),
    );
    await db.query("insert into personal_os_owners values($1)", [owner]);
    await as(owner);
    await db.query(
      "insert into personal_os_attachments(id,owner_id,object_key,mime,name,bytes,sha256) values($1,$2,$3,'image/png','synthetic.png',123,'test-hash')",
      [attachment, owner, `${owner}/${attachment}`],
    );
    await rpc("personal_os_save_record", [
      {
        id: record,
        originalText: "  合成原文\n保持不变。  ",
        attachmentIds: [attachment],
        links: [],
      },
    ]);
    await rpc("personal_os_update_metadata", [
      record,
      { version: 1, isIdea: true, domains: ["生活", "能力"] },
      crypto.randomUUID(),
    ]);
    await rpc("personal_os_save_entry", [
      { ...base, id: direction, kind: "direction" },
      crypto.randomUUID(),
    ]);
    await rpc("personal_os_save_entry", [
      { ...base, id: focus, kind: "focus", relationId: direction },
      crypto.randomUUID(),
    ]);
    await rpc("personal_os_save_entry", [
      {
        ...base,
        id: review,
        kind: "reflection",
        cadence: "monthly",
        sourceIds: [record],
      },
      crypto.randomUUID(),
    ]);
    const original = await rpc("personal_os_get_record", [record]);
    const attachmentBefore = await db.query(
      "select * from personal_os_attachments",
    );
    const entriesBefore = await rpc("personal_os_list_entries");
    await db.exec("reset role");
    const migration = await readFile(
      "docs/02-engineering/proposals/recycle-bin-v1.sql",
      "utf8",
    );
    await db.exec(migration);
    await as(owner);
    await t.test("增量安装不改变已有正文、附件、灵感或关联", async () => {
      assert.deepEqual(await rpc("personal_os_get_record", [record]), original);
      assert.deepEqual(await rpc("personal_os_list_entries"), entriesBefore);
      assert.deepEqual(
        await db.query("select * from personal_os_attachments"),
        attachmentBefore,
      );
      assert.deepEqual(await rpc("personal_os_list_trash"), []);
    });
    await t.test(
      "移入重试幂等、版本冲突拒绝、保留原件并从普通列表隐藏",
      async () => {
        const key = crypto.randomUUID();
        const first = await move(record, "record", 2, true, key);
        assert.deepEqual(await move(record, "record", 2, true, key), first);
        await assert.rejects(move(record, "record", 2, false, key), {
          code: "40001",
        });
        await assert.rejects(move(record, "record", 2, false), {
          code: "40001",
        });
        assert.deepEqual(await rpc("personal_os_list_records"), []);
        const tombstone = await rpc("personal_os_get_record", [record]);
        assert.deepEqual(Object.keys(tombstone).sort(), ["deletedAt", "id"]);
        const bin = await rpc<Array<{ id: string; version: number }>>(
          "personal_os_list_trash",
        );
        assert.equal(bin[0].id, record);
        assert.equal(bin[0].version, 3);
        assert.deepEqual(
          await db.query("select * from personal_os_attachments"),
          attachmentBefore,
        );
        const raw = await db.query<{ original_text: string; is_idea: boolean }>(
          "select original_text,is_idea,attachment_ids from personal_os_records where id=$1",
          [record],
        );
        assert.equal(raw.rows[0].original_text, "  合成原文\n保持不变。  ");
        assert.equal(raw.rows[0].is_idea, true);
        await assert.rejects(
          db.query(
            "update personal_os_records set original_text='override' where id=$1",
            [record],
          ),
          { code: "42501" },
        );
        await assert.rejects(
          rpc("personal_os_update_metadata", [
            record,
            { version: 3, note: "edit while removed" },
            crypto.randomUUID(),
          ]),
          { code: "PT410" },
        );
        await assert.rejects(
          rpc("personal_os_save_record", [
            {
              id: crypto.randomUUID(),
              originalText: "new",
              attachmentIds: [],
              links: [],
              sourceId: record,
            },
          ]),
          { code: "PT410" },
        );
      },
    );
    await t.test(
      "保留旧复盘来源、拒绝新引用被移除材料，恢复灵感和原始内容",
      async () => {
        await rpc("personal_os_save_entry", [
          {
            ...base,
            id: review,
            kind: "reflection",
            version: 1,
            cadence: "monthly",
            sourceIds: [record],
            body: "补充手写内容",
          },
          crypto.randomUUID(),
        ]);
        await assert.rejects(
          rpc("personal_os_save_entry", [
            {
              ...base,
              id: crypto.randomUUID(),
              kind: "reflection",
              cadence: "weekly",
              sourceIds: [record],
            },
            crypto.randomUUID(),
          ]),
          { code: "42501" },
        );
        await move(record, "record", 3, false);
        const restored = await rpc("personal_os_get_record", [record]);
        assert.deepEqual({ ...restored, version: original.version }, original);
        assert.equal(
          (await rpc<Array<unknown>>("personal_os_list_records")).length,
          1,
        );
        assert.deepEqual(await rpc("personal_os_list_trash"), []);
      },
    );
    await t.test(
      "方向有关联关注时拒绝（含直接写表），解除关联后可移入，禁止新建指向已移除方向的关注",
      async () => {
        await assert.rejects(move(direction, "direction", 1), {
          code: "PT409",
        });
        await assert.rejects(
          db.query(
            "update personal_os_entries set deleted_at=now() where id=$1",
            [direction],
          ),
          { code: "PT409" },
        );
        // Even inactive references remain intact and must be manually unlinked.
        await rpc("personal_os_save_entry", [
          {
            ...base,
            id: focus,
            kind: "focus",
            version: 1,
            active: false,
            relationId: direction,
          },
          crypto.randomUUID(),
        ]);
        await assert.rejects(move(direction, "direction", 1), {
          code: "PT409",
        });
        await rpc("personal_os_save_entry", [
          { ...base, id: focus, kind: "focus", version: 2, active: false },
          crypto.randomUUID(),
        ]);
        await move(direction, "direction", 1);
        await assert.rejects(
          rpc("personal_os_save_entry", [
            {
              ...base,
              id: crypto.randomUUID(),
              kind: "focus",
              relationId: direction,
            },
            crypto.randomUUID(),
          ]),
          { code: "PT410" },
        );
        await assert.rejects(
          rpc("personal_os_save_entry", [
            { ...base, id: direction, kind: "direction", version: 2 },
            crypto.randomUUID(),
          ]),
          { code: "PT410" },
        );
        await move(direction, "direction", 2, false);
        await assert.rejects(move(focus, "focus", 3), { code: "22023" });
      },
    );
    await t.test(
      "移除和恢复复盘不改来源，保留周期；其他账户及匿名不可查看或操作",
      async () => {
        const before = await rpc("personal_os_get_record", [record]);
        await move(review, "reflection", 2);
        assert.equal(
          (await rpc<Array<{ id: string }>>("personal_os_list_entries")).some(
            (x) => x.id === review,
          ),
          false,
        );
        assert.deepEqual(await rpc("personal_os_get_record", [record]), before);
        await as(other);
        assert.deepEqual(await rpc("personal_os_list_trash"), []);
        await assert.rejects(move(review, "reflection", 3, false), {
          code: "42501",
        });
        await db.exec("reset role;set role anon");
        await assert.rejects(rpc("personal_os_list_trash"), { code: "42501" });
        await assert.rejects(move(review, "reflection", 3, false), {
          code: "42501",
        });
        await as(owner);
        await move(review, "reflection", 3, false);
        const restored = (
          await rpc<
            Array<{ id: string; cadence: string; sourceIds: string[] }>
          >("personal_os_list_entries")
        ).find((x) => x.id === review)!;
        assert.equal(restored.cadence, "monthly");
        assert.deepEqual(restored.sourceIds, [record]);
        for (const table of [
          "personal_os_records",
          "personal_os_entries",
          "personal_os_attachments",
        ]) {
          const { rows } = await db.query<{ destructive: boolean }>(
            "select has_table_privilege('authenticated',$1,'DELETE,TRUNCATE') as destructive",
            [table],
          );
          assert.equal(rows[0].destructive, false);
        }
      },
    );
    await t.test("六项只读安装检查为真", async () => {
      await db.exec("reset role");
      const result = await db.query<Record<string, boolean>>(
        await readFile("docs/02-engineering/verify-recycle-bin-v1.sql", "utf8"),
      );
      assert.equal(Object.keys(result.rows[0]).length, 6);
      assert.equal(Object.values(result.rows[0]).every(Boolean), true);
      await as(owner);
    });
    await t.test("重复迁移事务停止且不影响已有数据", async () => {
      await db.exec("reset role");
      await assert.rejects(db.exec(migration), /already present/);
      await db.exec("rollback");
      await as(owner);
      assert.equal(
        (await rpc<Array<unknown>>("personal_os_list_records")).length,
        1,
      );
      assert.equal(
        (await rpc<Array<unknown>>("personal_os_list_entries")).length,
        3,
      );
    });
  } finally {
    await db.close();
  }
});
