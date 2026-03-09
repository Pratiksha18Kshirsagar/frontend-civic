const BaseUrl = "http://localhost:4000";
const token = localStorage.getItem('token');
const issuesFeed = document.getElementById('issuesFeed');
const reportFab = document.getElementById('reportFab');
const modalOverlay = document.getElementById('modalOverlay');
const cancelBtn = document.getElementById('cancelBtn');
const reportForm = document.getElementById('reportForm');
const submitBtn = document.getElementById('submitBtn');
const fileInput = document.getElementById('issueImage');
const fileLabel = document.getElementById('fileLabel');
const toast = document.getElementById('toast');
const userNameEl = document.getElementById('userName');
const userBadgeEl = document.getElementById('userBadge');
const logoutBtn = document.getElementById('logoutBtn');

// New UI Controls
const tabOpen = document.getElementById('tabOpen');
const tabResolved = document.getElementById('tabResolved');
const mapToggleBtn = document.getElementById('mapToggleBtn');
const mapContainer = document.getElementById('mapContainer');

let userLat = null;
let userLng = null;
let selectedLat = null;
let selectedLng = null;
let map = null;
let markersLayer = null;
let modalMap = null;
let modalMarker = null;

let allIssues = [];
let currentTab = 'Open';

// ─── Auth Guard ───
if (!token) {
    window.location.href = '../index.html';
}

// ─── Load User Gamification Stats ───
async function loadUserStats() {
    try {
        const res = await axios.get(`${BaseUrl}/users/me/stats`, {
            headers: { Authorization: token }
        });
        userNameEl.textContent = `Hi, ${res.data.name}`;
        userBadgeEl.textContent = `Badge: ${res.data.badge}`;
        let badgeColor = '#64748b'; // Newbie
        if (res.data.badge === 'Active Citizen') badgeColor = '#3b82f6';
        if (res.data.badge === 'Civic Hero') badgeColor = '#f59e0b';
        userBadgeEl.style.color = badgeColor;
        userBadgeEl.style.background = `${badgeColor}25`;
    } catch (e) {
        console.error("Failed to load stats", e);
        userNameEl.textContent = `Hi, User`;
    }
}
loadUserStats();

// ─── Logout ───
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        window.location.href = '../index.html';
    });
}

// ─── Toast ───
function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = isError ? 'toast error show' : 'toast show';
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ─── Init Map ───
function initMap(lat, lng) {
    map = L.map('map').setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    const userIcon = L.divIcon({
        html: '<div style="width:16px;height:16px;background:#6366f1;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(99,102,241,0.6);"></div>',
        iconSize: [16, 16],
        className: ''
    });
    L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup('📍 You are here');

    markersLayer = L.layerGroup().addTo(map);
}

// ─── Map Toggle ───
let mapVisible = false;
mapToggleBtn.addEventListener('click', () => {
    mapVisible = !mapVisible;
    if (mapVisible) {
        mapContainer.style.display = 'block';
        mapToggleBtn.textContent = '📍 Hide Map';
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
                plotMarkers();
            }, 100);
        }
    } else {
        mapContainer.style.display = 'none';
        mapToggleBtn.textContent = '🗺️ Show Map';
    }
});

// ─── Load Nearby Issues ───
async function loadNearbyIssues() {
    try {
        const res = await axios.get(`${BaseUrl}/api/issues/nearby?lat=${userLat}&lng=${userLng}`);
        allIssues = res.data;
        renderFeed();
    } catch (error) {
        console.error(error);
        issuesFeed.innerHTML = `
            <div class="empty-state">
                <div style="font-size:2rem;margin-bottom:10px;">⚠️</div>
                <p>Failed to load nearby issues. Please try again.</p>
            </div>
        `;
    }
}

function plotMarkers() {
    if (!markersLayer || !mapVisible) return;
    markersLayer.clearLayers();
    allIssues.forEach(issue => {
        if (issue.status !== currentTab && currentTab !== 'All') return;
        const statusColor = issue.status === 'Resolved' ? '#4ade80' : issue.status === 'In Progress' ? '#fbbf24' : '#f87171';
        const pinIcon = L.divIcon({
            html: `<div style="width:14px;height:14px;background:${statusColor};border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px ${statusColor}80;"></div>`,
            iconSize: [14, 14],
            className: ''
        });
        L.marker(
            [issue.location.coordinates[1], issue.location.coordinates[0]],
            { icon: pinIcon }
        ).addTo(markersLayer).bindPopup(`<b>${issue.title}</b><br>${issue.status}`);
    });
}

