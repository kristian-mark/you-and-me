import assert from "node:assert/strict";
import test from "node:test";
import { isConnectionFailure, userMessage } from "./user-message.ts";

test("a rate limit from the auth server is shown in Russian", () => {
  assert.equal(
    userMessage(new Error("Too many requests. Please try again later."), "Не вышло"),
    "Слишком много попыток, подожди немного",
  );
});

test("a full session pool is a connection failure, not an account error", () => {
  const raw = "error: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15";
  assert.equal(isConnectionFailure(raw), true);
  assert.equal(userMessage(new Error(raw), "Не вышло"), "Связь прервалась");
});

test("login and register errors from the auth server are Russian", () => {
  assert.equal(userMessage(new Error("Invalid email or password"), "Не вышло"), "Неверная почта или пароль");
  assert.equal(userMessage(new Error("User already exists. Use another email."), "Не вышло"), "Такой аккаунт уже есть");
  assert.equal(userMessage(new Error("Password too short"), "Не вышло"), "Пароль слишком короткий");
  assert.equal(userMessage(new Error("Invalid email"), "Не вышло"), "Неверная почта");
  assert.equal(userMessage(new Error("Something unexpected from the server"), "Не вышло"), "Не вышло");
});

test("an empty failure uses the fallback", () => {
  assert.equal(userMessage(new Error("  "), "Не вышло"), "Не вышло");
});
