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
const collectionList = document.getElementById('collectionList');
const collectionPopup = document.getElementById('collectionPopup');
const collectionName = document.getElementById('collectionName');
const docCollection = document.getElementById('docCollection');
const collectionFilterBtn = document.getElementById('collectionFilterBtn');
const collectionFilterMenu = document.getElementById('collectionFilterMenu');
const filterLabel = document.getElementById('filterLabel');
const collectionSidebar = document.getElementById('collectionSidebar');
const searchIntro = document.querySelector('.search-intro');
const removeFileOption = document.getElementById('removeFileOption');
const removeExistingFile = document.getElementById('removeExistingFile');

const COLLECTIONS_KEY = 'vaultCollections';
let collections = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '[]');
let selectedCollectionIds = new Set();
let expandedCollectionIds = new Set();
let openDocumentMenuId = null;

function dismissSearchIntro() {
  searchIntro.classList.add('is-dismissed');
  document.querySelector('.vault-container').classList.add('intro-dismissed');
}

function persistCollections() {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

function collectionNameFor(id) {
  return collections.find(collection => collection.id === id)?.name || 'Unfiled';
}

function documentsForCollection(id) {
  return id === '__unfiled__' ? vault.filter(doc => !doc.collectionId) : vault.filter(doc => doc.collectionId === id);
}

function renderCollectionControls() {
  const counts = vault.reduce((result, doc) => {
    if (doc.collectionId) result[doc.collectionId] = (result[doc.collectionId] || 0) + 1;
    return result;
  }, {});
  collectionList.innerHTML = '';
  const visibleCollections = [...collections, { id: '__unfiled__', name: 'Unfiled documents' }];
  visibleCollections.forEach(collection => {
    const item = document.createElement('div');
    const collectionDocs = documentsForCollection(collection.id);
    const isExpanded = expandedCollectionIds.has(collection.id);
    item.className = `collection-item${selectedCollectionIds.has(collection.id) ? ' is-selected' : ''}${isExpanded ? ' is-expanded' : ''}`;
    const documents = isExpanded ? `<div class="collection-documents">${collectionDocs.length ? collectionDocs.map(doc => `<div class="collection-document-row"><button class="collection-document" type="button" data-document-id="${doc.id}" title="Open ${doc.name}">${doc.file?.type?.startsWith('image/') ? `<img src="${doc.file.data}" alt="">` : '<span class="document-placeholder" aria-hidden="true">⌁</span>'}<span>${doc.name}</span></button><button class="document-menu-toggle" type="button" data-document-menu-id="${doc.id}" aria-label="Actions for ${doc.name}" aria-expanded="${openDocumentMenuId === doc.id}">⋯</button>${openDocumentMenuId === doc.id ? `<div class="document-menu"><button type="button" data-edit-document-id="${doc.id}">Edit</button><button type="button" data-delete-document-id="${doc.id}">Delete</button></div>` : ''}</div>`).join('') : '<p class="collection-empty">No documents yet</p>'}</div>` : '';
    const deleteCollection = collection.id === '__unfiled__' ? '' : `<button class="collection-delete" type="button" data-delete-collection-id="${collection.id}" aria-label="Delete ${collection.name}" title="Delete collection">×</button>`;
    item.innerHTML = `<button class="collection-select" type="button" data-collection-id="${collection.id}" aria-expanded="${isExpanded}"><span class="collection-name">${collection.name}</span><span class="collection-count">${collectionDocs.length}</span><span class="collection-chevron" aria-hidden="true">⌄</span></button>${deleteCollection}${documents}`;
    collectionList.appendChild(item);
  });
  docCollection.innerHTML = '<option value="">Unfiled</option>' + collections.map(collection => `<option value="${collection.id}">${collection.name}</option>`).join('');
  const isGlobal = selectedCollectionIds.size === 0;
  filterLabel.textContent = isGlobal ? 'All collections' : `${selectedCollectionIds.size} collection${selectedCollectionIds.size === 1 ? '' : 's'}`;
  collectionFilterMenu.innerHTML = `<label class="filter-option"><input type="checkbox" id="globalCollectionFilter" ${isGlobal ? 'checked' : ''}> All collections</label><div class="filter-divider"></div>${collections.length ? collections.map(collection => `<label class="filter-option"><input type="checkbox" data-filter-collection-id="${collection.id}" ${selectedCollectionIds.has(collection.id) ? 'checked' : ''}> ${collection.name}</label>`).join('') : '<p class="filter-empty">Create a collection to narrow your search.</p>'}`;
}

function isDocumentInSearchScope(doc) {
  return selectedCollectionIds.size === 0 || selectedCollectionIds.has(doc.collectionId) || (selectedCollectionIds.has('__unfiled__') && !doc.collectionId);
}

function openDocumentForEditing(doc) {
  document.getElementById("docName").value = doc.name;
  document.getElementById("docValue").value = doc.value;
  document.getElementById("docInfo").value = doc.info || "";
  document.getElementById("docFile").value = "";
  docCollection.value = doc.collectionId || '';
  removeExistingFile.checked = false;
  removeFileOption.hidden = !doc.file;
  saveDocBtn.setAttribute("data-edit-id", doc.id);
  popup.style.display = "flex";
}

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

  const createDownloadLink = () => {
    const downloadLink = document.createElement("a");
    downloadLink.href = doc.file.data;
    downloadLink.download = doc.file.name;
    downloadLink.textContent = "Download";
    downloadLink.className = "file-download-link";
    downloadLink.setAttribute("aria-label", `Download ${doc.file.name}`);
    return downloadLink;
  };

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

    chatbox.appendChild(createDownloadLink());
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
    chatbox.appendChild(createDownloadLink());

    return;
  }

  chatbox.appendChild(createDownloadLink());
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
  renderCollectionControls();
})();