function renderFeed() {
    issuesFeed.innerHTML = '';
    const filteredIssues = allIssues.filter(issue =>
        currentTab === 'Open' ? issue.status !== 'Resolved' : issue.status === 'Resolved'
    );

    plotMarkers();

    if (filteredIssues.length === 0) {
        issuesFeed.innerHTML = `
            <div class="empty-state">
                <div style="font-size:3rem;margin-bottom:15px;">🎉</div>
                <p>No ${currentTab.toLowerCase()} issues found nearby.</p>
            </div>
        `;
        return;
    }

    filteredIssues.forEach(issue => {
        const card = document.createElement('div');
        card.className = 'issue-card';

        const statusClass = issue.status === 'Open' ? 'status-open'
            : issue.status === 'In Progress' ? 'status-in-progress' : 'status-resolved';

        let imageHTML = '';
        if (issue.status === 'Resolved' && issue.s3ResolvedImageUrl) {
            imageHTML = `
                <div class="resolved-images">
                    <div class="img-wrapper">
                        <img src="${issue.s3ImageUrl}" alt="Before" loading="lazy">
                        <span class="img-label before" style="position:absolute;top:10px;left:10px;background:rgba(239,68,68,0.8);color:#fff;padding:4px 8px;font-size:0.7rem;font-weight:700;border-radius:4px;">BEFORE</span>
                    </div>
                    <div class="img-wrapper">
                        <img src="${issue.s3ResolvedImageUrl}" alt="After" loading="lazy">
                        <span class="img-label after" style="position:absolute;top:10px;left:10px;background:rgba(34,197,94,0.8);color:#fff;padding:4px 8px;font-size:0.7rem;font-weight:700;border-radius:4px;">AFTER</span>
                    </div>
                </div>
            `;
        } else {
            imageHTML = `<img src="${issue.s3ImageUrl}" alt="${issue.title}" loading="lazy">`;
        }

        let reporterStatsStr = '';
        if (issue.reporter) {
            const phoneStr = issue.reporter.phone ? ` &bull; 📞 ${issue.reporter.phone}` : '';
            const resolvedAmt = issue.reporter.resolvedCount || 0;
            const resolvedStr = `<span style="background:rgba(16,185,129,0.2);color:#10b981;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;font-size:0.75rem;">🏆 ${resolvedAmt} Resolved</span>`;
            reporterStatsStr = `<div class="reporter-info" style="flex-wrap:wrap;">👤 ${issue.reporter.name}${phoneStr} <a href="mailto:${issue.reporter.email}">@Email</a>${resolvedStr}</div>`;
        }

        card.innerHTML = `
            ${imageHTML}
            <div class="issue-card-body">
                <h3>${issue.title}</h3>
                <p class="desc">${issue.description}</p>
                ${issue.humanLossOrEffect ? `<p class="impact">Impact: ${issue.humanLossOrEffect}</p>` : ''}
                ${reporterStatsStr}
                <div class="issue-card-footer">
                    <span class="status-badge ${statusClass}">${issue.status}</span>
                    <button class="like-btn" data-id="${issue._id}">
                        ❤️ <span style="margin-left:4px;">${issue.upvotes}</span>
                    </button>
                </div>
            </div>
        `;

        issuesFeed.appendChild(card);
    });

    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', () => upvoteIssue(btn));
    });
}

// ─── Tabs ───
tabOpen.addEventListener('click', () => {
    currentTab = 'Open';
    tabOpen.classList.add('active');
    tabResolved.classList.remove('active');
    renderFeed();
});

tabResolved.addEventListener('click', () => {
    currentTab = 'Resolved';
    tabResolved.classList.add('active');
    tabOpen.classList.remove('active');
    renderFeed();
});

// ─── Upvote ───
async function upvoteIssue(btn) {
    const id = btn.dataset.id;
    try {
        btn.disabled = true;
        const res = await axios.put(`${BaseUrl}/api/issues/${id}/upvote`, {}, {
            headers: { Authorization: token }
        });
        btn.querySelector('span').textContent = res.data.issue.upvotes;
        const issueToUpdate = allIssues.find(i => i._id === id);
        if (issueToUpdate) issueToUpdate.upvotes = res.data.issue.upvotes;
        showToast(res.data.message === 'Upvote removed' ? 'Unliked 🤍' : 'Liked! ❤️');
    } catch (err) {
        if (err.response && err.response.status === 401) {
            showToast('Please login to upvote', true);
        } else {
            showToast('Failed to upvote', true);
        }
    } finally {
        btn.disabled = false;
    }
}

