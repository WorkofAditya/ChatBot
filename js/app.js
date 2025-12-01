// IndexedDB Wrapper
const DB_NAME = "VaultDB";
const STORE_NAME = "documents";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Wait for a transaction to complete (native IndexedDB)
function waitForTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}


async function saveDocToDB(doc) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const req = store.add(doc);

  const id = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Wait for tx to fully complete (safety)
  await waitForTx(tx);

  return id; // returned autoIncrement id
}


async function getAllDocs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}

async function clearVaultDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await waitForTx(tx);
}

// DOM Elements
const chatbox = document.getElementById('chatbox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const addDocBtn = document.getElementById('addDocBtn');
const popup = document.getElementById('popup');
const saveDocBtn = document.getElementById('saveDocBtn');
const cancelBtn = document.getElementById('cancelBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

async function generatePdfThumbnail(pdfDataURL) {
  const pdf = await pdfjsLib.getDocument({ url: pdfDataURL }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  return canvas.toDataURL();
}

function renderFile(doc) {
  if (!doc.file) return;

  if (doc.file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = doc.file.data;
    img.alt = doc.file.name;
    img.style.maxWidth = "180px";
    img.style.borderRadius = "10px";
    img.style.marginTop = "6px";
    img.style.display = "block";
    img.style.cursor = "pointer";

    img.addEventListener("click", () => {
      imgModalContent.src = doc.file.data;
      imgModal.style.display = "flex";
    });

    chatbox.appendChild(img);

    const downloadLink = document.createElement("a");
    downloadLink.href = doc.file.data;
    downloadLink.download = doc.file.name;
    downloadLink.textContent = `Download ${doc.file.name}`;
    downloadLink.style.display = "inline-block";
    downloadLink.style.marginTop = "6px";
    downloadLink.style.color = "#8ab4ff";
    chatbox.appendChild(downloadLink);
    return;
  }

  // PDF
  if (doc.file.type === "application/pdf") {
    const canvas = document.createElement("canvas");
    canvas.style.width = "180px";
    canvas.style.borderRadius = "10px";
    canvas.style.marginTop = "6px";
    canvas.style.cursor = "pointer";
    chatbox.appendChild(canvas);

    // If thumbnail already cached use it 
    if (doc.pdfThumb) {
      const img = new Image();
      img.src = doc.pdfThumb;

      img.onload = () => {
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };

    } else {
      // Generate thumbnail and cache it
      const loadingTask = pdfjsLib.getDocument({
        data: atob(doc.file.data.split(",")[1])
      });

      loadingTask.promise.then(pdf => {
        pdf.getPage(1).then(page => {
          const viewport = page.getViewport({ scale: 0.3 });
          const ctx = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          page.render({ canvasContext: ctx, viewport: viewport }).promise.then(() => {
            // SAVE THUMBNAIL 
            const thumbData = canvas.toDataURL("image/png");
            doc.pdfThumb = thumbData;   // cached
            updateDocument(doc.id, { pdfThumb: thumbData }); // DB update
          });
        });
      });
    }

    // Download Link
    const downloadLink = document.createElement("a");
    downloadLink.href = doc.file.data;
    downloadLink.download = doc.file.name;
    downloadLink.textContent = `Download ${doc.file.name}`;
    downloadLink.style.display = "inline-block";
    downloadLink.style.marginTop = "6px";
    downloadLink.style.color = "#8ab4ff";
    chatbox.appendChild(downloadLink);

    return;
  }

  const link = document.createElement("a");
  link.href = doc.file.data;
  link.download = doc.file.name;
  link.textContent = `Download ${doc.file.name}`;
  link.style.display = "inline-block";
  link.style.marginTop = "6px";
  link.style.color = "#8ab4ff";
  chatbox.appendChild(link);
}

function updateDocument(id, updates) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const doc = getReq.result;
      Object.assign(doc, updates);
      store.put(doc);
    };
  };
}

// Helper Functions
function addMessage(content, sender) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'user-message' : 'bot-message';

  // Render HTML if content contains <br> or <a> or <img>
  if (typeof content === "string" && (content.includes("<br>") || content.includes("<a") || content.includes("<img"))) {
    div.innerHTML = content;
  } else {
    div.textContent = content;
  }

  chatbox.appendChild(div);

  // Auto-scroll
  setTimeout(() => {
    chatbox.scrollTop = chatbox.scrollHeight;
  }, 1000);
}


