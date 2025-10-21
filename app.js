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

let vault = JSON.parse(localStorage.getItem('vaultData')) || [];

// Helper Functions
function addMessage(text, sender) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'user-message' : 'bot-message';
  div.textContent = text;
  chatbox.appendChild(div);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function saveVault() {
  localStorage.setItem('vaultData', JSON.stringify(vault));
}

function findDoc(query) {
  query = query.toLowerCase();
  return vault.find(d => query.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(query));
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
    const doc = findDoc(text);

    if (doc) {
  let reply = `${doc.name}: ${doc.value}`;
  if (doc.info) reply += `\n${doc.info}`;

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
    } else {
      const link = document.createElement('a');
      link.href = doc.file.data;
      link.download = doc.file.name;
      link.textContent = `📎 Download ${doc.file.name}`;
      link.style.display = 'inline-block';
      link.style.marginTop = '6px';
      link.style.color = '#8ab4ff';
      chatbox.appendChild(link);
    }
    chatbox.scrollTop = chatbox.scrollHeight;
  }
}

     else {
      addMessage('No record found for that query.', 'bot');
    }
  }, 400 + Math.random() * 600); // Natural delay
};

// Add Document Popup
addDocBtn.onclick = () => (popup.style.display = 'flex');
cancelBtn.onclick = () => (popup.style.display = 'none');

saveDocBtn.onclick = async () => {
  const name = document.getElementById('docName').value.trim();
  const value = document.getElementById('docValue').value.trim();
  const info = document.getElementById('docInfo').value.trim();
  const fileInput = document.getElementById('docFile');
  const file = fileInput.files[0];

  if (!name || !value) {
    return showToast('Document name and value are required', 'error');
  }

  let fileData = null;
  if (file) {
    fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type,
        data: reader.result // base64 data
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  vault.push({ name, value, info, file: fileData });
  saveVault();

  popup.style.display = 'none';
  document.getElementById('docName').value = '';
  document.getElementById('docValue').value = '';
  document.getElementById('docInfo').value = '';
  fileInput.value = '';

  addMessage(`${name} added successfully.`, 'bot');
  showToast('Document added successfully', 'success');
};


// Clear Vault
clearBtn.onclick = () => {
  if (confirm('Are you sure you want to clear the vault?')) {
    vault = [];
    saveVault();
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

importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      vault = JSON.parse(event.target.result);
      saveVault();
      addMessage('Vault imported successfully.', 'bot');
      showToast('Vault imported', 'success');
    } catch {
      showToast('Invalid file format', 'error');
    }
  };
  reader.readAsText(file);
};