// ─── Modal Controls ───
reportFab.addEventListener('click', () => {
    modalOverlay.classList.add('active');

    selectedLat = userLat;
    selectedLng = userLng;

    if (!modalMap && userLat && userLng) {
        modalMap = L.map('modalMap').setView([userLat, userLng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(modalMap);

        modalMarker = L.marker([userLat, userLng], { draggable: true }).addTo(modalMap);

        modalMarker.on('dragend', function () {
            const position = modalMarker.getLatLng();
            selectedLat = position.lat;
            selectedLng = position.lng;
        });

        modalMap.on('click', function (e) {
            selectedLat = e.latlng.lat;
            selectedLng = e.latlng.lng;
            modalMarker.setLatLng([selectedLat, selectedLng]);
        });
    } else if (modalMap) {
        modalMap.setView([userLat, userLng], 15);
        modalMarker.setLatLng([userLat, userLng]);
        setTimeout(() => modalMap.invalidateSize(), 150);
    }
});

cancelBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    reportForm.reset();
    fileLabel.textContent = 'Tap to capture or select photo';
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
        reportForm.reset();
        fileLabel.textContent = 'Tap to capture or select photo';
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileLabel.textContent = fileInput.files[0].name;
    }
});

// ─── Submit Report (Payment + Issue creation) ───
reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedLat || !selectedLng) {
        showToast('Please pin the exact location on the map', true);
        return;
    }

    const title = document.getElementById('issueTitle').value;
    const description = document.getElementById('issueDesc').value;
    const humanLoss = document.getElementById('issueHumanLoss').value;
    const image = fileInput.files[0];

    if (!image) {
        showToast('Please select a photo', true);
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing Payment...';

        // 1. Create Order
        const orderRes = await axios.post(`${BaseUrl}/api/payment/order`, {}, {
            headers: { Authorization: token }
        });

        const options = {
            key: "rzp_test_SFGB7hqBW4zF2i", // Added real test key
            amount: 100, // 1 INR
            currency: "INR",
            name: "Civic Issue Reporter",
            description: "Issue Reporting Verification Fee",
            order_id: orderRes.data.id,
            handler: async function (response) {
                // Payment success, proceed with issue creation
                submitBtn.textContent = 'Uploading...';
                const transactionId = response.razorpay_payment_id || 'mock_txn_' + Date.now();

                const formData = new FormData();
                formData.append('title', title);
                formData.append('description', description);
                formData.append('humanLossOrEffect', humanLoss);
                formData.append('lat', selectedLat);
                formData.append('lng', selectedLng);
                formData.append('image', image);
                formData.append('transactionId', transactionId);

                try {
                    await axios.post(`${BaseUrl}/api/issues`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            Authorization: token
                        }
                    });

                    showToast('Issue reported successfully! ✅');
                    modalOverlay.classList.remove('active');
                    reportForm.reset();
                    fileLabel.textContent = 'Tap to capture or select photo';
                    loadNearbyIssues();
                    loadUserStats(); // Update badge if needed
                } catch (error) {
                    console.error("Issue creation error", error);
                    showToast('Failed to submit report', true);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Pay ₹1 & Submit';
                }
            },
            prefill: {
                name: localStorage.getItem('userName') || "User",
            },
            theme: { color: "#6366f1" },
            modal: {
                ondismiss: function () {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Pay ₹1 & Submit';
                }
            }
        };

        const rzp = new window.Razorpay(options);

        // Error handler for mock test key missing or failure
        rzp.on('payment.failed', function (response) {
            console.error(response.error);
            showToast('Payment Failed. Please try again.', true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Pay ₹1 & Submit';
        });

        rzp.open();

    } catch (error) {
        console.error(error);
        if (error.response && error.response.status === 401) {
            showToast('Please login to report issues', true);
        } else {
            showToast('Failed to initiate payment', true);
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pay ₹1 & Submit';
    }
});

// ─── Geolocation Init ───
window.addEventListener('DOMContentLoaded', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;
                initMap(userLat, userLng);
                loadNearbyIssues();
            },
            (error) => {
                console.error('Geolocation error:', error);
                userLat = 28.6139;
                userLng = 77.2090;
                initMap(userLat, userLng);
                loadNearbyIssues();
            }
        );
    } else {
        userLat = 28.6139;
        userLng = 77.2090;
        initMap(userLat, userLng);
        loadNearbyIssues();
    }
});