function findDoc(query) {
  query = query.toLowerCase();
  return vault.filter(d => isDocumentInSearchScope(d) && d.name.toLowerCase().includes(query));
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

  dismissSearchIntro();
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

  const scopedVault = vault.filter(isDocumentInSearchScope);

  if (scopedVault.length === 0) {
    addMessage("Your vault is empty. Add a document first!", "bot");
    return;
  }

  addMessage(`You have ${scopedVault.length} stored documents in this search scope:`, "bot");

  scopedVault.forEach((doc, index) => {
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

collectionFilterBtn.onclick = () => {
  const isOpen = !collectionFilterMenu.hidden;
  collectionFilterMenu.hidden = isOpen;
  collectionFilterBtn.setAttribute('aria-expanded', String(!isOpen));
};

collectionFilterMenu.addEventListener('change', (event) => {
  const input = event.target;
  if (input.id === 'globalCollectionFilter' && input.checked) {
    selectedCollectionIds.clear();
  } else if (input.dataset.filterCollectionId) {
    if (input.checked) selectedCollectionIds.add(input.dataset.filterCollectionId);
    else selectedCollectionIds.delete(input.dataset.filterCollectionId);
  }
  renderCollectionControls();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.collection-filter')) {
    collectionFilterMenu.hidden = true;
    collectionFilterBtn.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('newCollectionBtn').onclick = () => {
  collectionName.value = '';
  collectionPopup.style.display = 'flex';
  setTimeout(() => collectionName.focus(), 0);
};
document.getElementById('cancelCollectionBtn').onclick = () => (collectionPopup.style.display = 'none');
document.getElementById('saveCollectionBtn').onclick = () => {
  const name = collectionName.value.trim();
  if (!name) return showToast('Collection name is required', 'error');
  if (collections.some(collection => collection.name.toLowerCase() === name.toLowerCase())) return showToast('A collection with that name already exists', 'error');
  const collection = { id: crypto.randomUUID(), name };
  collections.push(collection);
  persistCollections();
  selectedCollectionIds = new Set([collection.id]);
  renderCollectionControls();
  collectionPopup.style.display = 'none';
  showToast('Collection created', 'success');
};

collectionList.addEventListener('click', async (event) => {
  const selectButton = event.target.closest('[data-collection-id]');
  const deleteButton = event.target.closest('[data-delete-collection-id]');
  if (selectButton) {
    const id = selectButton.dataset.collectionId;
    selectedCollectionIds = new Set([id]);
    if (expandedCollectionIds.has(id)) expandedCollectionIds.delete(id);
    else expandedCollectionIds.add(id);
    renderCollectionControls();
  }
  const menuToggle = event.target.closest('[data-document-menu-id]');
  if (menuToggle) {
    const id = Number(menuToggle.dataset.documentMenuId);
    openDocumentMenuId = openDocumentMenuId === id ? null : id;
    renderCollectionControls();
    return;
  }
  const editDocumentButton = event.target.closest('[data-edit-document-id]');
  if (editDocumentButton) {
    const doc = vault.find(item => item.id === Number(editDocumentButton.dataset.editDocumentId));
    if (doc) openDocumentForEditing(doc);
    openDocumentMenuId = null;
    return;
  }
  const deleteDocumentButton = event.target.closest('[data-delete-document-id]');
  if (deleteDocumentButton) {
    const id = Number(deleteDocumentButton.dataset.deleteDocumentId);
    const doc = vault.find(item => item.id === id);
    if (!doc || !confirm(`Delete “${doc.name}”?`)) return;
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await waitForTx(tx);
    vault = await getAllDocs();
    openDocumentMenuId = null;
    renderCollectionControls();
    showToast('Document deleted', 'success');
    return;
  }
  const documentButton = event.target.closest('[data-document-id]');
  if (documentButton) {
    const doc = vault.find(item => item.id === Number(documentButton.dataset.documentId));
    if (!doc) return;
    dismissSearchIntro();
    addMessage(`${doc.name}: ${doc.value}`, 'bot');
    if (doc.info) addMessage(doc.info, 'bot');
    renderFile(doc);
    chatbox.scrollTop = chatbox.scrollHeight;
    collectionSidebar.classList.remove('is-open');
  }
  if (deleteButton) {
    const id = deleteButton.dataset.deleteCollectionId;
    const collection = collections.find(item => item.id === id);
    if (!collection || !confirm(`Delete “${collection.name}”? Its documents will remain unfiled.`)) return;
    collections = collections.filter(item => item.id !== id);
    selectedCollectionIds.delete(id);
    expandedCollectionIds.delete(id);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    vault.filter(doc => doc.collectionId === id).forEach(doc => store.put({ ...doc, collectionId: '' }));
    await waitForTx(tx);
    vault = await getAllDocs();
    persistCollections();
    renderCollectionControls();
    showToast('Collection deleted', 'success');
  }
});

document.getElementById('sidebarToggle').onclick = () => collectionSidebar.classList.add('is-open');
document.getElementById('closeSidebarBtn').onclick = () => collectionSidebar.classList.remove('is-open');


// Add Document Popup
addDocBtn.onclick = () => {
  // Reset edit mode
  saveDocBtn.removeAttribute("data-edit-id");

  // Clear inputs (fresh add)
  document.getElementById("docName").value = "";
  document.getElementById("docValue").value = "";
  document.getElementById("docInfo").value = "";
  document.getElementById("docFile").value = "";
  removeExistingFile.checked = false;
  removeFileOption.hidden = true;
  docCollection.value = selectedCollectionIds.size === 1 ? [...selectedCollectionIds][0] : '';

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
  const collectionId = docCollection.value;
  const shouldRemoveFile = removeExistingFile.checked;

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
    file: fileData ? fileData : (shouldRemoveFile ? null : oldDoc.file),
    collectionId,
    pdfThumb: fileData || shouldRemoveFile ? null : oldDoc.pdfThumb,
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
renderCollectionControls();

popup.style.display = "none";
removeFileOption.hidden = true;
saveDocBtn.removeAttribute("data-edit-id");



  addMessage(`${name} updated successfully.`, "bot");
  showToast("Document updated!", "success");
  return;
}

//add
  const newDoc = { name, value, info, file: fileData, collectionId };
  await saveDocToDB(newDoc);
  vault = await getAllDocs();
  renderCollectionControls();
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

    setTimeout(() => {
      location.reload();
    }, 1000);
  }
};

// Export Vault
exportBtn.onclick = () => {
  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  let h = now.getHours();
  const ampm = h >= 12 ? "P" : "A";
  h = h % 12 || 12;

  const fileName = `vault_${y}${m}${d}_${h}${ampm}.json`;

  const backup = { version: 2, collections, documents: vault };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();

  showToast("Vault exported", "success");
};


// Import Vault
importBtn.onclick = () => importFile.click();

importFile.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const loader = document.getElementById("importLoader");
  const bar = document.getElementById("importBar");
  const text = document.getElementById("importText");

  loader.style.display = "block";
  bar.style.width = "0%";
  text.textContent = "Importing 0%";

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      const data = Array.isArray(parsed) ? parsed : parsed.documents;
      if (!Array.isArray(data)) {
        loader.style.display = "none";
        alert("Invalid file format.");
        return;
      }

      if (Array.isArray(parsed.collections)) {
        const existingNames = new Set(collections.map(collection => collection.name.toLowerCase()));
        parsed.collections.forEach(collection => {
          if (collection?.id && collection?.name && !existingNames.has(collection.name.toLowerCase())) collections.push(collection);
        });
        persistCollections();
      }

      for (let i = 0; i < data.length; i++) {
        await saveDocToDB({
          name: data[i].name || "Unnamed",
          value: data[i].value || "",
          info: data[i].info || "",
          file: data[i].file || null,
          collectionId: collections.some(collection => collection.id === data[i].collectionId) ? data[i].collectionId : ''
        });

        const percent = Math.round(((i + 1) / data.length) * 100);
        bar.style.width = percent + "%";
        text.textContent = "Importing " + percent + "%";
      }

      vault = await getAllDocs();
      renderCollectionControls();

      setTimeout(() => {
      loader.style.display = "none";
      showToast("Vault imported successfully!", "success");
      addMessage("Vault imported successfully.", "bot");

        setTimeout(() => {
          location.reload();
          }, 1000);
          }, 300);


    } catch (err) {
      loader.style.display = "none";
      alert("Invalid or corrupted backup file.");
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
                <span><strong>${doc.name}</strong><small>${collectionNameFor(doc.collectionId)}</small></span>
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
  renderCollectionControls();

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
            document.getElementById("editPopup").style.display = "none";
            openDocumentForEditing(doc);
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
  const preserved = [];

  text = text.replace(/<img[\s\S]*?>/gi, match => {
    preserved.push(match);
    return `%%IMG${preserved.length - 1}%%`;
  });
  text = escapeHtml(text);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  preserved.forEach((img, i) => {
    text = text.replace(`%%IMG${i}%%`, img);
  });
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
    if (!inTable || tableBuffer.length === 0) return;
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

    // CODE BLOCK
    if (raw.trim().startsWith("```")) {
      flushPara(); closeList(); flushTable();
      inCode = !inCode;
      if (!inCode) out += `<pre><code>${escapeHtml(codeBuffer)}</code></pre>\n`;
      codeBuffer = "";
      continue;
    }
    if (inCode) { codeBuffer += raw + "\n"; continue; }

    // HORIZONTAL RULE
    if (/^\s*([-*_])\1{2,}\s*$/.test(raw)) {
      flushPara(); closeList(); flushTable();
      out += "<hr>\n";
      continue;
    }

    // TABLE
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      if (!inTable) { flushPara(); closeList(); inTable = true; tableBuffer = []; }
      tableBuffer.push(raw);
      continue;
    } else if (inTable) flushTable();

    // HEADINGS
    const hMatch = raw.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) { flushPara(); closeList(); flushTable(); const level = hMatch[1].length; out += `<h${level}>${inlineFormat(hMatch[2].trim())}</h${level}>\n`; continue; }

    // Ordered List with custom numbers
    const olMatch = raw.match(/^\s*(\d+)\.\s+(.*)/);
    if (olMatch) {
    flushPara(); flushTable();
    const num = olMatch[1]; // the number in markdown
    if (!inList || listType !== "ol") { closeList(); inList = true; listType = "ol"; out += "<ol>\n"; }
    out += `<li value="${num}">${inlineFormat(olMatch[2].trim())}</li>\n`;
    continue;
}


    // UNORDERED LIST
    const ulMatch = raw.match(/^\s*[-+*]\s+(.*)/);
    if (ulMatch) { flushPara(); flushTable(); if (!inList || listType !== "ul") { closeList(); inList = true; listType = "ul"; out += "<ul>\n"; } out += `<li>${inlineFormat(ulMatch[1].trim())}</li>\n`; continue; }

    // EMPTY LINE
    if (raw.trim() === "") { flushPara(); closeList(); flushTable(); continue; }

    // PARAGRAPH
    paraBuffer.push(raw.trim());
  }

  flushPara(); closeList(); flushTable();
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

