document.addEventListener('DOMContentLoaded', () => {
    const statUsers = document.getElementById('stat-users');
    const statNotes = document.getElementById('stat-notes');
    const usersTableBody = document.querySelector('#users-table tbody');
    const creatorDetailsInput = document.getElementById('creator-details');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    async function loadStats() {
        try {
            // ... existing stats logic (implicit in overwrite or separate functions)
            // simplified for this edit to just add the new logic
            const res = await fetch('/api/admin/stats');
            if (res.status === 403 || res.status === 401) {
                window.location.href = '/login';
                return;
            }
            const data = await res.json();
            statUsers.textContent = data.user_count;
            statNotes.textContent = data.note_count;
        } catch (err) {
            console.error('Failed to load stats', err);
        }
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            creatorDetailsInput.value = data.creator_details || '';
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }

    saveSettingsBtn.addEventListener('click', async () => {
        const details = creatorDetailsInput.value;
        saveSettingsBtn.textContent = 'Saving...';
        saveSettingsBtn.disabled = true;

        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creator_details: details })
            });
            const data = await res.json();
            if (data.success) {
                alert('Settings saved!');
            } else {
                alert('Failed to save settings');
            }
        } catch (err) {
            console.error('Error saving settings', err);
            alert('Error saving settings');
        } finally {
            saveSettingsBtn.textContent = 'Save Settings';
            saveSettingsBtn.disabled = false;
        }
    });

    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            if (res.status !== 200) return;
            const users = await res.json();

            usersTableBody.innerHTML = '';
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.username}</td>
                    <td><span class="badge ${user.role.toLowerCase()}">${user.role}</span></td>
                    <td>
                        ${user.role !== 'Admin' ?
                        `<button class="btn-danger btn-sm" onclick="deleteUser('${user.username}')">Delete</button>` :
                        '<span class="text-muted">No Action</span>'}
                    </td>
                `;
                usersTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Failed to load users', err);
        }
    }

    window.deleteUser = async (username) => {
        if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/admin/users/${username}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadStats();
                loadUsers();
            } else {
                alert(data.message || 'Failed to delete user');
            }
        } catch (err) {
            console.error('Error deleting user', err);
            alert('Error deleting user');
        }
    };

    loadStats();
    loadUsers();
    loadSettings();
});
