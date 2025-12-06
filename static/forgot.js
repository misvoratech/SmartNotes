document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-form');
    const usernameInput = document.getElementById('username');
    const phoneInput = document.getElementById('phone');
    const newPasswordInput = document.getElementById('new-password');
    const errorEl = document.getElementById('forgot-error');
    const btn = document.getElementById('reset-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.style.display = 'none';

        const username = usernameInput.value.trim();
        const phone = phoneInput.value.trim();
        const newPassword = newPasswordInput.value.trim();

        // Basic Client Validation
        if (newPassword.length < 8) {
            errorEl.textContent = "New password must be at least 8 characters long.";
            errorEl.style.display = 'block';
            return;
        }
        if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
            errorEl.textContent = "Password must contain letters and numbers.";
            errorEl.style.display = 'block';
            return;
        }
        if (!/[^a-zA-Z0-9]/.test(newPassword)) {
            errorEl.textContent = "Password must contain at least one special character.";
            errorEl.style.display = 'block';
            return;
        }

        btn.textContent = 'Resetting...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, phone, new_password: newPassword })
            });

            const data = await res.json();

            if (data.success) {
                alert('Password reset successfully! Please login.');
                window.location.href = '/login';
            } else {
                errorEl.textContent = data.message || 'Failed to reset password';
                errorEl.style.display = 'block';
                btn.textContent = 'Reset Password';
                btn.disabled = false;
            }
        } catch (err) {
            console.error('Reset error', err);
            errorEl.textContent = 'An error occurred. Please try again.';
            errorEl.style.display = 'block';
            btn.textContent = 'Reset Password';
            btn.disabled = false;
        }
    });
});