const helpBtn = document.getElementById("helpBtn");
const helpPopup = document.getElementById("helpPopup");
const closeHelp = document.getElementById("closeHelp");
const helpBody = document.getElementById("helpBody");

helpBtn.onclick = async () => {
  helpPopup.style.display = "flex";
  helpBody.innerHTML = "<p>Loading...</p>";

  const res = await fetch("https://raw.githubusercontent.com/WorkofAditya/ChatBot/refs/heads/main/docs/guide.md");
  const md = await res.text();
  helpBody.innerHTML = parseMarkdown(md);
};


closeHelp.onclick = () => {
  helpPopup.style.display = "none";
};

const LOCAL_VERSION = "3";
const REMOTE_VERSION_URL = "https://raw.githubusercontent.com/WorkofAditya/ChatBot/refs/heads/main/version.txt";

let latestRemoteVersion = null;

function parseVersion(version) {
  return String(version)
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isRemoteVersionNewer(remoteVersion, localVersion) {
  const remote = parseVersion(remoteVersion);
  const local = parseVersion(localVersion);
  const maxLen = Math.max(remote.length, local.length);

  for (let i = 0; i < maxLen; i++) {
    const remotePart = remote[i] || 0;
    const localPart = local[i] || 0;

    if (remotePart > localPart) return true;
    if (remotePart < localPart) return false;
  }

  return false;
}

function checkForAppUpdate() {
  fetch(REMOTE_VERSION_URL + "?cache=" + Date.now())
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch remote version");
      return res.text();
    })
    .then(remote => {
      const remoteVersion = remote.trim();
      latestRemoteVersion = remoteVersion;

      const storedVersion = localStorage.getItem("updatedVersion");
      if (storedVersion === remoteVersion) return;

      if (isRemoteVersionNewer(remoteVersion, LOCAL_VERSION)) {
        showUpdatePopup();
      }
    })
    .catch(() => {});
}

function showUpdatePopup() {
  const popup = document.getElementById("updatePopup");
  popup.style.display = "flex";

  document.getElementById("refreshAppBtn").onclick = async () => {
    popup.style.display = "none";
    localStorage.setItem("updatedVersion", latestRemoteVersion);

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();

      await Promise.all(
        registrations.map(async (reg) => {
          if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
          await reg.update();
        })
      );
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    setTimeout(() => window.location.reload(), 300);
  };

  document.getElementById("dismissUpdateBtn").onclick = () => {
    popup.style.display = "none";
  };
}

if (navigator.onLine) checkForAppUpdate();

// Fatch app version from Github RAW
fetch("https://raw.githubusercontent.com/WorkofAditya/ChatBot/main/version.txt")
  .then(response => response.text())
  .then(data => {
    document.getElementById("appVersion").textContent = data.trim();
  })
  .catch(() => {
    document.getElementById("appVersion").textContent = "Unknown";
  });
