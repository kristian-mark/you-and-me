import assert from "node:assert/strict";
import test from "node:test";
import { transactionPoolerUrl } from "./pg-pool.ts";

const session = "postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

test("a supabase session pooler url uses the transaction port", () => {
  assert.equal(
    transactionPoolerUrl(session),
    "postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  );
});

test("a transaction pooler url is left alone", () => {
  const url = session.replace(":5432/", ":6543/");
  assert.equal(transactionPoolerUrl(url), url);
});

test("a direct supabase host stays on 5432", () => {
  const url = "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres";
  assert.equal(transactionPoolerUrl(url), url);
});

test("a query string survives the port change", () => {
  const url = `${session}?sslmode=require`;
  assert.equal(transactionPoolerUrl(url), `${session.replace(":5432/", ":6543/")}?sslmode=require`);
});
