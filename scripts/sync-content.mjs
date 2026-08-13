import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { applySiteAssetEdits, applySiteEditorialEdits } from "./site-editorial.mjs";

const projectRoot = process.cwd();
const sourceRoot = await resolveSourceRoot();
if (!sourceRoot) {
  await syncPublicContent();
} else {
  await syncVaultContent(sourceRoot);
}

async function syncVaultContent(sourceRoot) {
  const outputRoot = path.join(projectRoot, "data");
  const generatedRoot = path.join(projectRoot, "src", "generated");

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(generatedRoot, { recursive: true });

  const files = await collectFiles(sourceRoot);
  const markdownFiles = files.filter((file) => file.extension === ".md");
  const codeFiles = files.filter((file) => [".sql", ".yml", ".yaml"].includes(file.extension));
  const parsedMarkdown = markdownFiles.map((file) => parseMarkdownFile(file));
  const linkMap = buildLinkMap(parsedMarkdown);

  const docs = parsedMarkdown.map((file) => {
  const markdown = applySiteEditorialEdits(file.relativePath, applySiteOnlyEdits(file.relativePath, sanitizeSourceText(file.body)));
  const rewritten = rewriteWikiLinks(markdown, linkMap);
  const html = renderMarkdown(removeDocumentHeading(rewritten));
  const toc = extractToc(rewritten);
  const title = normalizeDisplayTitle(file.frontmatter.title || firstHeading(rewritten) || file.title);
  return {
    slug: file.slug,
    title,
    section: sectionFor(file.relativePath),
    sourcePath: file.relativePath,
    excerpt: excerpt(rewritten),
    toc,
    html
  };
  });

  const assets = codeFiles.map((file) => ({
  slug: file.slug,
  title: assetTitle(file.relativePath, file.title),
  section: "03 / 실습",
  sourcePath: file.relativePath,
  language: file.extension === ".sql" ? "sql" : "yaml",
  code: applySiteAssetEdits(file.relativePath, sanitizeSourceText(file.body))
  }));

  const manifest = [
  ...docs.map(({ slug, title, section, sourcePath, excerpt: summary }) => ({
    slug,
    title,
    section,
    sourcePath,
    kind: "doc",
    summary
  })),
  ...assets.map(({ slug, title, section, sourcePath, language }) => ({
    slug,
    title,
    section,
    sourcePath,
    kind: "asset",
    language
  }))
  ].sort(compareManifest);

  const content = {
  generatedAt: new Date().toISOString(),
  manifest,
  docs: Object.fromEntries(docs.map((doc) => [doc.slug, doc])),
  assets: Object.fromEntries(assets.map((asset) => [asset.slug, asset]))
  };

  const bulkEntries = [
  { key: "manifest", value: JSON.stringify(manifest) },
  { key: "search", value: JSON.stringify(manifest.map(({ slug, title, section, summary, kind }) => ({ slug, title, section, summary, kind }))) },
  ...docs.map((doc) => ({ key: `doc/${doc.slug}`, value: JSON.stringify(doc) })),
  ...assets.map((asset) => ({ key: `asset/${asset.slug}`, value: JSON.stringify(asset) }))
  ];

  await fs.writeFile(path.join(outputRoot, "content.json"), `${JSON.stringify(content, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputRoot, "kv-bulk.json"), `${JSON.stringify(bulkEntries, null, 2)}\n`, "utf8");
  await fs.writeFile(
  path.join(generatedRoot, "content.ts"),
  `export const localContent = ${JSON.stringify(content)} as const;\nexport default localContent;\n`,
  "utf8"
  );

  console.log(`synced ${docs.length} markdown documents and ${assets.length} code assets from ${sourceRoot}`);
}

async function syncPublicContent() {
  const outputRoot = path.join(projectRoot, "data");
  const generatedRoot = path.join(projectRoot, "src", "generated");
  const fixturePath = path.join(projectRoot, "data", "public-content.json");
  const content = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const bulkEntries = [
    { key: "manifest", value: JSON.stringify(content.manifest) },
    { key: "search", value: JSON.stringify(content.manifest.map(({ slug, title, section, summary, kind }) => ({ slug, title, section, summary, kind }))) },
    ...Object.values(content.docs).map((doc) => ({ key: `doc/${doc.slug}`, value: JSON.stringify(doc) })),
    ...Object.values(content.assets).map((asset) => ({ key: `asset/${asset.slug}`, value: JSON.stringify(asset) }))
  ];
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.writeFile(path.join(outputRoot, "content.json"), `${JSON.stringify(content, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputRoot, "kv-bulk.json"), `${JSON.stringify(bulkEntries, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(generatedRoot, "content.ts"),
    `export const localContent = ${JSON.stringify(content)} as const;\nexport default localContent;\n`,
    "utf8"
  );
  console.log("synced public demo content without private source documents");
}

async function resolveSourceRoot() {
  if (process.env.SQLD_SOURCE_ROOT) {
    const configured = path.resolve(process.env.SQLD_SOURCE_ROOT);
    return await pathExists(configured) ? configured : null;
  }

  const devicePath = path.join(os.homedir(), ".config", "kiyeon-agent", "device.json");
  if (!(await pathExists(devicePath))) return null;
  const device = JSON.parse(await fs.readFile(devicePath, "utf8"));
  const configured = path.join(device.vaultRoot, "20-Learning", "SQLD");
  return await pathExists(configured) ? configured : null;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(root) {
  const result = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (![".md", ".sql", ".yml", ".yaml"].includes(extension)) continue;
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const body = await fs.readFile(absolutePath, "utf8");
      result.push({
        absolutePath,
        relativePath,
        extension,
        body,
        title: titleFromFilename(entry.name),
        slug: slugify(relativePath)
      });
    }
  }

  await visit(root);
  return result.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "ko"));
}

function parseMarkdownFile(file) {
  const match = file.body.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const frontmatter = match ? parseFrontmatter(match[1]) : {};
  const body = match ? file.body.slice(match[0].length) : file.body;
  const aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases : [];
  return { ...file, frontmatter, aliases, body };
}

function parseFrontmatter(source) {
  const result = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([\w-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    } else {
      result[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
  return result;
}

function buildLinkMap(files) {
  const map = new Map();
  for (const file of files) {
    const keys = [
      file.relativePath,
      file.relativePath.replace(/\.md$/i, ""),
      path.basename(file.relativePath),
      path.basename(file.relativePath, ".md"),
      file.frontmatter.title,
      ...file.aliases
    ];
    for (const key of keys.filter(Boolean)) {
      map.set(normalizeLinkKey(key), file.slug);
    }
  }
  return map;
}

function rewriteWikiLinks(markdown, linkMap) {
  const protectedParts = [];
  const masked = markdown.replace(/```[\s\S]*?```|`[^`]*`/g, (part) => {
    const token = `\u0000CODE_${protectedParts.length}\u0000`;
    protectedParts.push(part);
    return token;
  });
  const rewritten = masked.replace(/!?(\[\[([^\]]+)\]\])/g, (whole, _full, inner) => {
    if (whole.startsWith("!")) return whole;
    const [rawTarget, rawLabel] = inner.split(/\\?\|/);
    const [target, heading] = rawTarget.split("#");
    const label = rawLabel?.replace(/\\\|/g, "|").trim() || target.split("/").at(-1);
    const slug = linkMap.get(normalizeLinkKey(target));
    if (!slug) return `<span class="external-wikilink" title="SQLD 폴더 외부 링크">${escapeHtml(label)}</span>`;
    const hash = heading ? `#${slugify(heading)}` : "";
    return `[${label}](/docs/${encodeURIComponent(slug)}${hash})`;
  });
  return rewritten.replace(/\u0000CODE_(\d+)\u0000/g, (_match, index) => protectedParts[Number(index)]);
}

function renderMarkdown(markdown) {
  const withCallouts = convertCallouts(markdown);
  let html = marked.parse(withCallouts, { gfm: true, breaks: false });
  html = normalizeRenderedSpacing(html);
  html = html.replace(/<li>\s*<\/li>/g, "").replace(/<(ul|ol)>\s*<\/\1>/g, "");
  html = html.replace(/<table>[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll">${responsiveTable(table)}</div>`);
  html = html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (_match, level, content) => {
    const plain = plainText(content);
    return `<h${level} id="${slugify(plain)}">${content}</h${level}>`;
  });
  html = html.replace(/<a href="(https?:\/\/[^"#]+)">/g, '<a href="$1" target="_blank" rel="noreferrer">');
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "aside", "div", "span", "details", "summary"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["id", "class", "title", "data-label"],
      a: ["href", "name", "target", "rel"],
      code: ["class"],
      img: ["src", "alt", "title"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false
  });
}

function removeDocumentHeading(markdown) {
  return markdown.replace(/^#\s+.+(?:\r?\n|$)\s*/m, "");
}

function responsiveTable(table) {
  const headers = [...table.matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g)]
    .map((match) => plainText(match[1]));
  if (!headers.length) return table;

  return table.replace(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/g, (row, body) => {
    if (!/<td(?:\s|>)/.test(body)) return row;
    let index = 0;
    const labeledBody = body.replace(/<td(\s[^>]*)?>([\s\S]*?)<\/td>/g, (_match, attributes = "", content) => {
      const label = headers[index] || `항목 ${index + 1}`;
      index += 1;
      return `<td${attributes} data-label="${escapeHtml(label)}">${content}</td>`;
    });
    return row.replace(body, labeledBody);
  });
}

function plainText(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_match, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity])
    .replace(/\s+/g, " ")
    .trim();
}