let vault = [];
(async () => {
  vault = await getAllDocs();
})();


function findDoc(query) {
  query = query.toLowerCase();
  return vault.filter(d => d.name.toLowerCase().includes(query));
}

// Typing Animation
function showTyping() {
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = `<span></span><span></span><span></span>`;
  chatbox.appendChild(typing);
  chatbox.scrollTop = chatbox.scrollHeight;
  return typing;
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// Toast Feedback 
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Chat Logic 
sendBtn.onclick = () => {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  userInput.value = '';

  const typingEl = showTyping();

  setTimeout(() => {
    removeTyping(typingEl);

    // Conversational handling
const lower = text.toLowerCase();

// Greetings
const greetings = ["hi", "hello", "hey", "hola", "yo", "sup", "good morning", "good evening"];
if (greetings.some(g => lower === g || lower.startsWith(g))) {
  addMessage("Hello! How can I help you today?", "bot");
  return;
}

// Natural language doc requests
const intentWords = ["give me", "give me my", "show me", "show me my", "open", "get", "my", "card", "file", "document", "info"];
if (intentWords.some(w => lower.includes(w))) {
  // Extract keyword
  const keyword = lower
    .replace("give me", "")
    .replace("give me my", "")
    .replace("show me", "")
    .replace("show me my", "")
    .replace("open", "")
    .replace("get", "")
    .replace("my", "")
    .trim();

  const intentMatches = findDoc(keyword);

  if (intentMatches.length > 0) {
    intentMatches.forEach((doc, index) => {
  let reply = `${index + 1}. ${doc.name}: ${doc.value}`;
  if (doc.info) reply += `<br>${doc.info}`;
  addMessage(reply, "bot");

  renderFile(doc);

});

    return;
  }
}

// SHOW ALL DOCUMENTS COMMAND
const showAllCmds = [
  "show all",
  "show all documents",
  "show my documents",
  "show my docs",
  "list all",
  "list documents",
  "list all documents",
  "show everything",
  "all documents",
  "all files",
  "my documents",
  "my files"
];

if (showAllCmds.some(cmd => lower === cmd || lower.includes(cmd))) {

  if (vault.length === 0) {
    addMessage("Your vault is empty. Add a document first!", "bot");
    return;
  }

  addMessage(`You have ${vault.length} stored documents:`, "bot");

  vault.forEach((doc, index) => {
    let reply = `${index + 1}. ${doc.name}: ${doc.value}`;
    if (doc.info) reply += `<br>${doc.info}`;
    addMessage(reply, 'bot');

    // FILE HANDLING
    renderFile(doc);

  });

  return; // prevent normal search
}


    const matches = findDoc(text); // now returns multiple docs

    if (matches.length > 0) {
      matches.forEach((doc, index) => {
        let reply = `${index + 1}. ${doc.name}: ${doc.value}`;
        if (doc.info) reply += `<br>${doc.info}`;
        addMessage(reply, 'bot');

        renderFile(doc);

      });

      setTimeout(() => {
        chatbox.scrollTop = chatbox.scrollHeight;
      }, 200);
    } else {
      addMessage('No record found for that query.', 'bot');
    }
  }, 400 + Math.random() * 600); // Natural delay
};


// Pressing Enter also sends the message
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendBtn.click();
  }
});


// Add Document Popup
addDocBtn.onclick = () => {
  // Reset edit mode
  saveDocBtn.removeAttribute("data-edit-id");

  // Clear inputs (fresh add)
  document.getElementById("docName").value = "";
  document.getElementById("docValue").value = "";
  document.getElementById("docInfo").value = "";
  document.getElementById("docFile").value = "";

  // Open popup
  popup.style.display = "flex";
};

cancelBtn.onclick = () => (popup.style.display = 'none');

saveDocBtn.onclick = async () => {
  const editId = saveDocBtn.getAttribute("data-edit-id");
  const name = document.getElementById("docName").value.trim();
  const value = document.getElementById("docValue").value.trim();
  const info = document.getElementById("docInfo").value.trim();
  const fileInput = document.getElementById("docFile");
  const file = fileInput.files[0];

  if (!name) return showToast("Document name is required", "error");

  let fileData = null;
  if (file) {
    fileData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ name: file.name, type: file.type, data: reader.result });
      reader.readAsDataURL(file);
    });
  }
