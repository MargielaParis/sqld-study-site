import { PGlite } from "@electric-sql/pglite";

export type PracticeChallenge = {
  id: string;
  number: string;
  title: string;
  prompt: string;
  expectedColumns: string[];
  expectedOrder: string;
  orderRequirement: string;
  relations: string[];
  solution: string;
  mode: "result" | "script";
  sourcePath: string;
};

export type PracticeCheckResult = {
  status: "correct" | "wrong" | "error";
  message: string;
  fields: string[];
  rows: unknown[][];
  expectedRowCount?: number;
  elapsedMs: number;
};

type QueryOutput = {
  fields: string[];
  rows: unknown[][];
};

const MAX_QUERY_LENGTH = 20_000;
const MAX_RESULT_ROWS = 500;
const BLOCKED_PATTERNS = [
  /\bcopy\b[\s\S]*\bprogram\b/i,
  /\balter\s+system\b/i,
  /\bcreate\s+role\b/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+role\b/i,
  /\bload\s+['"]/i
];

export async function createBrowserPracticeRunner(schemaSql: string, seedSql: string) {
  const db = new PGlite("memory://");
  await db.waitReady;

  async function reset() {
    await rollback(db);
    await db.exec("DROP SCHEMA IF EXISTS sqld_lab CASCADE; DROP SCHEMA IF EXISTS demo CASCADE;");
    await db.exec(`${schemaSql}\n${seedSql}`);
    await db.exec("SET statement_timeout = '5000ms';");
  }

  async function check(challenge: PracticeChallenge, source: string): Promise<PracticeCheckResult> {
    const startedAt = performance.now();
    const sql = cleanSql(source);
    if (!sql) return errorResult("실행할 SQL을 입력해 주세요.", startedAt);
    if (sql.length > MAX_QUERY_LENGTH) return errorResult("쿼리가 너무 깁니다. 20,000자 이내로 작성해 주세요.", startedAt);
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(sql))) {
      return errorResult("브라우저 실습에서 사용할 수 없는 명령이 포함되어 있습니다.", startedAt);
    }

    try {
      await reset();
      if (challenge.mode === "script") {
        const expected = await executeScript(challenge.solution);
        await reset();
        const actual = await executeScript(sql);
        const matched = stableSerialize(expected.snapshot) === stableSerialize(actual.snapshot)
          && stableSerialize(expected.output.rows) === stableSerialize(actual.output.rows)
          && stableSerialize(expected.output.fields) === stableSerialize(actual.output.fields);
        return {
          status: matched ? "correct" : "wrong",
          message: matched ? "정답입니다. 조회 결과와 최종 데이터 상태가 일치합니다." : "실행은 되었지만 결과 또는 최종 데이터 상태가 정답과 다릅니다.",
          fields: actual.output.fields,
          rows: actual.output.rows,
          expectedRowCount: expected.output.rows.length,
          elapsedMs: Math.round(performance.now() - startedAt)
        };
      }

      const expected = await executeQuery(challenge.solution);
      await reset();
      const actual = await executeQuery(sql);
      const matched = stableSerialize(expected.output.rows) === stableSerialize(actual.output.rows)
        && stableSerialize(expected.output.fields) === stableSerialize(actual.output.fields);
      return {
        status: matched ? "correct" : "wrong",
        message: matched ? "정답입니다. 조회 결과가 일치합니다." : "실행은 되었지만 조회 결과가 정답과 다릅니다.",
        fields: actual.output.fields,
        rows: actual.output.rows,
        expectedRowCount: expected.output.rows.length,
        elapsedMs: Math.round(performance.now() - startedAt)
      };
    } catch (error) {
      return errorResult(errorMessage(error), startedAt);
    }
  }

  await reset();
  return {
    check,
    close: () => db.close()
  };

  async function executeQuery(sql: string) {
    const results = await db.exec(sql, { rowMode: "array" });
    const result = [...results].reverse().find((candidate) => candidate.fields?.length);
    if (!result) {
      throw new Error("조회 결과가 없습니다. SELECT 문을 포함해 주세요.");
    }
    const rows = result.rows as unknown[][];
    if (rows.length > MAX_RESULT_ROWS) {
      throw new Error(`결과가 ${MAX_RESULT_ROWS}행을 초과합니다.`);
    }
    return {
      output: {
        fields: result.fields.map((field) => field.name),
        rows: rows.map((row) => row.map(normalizeValue))
      }
    };
  }

  async function executeScript(sql: string) {
    const results = await db.exec(sql, { rowMode: "array" });
    const result = [...results].reverse().find((candidate) => candidate.fields?.length);
    const output = result
      ? {
        fields: result.fields.map((field) => field.name),
        rows: (result.rows as unknown[][]).map((row) => row.map(normalizeValue))
      }
      : { fields: [], rows: [] };
    if (output.rows.length > MAX_RESULT_ROWS) {
      throw new Error(`결과가 ${MAX_RESULT_ROWS}행을 초과합니다.`);
    }
    return { snapshot: await snapshotDatabase(), output };
  }

  async function snapshotDatabase() {
    const tables = await db.query<{ table_schema: string; table_name: string }>(
      "SELECT schemaname AS table_schema, tablename AS table_name FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename;"
    );
    const snapshot = [];
    for (const table of tables.rows) {
      const identifier = `${quoteIdentifier(table.table_schema)}.${quoteIdentifier(table.table_name)}`;
      const result = await db.exec(`SELECT * FROM ${identifier};`, { rowMode: "array" });
      const last = [...result].reverse().find((candidate) => candidate.fields?.length);
      if (!last) continue;
      const rows = (last.rows as unknown[][]).map((row) => row.map(normalizeValue));
      rows.sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right)));
      snapshot.push({
        table: `${table.table_schema}.${table.table_name}`,
        fields: last.fields.map((field) => field.name),
        rows
      });
    }
    return snapshot;
  }
}

function cleanSql(source: string) {
  return source
    .replace(/^\s*```(?:sql)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(10));
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) || Number.isFinite(numeric)) return Number(numeric.toFixed(10));
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
}

function stableSerialize(value: unknown) {
  return JSON.stringify(value);
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function rollback(db: PGlite) {
  try {
    await db.exec("ROLLBACK;");
  } catch {}
}

function errorResult(message: string, startedAt: number): PracticeCheckResult {
  return {
    status: "error",
    message,
    fields: [],
    rows: [],
    elapsedMs: Math.round(performance.now() - startedAt)
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.replace(/^ERROR:\s*/i, "");
  return String(error);
}