function applySiteOnlyEdits(relativePath, markdown) {
  if (relativePath !== "3-실습/3-1_실습 환경 구축 - PostgreSQL Docker Compose.md") return markdown;

  const codeFence = "```";
  const containerSetup = `
## 3. 컨테이너와 실습 DB 시작

이 실습은 SQL 파일을 직접 하나씩 실행하지 않아도 된다. Docker Compose가 처음 빈 데이터 볼륨을 만들 때 다음 순서로 준비한다.

| 단계 | 담당 파일·설정 | 만들어지는 것 |
|---|---|---|
| 1 | \`POSTGRES_DB: sqld_lab\` | PostgreSQL 데이터베이스 \`sqld_lab\` |
| 2 | \`db/01_schema.sql\` | \`sqld_lab\` 스키마, 테이블, 인덱스, 뷰 |
| 3 | \`db/02_seed.sql\` | 실습용 기본 데이터 |

다음 순서대로 실행한다.

1. \`docker-compose.yml\`과 \`db\` 폴더가 함께 있는 \`3-실습\` 폴더에서 터미널을 연다.
2. 아래 경로의 \`<실습 폴더 상위 경로>\`를 파일을 저장한 위치에 맞게 바꿔 이동한다. 이미 해당 폴더에서 터미널을 열었다면 \`cd\` 단계는 건너뛴다.

${codeFence}bash
# macOS / Linux
cd "<실습 폴더 상위 경로>/3-실습"
ls
${codeFence}

${codeFence}powershell
# Windows PowerShell
Set-Location "<실습 폴더 상위 경로>/3-실습"
Get-ChildItem
${codeFence}

${codeFence}bash
docker compose config
docker compose up -d
docker compose ps
${codeFence}

\`docker compose config\`는 실제 적용될 설정을 확인하고, \`docker compose up -d\`는 컨테이너를 백그라운드로 시작한다. \`docker compose ps\`의 상태가 \`healthy\`가 되면 접속한다.

컨테이너와 기본 데이터가 준비됐는지 확인한다.

${codeFence}bash
docker compose exec postgres psql -U sqld -d sqld_lab -c "SELECT current_database();"
docker compose exec postgres psql -U sqld -d sqld_lab -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'sqld_lab';"
docker compose exec postgres psql -U sqld -d sqld_lab -c "SELECT COUNT(*) FROM sqld_lab.customers;"
${codeFence}

## 3-1. 기존 PostgreSQL에 직접 스키마 넣기

Docker를 사용하지 않고 이미 설치된 PostgreSQL 서버를 쓰는 경우에는 먼저 \`postgres\` 데이터베이스에 접속해 대상 DB를 만든다. 이미 있으면 이 단계는 건너뛴다.

${codeFence}sql
CREATE DATABASE sqld_lab;
${codeFence}

그다음 DataGrip에서 \`sqld_lab\` 데이터베이스에 연결해 사이트의 실습 코드 \`01_schema.sql\` → \`02_seed.sql\` 순서로 실행한다. 첫 번째 파일은 \`sqld_lab\` 스키마와 구조를 만들고, 두 번째 파일은 기본 데이터를 넣는다. 이 수동 방식도 새 연습용 DB에서만 사용한다.

## 3-2. 실습 데이터 초기화

이미 데이터 볼륨이 있으면 초기화 SQL이 다시 자동 실행되지 않는다. 연습 데이터를 처음 상태로 되돌릴 때만 다음처럼 볼륨까지 지운다. \`01_schema.sql\`은 스키마를 삭제 후 다시 만들기 때문에 기존 데이터를 보존해야 하는 DB에서는 직접 실행하지 않는다.

${codeFence}bash
docker compose down -v
docker compose up -d
${codeFence}
`;

  const generalized = markdown
    .replace(
      "이 노트가 있는 `3-실습` 디렉터리로 이동한다.",
      "명령은 `docker-compose.yml`과 `db` 폴더가 함께 있는 `3-실습` 폴더에서 실행한다. 아래 경로의 `<실습 폴더 상위 경로>`를 파일을 저장한 위치에 맞게 바꾼다."
    )
    .replace('cd "20-Learning/SQLD/3-실습"', 'cd "<실습 폴더 상위 경로>/3-실습"');
  const setupPattern = /\n## 3\. 컨테이너 시작[\s\S]*?(?=\n## 4\. DataGrip으로 연결)/;
  if (!setupPattern.test(generalized)) throw new Error(`사이트 교정 대상을 찾지 못했습니다: ${relativePath} / 컨테이너 시작`);
  return generalized.replace(setupPattern, `\n${containerSetup}\n`);
}

