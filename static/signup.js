document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const signupError = document.getElementById('signup-error');
    const signupBtn = document.getElementById('signup-btn');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        signupError.style.display = 'none';

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (password !== confirmPassword) {
            signupError.textContent = "Passwords do not match";
            signupError.style.display = 'block';
            return;
        }

        // Basic Client Validation
        if (password.length < 8) {
            signupError.textContent = "Password must be at least 8 characters long.";
            signupError.style.display = 'block';
            return;
        }
        if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
            signupError.textContent = "Password must contain letters and numbers.";
            signupError.style.display = 'block';
            return;
        }
        if (username && password.toLowerCase().includes(username.toLowerCase())) {
            signupError.textContent = "Password cannot contain your username.";
            signupError.style.display = 'block';
            return;
        }

        signupBtn.textContent = 'Creating Account...';
        signupBtn.disabled = true;

        try {
            const res = await fetch('/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                // Auto login or redirect to login? Let's redirect to login for simplicity or login page can say "Account created".
                // Better UX: Redirect to login with a parameter or just alert.
                // Let's redirect to login.
                alert("Account created successfully! Please sign in.");
                window.location.href = '/login';
            } else {
                signupError.textContent = data.message || 'Failed to create account';
                signupError.style.display = 'block';
                signupBtn.textContent = 'Sign Up';
                signupBtn.disabled = false;
            }
        } catch (err) {
            console.error('Signup error', err);
            signupError.textContent = 'An error occurred. Please try again.';
            signupError.style.display = 'block';
            signupBtn.textContent = 'Sign Up';
            signupBtn.disabled = false;
        }
    });
});
