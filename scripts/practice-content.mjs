import { PGlite } from "@electric-sql/pglite";

const PRACTICE_PAIRS = [
  {
    questionPath: "3-실습/3-3_실습 문제 - 조회 조건 함수 정렬.md",
    answerPath: "3-실습/3-6_실습 정답 - 조회 조건 함수 정렬.md"
  },
  {
    questionPath: "3-실습/3-4_실습 문제 - 조인 그룹 서브쿼리 집합.md",
    answerPath: "3-실습/3-7_실습 정답 - 조인 그룹 서브쿼리 집합.md"
  },
  {
    questionPath: "3-실습/3-5_실습 문제 - 윈도우 계층형 DML.md",
    answerPath: "3-실습/3-8_실습 정답 - 윈도우 계층형 DML.md"
  }
];

const ORDER_LABELS = new Map([
  ["price", "상품 가격"],
  ["product_id", "상품 번호"],
  ["customer_id", "고객 번호"],
  ["payment_id", "결제 번호"],
  ["region", "지역"],
  ["final_amount", "주문 최종 금액"],
  ["order_id", "주문 번호"],
  ["order_month", "주문 월"],
  ["order_count", "주문 건수"],
  ["order_status", "주문 상태"],
  ["employee_id", "직원 번호"],
  ["customer_name", "고객명"],
  ["ordered_at", "주문일시"],
  ["line_no", "상세 행 번호"],
  ["sold_quantity", "판매 수량"],
  ["category_id", "카테고리 번호"],
  ["salary", "급여"],
  ["category_name", "카테고리명"],
  ["product_no", "카테고리 내 상품 순번"],
  ["department_id", "부서 번호"],
  ["salary_rank", "급여 순위"],
  ["product_amount", "상품 매출"],
  ["sales_rank", "매출 순위"],
  ["unit_price", "단가"],
  ["category_path", "카테고리 경로"],
  ["manager_path", "조직 경로"],
  ["day", "날짜"]
]);

export async function buildPracticeContent({ parsedMarkdown, assets }) {
  const schema = assets.find((asset) => asset.sourcePath === "3-실습/db/01_schema.sql");
  const seed = assets.find((asset) => asset.sourcePath === "3-실습/db/02_seed.sql");

  if (!schema || !seed) {
    throw new Error("실습 DB 초기화 파일(01_schema.sql, 02_seed.sql)을 찾을 수 없습니다.");
  }

  const challenges = [];
  for (const pair of PRACTICE_PAIRS) {
    const questionFile = parsedMarkdown.find((file) => file.relativePath === pair.questionPath);
    const answerFile = parsedMarkdown.find((file) => file.relativePath === pair.answerPath);
    if (!questionFile || !answerFile) continue;

    const questions = parseQuestionSections(questionFile.body);
    const answers = parseAnswerSections(answerFile.body);

    for (const answer of answers) {
      const question = questions.get(answer.number);
      if (!question) continue;

      answer.variants.forEach((variant, index) => {
        const id = answer.variants.length === 1 ? answer.number : `${answer.number}-${index + 1}`;
        const detail = variant.label ? `\n\n세부 요구: ${cleanInline(variant.label)}` : "";
        challenges.push({
          id,
          number: id,
          title: `${id}. ${cleanInline(question.title)}`,
          prompt: `${question.prompt}${detail}`.trim(),
          solution: variant.sql,
          mode: isScript(variant.sql) ? "script" : "result",
          sourcePath: pair.questionPath
        });
      });
    }
  }

  challenges.sort(compareChallengeIds);
  const inspected = await inspectPracticeContent(schema.code, seed.code, challenges);
  return {
    version: 2,
    setup: {
      schemaSlug: schema.slug,
      seedSlug: seed.slug
    },
    schema: inspected.schema,
    challenges: challenges.map((challenge) => {
      const expectedOrder = extractTopLevelOrderBy(challenge.solution);
      const orderRequirement = describeOrderBy(expectedOrder);
      return {
        ...challenge,
        prompt: appendOrderRequirement(challenge.prompt, orderRequirement),
        expectedColumns: inspected.columnsById.get(challenge.id) ?? [],
        expectedOrder,
        orderRequirement,
        relations: inspected.schema
          .filter((relation) => containsIdentifier(challenge.solution, relation.name))
          .map((relation) => relation.name)
      };
    })
  };
}