function convertCallouts(markdown) {
  return markdown.replace(
    /^>\s*\[!([\w-]+)\]\s*(.*?)\r?\n((?:>.*(?:\r?\n|$))*)/gim,
    (_match, type, title, quotedBody) => {
      const body = quotedBody
        .split(/\r?\n/)
        .map((line) => line.replace(/^>\s?/, ""))
        .join("\n")
        .trim();
      const bodyHtml = body ? marked.parse(body, { gfm: true }) : "";
      return `<aside class="callout callout-${slugify(type)}"><div class="callout-label">${escapeHtml(title || type)}</div>${bodyHtml}</aside>\n`;
    }
  );
}

function extractToc(markdown) {
  return [...markdown.matchAll(/^(#{2,4})\s+(.+)$/gm)].map((match) => {
    const text = plainText(marked.parseInline(match[2]));
    return {
      level: match[1].length,
      text,
      id: slugify(text)
    };
  });
}

function firstHeading(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function excerpt(markdown) {
  const blocks = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && !/^#/.test(block) && !/^>/.test(block) && !/^\|/.test(block));
  const source = blocks[0] || firstHeading(markdown) || "SQLD 학습 노트";
  const plain = plainText(normalizeRenderedSpacing(marked.parseInline(source.replace(/\n+/g, " "))))
    .replace(/^\s*(?:[-+*]|\d+\.)\s+/, "")
    .replace(/\*{2,3}/g, "")
    .replace(/\.\s+-\s+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 180) return plain;
  const candidate = plain.slice(0, 181);
  const boundary = candidate.lastIndexOf(" ");
  return `${plain.slice(0, boundary >= 135 ? boundary : 180).trimEnd()}…`;
}

function normalizeRenderedSpacing(html) {
  return html.replace(
    /<\/(strong|em|code|a)>\s+(이|가|은|는|을|를|와|과|으로|로|라고|에서|에|의|도|만|이다|이며)(?=[\s<.,)])/g,
    "</$1>$2"
  );
}

function sanitizeSourceText(source) {
  return source
    .replace(/file:\/\/\/[^\s)]+/gi, "[로컬 파일 링크]")
    .replace(/\/Users\/[^\s)`]+/g, "[로컬 경로]")
    .replace(/[A-Z]:\\[^\s)`]+/g, "[로컬 경로]");
}

