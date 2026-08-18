import "./styles.css";
import type { PracticeChallenge, PracticeCheckResult } from "./practice-runner";

type ManifestItem = {
  slug: string;
  title: string;
  section: string;
  sourcePath: string;
  kind: "doc" | "asset";
  summary?: string;
  language?: string;
};

type Doc = ManifestItem & {
  excerpt: string;
  html: string;
  toc: Array<{ level: number; text: string; id: string }>;
};

type Asset = ManifestItem & {
  code: string;
};

type PracticeBundle = {
  version: number;
  setup: {
    schemaSlug: string;
    seedSlug: string;
  };
  challenges: PracticeChallenge[];
};

const state: {
  authenticated: boolean;
  manifest: ManifestItem[];
  docs: Map<string, Doc>;
  assets: Map<string, Asset>;
  practice: PracticeBundle | null;
  practicePromise: Promise<PracticeBundle | null> | null;
  query: string;
} = {
  authenticated: false,
  manifest: [],
  docs: new Map(),
  assets: new Map(),
  practice: null,
  practicePromise: null,
  query: ""
};

const app = document.querySelector<HTMLDivElement>("#app")!;
const SIDEBAR_STORAGE_KEY = "sqld-sidebar-collapsed";
let clearTocTracking = () => {};
let cleanupPracticeRunner = () => {};

document.addEventListener("click", handleNavigation);
document.addEventListener("submit", handleSubmit);
document.addEventListener("input", handleInput);

await boot();

async function boot() {
  state.authenticated = await fetchSession();
  if (!state.authenticated) {
    renderLogin();
    return;
  }

  await loadManifest();
  renderShell();
  await route();
  window.addEventListener("popstate", () => void route());
}

async function fetchSession() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin" });
  if (!response.ok) return false;
  const body = await response.json() as { authenticated?: boolean };
  return Boolean(body.authenticated);
}

async function loadManifest() {
  const response = await fetch("/api/manifest", { credentials: "same-origin" });
  if (!response.ok) throw new Error("문서 목록을 불러오지 못했습니다.");
  state.manifest = await response.json() as ManifestItem[];
}

