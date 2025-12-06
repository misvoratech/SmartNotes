document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        loginError.style.display = 'none';
        loginBtn.textContent = 'Signing in...';
        loginBtn.disabled = true;

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('isAdmin', data.isAdmin === true);
                window.location.href = '/';
            } else {
                loginError.textContent = data.message || 'Invalid credentials';
                loginError.style.display = 'block';
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
            }
        } catch (err) {
            console.error('Login error', err);
            loginError.textContent = 'An error occurred. Please try again.';
            loginError.style.display = 'block';
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        }
    });

    // Load Creator Details
    fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
            if (data.creator_details) {
                const el = document.getElementById('creator-details-login');
                if (el) el.innerHTML = data.creator_details.replace(/\n/g, '<br>');
            }
        })
        .catch(err => console.error(err));
});