function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, "").replace(/^[0-9]+[-_]/, "").replace(/[-_]+/g, " ");
}

function sectionFor(relativePath) {
  if (relativePath === "_Overview.md") return "00 / 전체 목차";
  if (relativePath.startsWith("1-")) return "01 / 데이터 모델링";
  if (relativePath.startsWith("2-")) return "02 / SQL 기본·활용";
  if (relativePath.startsWith("3-실습/")) return "03 / 실습";
  return "00 / 참고 노트";
}

function compareManifest(left, right) {
  const sectionOrder = { "00 / 전체 목차": 0, "01 / 데이터 모델링": 1, "02 / SQL 기본·활용": 2, "03 / 실습": 3, "00 / 참고 노트": 4 };
  return (sectionOrder[left.section] ?? 9) - (sectionOrder[right.section] ?? 9)
    || left.sourcePath.localeCompare(right.sourcePath, "ko", { numeric: true });
}

function normalizeDisplayTitle(title) {
  return title
    .replace(/제약조건/g, "제약 조건")
    .replace(/인라인뷰/g, "인라인 뷰")
    .replace(/(?<=[A-Z])·(?=[A-Z])/g, " · ");
}

function assetTitle(relativePath, fallback) {
  return ({
    "3-실습/db/01_schema.sql": "스키마 생성 SQL",
    "3-실습/db/02_seed.sql": "기본 데이터 SQL",
    "3-실습/docker-compose.yml": "Docker Compose 설정"
  })[relativePath] || normalizeDisplayTitle(fallback);
}

function normalizeLinkKey(value) {
  return value
    .replace(/^.*20-Learning\/SQLD\//, "")
    .replace(/^.*SQLD\//, "")
    .replace(/\.md$/i, "")
    .replace(/\\/g, "/")
    .trim()
    .toLocaleLowerCase("ko-KR");
}

function slugify(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[\\/]+/g, "--")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}