function renderLogin(error = "") {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card" aria-labelledby="login-title">
        <div class="login-mark">SQLD / 학습 노트</div>
        <p class="eyebrow">비밀번호로 보호된 학습 자료</p>
        <h1 id="login-title">SQL을 읽고,<br /><em>직접 실행하는</em> 노트.</h1>
        <p class="login-copy">공유받은 비밀번호를 입력하면 SQLD 개념 정리와 PostgreSQL 실습 자료를 볼 수 있습니다.</p>
        <form class="login-form" id="login-form">
          <label for="password">접속 비밀번호</label>
          <div class="password-field">
            <input id="password" name="password" type="password" autocomplete="current-password" required autofocus placeholder="비밀번호 입력" />
            <button type="submit">자료 열기 <span aria-hidden="true">↗</span></button>
          </div>
          <p class="form-message ${error ? "is-error" : ""}" role="status">${escapeHtml(error || "비밀번호를 받은 사람만 볼 수 있습니다.")}</p>
        </form>
        <div class="login-foot"><span>POSTGRESQL</span><span>데이터 모델링</span><span>SQL 실습</span></div>
      </section>
    </main>
  `;
}

function renderShell() {
  app.innerHTML = `
    <div class="site-frame">
      <header class="topbar">
        <div class="topbar-leading">
          <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-controls="site-sidebar" aria-expanded="true" aria-label="왼쪽 목차 접기">
            <span class="sidebar-toggle-icon" aria-hidden="true">⇤</span><span>목차</span>
          </button>
          <a class="brand" href="/" data-nav>
            <span class="brand-symbol">∷</span>
            <span><strong>SQLD</strong><small>학습 노트</small></span>
          </a>
        </div>
        <div class="topbar-actions">
          <label class="search-box" for="search-input">
            <span aria-hidden="true">⌕</span>
            <input id="search-input" type="search" placeholder="문서 검색" autocomplete="off" />
            <kbd>⌘ K</kbd>
          </label>
          <button class="text-button" id="logout-button" type="button">로그아웃</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar" id="site-sidebar" aria-label="문서 탐색">
          <div class="sidebar-intro">
            <p class="eyebrow">SQLD 학습 자료 / 2026</p>
            <h2>SQL을 구조로<br />읽는 연습.</h2>
            <p>데이터 모델링부터 쿼리 실행까지, 한 장씩 쌓아 올리는 SQLD 노트.</p>
          </div>
          <nav class="document-nav" id="document-nav"></nav>
          <div class="sidebar-meta"><span id="doc-count"></span><span>읽기 전용</span></div>
        </aside>
        <main class="main-content" id="main"></main>
      </div>
    </div>
  `;
  renderNav();
  setSidebarCollapsed(readSidebarState(), false);
  document.querySelector<HTMLButtonElement>("#sidebar-toggle")!.addEventListener("click", () => {
    const frame = document.querySelector<HTMLElement>(".site-frame")!;
    setSidebarCollapsed(!frame.classList.contains("sidebar-collapsed"));
  });
  document.querySelector<HTMLButtonElement>("#logout-button")!.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.reload();
  });
  document.querySelector<HTMLElement>(".search-box")!.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>("#search-input")?.focus();
  });
  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector<HTMLInputElement>("#search-input")?.focus();
    }
  });
}

async function route() {
  cleanupPracticeRunner();
  cleanupPracticeRunner = () => {};
  clearTocTracking();
  const path = window.location.pathname;
  const match = path.match(/^\/docs\/(.+)$/);
  if (!match) {
    renderHome();
    return;
  }

  const slug = decodeURIComponent(match[1]);
  const item = state.manifest.find((candidate) => candidate.slug === slug);
  if (!item) {
    renderNotFound();
    return;
  }

  if (item.kind === "asset") {
    await renderAsset(item);
  } else {
    await renderDoc(item);
  }
}

function renderNav() {
  const nav = document.querySelector<HTMLElement>("#document-nav")!;
  const grouped = new Map<string, ManifestItem[]>();
  for (const item of state.manifest) {
    const group = grouped.get(item.section) ?? [];
    group.push(item);
    grouped.set(item.section, group);
  }

  nav.innerHTML = [...grouped.entries()].map(([section, items]) => `
    <section class="nav-section">
      <h3>${escapeHtml(section)}</h3>
      ${items.map((item) => `<a href="/docs/${encodeURIComponent(item.slug)}" data-nav data-slug="${escapeHtml(item.slug)}" class="nav-item ${item.kind === "asset" ? "nav-asset" : ""}"><span>${item.kind === "asset" ? "↳" : ""}</span>${escapeHtml(item.title)}</a>`).join("")}
    </section>
  `).join("");

  document.querySelector<HTMLElement>("#doc-count")!.textContent = `전체 ${state.manifest.length}개 / 문서 ${state.manifest.filter((item) => item.kind === "doc").length}개`;
}

function renderHome() {
  const docs = state.manifest.filter((item) => item.kind === "doc");
  const sections = [...new Set(docs.map((item) => item.section))];
  const latest = docs.filter((item) => item.section === "03 / 실습").slice(0, 3);
  document.querySelector<HTMLElement>("#main")!.innerHTML = `
    <div class="home-page">
      <div class="home-hero">
        <div>
          <p class="eyebrow">SQLD 학습 아카이브</p>
          <h1>데이터를<br /><em>질문으로</em><br /><span class="hero-final-line">바꾸는 법.</span></h1>
          <p class="hero-copy">모델링의 언어와 SQL 문법을 연결해, 읽은 내용을 직접 실행할 수 있게 만든 SQLD 학습 아카이브입니다.</p>
          <a class="primary-link" href="/docs/${encodeURIComponent(docs[0]?.slug ?? "")}" data-nav>첫 장부터 읽기 <span>↗</span></a>
        </div>
        <div class="hero-signal" aria-label="학습 아카이브 통계">
          <div class="signal-ring"><span>${state.manifest.length}</span><small>자료</small></div>
          <div class="signal-lines"><span>모델링</span><span>질의</span><span>실행</span></div>
        </div>
      </div>
      <div class="home-rule"><span>목차 / 00—03</span><span>최근 반영 / 2026.08.13</span></div>
      <section class="section-block">
        <div class="section-heading"><span class="section-index">01</span><div><p class="eyebrow">쿼리 전에 보는 지도</p><h2>이 노트의 구조</h2></div></div>
        <div class="section-grid">
          ${sections.filter((section) => section !== "00 / 참고 노트").map((section, index) => {
            const sectionDocs = docs.filter((item) => item.section === section);
            return `<a class="section-card" href="/docs/${encodeURIComponent(sectionDocs[0]?.slug ?? "")}" data-nav><span class="card-number">0${index + 1}</span><strong>${escapeHtml(section.replace(/^\d+ \/ /, ""))}</strong><span>${sectionDocs.length}개 노트</span><i>↗</i></a>`;
          }).join("")}
        </div>
      </section>
      <section class="section-block practice-block">
        <div class="section-heading"><span class="section-index">02</span><div><p class="eyebrow">읽고 바로 실행하기</p><h2>손으로 확인하는 실습</h2></div></div>
        <div class="practice-list">
          ${latest.map((item, index) => `<a class="practice-row" href="/docs/${encodeURIComponent(item.slug)}" data-nav><span>0${index + 1}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.sourcePath)}</small><i>↗</i></a>`).join("")}
        </div>
      </section>
      <footer class="home-footer"><span>SQLD 학습 노트</span><span>비밀번호 보호</span></footer>
    </div>
  `;
}

async function renderDoc(item: ManifestItem) {
  const main = document.querySelector<HTMLElement>("#main")!;
  const doc = await fetchDoc(item.slug);
  if (!doc) {
    renderNotFound();
    return;
  }
  const index = state.manifest.findIndex((candidate) => candidate.slug === item.slug);
  const previous = state.manifest[index - 1];
  const next = state.manifest[index + 1];
  main.innerHTML = `
    <article class="doc-page">
      <div class="doc-topline"><span>${escapeHtml(doc.section)}</span><span>${escapeHtml(doc.sourcePath)}</span></div>
      <div class="doc-layout">
        <div class="doc-body">
          <header class="doc-header"><p class="eyebrow">${escapeHtml(doc.section)}</p><h1 class="${doc.title.length >= 48 ? "long-title" : ""}">${escapeHtml(doc.title)}</h1><p class="doc-excerpt">${escapeHtml(doc.excerpt || "SQLD 학습 노트")}</p></header>
          <div class="prose">${doc.html}</div>
          ${isPracticeDoc(doc) ? renderPracticeWorkspace(doc) : ""}
          <nav class="pager" aria-label="문서 이동">
            ${previous ? `<a href="/docs/${encodeURIComponent(previous.slug)}" data-nav><small>이전 문서</small><strong>← ${escapeHtml(previous.title)}</strong></a>` : "<span></span>"}
            ${next ? `<a href="/docs/${encodeURIComponent(next.slug)}" data-nav class="pager-next"><small>다음 문서</small><strong>${escapeHtml(next.title)} →</strong></a>` : ""}
          </nav>
        </div>
        ${doc.toc.length ? `<aside class="toc" aria-label="현재 문서 목차"><p class="eyebrow">이 문서의 목차</p>${doc.toc.map((entry) => `<a href="#${escapeHtml(entry.id)}" data-toc-link data-heading-id="${escapeHtml(entry.id)}" class="toc-level-${entry.level}">${escapeHtml(entry.text)}</a>`).join("")}</aside>` : ""}
      </div>
    </article>
  `;
  highlightCode();
  if (isPracticeDoc(doc)) setupPracticeRunner(doc.sourcePath);
  updateActiveNav(item.slug);
  setupTocTracking();
  scrollToRoutePosition();
}

function isPracticeDoc(doc: Doc) {
  return (doc.sourcePath.startsWith("3-실습/3-") && doc.sourcePath.includes("실습 문제")) || doc.sourcePath === "public/practice-demo";
}

function renderPracticeWorkspace(doc: Doc) {
  const schema = doc.html.match(/<details class="practice-schema-reference"[\s\S]*?<\/details>/)?.[0] ?? "";
  return `
    ${schema ? `<section class="practice-schema-repeat" aria-labelledby="practice-schema-repeat-title">
      <p class="eyebrow">쿼리 작성 전 확인</p>
      <h2 id="practice-schema-repeat-title">스키마 다시 보기</h2>
      <p>필요한 테이블과 컬럼을 확인한 뒤 아래 실행기에서 쿼리를 작성하세요.</p>
      ${schema}
    </section>` : ""}
    ${renderPracticeRunner()}
  `;
}

function renderPracticeRunner() {
  return `
    <section class="practice-runner" data-practice-runner aria-labelledby="practice-runner-title">
      <div class="practice-runner-head">
        <div>
          <p class="eyebrow">브라우저 SQL 실습</p>
          <h2 id="practice-runner-title">이 페이지의 문제를 바로 실행하기</h2>
          <p>PostgreSQL 엔진과 실습 데이터를 브라우저 안에 준비해 쿼리를 실행하고 결과를 정답과 비교합니다.</p>
        </div>
        <span class="practice-badge">POSTGRESQL / WASM</span>
      </div>
      <div class="practice-runner-gate" data-practice-gate>
        <div>
          <strong>실행기를 준비하면 이 페이지에서 바로 풀 수 있습니다.</strong>
          <span>실습 DB는 메모리에서만 동작하며 페이지를 나가면 사라집니다.</span>
        </div>
        <button class="primary-button" type="button" data-practice-start>실행기 준비</button>
      </div>
    </section>
  `;
}

function setupPracticeRunner(sourcePath: string) {
  const root = document.querySelector<HTMLElement>("[data-practice-runner]");
  const startButton = root?.querySelector<HTMLButtonElement>("[data-practice-start]");
  if (!root || !startButton) return;
  startButton.addEventListener("click", () => void initializePracticeRunner(root, sourcePath));
}

async function initializePracticeRunner(root: HTMLElement, sourcePath: string) {
  const gate = root.querySelector<HTMLElement>("[data-practice-gate]");
  const startButton = root.querySelector<HTMLButtonElement>("[data-practice-start]");
  if (!gate || !startButton || root.dataset.ready === "true") return;

  root.dataset.ready = "loading";
  startButton.disabled = true;
  startButton.textContent = "PostgreSQL 준비 중…";
  try {
    const practice = await fetchPractice();
    if (!practice) throw new Error("실습 문제 정보를 불러오지 못했습니다.");
    const challenges = practice.challenges.filter((challenge) => challenge.sourcePath === sourcePath);
    if (!challenges.length) throw new Error("이 페이지에 연결된 실습 문제가 없습니다.");

    const schema = await fetchAsset(practice.setup.schemaSlug);
    const seed = await fetchAsset(practice.setup.seedSlug);
    if (!schema || !seed) throw new Error("실습 DB 초기화 파일을 불러오지 못했습니다.");

    const { createBrowserPracticeRunner } = await import("./practice-runner");
    const runtime = await createBrowserPracticeRunner(schema.code, seed.code);
    cleanupPracticeRunner = () => {
      void runtime.close().catch(() => {});
    };
    root.dataset.ready = "true";
    renderPracticeEditor(root, challenges, runtime);
  } catch (error) {
    root.dataset.ready = "";
    gate.classList.add("is-error");
    gate.innerHTML = `<div><strong>실행기를 준비하지 못했습니다.</strong><span>${escapeHtml(errorMessage(error))}</span></div><button class="secondary-button" type="button" data-practice-retry>다시 시도</button>`;
    gate.querySelector<HTMLButtonElement>("[data-practice-retry]")?.addEventListener("click", () => {
      gate.classList.remove("is-error");
      gate.innerHTML = `<div><strong>실행기를 준비하면 이 페이지에서 바로 풀 수 있습니다.</strong><span>실습 DB는 메모리에서만 동작하며 페이지를 나가면 사라집니다.</span></div><button class="primary-button" type="button" data-practice-start>실행기 준비</button>`;
      setupPracticeRunner(sourcePath);
    });
  }
}

function renderPracticeEditor(
  root: HTMLElement,
  challenges: PracticeChallenge[],
  runtime: { check: (challenge: PracticeChallenge, source: string) => Promise<PracticeCheckResult> }
) {
  root.innerHTML = `
    <div class="practice-runner-head">
      <div>
        <p class="eyebrow">브라우저 SQL 실습</p>
        <h2 id="practice-runner-title">문제를 선택하고 실행해 보세요</h2>
        <p>정답 SQL은 화면에 노출하지 않고, 실행 결과만 비교합니다. 매번 초기 데이터에서 다시 시작합니다.</p>
      </div>
      <span class="practice-badge">POSTGRESQL / WASM</span>
    </div>
    <div class="practice-toolbar">
      <label for="practice-challenge">문제 선택</label>
      <select id="practice-challenge" data-practice-select>
        ${challenges.map((challenge) => `<option value="${escapeHtml(challenge.id)}">${escapeHtml(challenge.title)}</option>`).join("")}
      </select>
      <span class="practice-count">${challenges.length}문제 / 결과 비교</span>
    </div>
    <div class="practice-prompt">
      <p class="eyebrow" data-practice-number></p>
      <h3 data-practice-title></h3>
      <p data-practice-prompt></p>
      <dl class="practice-contract" data-practice-contract></dl>
    </div>
    <label class="practice-editor-label" for="practice-sql">SQL 입력</label>
    <textarea id="practice-sql" class="practice-editor" data-practice-input spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
    <div class="practice-actions">
      <button class="primary-button" type="button" data-practice-run>쿼리 실행·정답 확인</button>
      <button class="secondary-button" type="button" data-practice-clear>입력 비우기</button>
      <span class="practice-status is-ready" data-practice-status role="status">실행하면 이 자리에서 결과를 확인합니다.</span>
    </div>
    <div class="practice-result" data-practice-result hidden></div>
  `;

  const select = root.querySelector("[data-practice-select]") as unknown as HTMLSelectElement;
  const input = root.querySelector<HTMLTextAreaElement>("[data-practice-input]")!;
  const title = root.querySelector<HTMLElement>("[data-practice-title]")!;
  const number = root.querySelector<HTMLElement>("[data-practice-number]")!;
  const prompt = root.querySelector<HTMLElement>("[data-practice-prompt]")!;
  const contract = root.querySelector<HTMLElement>("[data-practice-contract]")!;
  const runButton = root.querySelector<HTMLButtonElement>("[data-practice-run]")!;
  const clearButton = root.querySelector<HTMLButtonElement>("[data-practice-clear]")!;
  const status = root.querySelector<HTMLElement>("[data-practice-status]")!;
  const result = root.querySelector<HTMLElement>("[data-practice-result]")!;

  const currentChallenge = () => challenges.find((challenge) => challenge.id === select.value) ?? challenges[0];
  const selectChallenge = () => {
    const challenge = currentChallenge();
    number.textContent = `문제 ${challenge.number}`;
    title.textContent = challenge.title.replace(/^\S+\.\s*/, "");
    prompt.innerHTML = escapeHtml(challenge.prompt).replace(/\n/g, "<br />");
    contract.innerHTML = `
      <div><dt>결과 컬럼</dt><dd>${challenge.expectedColumns.map((column) => `<code>${escapeHtml(column)}</code>`).join("")}</dd></div>
      ${challenge.relations.length ? `<div><dt>관련 테이블·뷰</dt><dd>${challenge.relations.map((relation) => `<code>${escapeHtml(relation)}</code>`).join("")}</dd></div>` : ""}
    `;
    input.value = buildPracticeStarter(challenge);
    result.hidden = true;
    result.innerHTML = "";
    status.className = "practice-status is-ready";
    status.textContent = "실행하면 이 자리에서 결과를 확인합니다.";
  };

  select.addEventListener("change", selectChallenge);
  clearButton.addEventListener("click", () => {
    input.value = buildPracticeStarter(currentChallenge());
    input.focus();
  });
  runButton.addEventListener("click", async () => {
    const challenge = currentChallenge();
    runButton.disabled = true;
    select.disabled = true;
    status.className = "practice-status is-running";
    status.textContent = "실행 중…";
    result.hidden = true;
    try {
      const checked = await runtime.check(challenge, input.value);
      renderPracticeResult(result, status, checked);
    } finally {
      runButton.disabled = false;
      select.disabled = false;
    }
  });
  selectChallenge();
}

function buildPracticeStarter(challenge: PracticeChallenge) {
  const searchPath = challenge.solution.match(/^\s*(SET\s+search_path\s+TO\s+[^;]+;)/i)?.[1];
  return searchPath ? `${searchPath}\n\n` : "";
}

function renderPracticeResult(result: HTMLElement, status: HTMLElement, checked: PracticeCheckResult) {
  status.className = `practice-status is-${checked.status}`;
  status.textContent = `${checked.message} (${checked.elapsedMs}ms)`;
  const table = checked.fields.length
    ? `<div class="practice-result-table"><table><thead><tr>${checked.fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead><tbody>${checked.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(formatPracticeCell(cell))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${checked.fields.length}">조회 결과가 0행입니다.</td></tr>`}</tbody></table></div>`
    : "";
  const rowSummary = checked.expectedRowCount === undefined ? "" : `<span>정답 기준 ${checked.expectedRowCount}행 · 내 결과 ${checked.rows.length}행</span>`;
  result.innerHTML = `<div class="practice-result-card is-${checked.status}"><strong>${escapeHtml(checked.status === "correct" ? "정답" : checked.status === "wrong" ? "결과 확인" : "실행 오류")}</strong>${rowSummary}${table}${checked.status === "error" ? `<pre>${escapeHtml(checked.message)}</pre>` : ""}</div>`;
  result.hidden = false;
}

function formatPracticeCell(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function fetchPractice() {
  if (state.practice) return state.practice;
  let pending = state.practicePromise;
  if (!pending) {
    pending = fetch("/api/practice", { credentials: "same-origin" }).then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as PracticeBundle;
    });
    state.practicePromise = pending;
  }
  try {
    const practice = await pending;
    state.practice = practice;
    return practice;
  } finally {
    if (state.practicePromise === pending) state.practicePromise = null;
  }
}

async function renderAsset(item: ManifestItem) {
  const asset = await fetchAsset(item.slug);
  if (!asset) {
    renderNotFound();
    return;
  }
  document.querySelector<HTMLElement>("#main")!.innerHTML = `
    <article class="doc-page asset-page">
      <div class="doc-topline"><span>${escapeHtml(asset.section)}</span><span>${escapeHtml(asset.sourcePath)}</span></div>
      <header class="doc-header"><p class="eyebrow">실습 코드 / ${escapeHtml(asset.language || "text")}</p><h1>${escapeHtml(asset.title)}</h1><p class="doc-excerpt">실습 환경에서 사용하는 코드 파일입니다.</p></header>
      <div class="code-toolbar"><span>${escapeHtml(asset.sourcePath)}</span><button type="button" data-copy-code>코드 복사</button></div>
      <pre class="standalone-code"><code>${escapeHtml(asset.code)}</code></pre>
    </article>
  `;
  document.querySelector<HTMLButtonElement>("[data-copy-code]")!.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(asset.code);
    (event.currentTarget as HTMLButtonElement).textContent = "복사됨";
  });
  updateActiveNav(item.slug);
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

