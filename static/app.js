(() => {
  const idKey = "document-rag-session-id";
  let sessionId = sessionStorage.getItem(idKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(idKey, sessionId);
  }

  const $ = (selector) => document.querySelector(selector);
  const filesInput = $("#files");
  const processButton = $("#process");
  const fileList = $("#file-list");
  const uploadStatus = $("#upload-status");
  const chatForm = $("#chat-form");
  const question = $("#question");
  const sendButton = $("#send");
  const messages = $("#messages");
  const apiKey = $("#api-key");
  const model = $("#model");
  const documentList = $("#document-list");
  const chatState = $("#chat-state");
  const exportButton = $("#export");
  let chosenFiles = [];
  let history = [];
  let ready = false;
  let busy = false;

  apiKey.value = sessionStorage.getItem("document-rag-groq-key") || "";
  apiKey.addEventListener("input", () => sessionStorage.setItem("document-rag-groq-key", apiKey.value));

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  }

  function setNotice(message, kind = "") {
    uploadStatus.textContent = message;
    uploadStatus.className = `notice ${kind}`;
  }

  function renderFiles() {
    fileList.replaceChildren();
    let total = 0;
    chosenFiles.forEach((file) => {
      total += file.size;
      const item = window.document.createElement("div");
      item.className = "file-item";
      const badge = window.document.createElement("span");
      badge.className = "file-badge";
      badge.textContent = file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "TXT";
      const name = window.document.createElement("span");
      name.textContent = `${file.name} · ${formatSize(file.size)}`;
      item.append(badge, name);
      fileList.append(item);
    });
    processButton.disabled = chosenFiles.length === 0 || total > 100 * 1024 * 1024 || busy;
    if (total > 100 * 1024 * 1024) setNotice("Combined files exceed the 100 MB limit.", "error");
    else if (chosenFiles.length) setNotice(`${chosenFiles.length} file(s) selected · ${formatSize(total)}`);
    else setNotice("");
  }

  function formatSize(size) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  filesInput.addEventListener("change", () => {
    chosenFiles = [...filesInput.files];
    renderFiles();
  });

  const dropzone = $(".dropzone");
  for (const eventName of ["dragenter", "dragover"]) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add("drag"); });
  for (const eventName of ["dragleave", "drop"]) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove("drag"); });
  dropzone.addEventListener("drop", (event) => {
    chosenFiles = [...event.dataTransfer.files].filter((file) => /\.(pdf|txt)$/i.test(file.name));
    renderFiles();
  });

  processButton.addEventListener("click", async () => {
    if (!chosenFiles.length || busy) return;
    busy = true;
    processButton.disabled = true;
    processButton.textContent = "Processing documents…";
    setNotice("Extracting text and adding vector embeddings to the persistent database. The first run downloads the local embedding model.");
    try {
      const form = new FormData();
      form.append("session_id", sessionId);
      chosenFiles.forEach((file) => form.append("files", file));
      const data = await api("/api/upload", { method: "POST", body: form });
      ready = true;
      question.disabled = false;
      sendButton.disabled = false;
      chatState.textContent = "Documents are ready";
      chatState.classList.add("ready");
      await loadDatabase();
      setNotice(data.message, "success");
    } catch (error) {
      setNotice(error.message, "error");
    } finally {
      busy = false;
      processButton.disabled = chosenFiles.length === 0;
      processButton.innerHTML = 'Process documents <span>→</span>';
    }
  });

  function clearMessages() {
    messages.replaceChildren();
    history = [];
    exportButton.hidden = true;
    const welcome = window.document.createElement("div");
    welcome.className = "welcome";
    const icon = window.document.createElement("div");
    icon.className = "sparkle";
    icon.textContent = "✳";
    const title = window.document.createElement("h3");
    title.textContent = "Your conversation starts here";
    const description = window.document.createElement("p");
    description.textContent = "Ask about key points, facts, or recommendations in your documents.";
    welcome.append(icon, title, description);
    messages.append(welcome);
  }

  async function loadDatabase() {
    const data = await api("/api/documents");
    documentList.replaceChildren();
    documentList.className = `document-list${data.documents.length ? "" : " empty"}`;
    if (!data.documents.length) {
      documentList.textContent = "No documents in the database yet.";
      ready = false;
      question.disabled = true;
      sendButton.disabled = true;
      chatState.textContent = "Upload documents to begin";
      chatState.classList.remove("ready");
      return;
    }
    data.documents.forEach((entry) => {
      const item = window.document.createElement("div");
      item.className = "doc-item";
      const badge = window.document.createElement("span");
      badge.className = "file-badge";
      badge.textContent = entry.file.toLowerCase().endsWith(".pdf") ? "PDF" : "TXT";
      const text = window.document.createElement("span");
      text.textContent = `${entry.file} · ${entry.chunks} chunks`;
      item.append(badge, text);
      documentList.append(item);
    });
    ready = true;
    question.disabled = false;
    sendButton.disabled = false;
    chatState.textContent = `${data.documents.length} document(s) · ${data.chunks} chunks`;
    chatState.classList.add("ready");
  }

  function addMessage(role, text, sources = []) {
    const wrapper = window.document.createElement("div");
    wrapper.className = `message ${role}`;
    const label = window.document.createElement("div");
    label.className = "role";
    label.textContent = role === "user" ? "You" : "Assistant";
    const bubble = window.document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    wrapper.append(label, bubble);
    if (sources.length) {
      const sourceLine = window.document.createElement("div");
      sourceLine.className = "sources";
      sourceLine.textContent = `Sources: ${sources.map((source) => source.page ? `${source.file}, page ${source.page}` : source.file).join(" · ")}`;
      wrapper.append(sourceLine);
    }
    messages.append(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = question.value.trim();
    if (!text || !ready || busy) return;
    if (messages.querySelector(".welcome")) messages.replaceChildren();
    addMessage("user", text);
    question.value = "";
    question.style.height = "auto";
    busy = true;
    question.disabled = true;
    sendButton.disabled = true;
    const wait = window.document.createElement("div");
    wait.className = "message assistant";
    wait.textContent = "Searching your documents…";
    messages.append(wait);
    try {
      const data = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question: text, model: model.value, api_key: apiKey.value || null }),
      });
      wait.remove();
      addMessage("assistant", data.answer, data.sources);
      history.push(`User: ${text}`, `Assistant: ${data.answer}`);
      exportButton.hidden = false;
    } catch (error) {
      wait.remove();
      addMessage("assistant", `I couldn't complete that request: ${error.message}`);
    } finally {
      busy = false;
      question.disabled = !ready;
      sendButton.disabled = !ready;
      question.focus();
    }
  });

  question.addEventListener("input", () => {
    question.style.height = "auto";
    question.style.height = `${Math.min(question.scrollHeight, 100)}px`;
  });
  question.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  $("#clear").addEventListener("click", async () => {
    try { await api("/api/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) }); } catch (_) { /* Reset the page even if the server restarted. */ }
    clearMessages();
    await loadDatabase();
  });

  $("#delete-database").addEventListener("click", async () => {
    if (!window.confirm("Delete every document and embedding from the persistent vector database? This cannot be undone.")) return;
    try {
      const data = await api("/api/database", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE ALL" }),
      });
      clearMessages();
      await loadDatabase();
      setNotice(`${data.message} (${data.deleted_chunks} chunks removed.)`, "success");
    } catch (error) {
      setNotice(error.message, "error");
    }
  });

  exportButton.addEventListener("click", () => {
    const content = history.join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `document-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  });

  loadDatabase().catch((error) => setNotice(`Could not read vector database: ${error.message}`, "error"));
  api(`/api/export/${encodeURIComponent(sessionId)}`).then((data) => {
    const savedHistory = data.history || [];
    for (let index = 0; index + 1 < savedHistory.length; index += 2) {
      const userLine = savedHistory[index];
      const assistantLine = savedHistory[index + 1];
      if (userLine.startsWith("User: ")) addMessage("user", userLine.slice(6));
      if (assistantLine.startsWith("Assistant: ")) addMessage("assistant", assistantLine.slice(11));
    }
    history = savedHistory;
    exportButton.hidden = history.length === 0;
  }).catch(() => {});
})();