// EDIT
if (editId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // FIXED: store.get() does NOT return a promise
  const oldDoc = await new Promise((resolve) => {
    const r = store.get(Number(editId));
    r.onsuccess = () => resolve(r.result);
  });

  const updatedDoc = {
    ...oldDoc,
    name,
    value,
    info,
    file: fileData ? fileData : oldDoc.file,
  };

  const putReq = store.put(updatedDoc);

await new Promise((resolve, reject) => {
  putReq.onsuccess = () => resolve(putReq.result);
  putReq.onerror = () => reject(putReq.error);
});

// Wait for tx to complete
await waitForTx(tx);

// Reload vault so array matches DB contents
vault = await getAllDocs();

popup.style.display = "none";
saveDocBtn.removeAttribute("data-edit-id");



  addMessage(`${name} updated successfully.`, "bot");
  showToast("Document updated!", "success");
  return;
}

//add
  const newDoc = { name, value, info, file: fileData };
  await saveDocToDB(newDoc);
  vault = await getAllDocs();
  addMessage(`${name} was safely stored to vault.`, "bot");
  popup.style.display = "none";
  showToast("Document saved!", "success");

  document.getElementById("docName").value = "";
  document.getElementById("docValue").value = "";
  document.getElementById("docInfo").value = "";
  fileInput.value = "";

  saveDocBtn.removeAttribute("data-edit-id");
};

// Clear Vault
clearBtn.onclick = async () => {
  if (confirm('Are you sure you want to clear the vault?')) {
    await clearVaultDB();
    vault = [];
    addMessage('Vault cleared successfully.', 'bot');
    showToast('Vault cleared', 'success');
  }
};

// Export Vault
exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vault_backup.json';
  a.click();
  showToast('Vault exported', 'success');
};

// Import Vault
importBtn.onclick = () => importFile.click();

importFile.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);

      // Validate it’s an array
      if (!Array.isArray(data)) {
        alert("Invalid file format. Expected a list of documents.");
        return;
      }

      // Convert legacy entries (from old localStorage system)
      const converted = data.map(d => {
        return {
          name: d.name || "Unnamed",
          value: d.value || "",
          info: d.info || "",
          file: d.file || null, // may already be a DataURL or null
        };
      });

      // Save each document to IndexedDB
      for (const doc of converted) {
        await saveDocToDB(doc);
      }

      vault = await getAllDocs();
      addMessage("Vault imported successfully.", "bot");
      showToast("Vault imported successfully!", "success");
    } catch (err) {
      console.error("Import error:", err);
      alert("Invalid file format or corrupted JSON.");
    }
  };
  reader.readAsText(file);
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log("Service Worker Registered"))
      .catch((err) => console.error("Service Worker failed:", err));
  });
}

// Always show welcome message on page load
window.addEventListener("load", () => {
  addMessage(
    "Welcome to ChatBot",
    "bot"
  );
});

document.getElementById("editDocsBtn").onclick = async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
        const docs = req.result;
        const list = document.getElementById("editDocsList");
        list.innerHTML = "";

        docs.forEach(doc => {
            const item = document.createElement("div");
            item.className = "edit-doc-item";

            item.innerHTML = `
                <span><strong>${doc.name}</strong></span>
                <div class="edit-buttons">
                    <button class="edit-btn" data-id="${doc.id}">Edit</button>
                    <button class="delete-btn" data-id="${doc.id}">Delete</button>
                </div>
            `;

            list.appendChild(item);
        });

        document.getElementById("editPopup").style.display = "flex";
    };
};

document.getElementById("closeEditPopup").onclick = () => {
    document.getElementById("editPopup").style.display = "none";
};
  