function renderNotFound() {
  document.querySelector<HTMLElement>("#main")!.innerHTML = `<div class="empty-state"><p class="eyebrow">404 / 문서 없음</p><h1>문서를 찾을 수 없습니다.</h1><a class="primary-link" href="/" data-nav>홈으로 돌아가기 ↗</a></div>`;
}

async function fetchDoc(slug: string) {
  if (state.docs.has(slug)) return state.docs.get(slug)!;
  const response = await fetch(`/api/doc/${encodeURIComponent(slug)}`, { credentials: "same-origin" });
  if (!response.ok) return null;
  const doc = await response.json() as Doc;
  state.docs.set(slug, doc);
  return doc;
}

async function fetchAsset(slug: string) {
  if (state.assets.has(slug)) return state.assets.get(slug)!;
  const response = await fetch(`/api/asset/${encodeURIComponent(slug)}`, { credentials: "same-origin" });
  if (!response.ok) return null;
  const asset = await response.json() as Asset;
  state.assets.set(slug, asset);
  return asset;
}

function updateActiveNav(slug: string) {
  document.querySelectorAll<HTMLElement>(".nav-item").forEach((link) => link.classList.toggle("active", link.dataset.slug === slug));
}

function handleNavigation(event: MouseEvent) {
  const tocLink = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-toc-link]");
  if (tocLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    const headingId = tocLink.dataset.headingId;
    if (!headingId) return;
    const heading = document.getElementById(headingId);
    if (!heading) return;
    setActiveTocLink(headingId);
    history.replaceState(history.state, "", tocLink.href);
    heading.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
    return;
  }

  const target = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-nav]");
  if (!target || target.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState({}, "", target.href);
  void route();
}

