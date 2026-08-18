import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const content = JSON.parse(await fs.readFile(new URL("../data/content.json", import.meta.url), "utf8"));
const styles = await fs.readFile(new URL("../src/client/styles.css", import.meta.url), "utf8");
const client = await fs.readFile(new URL("../src/client/main.ts", import.meta.url), "utf8");
const worker = await fs.readFile(new URL("../src/worker.ts", import.meta.url), "utf8");
const isPublicDemo = content.manifest.some((item) => item.sourcePath.startsWith("public/"));

test("all SQLD source files are represented", () => {
  if (isPublicDemo) {
    assert.equal(content.manifest.length, 6);
    assert.equal(content.manifest.filter((item) => item.kind === "doc").length, 3);
    assert.equal(content.manifest.filter((item) => item.kind === "asset").length, 3);
    return;
  }
  assert.equal(content.manifest.length, 32);
  assert.equal(content.manifest.filter((item) => item.kind === "doc").length, 29);
  assert.equal(content.manifest.filter((item) => item.kind === "asset").length, 3);
  const sqlSection = content.manifest.filter((item) => item.section === "02 / SQL 기본·활용");
  assert.ok(sqlSection.findIndex((item) => item.sourcePath.startsWith("2-2_")) < sqlSection.findIndex((item) => item.sourcePath.startsWith("2-10_")));
  assert.ok(content.manifest.some((item) => item.title === "스키마 생성 SQL"));
});

test("every markdown document has rendered HTML and a stable slug", () => {
  for (const item of content.manifest.filter((candidate) => candidate.kind === "doc")) {
    const doc = content.docs[item.slug];
    assert.ok(doc, item.sourcePath);
    assert.ok(doc.html.includes("<"), item.sourcePath);
    assert.ok(!doc.slug.includes("/"), item.sourcePath);
    assert.doesNotMatch(doc.html, /<h1(?:\s|>)/, item.sourcePath);
    assert.doesNotMatch(doc.html, /<li>\s*<\/li>/, item.sourcePath);
  }
});

test("every on-page navigation target exists in its document", () => {
  for (const doc of Object.values(content.docs)) {
    for (const entry of doc.toc) {
      assert.ok(doc.html.includes(`id="${entry.id}"`), `${doc.sourcePath}#${entry.id}`);
    }
  }
});

test("code assets are available for download/view", () => {
  for (const item of content.manifest.filter((candidate) => candidate.kind === "asset")) {
    assert.ok(content.assets[item.slug]?.code, item.sourcePath);
  }
});

test("interactive practice metadata and API are available", () => {
  assert.ok(content.practice);
  assert.equal(content.practice.version, 2);
  assert.ok(content.practice.setup.schemaSlug);
  assert.ok(content.practice.setup.seedSlug);
  assert.ok(content.practice.schema.length > 0);
  assert.ok(content.practice.challenges.length > 0);
  assert.equal(new Set(content.practice.challenges.map((challenge) => challenge.id)).size, content.practice.challenges.length);
  for (const relation of content.practice.schema) {
    assert.match(relation.kind, /^(table|view)$/);
    assert.ok(relation.name);
    assert.ok(relation.columns.length > 0, relation.name);
    assert.equal(new Set(relation.columns.map((column) => column.name)).size, relation.columns.length, relation.name);
  }
  for (const challenge of content.practice.challenges) {
    assert.ok(challenge.prompt, challenge.id);
    assert.ok(challenge.expectedColumns.length > 0, challenge.id);
    assert.equal(typeof challenge.expectedOrder, "string", challenge.id);
    assert.equal(typeof challenge.orderRequirement, "string", challenge.id);
    assert.ok(Array.isArray(challenge.relations), challenge.id);
    assert.ok(challenge.solution, challenge.id);
    assert.match(challenge.sourcePath, /practice|3-실습\/3-/);
    assert.doesNotMatch(challenge.prompt, /셀프 체크|이어서 읽기/, challenge.id);
    if (challenge.expectedOrder) {
      assert.ok(challenge.orderRequirement, challenge.id);
      assert.match(challenge.prompt, /결과 순서:/, challenge.id);
    }
  }
  if (isPublicDemo) assert.equal(content.practice.challenges.length, 1);
  else assert.equal(content.practice.challenges.length, 44);
  assert.match(worker, /url\.pathname === "\/api\/practice"/);
  assert.match(client, /import\("\.\/practice-runner"\)/);
  assert.match(styles, /\.practice-runner/);
  assert.match(client, /practice-schema-repeat/);
  assert.match(client, /renderPracticeWorkspace\(doc\)/);
  assert.doesNotMatch(client, /challenge\.expectedOrder/);
});

