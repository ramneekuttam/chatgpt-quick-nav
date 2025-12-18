// ChatGPT Quick Navigator v0.3.0: content.js
(function () {
  const SIDEBAR_ID = "qn-sidebar";
  const TOGGLE_ID = "qn-toggle";
  const HIGHLIGHT_CLASS = "qn-highlight";
  const STORAGE_KEY_STATE = "qn_isOpen";
  const ATTR_QN_ID = "data-qn-id";
  
  // Default sidebar width used for pushing content
  let sidebarWidth = 320; 

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

  function snippet(text, maxChars = 100) {
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
    setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 2000);
  }

  // --- Layout Shifting Logic ---
  // We need to find the main content wrapper and squeeze it
  function updateMainLayout(isOpen) {
    // The user specified ID "main", but we add fallback just in case
    const mainEl = document.getElementById("main") || document.querySelector("main");
    
    if (mainEl) {
      mainEl.style.transition = "margin-right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
      if (isOpen) {
        mainEl.style.marginRight = `${sidebarWidth}px`;
      } else {
        mainEl.style.marginRight = "0px";
      }
    }
  }

  // --- Sidebar UI ---
  function injectSidebar() {
    const sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.className = "qn-root qn-hidden"; // Start hidden by default logic in init()

    sidebar.innerHTML = `
      <div class="qn-header">
        <div class="qn-title">Navigation</div>
        <div class="qn-actions">
          <button id="qn-refresh" title="Refresh List">↻</button>
          <button id="qn-close" title="Close Sidebar (Alt+V)">✕</button>
        </div>
      </div>
      <div id="qn-list" class="qn-list"></div>
      <div class="qn-footer">
        <label class="qn-checkbox">
          <input type="checkbox" id="qn-include-assistant"> Include AI Replies
        </label>
      </div>
      <div class="qn-resize-grip"></div>
    `;

    const toggleBtn = document.createElement("button");
    toggleBtn.id = TOGGLE_ID;
    toggleBtn.innerHTML = `Quick Nav <span class="shortcut-hint">Alt+V</span>`;
    toggleBtn.title = "Toggle Navigator";

    document.documentElement.appendChild(sidebar);
    document.documentElement.appendChild(toggleBtn);

    // Event: Toggle Sidebar
    const toggleAction = () => {
      const isHidden = sidebar.classList.contains("qn-hidden");
      if (isHidden) {
        sidebar.classList.remove("qn-hidden");
        updateMainLayout(true);
        localStorage.setItem(STORAGE_KEY_STATE, "true");
      } else {
        sidebar.classList.add("qn-hidden");
        updateMainLayout(false);
        localStorage.setItem(STORAGE_KEY_STATE, "false");
      }
    };

    toggleBtn.addEventListener("click", toggleAction);
    sidebar.querySelector("#qn-close").addEventListener("click", toggleAction);

    // Event: Refresh & Filters
    sidebar.querySelector("#qn-refresh").addEventListener("click", buildList);
    sidebar.querySelector("#qn-include-assistant").addEventListener("change", buildList);

    // Event: Keyboard Shortcut (Alt + V)
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.code === "KeyV") {
        e.preventDefault();
        toggleAction();
      }
    });

    // Event: Resize Logic
    const grip = sidebar.querySelector(".qn-resize-grip");
    let resizing = false;
    
    grip.addEventListener("mousedown", (e) => {
      e.preventDefault();
      resizing = true;
      document.body.style.cursor = "ew-resize";
    });

    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      // Calculate new width (from right)
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 200 && newWidth < 600) {
        sidebarWidth = newWidth;
        sidebar.style.width = sidebarWidth + "px";
        // Also update main layout immediately if open
        if (!sidebar.classList.contains("qn-hidden")) {
           updateMainLayout(true);
        }
      }
    });

    window.addEventListener("mouseup", () => {
      if (resizing) {
        resizing = false;
        document.body.style.cursor = "";
      }
    });

    return { sidebar, toggleBtn, toggleAction };
  }

  function getMessageNodes(includeAssistant = false) {
    const selector = includeAssistant
      ? '[data-message-author-role="user"], [data-message-author-role="assistant"]'
      : '[data-message-author-role="user"]';
    
    let nodes = Array.from(document.querySelectorAll(selector));

    // Fallback for different DOM structures
    if (!nodes.length) {
      // Sometimes ChatGPT changes attributes; look for generic article containers
      nodes = Array.from(document.querySelectorAll("main article"));
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
      const role = node.getAttribute("data-message-author-role") || "unknown";

      const item = document.createElement("div");
      item.className = "qn-item";
      item.setAttribute("data-role", role);
      
      item.innerHTML = `
        <div class="qn-who">${role}</div>
        <div class="qn-label">${snippet(text)}</div>
      `;
      
      item.addEventListener("click", () => scrollToMarker(id));
      list.appendChild(item);
    });

    if (!list.children.length) {
      list.innerHTML = `<div class="qn-empty">No messages found.<br>Try refreshing or sending a message.</div>`;
    }
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      // Debounce slightly
      if (observe._pending) return;
      observe._pending = true;
      setTimeout(() => {
        buildList();
        observe._pending = false;
      }, 1000);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    if (!isOnChatGPT()) return;

    const { sidebar } = injectSidebar();

    // 1. Check LocalStorage for previous state
    const savedState = localStorage.getItem(STORAGE_KEY_STATE);
    
    // 2. Apply State (Default is closed if null)
    if (savedState === "true") {
      sidebar.classList.remove("qn-hidden");
      updateMainLayout(true);
    } else {
      sidebar.classList.add("qn-hidden");
      updateMainLayout(false); // Ensure main is at 0
    }

    // 3. Wait for content to load
    for (let i = 0; i < 10; i++) {
      await sleep(300);
      if (getMessageNodes(true).length) break;
    }
    
    buildList();
    observe();
  }

  init();
})();
