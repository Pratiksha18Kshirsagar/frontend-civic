const BaseUrl = "http://localhost:4000";

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.style.display = 'none';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await axios.post(`${BaseUrl}/users/admin/login`, { email, password });

        if (res.status === 200) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('userName', res.data.name);
            localStorage.setItem('userRole', res.data.role);
            window.location.href = './admin.html';
        }
    } catch (err) {
        console.error(err);
        errorMsg.style.display = 'block';
        errorMsg.textContent = err.response ? err.response.data.message : 'Server not reachable';
    }
});