test("source paths do not expose the local machine root", () => {
  const serialized = JSON.stringify(content);
  assert.equal(serialized.includes("/Users/"), false);
  assert.equal(serialized.includes("file:///"), false);
  assert.equal(serialized.includes("20-Learning/SQLD"), false);
  assert.equal(serialized.includes("이 노트가 있는 `3-실습` 디렉터리"), false);
});

test("GitHub deployment notes stay outside the study site", () => {
  assert.doesNotMatch(JSON.stringify(content), /github|깃허브/i);
});

test("site-only practice setup is location-independent and explains bootstrap order", () => {
  const doc = Object.values(content.docs).find((candidate) => candidate.sourcePath === "3-실습/3-1_실습 환경 구축 - PostgreSQL Docker Compose.md");
  if (isPublicDemo) return;
  assert.ok(doc);
  assert.match(doc.html, /실습 폴더 상위 경로/);
  assert.match(doc.html, /POSTGRES_DB/);
  assert.match(doc.html, /01_schema\.sql/);
  assert.match(doc.html, /02_seed\.sql/);
  assert.match(doc.html, /CREATE DATABASE sqld_lab/);
  assert.match(doc.html, /table-scroll/);
  assert.match(doc.html, /data-label="단계"/);
});

test("editorial layer fixes excerpts, page ranges, and literal pipes", () => {
  for (const doc of Object.values(content.docs)) {
    assert.doesNotMatch(doc.excerpt, /\[![a-z]+|\|/i, doc.sourcePath);
    assert.doesNotMatch(doc.excerpt, /\*\*|__/, doc.sourcePath);
    assert.doesNotMatch(doc.excerpt, /(?:^| )을 사용한다\.|정답은 에 있다\./, doc.sourcePath);
    assert.doesNotMatch(doc.html.replace(/<pre[\s\S]*?<\/pre>/g, ""), /\b\d{4}쪽/, doc.sourcePath);
    assert.doesNotMatch(doc.html.replace(/<pre[\s\S]*?<\/pre>/g, ""), /\*\*[^*]+\*\*/, doc.sourcePath);
  }
  if (isPublicDemo) return;
  const erd = Object.values(content.docs).find((doc) => doc.sourcePath.startsWith("1-2_"));
  const relation = Object.values(content.docs).find((doc) => doc.sourcePath.startsWith("1-5_"));
  const select = Object.values(content.docs).find((doc) => doc.sourcePath.startsWith("2-2_"));
  assert.match(erd.html, /<code>\|<\/code>/);
  assert.match(relation.html, /필수참여관계는 <code>\|<\/code>/);
  assert.match(select.html, /<code>\|\|<\/code>/);
  const answer = Object.values(content.docs).find((doc) => doc.sourcePath.startsWith("3-실습/3-6_"));
  assert.match(answer.excerpt, /COUNT\(\*\)/);
});

test("reviewed factual errors are absent from site content", () => {
  const serialized = JSON.stringify(content.docs);
  for (const phrase of [
    "2024/11/31",
    "DATEADD(unit, d, n)",
    "HAVING 절이 GROUP BY 절 앞",
    "FULL OUTER JOIN을 직접적으로 지원하지",
    "SQL Server 지원 X",
    "PK나 FK는 default값을 가지지 않는다",
    "NULL = NULL → unknown OR FALSE",
    "스칼라 서브쿼리는 OUTER JOIN 연산을 사용한 결과와 같다",
    "부모 엔터티 없이 자식 엔터티가 생성이 가능",
    "비식별관계에서 조인이 많이 발생",
    "루프노드(최상위 계층)",
    "다른 테이블과의 조인 연산 불가능"
  ]) assert.equal(serialized.includes(phrase), false, phrase);
});

test("concept explanations include the input and result tables they refer to", () => {
  if (isPublicDemo) return;
  const expectations = [
    {
      prefix: "2-7_",
      minimumTables: 7,
      phrases: ["ROLLUP 예시 결과", "CUBE에서 ROLLUP보다 추가되는 JOB별 소계", "GROUPING 값 판별 예시"]
    },
    {
      prefix: "2-8_",
      minimumTables: 18,
      phrases: ["같은 데이터에 프레임을 다르게 적용한 결과", "LAG·LEAD 결과 예시", "PERCENT_RANK·CUME_DIST 결과 비교"]
    },
    {
      prefix: "2-9_",
      minimumTables: 23,
      phrases: ["올바른 TOP 3 결과", "DEPT 예시 데이터와 순방향 전개 결과", "PIVOT 결과"]
    }
  ];

  for (const { prefix, minimumTables, phrases } of expectations) {
    const doc = Object.values(content.docs).find((candidate) => candidate.sourcePath.startsWith(prefix));
    assert.ok(doc, prefix);
    const tableCount = (doc.html.match(/<table>/g) ?? []).length;
    const wrapperCount = (doc.html.match(/class="table-scroll"/g) ?? []).length;
    assert.ok(tableCount >= minimumTables, `${prefix}: ${tableCount}`);
    assert.equal(wrapperCount, tableCount, prefix);
    for (const phrase of phrases) assert.match(doc.html, new RegExp(phrase), `${prefix}: ${phrase}`);
  }

  const windowFunctions = Object.values(content.docs).find((candidate) => candidate.sourcePath.startsWith("2-8_"));
  assert.match(windowFunctions.html, /ADAMS[\s\S]*?2,850[\s\S]*?2,850[\s\S]*?4,100/);
  assert.match(windowFunctions.html, /MARTIN[\s\S]*?1,350[\s\S]*?1,500[\s\S]*?NULL/);
});

test("practice wording is explicit and seed data supports every requested set", () => {
  if (isPublicDemo) return;
  const questions = Object.values(content.docs)
    .filter((doc) => /3-실습\/3-[345]_/.test(doc.sourcePath))
    .map((doc) => doc.html)
    .join("\n");
  assert.match(questions, /2024 - 출생연도/);
  assert.match(questions, /REFUNDED/);
  assert.match(questions, /기본 데이터에서 1명 반환/);
  assert.match(questions, /unit_price, order_id, line_no/);
  assert.match(questions, /practice-schema-reference/);
  assert.match(questions, /products/);
  assert.match(questions, /product_id/);
  assert.equal((questions.match(/callout-info/g) ?? []).length, 40);
  assert.equal((questions.match(/결과 순서:/g) ?? []).length, 36);
  assert.doesNotMatch(questions, /결과 정렬:/);
  const searchProducts = content.practice.challenges.find((challenge) => challenge.id === "6");
  assert.deepEqual(searchProducts.expectedColumns, ["product_id", "product_name", "price"]);
  assert.equal(searchProducts.expectedOrder, "product_id");
  assert.match(searchProducts.prompt, /결과 순서: 상품 번호 오름차순으로 출력한다\./);
  assert.deepEqual(searchProducts.relations, ["products"]);
  const orderedProducts = content.practice.challenges.find((challenge) => challenge.id === "1");
  assert.match(orderedProducts.prompt, /상품 가격 내림차순 → 상품 번호 오름차순/);
  const statusPriority = content.practice.challenges.find((challenge) => challenge.id === "11");
  assert.match(statusPriority.prompt, /PAID → SHIPPED → DELIVERED → REFUNDED → CANCELLED/);
  assert.doesNotMatch(statusPriority.prompt, /CASE\s+order_status/i);
  const products = content.practice.schema.find((relation) => relation.name === "products");
  assert.ok(products);
  assert.deepEqual(products.columns.slice(0, 4).map((column) => column.name), ["product_id", "category_id", "product_name", "price"]);
  assert.deepEqual(products.columns.find((column) => column.name === "category_id").references, { table: "categories", column: "category_id" });
  const seed = Object.values(content.assets).find((asset) => asset.sourcePath === "3-실습/db/02_seed.sql");
  assert.ok(seed);
  assert.match(seed.code, /\(16, 12, 304/);
});

test("interface copy uses clear Korean action labels", () => {
  for (const phrase of ["자료 열기", "로그아웃", "비밀번호를 받은 사람만 볼 수 있습니다.", "이 문서의 목차", "실습 코드", "이전 문서", "다음 문서"])
    assert.match(client, new RegExp(phrase));
  for (const phrase of ["PRIVATE STUDY ARCHIVE", "ON THIS PAGE", "CODE RESOURCE", "PREVIOUS", "NEXT"])
    assert.equal(client.includes(phrase), false, phrase);
});

test("readability safeguards cover headings, long text, tables, and code paths", () => {
  assert.match(styles, /text-wrap:\s*balance/);
  assert.match(styles, /text-wrap:\s*pretty/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.table-scroll/);
  assert.match(styles, /\.prose table[^\{]*\{[^}]*min-width:\s*36rem/s);
  assert.match(styles, /\.prose td::before[^\{]*\{[^}]*content:\s*attr\(data-label\)/s);
  assert.match(styles, /\.code-toolbar span/);
  assert.match(styles, /\.doc-header h1[^\{]*\{[^}]*font-size:\s*clamp\(2\.1rem,[^;]*3\.75rem\)/s);
  assert.match(styles, /\.doc-header h1\.long-title[^\{]*\{[^}]*font-size:\s*clamp/s);
  assert.match(styles, /\.doc-header h1[^\{]*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(styles, /\.prose th, \.prose td[^\{]*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(styles, /\.prose[^\{]*\{[^}]*font-size:\s*1rem/s);
});

test("on-page navigation tracks reading position and scrolls without rerouting", () => {
  assert.match(client, /data-toc-link/);
  assert.match(client, /setActiveTocLink/);
  assert.match(client, /requestAnimationFrame/);
  assert.match(client, /scrollIntoView\(\{[\s\S]*?behavior:[\s\S]*?"smooth"/);
  assert.match(styles, /\.toc a\.is-active/);
  assert.match(styles, /\.toc a\.is-active::before/);
});

test("left navigation can collapse and persists its state", () => {
  assert.match(client, /id="sidebar-toggle"/);
  assert.match(client, /SIDEBAR_STORAGE_KEY/);
  assert.match(client, /localStorage\.setItem/);
  assert.match(styles, /\.site-frame\.sidebar-collapsed \.layout/);
  assert.match(styles, /\.site-frame\.sidebar-collapsed \.sidebar/);
});

test("no generated content contains obvious secret markers", () => {
  const serialized = JSON.stringify(content).toLowerCase();
  assert.equal(/private key|api[_ -]?key|access[_ -]?token/.test(serialized), false);
});

test("wiki links inside code remain code and unresolved external links are not broken", () => {
  const serialized = JSON.stringify(content);
  assert.equal(serialized.includes("broken-wikilink"), false);
});
