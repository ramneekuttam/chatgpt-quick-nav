// ChatGPT Quick Navigator v0.2.1: content.js
(function () {
  const SIDEBAR_ID = "qn-sidebar";
  const TOGGLE_ID = "qn-toggle";
  const HIGHLIGHT_CLASS = "qn-highlight";
  const ITEM_CLASS = "qn-item";
  const ROOT_CLASS = "qn-root";
  const ATTR_QN_ID = "data-qn-id";

  if (document.getElementById(SIDEBAR_ID)) return;

  // --- Utilities ---
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_\-]/g, "_"));

  function isOnChatGPT() {
    return /chatgpt\.com|chat\.openai\.com/.test(location.host);
  }

  function normalizeText(text) {
    return (text || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function snippet(text, maxChars = 280) {
    const t = normalizeText(text);
    if (t.length <= maxChars) return t;
    return t.slice(0, maxChars - 1) + "…";
  }

  function makeId() {
    return "qn-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
  }

  function ensureMarker(el) {
    if (!el.getAttribute(ATTR_QN_ID)) {
      el.setAttribute(ATTR_QN_ID, makeId());
    }
    return el.getAttribute(ATTR_QN_ID);
  }

  function scrollToMarker(id) {
    const el = document.querySelector(`[${ATTR_QN_ID}="${cssEscape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(HIGHLIGHT_CLASS);
    setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 1500);
  }

  // --- Sidebar UI ---
  function injectSidebar() {
    const sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.className = ROOT_CLASS;

    sidebar.innerHTML = `
      <div class="qn-header">
        <div class="qn-title">Quick Nav</div>
        <div class="qn-actions">
          <button id="qn-refresh" title="Re-scan messages">↻</button>
          <button id="qn-collapse" title="Collapse sidebar">⟨</button>
        </div>
      </div>
      <div id="qn-list" class="qn-list"></div>
      <div class="qn-footer">
        <label class="qn-checkbox">
          <input type="checkbox" id="qn-include-assistant"> include assistant replies
        </label>
      </div>
    `;

    const toggle = document.createElement("button");
    toggle.id = TOGGLE_ID;
    toggle.textContent = "Quick Nav";
    toggle.title = "Toggle Quick Navigator";

    document.documentElement.appendChild(sidebar);
    document.documentElement.appendChild(toggle);

    // Drag to resize
    let resizing = false;
    let startX = 0;
    let startW = 380;
    const grip = document.createElement("div");
    grip.className = "qn-resize-grip";
    sidebar.appendChild(grip);

    grip.addEventListener("mousedown", (e) => {
      e.preventDefault();
      resizing = true;
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      document.body.classList.add("qn-resizing");
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const dx = startX - e.clientX;
      const w = Math.min(Math.max(startW + dx, 260), 640);
      sidebar.style.width = w + "px";
    });
    window.addEventListener("mouseup", () => {
      resizing = false;
      document.body.classList.remove("qn-resizing");
    });

    // Handlers
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("qn-hidden");
    });
    sidebar.querySelector("#qn-collapse").addEventListener("click", () => {
      sidebar.classList.add("qn-hidden");
    });
    sidebar.querySelector("#qn-refresh").addEventListener("click", buildList);
    sidebar.querySelector("#qn-include-assistant").addEventListener("change", buildList);

    return sidebar;
  }

  function getMessageNodes(includeAssistant=false) {
    const selector = includeAssistant
      ? '[data-message-author-role="user"], [data-message-author-role="assistant"]'
      : '[data-message-author-role="user"]';
    let nodes = Array.from(document.querySelectorAll(selector));

    if (!nodes.length) {
      nodes = Array.from(document.querySelectorAll("main article"));
      if (!includeAssistant) {
        nodes = nodes.filter(n => !n.querySelector("code"));
      }
    }
    return nodes;
  }

  function buildList() {
    const includeAssistant = document.getElementById("qn-include-assistant")?.checked || false;
    const list = document.getElementById("qn-list");
    if (!list) return;

    list.innerHTML = "";
    const nodes = getMessageNodes(includeAssistant);
    nodes.forEach((node) => {
      const text = normalizeText((node.innerText || ""));
      if (!text) return;
      const id = ensureMarker(node);

      const item = document.createElement("button");
      item.className = ITEM_CLASS;
      const who = node.getAttribute("data-message-author-role") || "message";

      item.innerHTML = `
        <span class="qn-who">${who}</span>
        <span class="qn-label">${snippet(text, 280)}</span>
      `;
      item.addEventListener("click", () => scrollToMarker(id));
      list.appendChild(item);
    });

    if (!list.children.length) {
      const empty = document.createElement("div");
      empty.className = "qn-empty";
      empty.textContent = "No messages found yet.";
      list.appendChild(empty);
    }
  }

  function observe() {
    const observer = new MutationObserver(() => {
      if (observe._pending) return;
      observe._pending = true;
      requestAnimationFrame(() => {
        buildList();
        observe._pending = false;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    if (!isOnChatGPT()) return;
    injectSidebar();

    for (let i = 0; i < 10; i++) {
      await sleep(200);
      if (getMessageNodes(true).length) break;
    }
    buildList();
    observe();
  }

  init();
})();
