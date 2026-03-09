const BaseUrl = "https://civic-issue-reporter-cx6z.onrender.com";

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;

    try {
        const res = await axios.post(`${BaseUrl}/users/signup`, { name, email, phone, password });

        if (res.status === 201) {
            successMsg.style.display = 'block';
            successMsg.textContent = 'Account created! Redirecting to login...';
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
        }
    } catch (err) {
        console.error(err);
        errorMsg.style.display = 'block';
        errorMsg.textContent = err.response ? err.response.data.message : 'Server not reachable';
    }
});