document.getElementById("editDocsList").addEventListener("click", async (e) => {
    const target = e.target;

    // DELETE BUTTON
    if (target.classList.contains("delete-btn")) {
  const id = Number(target.dataset.id);

  if (!confirm("Are you sure you want to delete this document?")) {
    return; 
  }

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const delReq = store.delete(id);

  await new Promise((resolve, reject) => {
    delReq.onsuccess = () => resolve();
    delReq.onerror = () => reject(delReq.error);
  });

  await waitForTx(tx);

  const itemEl = target.closest('.edit-doc-item');
  if (itemEl) itemEl.remove();

  vault = await getAllDocs();

  showToast("Document deleted!", "success");
  return;
}


    // EDIT BUTTON
    if (target.classList.contains("edit-btn")) {
        const id = Number(target.dataset.id);

        const db = await openDB();
        const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => {
            const doc = req.result;

            // Fill popup fields
            document.getElementById("docName").value = doc.name;
            document.getElementById("docValue").value = doc.value;
            document.getElementById("docInfo").value = doc.info || "";
            document.getElementById("docFile").value = "";

            // Mark popup as EDIT MODE
            saveDocBtn.setAttribute("data-edit-id", id);

            // Close edit list
            document.getElementById("editPopup").style.display = "none";

            // Open form popup
            popup.style.display = "flex";
        };

        return;
    }
});

// About popup
const aboutPopup = document.getElementById("aboutPopup");
const aboutBtn = document.getElementById("aboutBtn");
const closeAbout = document.getElementById("closeAbout");

// Open About popup
aboutBtn.onclick = () => {
  aboutPopup.style.display = "flex";
};

// Close About popup
closeAbout.onclick = () => {
  aboutPopup.style.display = "none";
};

// Close when clicking outside the box
aboutPopup.onclick = e => {
  if (e.target === aboutPopup) aboutPopup.style.display = "none";
};

const openChangelogBtn = document.getElementById("openChangelogBtn");
const changelogPopup = document.getElementById("changelogPopup");
const closeChangelogBtn = document.getElementById("closeChangelogBtn");
const refreshChangelogBtn = document.getElementById("refreshChangelogBtn");
const changelogBody = document.getElementById("changelogBody");

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(text) {
  text = escapeHtml(text);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  return text;
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let out = "";
  let inCode = false;
  let codeBuffer = "";
  let inList = false;
  let listType = null;
  let paraBuffer = [];

  function flushPara() {
    if (paraBuffer.length === 0) return;
    out += `<p>${inlineFormat(paraBuffer.join(" "))}</p>\n`;
    paraBuffer = [];
  }

  function closeList() {
    if (!inList) return;
    out += `</${listType}>\n`;
    inList = false;
    listType = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (raw.trim().startsWith("```")) {
      if (!inCode) {
        flushPara();
        closeList();
        inCode = true;
        codeBuffer = "";
        continue;
      } else {
        out += `<pre><code>${escapeHtml(codeBuffer)}</code></pre>\n`;
        inCode = false;
        codeBuffer = "";
        continue;
      }
    }

    if (inCode) {
      codeBuffer += raw + "\n";
      continue;
    }

    const line = raw;

    if (/^---+$/.test(line.trim())) {
      flushPara();
      closeList();
      out += "<hr>\n";
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      flushPara();
      closeList();
      const level = hMatch[1].length;
      out += `<h${level}>${inlineFormat(hMatch[2].trim())}</h${level}>\n`;
      continue;
    }

    const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
    if (olMatch) {
      flushPara();
      if (!inList || listType !== "ol") {
        closeList();
        inList = true;
        listType = "ol";
        out += "<ol>\n";
      }
      out += `<li>${inlineFormat(olMatch[1].trim())}</li>\n`;
      continue;
    }

    const ulMatch = line.match(/^\s*[-+*]\s+(.*)/);
    if (ulMatch) {
      flushPara();
      if (!inList || listType !== "ul") {
        closeList();
        inList = true;
        listType = "ul";
        out += "<ul>\n";
      }
      out += `<li>${inlineFormat(ulMatch[1].trim())}</li>\n`;
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      closeList();
      continue;
    }

    paraBuffer.push(line.trim());
  }

  flushPara();
  closeList();
  if (inCode) out += `<pre><code>${escapeHtml(codeBuffer)}</code></pre>\n`;

  return out || "<p style='opacity:.6;'>No changelog content</p>";
}

async function fetchChangelogRaw() {
  const urls = [
    "https://raw.githubusercontent.com/WorkofAditya/ChatBot/refs/heads/main/CHANGELOG.md",
    "https://raw.githubusercontent.com/WorkofAditya/ChatBot/main/CHANGELOG.md"
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error("not ok");
      return await res.text();
    } catch (e) {}
  }
  throw new Error("fetch failed");
}

