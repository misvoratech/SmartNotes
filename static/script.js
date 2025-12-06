document.addEventListener('DOMContentLoaded', () => {
    // Check for admin status to show link
    if (localStorage.getItem('isAdmin') === 'true') {
        const adminBtnContainer = document.getElementById('admin-btn-container');
        if (adminBtnContainer) adminBtnContainer.style.display = 'block';
    }

    // Elements
    const notesListEl = document.getElementById('notes-list');
    const newNoteBtn = document.getElementById('new-note-btn');
    const editorContainer = document.getElementById('editor-container');
    const emptyView = document.getElementById('empty-view');
    const noteTitleInput = document.getElementById('note-title');
    const noteContentInput = document.getElementById('note-content');
    const deleteBtn = document.getElementById('delete-btn');
    const saveStatus = document.getElementById('save-status');

    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatPanel = document.getElementById('chat-panel');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    let notes = [];
    let activeNoteId = null;
    let autoSaveTimer = null;

    // --- API Interactions ---

    async function fetchNotes() {
        try {
            const res = await fetch('/api/notes');
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            notes = await res.json();
            renderNotesList();
        } catch (err) {
            console.error("Failed to fetch notes", err);
        }
    }

    async function createNote() {
        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Untitled Note', content: '' })
            });
            const newNote = await res.json();
            notes.push(newNote);
            setActiveNote(newNote.id);
            renderNotesList();
        } catch (err) {
            console.error("Failed to create note", err);
        }
    }

    async function updateNote(id, title, content) {
        saveStatus.textContent = "Saving...";
        try {
            const res = await fetch(`/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            const updatedNote = await res.json();

            // Update local state
            const index = notes.findIndex(n => n.id === id);
            if (index !== -1) {
                notes[index] = updatedNote;
                renderNotesList(); // Refresh list to show new title/preview
            }
            saveStatus.textContent = "Saved";
        } catch (err) {
            console.error("Failed to update note", err);
            saveStatus.textContent = "Error saving";
        }
    }

    async function deleteNote(id) {
        if (!confirm("Are you sure you want to delete this note?")) return;

        try {
            await fetch(`/api/notes/${id}`, { method: 'DELETE' });
            notes = notes.filter(n => n.id !== id);
            activeNoteId = null;
            renderNotesList();
            renderEditor();
        } catch (err) {
            console.error("Failed to delete note", err);
        }
    }

    async function askAI(query) {
        // Append User Message
        appendMessage('user', query);
        chatInput.value = '';

        // Loading state
        const loadingId = appendMessage('ai', 'Thinking...');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();

            // Remove loading, add real response
            const loadingMsg = document.querySelector(`[data-msg-id="${loadingId}"]`);
            if (loadingMsg) loadingMsg.remove();

            appendMessage('ai', data.answer);
        } catch (err) {
            console.error("AI Error", err);
            appendMessage('ai', "Sorry, something went wrong.");
        }
    }

    // --- UI Rendering ---

    function renderNotesList() {
        notesListEl.innerHTML = '';
        notes.forEach(note => {
            const el = document.createElement('div');
            el.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
            el.innerHTML = `
                <h3>${note.title || 'Untitled Note'}</h3>
                <p>${note.content || 'No content'}</p>
            `;
            el.onclick = () => setActiveNote(note.id);
            notesListEl.appendChild(el);
        });
    }

    function setActiveNote(id) {
        activeNoteId = id;
        renderNotesList();
        renderEditor();
    }

    const settingsBtn = document.getElementById('settings-btn');
    const settingsView = document.getElementById('settings-view');

    // --- Navigation Logic ---

    function showEditor() {
        editorContainer.style.display = 'none';
        emptyView.style.display = 'flex';
        settingsView.style.display = 'none';
        activeNoteId = null;

        // Visual reset of sidebar active items if needed
        const items = document.querySelectorAll('.note-item');
        items.forEach(i => i.classList.remove('active'));
        editorContainer.style.display = 'none';
        emptyView.style.display = 'none';
        settingsView.style.display = 'block';
    });

// --- Settings Logic (Change Password) ---
const setSavePassBtn = document.getElementById('set-save-pass-btn');
const setOldPassInput = document.getElementById('set-old-pass');
const setNewPassInput = document.getElementById('set-new-pass');
const setPassError = document.getElementById('set-pass-error');

if (setSavePassBtn) {
    setSavePassBtn.onclick = async function () {
        const oldPass = setOldPassInput.value;
        const newPass = setNewPassInput.value;

        setPassError.style.display = "none";

        if (!oldPass || !newPass) {
            setPassError.textContent = "Please fill in all fields";
            setPassError.style.display = "block";
            return;
        }

        // Validation
        if (newPass.length < 8) {
            setPassError.textContent = "New password must be at least 8 characters long.";
            setPassError.style.display = "block";
            return;
        }
        if (!/\d/.test(newPass) || !/[a-zA-Z]/.test(newPass)) {
            setPassError.textContent = "Password must contain letters and numbers.";
            setPassError.style.display = "block";
            return;
        }
        if (!/[^a-zA-Z0-9]/.test(newPass)) {
            setPassError.textContent = "Password must contain at least one special character.";
            setPassError.style.display = "block";
            return;
        }

        setSavePassBtn.textContent = "Updating...";
        setSavePassBtn.disabled = true;

        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPass, new_password: newPass })
            });
            const data = await res.json();

            if (data.success) {
                alert('Password updated successfully!');
                setOldPassInput.value = '';
                setNewPassInput.value = '';
            } else {
                setPassError.textContent = data.message || 'Error updating password';
                setPassError.style.display = "block";
            }
        } catch (err) {
            console.error("Error", err);
            setPassError.textContent = 'Server error';
            setPassError.style.display = "block";
        } finally {
            setSavePassBtn.textContent = "Update Password";
            setSavePassBtn.disabled = false;
        }
    }
}

function appendMessage(role, text) {
    const id = Date.now();
    const el = document.createElement('div');
    el.className = `message ${role}`;
    el.dataset.msgId = id;

    // Parse basic markdown if AI
    if (role === 'ai' && window.marked) {
        el.innerHTML = marked.parse(text);
    } else {
        el.textContent = text;
    }

    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

// --- Event Listeners ---

newNoteBtn.addEventListener('click', createNote);

deleteBtn.addEventListener('click', () => {
    if (activeNoteId) deleteNote(activeNoteId);
});

// Auto-save logic
const handleInput = () => {
    if (!activeNoteId) return;
    saveStatus.textContent = "Unsaved changes...";

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        updateNote(activeNoteId, noteTitleInput.value, noteContentInput.value);
    }, 1000); // Save after 1 second of inactivity
};

noteTitleInput.addEventListener('input', handleInput);
noteContentInput.addEventListener('input', handleInput);

// Chat
chatToggleBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
});

closeChatBtn.addEventListener('click', () => {
    chatPanel.classList.remove('open');
});

sendChatBtn.addEventListener('click', () => {
    const query = chatInput.value.trim();
    if (query) askAI(query);
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatBtn.click();
});

// Initial Load
fetchNotes();

// Load Creator Details
fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
        if (data.creator_details) {
            const el = document.getElementById('creator-details-sidebar');
            const loadingId = appendMessage('ai', 'Thinking...');

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const data = await res.json();

                // Remove loading, add real response
                const loadingMsg = document.querySelector(`[data-msg-id="${loadingId}"]`);
                if (loadingMsg) loadingMsg.remove();

                appendMessage('ai', data.answer);
            } catch (err) {
                console.error("AI Error", err);
                appendMessage('ai', "Sorry, something went wrong.");
            }
        }

        // --- UI Rendering ---

        function renderNotesList() {
            notesListEl.innerHTML = '';
            notes.forEach(note => {
                const el = document.createElement('div');
                el.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
                el.innerHTML = `
                <h3>${note.title || 'Untitled Note'}</h3>
                <p>${note.content || 'No content'}</p>
            `;
                el.onclick = () => setActiveNote(note.id);
                notesListEl.appendChild(el);
            });
        }

        function setActiveNote(id) {
            activeNoteId = id;
            renderNotesList();
            renderEditor();
        }

        const settingsBtn = document.getElementById('settings-btn');
        const settingsView = document.getElementById('settings-view');

        // --- Navigation Logic ---

        function showEditor() {
            editorContainer.style.display = 'none';
            emptyView.style.display = 'flex';
            settingsView.style.display = 'none';
            activeNoteId = null;

            // Visual reset of sidebar active items if needed
            const items = document.querySelectorAll('.note-item');
            items.forEach(i => i.classList.remove('active'));
            editorContainer.style.display = 'none';
            emptyView.style.display = 'none';
            settingsView.style.display = 'block';
        });

// --- Settings Logic (Change Password) ---
const setSavePassBtn = document.getElementById('set-save-pass-btn');
const setOldPassInput = document.getElementById('set-old-pass');
const setNewPassInput = document.getElementById('set-new-pass');
const setPassError = document.getElementById('set-pass-error');

if (setSavePassBtn) {
    setSavePassBtn.onclick = async function () {
        const oldPass = setOldPassInput.value;
        const newPass = setNewPassInput.value;

        setPassError.style.display = "none";

        if (!oldPass || !newPass) {
            setPassError.textContent = "Please fill in all fields";
            setPassError.style.display = "block";
            return;
        }

        // Validation
        if (newPass.length < 8) {
            setPassError.textContent = "New password must be at least 8 characters long.";
            setPassError.style.display = "block";
            return;
        }
        if (!/\d/.test(newPass) || !/[a-zA-Z]/.test(newPass)) {
            setPassError.textContent = "Password must contain letters and numbers.";
            setPassError.style.display = "block";
            return;
        }
        if (!/[^a-zA-Z0-9]/.test(newPass)) {
            setPassError.textContent = "Password must contain at least one special character.";
            setPassError.style.display = "block";
            return;
        }

        setSavePassBtn.textContent = "Updating...";
        setSavePassBtn.disabled = true;

        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPass, new_password: newPass })
            });
            const data = await res.json();

            if (data.success) {
                alert('Password updated successfully!');
                setOldPassInput.value = '';
                setNewPassInput.value = '';
            } else {
                setPassError.textContent = data.message || 'Error updating password';
                setPassError.style.display = "block";
            }
        } catch (err) {
            console.error("Error", err);
            setPassError.textContent = 'Server error';
            setPassError.style.display = "block";
        } finally {
            setSavePassBtn.textContent = "Update Password";
            setSavePassBtn.disabled = false;
        }
    }
}

function appendMessage(role, text) {
    const id = Date.now();
    const el = document.createElement('div');
    el.className = `message ${role}`;
    el.dataset.msgId = id;

    // Parse basic markdown if AI
    if (role === 'ai' && window.marked) {
        el.innerHTML = marked.parse(text);
    } else {
        el.textContent = text;
    }

    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

// --- Event Listeners ---

newNoteBtn.addEventListener('click', createNote);

deleteBtn.addEventListener('click', () => {
    if (activeNoteId) deleteNote(activeNoteId);
});

// Auto-save logic
const handleInput = () => {
    if (!activeNoteId) return;
    saveStatus.textContent = "Unsaved changes...";

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        updateNote(activeNoteId, noteTitleInput.value, noteContentInput.value);
    }, 1000); // Save after 1 second of inactivity
};

noteTitleInput.addEventListener('input', handleInput);
noteContentInput.addEventListener('input', handleInput);

// Chat
chatToggleBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
});

closeChatBtn.addEventListener('click', () => {
    chatPanel.classList.remove('open');
});

sendChatBtn.addEventListener('click', () => {
    const query = chatInput.value.trim();
    if (query) askAI(query);
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatBtn.click();
});

// Initial Load
fetchNotes();

// Load Creator Details
fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
        if (data.creator_details) {
            const el = document.getElementById('creator-details-sidebar');
            if (el) el.innerHTML = data.creator_details.replace(/\n/g, '<br>');
        }
    })
    .catch(err => console.error(err));

// --- Settings Logic (Change Password) ---
const setSavePassBtn = document.getElementById('set-save-pass-btn');
const setOldPassInput = document.getElementById('set-old-pass');
const setNewPassInput = document.getElementById('set-new-pass');
const setPassError = document.getElementById('set-pass-error');

if (setSavePassBtn) {
    setSavePassBtn.onclick = async function () {
        const oldPass = setOldPassInput.value;
        const newPass = setNewPassInput.value;

        setPassError.style.display = "none";

        if (!oldPass || !newPass) {
            setPassError.textContent = "Please fill in all fields";
            setPassError.style.display = "block";
            return;
        }

        // Validation
        if (newPass.length < 8) {
            setPassError.textContent = "New password must be at least 8 characters long.";
            setPassError.style.display = "block";
            return;
        }
        if (!/\d/.test(newPass) || !/[a-zA-Z]/.test(newPass)) {
            setPassError.textContent = "Password must contain letters and numbers.";
            setPassError.style.display = "block";
            return;
        }
        if (!/[^a-zA-Z0-9]/.test(newPass)) {
            setPassError.textContent = "Password must contain at least one special character.";
            setPassError.style.display = "block";
            return;
        }

        setSavePassBtn.textContent = "Updating...";
        setSavePassBtn.disabled = true;

        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password: oldPass, new_password: newPass })
            });
            const data = await res.json();

            if (data.success) {
                alert('Password updated successfully!');
                setOldPassInput.value = '';
                setNewPassInput.value = '';
            } else {
                setPassError.textContent = data.message || 'Error updating password';
                setPassError.style.display = "block";
            }
        } catch (err) {
            console.error("Error", err);
            setPassError.textContent = 'Server error';
            setPassError.style.display = "block";
        } finally {
            setSavePassBtn.textContent = "Update Password";
            setSavePassBtn.disabled = false;
        }
    }
}
});
