import assert from "node:assert/strict";
import test from "node:test";
import { userMessage } from "./user-message.ts";

test("a rate limit from the auth server is shown in Russian", () => {
  assert.equal(
    userMessage(new Error("Too many requests. Please try again later."), "Не вышло"),
    "Слишком много попыток, подожди немного",
  );
});

test("an empty failure uses the fallback", () => {
  assert.equal(userMessage(new Error("  "), "Не вышло"), "Не вышло");
});
