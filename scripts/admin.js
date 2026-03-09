const BaseUrl = "https://civic-issue-reporter-cx6z.onrender.com";
const token = localStorage.getItem('token');
const userRole = localStorage.getItem('userRole');
const issueTableBody = document.getElementById('issueTableBody');
const openCountEl = document.getElementById('openCount');
const totalCountEl = document.getElementById('totalCount');
const toast = document.getElementById('toast');
const adminNameEl = document.getElementById('adminName');
const logoutBtn = document.getElementById('logoutBtn');

// ─── Auth Guard ───
if (!token || userRole !== 'admin') {
    window.location.href = './admin-login.html';
}

// ─── Display admin name ───
const adminName = localStorage.getItem('userName');
if (adminNameEl && adminName) {
    adminNameEl.textContent = `Admin: ${adminName}`;
}

// ─── Logout ───
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        window.location.href = './admin-login.html';
    });
}

function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = isError ? 'toast error show' : 'toast show';
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

let adminMap = null;
let markersLayer = null;

function initAdminMap() {
    if (!adminMap) {
        adminMap = L.map('adminMap').setView([28.6139, 77.2090], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(adminMap);
        markersLayer = L.layerGroup().addTo(adminMap);
    }
}

const loadIssues = async () => {
    try {
        const res = await axios.get(`${BaseUrl}/api/issues`, {
            headers: { Authorization: token }
        });
        const issues = res.data;

        openCountEl.textContent = issues.length;
        totalCountEl.textContent = issues.length;

        if (issues.length === 0) {
            issueTableBody.innerHTML = `
                <tr><td colspan="6">
                    <div class="empty-state">
                        <div class="icon">✅</div>
                        <p>All issues are resolved! Great work.</p>
                    </div>
                </td></tr>
            `;
            return;
        }

        issueTableBody.innerHTML = '';

        if (issues.length > 0) {
            initAdminMap();
            markersLayer.clearLayers();
            // Center map on the first issue
            const firstLat = issues[0].location.coordinates[1];
            const firstLng = issues[0].location.coordinates[0];
            adminMap.setView([firstLat, firstLng], 12);
        }

        issues.forEach(issue => {
            if (adminMap && issue.location && issue.location.coordinates) {
                const lat = issue.location.coordinates[1];
                const lng = issue.location.coordinates[0];
                const statusColor = issue.status === 'Resolved' ? '#4ade80' : '#f87171';
                const pinIcon = L.divIcon({
                    html: `<div style="width:14px;height:14px;background:${statusColor};border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px ${statusColor}80;"></div>`,
                    iconSize: [14, 14],
                    className: ''
                });
                L.marker([lat, lng], { icon: pinIcon }).addTo(markersLayer)
                    .bindPopup(`<b>${issue.title}</b><br>${issue.status}`);
            }

            const tr = document.createElement('tr');
            const statusClass = issue.status === 'Open' ? 'status-open' : 'status-resolved';
            const reporterInfo = issue.reporter ? `<strong>${issue.reporter.name}</strong><br><a href="mailto:${issue.reporter.email}" style="color: #6366f1; text-decoration: none; font-size: 0.8rem;">${issue.reporter.email}</a><br><a href="tel:${issue.reporter.phone}" style="color: #4ade80; text-decoration: none; font-size: 0.8rem;">📞 ${issue.reporter.phone || 'N/A'}</a>` : 'Anonymous';

            tr.innerHTML = `
                <td><img class="issue-thumb" src="${issue.s3ImageUrl}" alt="${issue.title}"></td>
                <td>${reporterInfo}</td>
                <td>
                    <strong>${issue.title}</strong><br>
                    <span style="font-size: 0.8rem; color: #94a3b8;">${issue.description.length > 60 ? issue.description.slice(0, 60) + '...' : issue.description}</span>
                </td>
                <td style="color: #fca5a5; font-size: 0.85rem;">${issue.humanLossOrEffect || '-'}</td>
                <td>
                    ▲ ${issue.upvotes}<br>
                    <span class="status-badge ${statusClass}" style="margin-top: 6px; display: inline-block;">${issue.status}</span>
                </td>
                <td>
                    <button class="resolve-btn" data-id="${issue._id}">Resolve</button>
                    <input type="file" class="hidden-file" accept="image/*" data-id="${issue._id}">
                </td>
            `;

            issueTableBody.appendChild(tr);

            // Wire up resolve button to trigger file input
            const resolveBtn = tr.querySelector('.resolve-btn');
            const fileInput = tr.querySelector('.hidden-file');

            resolveBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', async () => {
                if (fileInput.files.length === 0) return;

                const formData = new FormData();
                formData.append('image', fileInput.files[0]);

                try {
                    resolveBtn.disabled = true;
                    resolveBtn.textContent = 'Uploading...';

                    await axios.put(`${BaseUrl}/api/issues/${issue._id}/resolve`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            Authorization: token
                        }
                    });

                    showToast('Issue resolved successfully! ✅');
                    loadIssues();
                } catch (error) {
                    console.error(error);
                    if (error.response && error.response.status === 403) {
                        showToast('Admin access required', true);
                    } else {
                        showToast('Failed to resolve issue', true);
                    }
                    resolveBtn.disabled = false;
                    resolveBtn.textContent = 'Mark Resolved';
                }
            });
        });

    } catch (error) {
        console.error(error);
        if (error.response && error.response.status === 401) {
            window.location.href = './admin-login.html';
        }
        issueTableBody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <p>Failed to load issues. Is the server running?</p>
                </div>
            </td></tr>
        `;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    loadIssues();
});