export function decoratePracticeMarkdown(markdown, sourcePath, practice) {
  const challenges = practice.challenges.filter((challenge) => challenge.sourcePath === sourcePath);
  if (!challenges.length) return markdown;

  const firstQuestion = /^##\s+\d+\.\s+.+$/m.exec(markdown);
  if (!firstQuestion) return markdown;

  const withSchema = `${markdown.slice(0, firstQuestion.index).trimEnd()}\n\n${schemaReference(practice.schema)}\n\n${markdown.slice(firstQuestion.index)}`;
  const headings = [...withSchema.matchAll(/^##\s+(.+)$/gm)];
  let result = "";
  let cursor = 0;

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const number = heading[1].match(/^(\d+)\.\s+/)?.[1];
    if (!number) continue;
    const sectionEnd = headings[index + 1]?.index ?? withSchema.length;
    const section = withSchema.slice(heading.index, sectionEnd);
    const variants = challenges.filter((challenge) => challenge.id === number || challenge.id.startsWith(`${number}-`));
    if (!variants.length) continue;

    result += withSchema.slice(cursor, heading.index);
    const orderRequirement = orderRequirementBlock(variants);
    result += `${section.trimEnd()}${orderRequirement ? `\n\n${orderRequirement}` : ""}\n\n${requirementCallout(variants)}\n\n`;
    cursor = sectionEnd;
  }

  return `${result}${withSchema.slice(cursor)}`.trimEnd();
}

function parseQuestionSections(markdown) {
  const sections = sectionMatches(markdown);
  return new Map(sections.map((section) => [section.number, {
    title: section.title,
    prompt: cleanPrompt(section.body)
  }]));
}

function parseAnswerSections(markdown) {
  return sectionMatches(markdown).map((section) => {
    const subsections = [...section.body.matchAll(/^###\s+(.+)$/gm)];
    const variants = subsections.length
      ? subsections.map((match, index) => ({
        label: match[1].trim(),
        sql: firstSqlBlock(section.body.slice(match.index + match[0].length, subsections[index + 1]?.index ?? section.body.length))
      }))
      : [{ label: "", sql: firstSqlBlock(section.body) }];

    return {
      number: section.number,
      variants: variants.filter((variant) => variant.sql)
    };
  }).filter((section) => section.variants.length);
}

function sectionMatches(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  return matches.map((match, index) => ({
    number: match[1],
    title: match[2].trim(),
    body: markdown.slice(match.index + match[0].length, matches[index + 1]?.index ?? markdown.length)
  }));
}

function firstSqlBlock(markdown) {
  const match = markdown.match(/```sql\s*\n([\s\S]*?)\n```/i);
  return match?.[1]?.trim() ?? "";
}

function cleanPrompt(markdown) {
  return markdown
    .replace(/^##\s+(?:셀프 체크|이어서 읽기)(?:\s|$)[\s\S]*$/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*\[\[[^\n]+\]\]\s*$/gm, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^\s*[-*]\s+\[[ xX]\].*$/gm, "")
    .replace(/^\s*#+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function inspectPracticeContent(schemaSql, seedSql, challenges) {
  const database = new PGlite("memory://");
  await database.waitReady;

  try {
    await database.exec(`${schemaSql}\n${seedSql}`);
    const schema = await readSchema(database);
    const columnsById = new Map();

    for (const challenge of challenges) {
      try {
        const results = await database.exec(challenge.solution, { rowMode: "array" });
        const output = [...results].reverse().find((result) => result.fields?.length);
        if (!output) throw new Error("결과 컬럼이 있는 문장이 없습니다.");
        columnsById.set(challenge.id, output.fields.map((field) => field.name));
      } catch (error) {
        throw new Error(`실습 ${challenge.id}번 정답 메타데이터 생성 실패: ${errorMessage(error)}`);
      } finally {
        await rollback(database);
      }
    }

    return { schema, columnsById };
  } finally {
    await database.close();
  }
}

async function readSchema(database) {
  const columnResult = await database.query(`
    SELECT
      relation.relname AS relation_name,
      CASE relation.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' END AS relation_kind,
      column_info.attnum AS ordinal_position,
      column_info.attname AS column_name,
      pg_catalog.format_type(column_info.atttypid, column_info.atttypmod) AS data_type,
      column_info.attnotnull AS not_null,
      COALESCE(primary_key.contype = 'p', false) AS is_primary_key
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_attribute column_info
      ON column_info.attrelid = relation.oid
     AND column_info.attnum > 0
     AND NOT column_info.attisdropped
    LEFT JOIN pg_catalog.pg_constraint primary_key
      ON primary_key.conrelid = relation.oid
     AND primary_key.contype = 'p'
     AND column_info.attnum = ANY(primary_key.conkey)
    WHERE namespace.nspname = 'sqld_lab'
      AND relation.relkind IN ('r', 'v')
    ORDER BY CASE relation.relkind WHEN 'r' THEN 0 ELSE 1 END, relation.relname, column_info.attnum;
  `);
  const foreignKeyResult = await database.query(`
    SELECT
      child.relname AS table_name,
      child_column.attname AS column_name,
      parent.relname AS references_table,
      parent_column.attname AS references_column
    FROM pg_catalog.pg_constraint constraint_info
    JOIN pg_catalog.pg_class child ON child.oid = constraint_info.conrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid = constraint_info.confrelid
    JOIN LATERAL unnest(constraint_info.conkey, constraint_info.confkey)
      AS key_pair(child_attnum, parent_attnum) ON true
    JOIN pg_catalog.pg_attribute child_column
      ON child_column.attrelid = child.oid
     AND child_column.attnum = key_pair.child_attnum
    JOIN pg_catalog.pg_attribute parent_column
      ON parent_column.attrelid = parent.oid
     AND parent_column.attnum = key_pair.parent_attnum
    WHERE namespace.nspname = 'sqld_lab'
      AND constraint_info.contype = 'f'
    ORDER BY child.relname, child_column.attnum;
  `);

  const foreignKeys = new Map(foreignKeyResult.rows.map((row) => [
    `${row.table_name}.${row.column_name}`,
    { table: row.references_table, column: row.references_column }
  ]));
  const relations = new Map();
  for (const row of columnResult.rows) {
    const relation = relations.get(row.relation_name) ?? {
      name: row.relation_name,
      kind: row.relation_kind,
      columns: []
    };
    relation.columns.push({
      name: row.column_name,
      type: row.data_type,
      nullable: !row.not_null,
      primaryKey: row.is_primary_key,
      references: foreignKeys.get(`${row.relation_name}.${row.column_name}`) ?? null
    });
    relations.set(row.relation_name, relation);
  }
  return [...relations.values()];
}

function schemaReference(schema) {
  const tableCount = schema.filter((relation) => relation.kind === "table").length;
  const viewCount = schema.filter((relation) => relation.kind === "view").length;
  const cards = schema.map((relation) => `
<div class="practice-schema-relation">
  <div class="practice-schema-relation-head"><code>${escapeHtml(relation.name)}</code><span>${relation.kind.toUpperCase()}</span></div>
  <ul>
    ${relation.columns.map((column) => `<li><code>${escapeHtml(column.name)}</code><span>${escapeHtml(column.type)}</span>${column.primaryKey ? "<strong>PK</strong>" : ""}${column.references ? `<strong>FK → ${escapeHtml(column.references.table)}.${escapeHtml(column.references.column)}</strong>` : ""}</li>`).join("\n    ")}
  </ul>
</div>`).join("\n");

  return `## 스키마 빠른 참조

<details class="practice-schema-reference">
  <summary><span>테이블 ${tableCount}개 · 뷰 ${viewCount}개</span><strong>컬럼 사전 펼치기</strong></summary>
  <div class="practice-schema-grid">${cards}
  </div>
</details>`;
}

function requirementCallout(challenges) {
  const outputLines = distinct(challenges.map((challenge) => challenge.expectedColumns.join(",")));
  const relations = distinct(challenges.flatMap((challenge) => challenge.relations));
  const lines = [];

  if (outputLines.length === 1) {
    lines.push(`> - 출력 컬럼(순서): ${formatIdentifiers(challenges[0].expectedColumns)}`);
  } else {
    for (const challenge of challenges) {
      lines.push(`> - ${challenge.number} 출력 컬럼: ${formatIdentifiers(challenge.expectedColumns)}`);
    }
  }
  if (relations.length) lines.push(`> - 관련 테이블·뷰: ${formatIdentifiers(relations)}`);

  return `> [!info] 결과 명세\n${lines.join("\n")}`;
}

function orderRequirementBlock(challenges) {
  const requirements = distinct(challenges.map((challenge) => challenge.orderRequirement).filter(Boolean));
  if (!requirements.length) return "";
  if (requirements.length === 1) return `**결과 순서:** ${requirements[0]}`;
  return ["**결과 순서:**", ...challenges.filter((challenge) => challenge.orderRequirement).map((challenge) => `- ${challenge.number}: ${challenge.orderRequirement}`)].join("\n");
}

function appendOrderRequirement(prompt, requirement) {
  if (!requirement) return prompt;
  return `${prompt.trim()}\n\n결과 순서: ${requirement}`;
}

function formatIdentifiers(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function distinct(values) {
  return [...new Set(values)];
}

function containsIdentifier(sql, identifier) {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(identifier)}(?![\\p{L}\\p{N}_])`, "iu").test(sql);
}

function describeOrderBy(orderBy) {
  if (!orderBy) return "";
  if (/^CASE\s+order_status\b/i.test(orderBy)) {
    return "주문 상태는 PAID → SHIPPED → DELIVERED → REFUNDED → CANCELLED 순으로 정렬하고, 같은 상태에서는 최신 주문부터 출력한다.";
  }
  if (/^GROUPING\(c\.category_name\)/i.test(orderBy)) {
    return "상세 행을 소계·총계 행보다 먼저 두고, 카테고리명과 주문 상태는 각각 오름차순으로 정렬하며 NULL은 마지막에 둔다.";
  }

  const terms = splitOrderTerms(orderBy).map(describeOrderTerm);
  if (terms.length === 1) return `${terms[0]}으로 출력한다.`;
  return `정렬 우선순위는 ${terms.join(" → ")}이다.`;
}

function describeOrderTerm(term) {
  const direction = /\s+DESC\b/i.test(term) ? "내림차순" : "오름차순";
  const expression = term
    .replace(/\s+NULLS\s+(?:FIRST|LAST)\b/ig, "")
    .replace(/\s+(?:ASC|DESC)\b/ig, "")
    .trim();
  const identifier = expression.split(".").at(-1)?.replaceAll('"', "").toLowerCase();
  const label = ORDER_LABELS.get(identifier);
  if (!label) throw new Error(`자연어 정렬 라벨을 찾지 못했습니다: ${term}`);
  return `${label} ${direction}`;
}

function splitOrderTerms(source) {
  const terms = [];
  let start = 0;
  let depth = 0;
  let quote = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (quote) {
      if (character === quote && next === quote) index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      terms.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  terms.push(source.slice(start).trim());
  return terms.filter(Boolean);
}

function extractTopLevelOrderBy(sql) {
  const masked = maskSql(sql);
  let depth = 0;
  let lastOrderBy = -1;

  for (let index = 0; index < masked.length; index += 1) {
    if (masked[index] === "(") depth += 1;
    else if (masked[index] === ")") depth = Math.max(0, depth - 1);
    if (depth !== 0) continue;
    const match = masked.slice(index).match(/^ORDER\s+BY\b/i);
    if (match) {
      lastOrderBy = index + match[0].length;
      index += match[0].length - 1;
    }
  }

  if (lastOrderBy < 0) return "";
  let end = masked.indexOf(";", lastOrderBy);
  if (end < 0) end = sql.length;
  const clause = sql.slice(lastOrderBy, end).replace(/\s+/g, " ").trim();
  return clause.replace(/\s+(?:FETCH|LIMIT|OFFSET)\b[\s\S]*$/i, "").trim();
}

function maskSql(sql) {
  let result = "";
  let state = "normal";

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (state === "line-comment") {
      if (character === "\n") {
        state = "normal";
        result += "\n";
      } else result += " ";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        result += "  ";
        index += 1;
        state = "normal";
      } else result += character === "\n" ? "\n" : " ";
      continue;
    }
    if (state === "single-quote" || state === "double-quote") {
      const quote = state === "single-quote" ? "'" : '"';
      if (character === quote && next === quote) {
        result += "  ";
        index += 1;
      } else if (character === quote) {
        result += " ";
        state = "normal";
      } else result += character === "\n" ? "\n" : " ";
      continue;
    }
    if (character === "-" && next === "-") {
      result += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && next === "*") {
      result += "  ";
      index += 1;
      state = "block-comment";
    } else if (character === "'") {
      result += " ";
      state = "single-quote";
    } else if (character === '"') {
      result += " ";
      state = "double-quote";
    } else result += character;
  }
  return result;
}

async function rollback(database) {
  try {
    await database.exec("ROLLBACK;");
  } catch {}
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function cleanInline(value) {
  return value
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

function isScript(sql) {
  return /\b(CREATE|INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i.test(sql);
}

function compareChallengeIds(left, right) {
  const leftParts = left.id.split("-").map(Number);
  const rightParts = right.id.split("-").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
