import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createBrowserPracticeRunner } from "../src/client/practice-runner.ts";

const content = JSON.parse(fs.readFileSync(new URL("../data/content.json", import.meta.url), "utf8"));
const isPublicDemo = content.manifest.some((item: { sourcePath: string }) => item.sourcePath.startsWith("public/"));
const schema = content.assets[content.practice.setup.schemaSlug].code;
const seed = content.assets[content.practice.setup.seedSlug].code;

test("PGlite practice runner distinguishes correct and incorrect query results", async () => {
  const runner = await createBrowserPracticeRunner(schema, seed);
  try {
    const challenge = content.practice.challenges[0];
    const correct = await runner.check(challenge, challenge.solution);
    const wrongSql = isPublicDemo ? "SELECT item_name FROM demo.items;" : "SELECT employee_name FROM employees;";
    const wrong = await runner.check(challenge, wrongSql);
    assert.equal(correct.status, "correct");
    assert.equal(wrong.status, "wrong");
  } finally {
    await runner.close();
  }
});

test("PGlite practice runner enforces the documented output column names", async () => {
  const runner = await createBrowserPracticeRunner(schema, seed);
  try {
    const challenge = content.practice.challenges[0];
    const renamed = challenge.solution.replace(
      /SELECT\s+([^,]+),/i,
      (_match: string, firstColumn: string) => `SELECT ${firstColumn} AS unexpected_column,`
    );
    const result = await runner.check(challenge, renamed);
    assert.equal(result.status, "wrong");
  } finally {
    await runner.close();
  }
});

test("PGlite practice runner compares final state for DML scripts", async (context) => {
  if (isPublicDemo) {
    context.skip("공개 데모에는 DML 스크립트 문제가 없음");
    return;
  }
  const runner = await createBrowserPracticeRunner(schema, seed);
  try {
    const challenge = content.practice.challenges.find((item: { id: string }) => item.id === "38");
    assert.ok(challenge);
    const result = await runner.check(challenge, challenge.solution);
    assert.equal(result.status, "correct");
  } finally {
    await runner.close();
  }
});

test("every generated answer query passes its own checker", async () => {
  const runner = await createBrowserPracticeRunner(schema, seed);
  try {
    for (const challenge of content.practice.challenges) {
      const result = await runner.check(challenge, challenge.solution);
      assert.equal(result.status, "correct", challenge.id);
      assert.deepEqual(result.fields, challenge.expectedColumns, challenge.id);
    }
  } finally {
    await runner.close();
  }
});