async function loadChangelogToPopup() {
  changelogBody.innerHTML = '<p style="opacity:.6;">Loading changelog…</p>';
  try {
    const md = await fetchChangelogRaw();
    const html = parseMarkdown(md);
    changelogBody.innerHTML = html;
    changelogBody.scrollTop = 0;
  } catch (err) {
    changelogBody.innerHTML = '<p style="opacity:.6;">Unable to load changelog.</p>';
  }
}

openChangelogBtn.addEventListener("click", () => {
  changelogPopup.style.display = "flex";
  loadChangelogToPopup();
});

closeChangelogBtn.addEventListener("click", () => {
  changelogPopup.style.display = "none";
});

refreshChangelogBtn.addEventListener("click", () => {
  loadChangelogToPopup();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") changelogPopup.style.display = "none";
});

changelogPopup.addEventListener("click", (e) => {
  if (e.target === changelogPopup) changelogPopup.style.display = "none";
});

const imgModal = document.getElementById("imgModal");
const imgModalContent = document.getElementById("imgModalContent");

// Close modal on background click
imgModal.addEventListener("click", (e) => {
  if (e.target === imgModal) imgModal.style.display = "none";
});

// Close modal on ESC
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") imgModal.style.display = "none";
});

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let out = "";
  let inCode = false;
  let codeBuffer = "";
  let inList = false;
  let listType = null;
  let paraBuffer = [];
  let inTable = false;
  let tableBuffer = [];

  function flushPara() {
    if (paraBuffer.length === 0) return;
    out += `<p>${inlineFormat(paraBuffer.join(" "))}</p>\n`;
    paraBuffer = [];
  }

  function closeList() {
    if (!inList) return;
    out += `</${listType}>\n`;
    inList = false;
    listType = null;
  }

  function flushTable() {
    if (!inTable) return;
    if (tableBuffer.length === 0) return;
    const header = tableBuffer[0].split("|").map(s => s.trim()).filter(s => s);
    out += "<table><thead><tr>";
    header.forEach(h => out += `<th>${inlineFormat(h)}</th>`);
    out += "</tr></thead><tbody>";
    for (let i = 2; i < tableBuffer.length; i++) {
      const row = tableBuffer[i].split("|").map(s => s.trim()).filter(s => s);
      out += "<tr>";
      row.forEach(c => out += `<td>${inlineFormat(c)}</td>`);
      out += "</tr>";
    }
    out += "</tbody></table>\n";
    inTable = false;
    tableBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (raw.trim().startsWith("```")) {
      flushPara(); closeList(); flushTable();
      inCode = !inCode;
      if (!inCode) out += `<pre><code>${escapeHtml(codeBuffer)}</code></pre>\n`;
      codeBuffer = "";
      continue;
    }

    if (inCode) { codeBuffer += raw + "\n"; continue; }

    if (/^\s*\|.*\|\s*$/.test(raw)) {
      if (!inTable) { flushPara(); closeList(); inTable = true; tableBuffer = []; }
      tableBuffer.push(raw);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (/^---+$/.test(raw.trim())) { flushPara(); closeList(); flushTable(); out += "<hr>\n"; continue; }
    const hMatch = raw.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) { flushPara(); closeList(); flushTable(); const level = hMatch[1].length; out += `<h${level}>${inlineFormat(hMatch[2].trim())}</h${level}>\n`; continue; }
    const olMatch = raw.match(/^\s*\d+\.\s+(.*)/);
    if (olMatch) { flushPara(); flushTable(); if (!inList || listType !== "ol") { closeList(); inList = true; listType = "ol"; out += "<ol>\n"; } out += `<li>${inlineFormat(olMatch[1].trim())}</li>\n`; continue; }
    const ulMatch = raw.match(/^\s*[-+*]\s+(.*)/);
    if (ulMatch) { flushPara(); flushTable(); if (!inList || listType !== "ul") { closeList(); inList = true; listType = "ul"; out += "<ul>\n"; } out += `<li>${inlineFormat(ulMatch[1].trim())}</li>\n`; continue; }

    if (raw.trim() === "") { flushPara(); closeList(); flushTable(); continue; }
    paraBuffer.push(raw.trim());
  }

  flushPara(); closeList(); flushTable();
  if (inCode) out += `<pre><code>${escapeHtml(codeBuffer)}</code></pre>\n`;

  return out || "<p style='opacity:.6;'>No changelog content</p>";
}