function setupTocTracking() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[data-toc-link]")];
  const entries = links
    .map((link) => ({ link, heading: document.getElementById(link.dataset.headingId || "") }))
    .filter((entry): entry is { link: HTMLAnchorElement; heading: HTMLElement } => Boolean(entry.heading));
  if (!entries.length) return;

  let frameId = 0;
  const update = () => {
    frameId = 0;
    const readingLine = Math.min(180, window.innerHeight * .24);
    let current = entries[0];
    for (const entry of entries) {
      if (entry.heading.getBoundingClientRect().top <= readingLine) current = entry;
      else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = entries.at(-1)!;
    }
    setActiveTocLink(current.heading.id);
  };
  const schedule = () => {
    if (!frameId) frameId = window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
  clearTocTracking = () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frameId) window.cancelAnimationFrame(frameId);
    clearTocTracking = () => {};
  };
}

function setActiveTocLink(headingId: string) {
  document.querySelectorAll<HTMLAnchorElement>("a[data-toc-link]").forEach((link) => {
    const active = link.dataset.headingId === headingId;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function scrollToRoutePosition() {
  const headingId = decodeURIComponent(window.location.hash.slice(1));
  const heading = headingId ? document.getElementById(headingId) : null;
  if (!heading) {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    return;
  }
  window.requestAnimationFrame(() => {
    heading.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    setActiveTocLink(headingId);
  });
}

function readSidebarState() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setSidebarCollapsed(collapsed: boolean, persist = true) {
  const frame = document.querySelector<HTMLElement>(".site-frame");
  const button = document.querySelector<HTMLButtonElement>("#sidebar-toggle");
  const icon = button?.querySelector<HTMLElement>(".sidebar-toggle-icon");
  if (!frame || !button) return;

  frame.classList.toggle("sidebar-collapsed", collapsed);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? "왼쪽 목차 펼치기" : "왼쪽 목차 접기");
  if (icon) icon.textContent = collapsed ? "⇥" : "⇤";
  if (!persist) return;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    return;
  }
}

async function handleSubmit(event: SubmitEvent) {
  const form = event.target as HTMLFormElement;
  if (form.id !== "login-form") return;
  event.preventDefault();
  const input = form.elements.namedItem("password") as HTMLInputElement;
  const button = form.querySelector<HTMLButtonElement>("button")!;
  button.disabled = true;
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password: input.value })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "접속에 실패했습니다." })) as { error?: string };
    renderLogin(result.error || "접속에 실패했습니다.");
    return;
  }
  await boot();
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.id !== "search-input") return;
  state.query = input.value.trim().toLocaleLowerCase("ko-KR");
  const filtered = state.manifest.filter((item) => `${item.title} ${item.sourcePath} ${item.summary ?? ""}`.toLocaleLowerCase("ko-KR").includes(state.query));
  renderSearchResults(filtered);
}

function renderSearchResults(results: ManifestItem[]) {
  const nav = document.querySelector<HTMLElement>("#document-nav");
  if (!nav || !state.query) {
    renderNav();
    return;
  }
  nav.innerHTML = `<section class="nav-section search-results"><h3>검색 결과 / ${results.length}</h3>${results.map((item) => `<a href="/docs/${encodeURIComponent(item.slug)}" data-nav data-slug="${escapeHtml(item.slug)}" class="nav-item">${escapeHtml(item.title)}</a>`).join("") || `<p class="no-results">일치하는 문서가 없습니다.</p>`}</section>`;
}

function highlightCode() {
  document.querySelectorAll("pre code").forEach((code) => {
    code.innerHTML = escapeHtml(code.textContent || "");
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]!));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
