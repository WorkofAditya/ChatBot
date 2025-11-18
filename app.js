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

  // FILE HANDLING (IMPORTANT)
  if (doc.file) {
    if (doc.file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = doc.file.data;
      img.alt = doc.file.name;
      img.style.maxWidth = "180px";
      img.style.borderRadius = "10px";
      img.style.marginTop = "6px";
      img.style.display = "block";
      chatbox.appendChild(img);

      const downloadLink = document.createElement("a");
      downloadLink.href = doc.file.data;
      downloadLink.download = doc.file.name;
      downloadLink.textContent = `Download ${doc.file.name}`;
      downloadLink.style.display = "inline-block";
      downloadLink.style.marginTop = "6px";
      downloadLink.style.color = "#8ab4ff";
      chatbox.appendChild(downloadLink);

    } else {
      const link = document.createElement("a");
      link.href = doc.file.data;
      link.download = doc.file.name;
      link.textContent = `Download ${doc.file.name}`;
      link.style.display = "inline-block";
      link.style.marginTop = "6px";
      link.style.color = "#8ab4ff";
      chatbox.appendChild(link);
    }
  }
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
    if (doc.file) {
      if (doc.file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = doc.file.data;
        img.alt = doc.file.name;
        img.style.maxWidth = "180px";
        img.style.borderRadius = "10px";
        img.style.marginTop = "6px";
        img.style.display = "block";
        chatbox.appendChild(img);

        const downloadLink = document.createElement("a");
        downloadLink.href = doc.file.data;
        downloadLink.download = doc.file.name;
        downloadLink.textContent = `Download ${doc.file.name}`;
        downloadLink.style.display = "inline-block";
        downloadLink.style.marginTop = "6px";
        downloadLink.style.color = "#8ab4ff";
        chatbox.appendChild(downloadLink);

      } else {
        const link = document.createElement("a");
        link.href = doc.file.data;
        link.download = doc.file.name;
        link.textContent = `Download ${doc.file.name}`;
        link.style.display = "inline-block";
        link.style.marginTop = "6px";
        link.style.color = "#8ab4ff";
        chatbox.appendChild(link);
      }
    }
  });

  return; // prevent normal search
}


    const matches = findDoc(text); // now returns multiple docs

    if (matches.length > 0) {
      matches.forEach((doc, index) => {
        let reply = `${index + 1}. ${doc.name}: ${doc.value}`;
        if (doc.info) reply += `<br>${doc.info}`;
        addMessage(reply, 'bot');

        if (doc.file) {
          if (doc.file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = doc.file.data;
            img.alt = doc.file.name;
            img.style.maxWidth = '180px';
            img.style.borderRadius = '10px';
            img.style.marginTop = '6px';
            img.style.display = 'block';
            chatbox.appendChild(img);

            const downloadLink = document.createElement('a');
            downloadLink.href = doc.file.data;
            downloadLink.download = doc.file.name;
            downloadLink.textContent = `Download ${doc.file.name}`;
            downloadLink.style.display = 'inline-block';
            downloadLink.style.marginTop = '6px';
            downloadLink.style.color = '#8ab4ff';
            chatbox.appendChild(downloadLink);
          } else {
            const link = document.createElement('a');
            link.href = doc.file.data;
            link.download = doc.file.name;
            link.textContent = `Download ${doc.file.name}`;
            link.style.display = 'inline-block';
            link.style.marginTop = '6px';
            link.style.color = '#8ab4ff';
            chatbox.appendChild(link);
          }
        }
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
