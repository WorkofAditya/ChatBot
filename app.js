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
const fabMain = document.getElementById('fabMain');
const fabOptions = document.getElementById('fabOptions');

let vault = JSON.parse(localStorage.getItem('vaultData')) || [];

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

sendBtn.onclick = () => {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  userInput.value = '';

  // show typing animation
  const typingIndicator = document.getElementById('typingIndicator');
  typingIndicator.style.display = 'flex';
  chatbox.appendChild(typingIndicator);
  chatbox.scrollTop = chatbox.scrollHeight;

  // simulate bot thinking delay
  setTimeout(() => {
    typingIndicator.style.display = 'none';

    const doc = findDoc(text);
    if (doc) {
      let reply = `${doc.name}: ${doc.value}`;
      if (doc.info) reply += `\n${doc.info}`;
      addMessage(reply, 'bot');
    } else {
      addMessage('No record found for that query.', 'bot');
    }
  }, 100); // delay 
};


addDocBtn.onclick = () => {
  popup.style.display = 'flex';
};

cancelBtn.onclick = () => {
  popup.style.display = 'none';
};

saveDocBtn.onclick = () => {
  const name = document.getElementById('docName').value.trim();
  const value = document.getElementById('docValue').value.trim();
  const info = document.getElementById('docInfo').value.trim();
  if (!name || !value) {
    alert('Document name and value are required');
    return;
  }
  vault.push({ name, value, info });
  saveVault();
  popup.style.display = 'none';
  document.getElementById('docName').value = '';
  document.getElementById('docValue').value = '';
  document.getElementById('docInfo').value = '';
  addMessage(`${name} added successfully.`, 'bot');
};

clearBtn.onclick = () => {
  if (confirm('Are you sure you want to clear the vault?')) {
    vault = [];
    saveVault();
    addMessage('Vault cleared successfully.', 'bot');
  }
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(vault)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vault_backup.json';
  a.click();
};

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
    } catch (err) {
      alert('Invalid file format.');
    }
  };
  reader.readAsText(file);
};

fabMain.addEventListener('click', () => {
  if (fabOptions.style.display === 'flex') {
    fabOptions.style.display = 'none';
  } else {
    fabOptions.style.display = 'flex';
  }
});
