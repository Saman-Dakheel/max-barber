// ADMIN DASHBOARD LOGIC - V4.0
console.log("%c MAX BARBER ADMIN LOADED ", "background: #c5a059; color: #000; font-size: 20px; font-weight: bold;");

const adminSecret = localStorage.getItem('adminSecret');
if (!adminSecret && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

let currentServices = [];
let currentGallery = [];
let bookingChart = null;

// --- AUTH LOGIC ---
async function authenticatedFetch(url, options = {}) {
    if (!adminSecret) {
        window.location.href = 'login.html';
        return null;
    }

    options.headers = {
        ...options.headers,
        'x-admin-secret': adminSecret
    };

    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            localStorage.removeItem('adminSecret');
            adminSecret = null;
            window.location.href = 'login.html';
            return null;
        }
        return response;
    } catch (err) {
        console.error('Fetch error:', err);
        return null;
    }
}

// --- DATA LOADING ---
async function loadAllData() {
    console.log('Fetching all dashboard data...');
    loadBookings();
    loadTestimonials();
    loadServices();
    loadGallery();
    loadNotifications();
    loadChartData();
}

async function loadBookings() {
    const res = await authenticatedFetch('/api/bookings');
    if (!res) return;
    const bookings = await res.json();
    const list = document.getElementById('bookings-list');
    if (!list) return;
    list.innerHTML = '';
    bookings.forEach(b => {
        const isConfirmed = b.status === 'confirmed';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${b.name}</td>
            <td><span class="status-badge ${isConfirmed ? 'status-confirmed' : ''}">${b.service}</span></td>
            <td>${b.date} @ ${b.time}</td>
            <td>${b.email}</td>
            <td>
                <button class="btn-confirm" onclick="confirmBooking('${b.id}')" ${isConfirmed ? 'disabled' : ''}>${isConfirmed ? 'Confirmed' : 'Confirm'}</button>
                <button class="btn-delete" onclick="deleteItem('bookings', '${b.id}')">Delete</button>
            </td>
        `;
        list.appendChild(row);
    });
}

async function loadTestimonials() {
    const res = await authenticatedFetch('/api/testimonials');
    if (!res) return;
    const items = await res.json();
    const list = document.getElementById('testimonials-list');
    if (!list) return;
    list.innerHTML = '';
    items.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${t.name}</td><td>${t.role}</td><td style="font-size: 0.85rem; max-width: 250px;">${t.story}</td><td><button class="btn-delete" onclick="deleteItem('testimonials', '${t.id}')">Delete</button></td>`;
        list.appendChild(row);
    });
}

function updateStats() {
    try {
        // Today's Bookings
        const today = new Date().toISOString().split('T')[0];
        const bookingsCount = document.querySelectorAll('#bookings-list tr').length; // Simple count for now
        document.getElementById('stat-bookings').innerText = bookingsCount;

        // Services Count
        document.getElementById('stat-services').innerText = currentServices.length;

        // Gallery Count
        document.getElementById('stat-gallery').innerText = currentGallery.length;
    } catch (err) { console.warn('Stats error:', err); }
}

async function loadServices() {
    const res = await authenticatedFetch('/api/services');
    if (!res) return;
    currentServices = await res.json();
    const list = document.getElementById('services-list');
    if (!list) return;
    list.innerHTML = '';
    currentServices.forEach((s, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${s.name}</td>
            <td>${s.price}</td>
            <td style="color: #777; font-size: 0.8rem;">${s.desc}</td>
            <td>
                <button class="btn-confirm" onclick="openEditModal(${idx})">Edit</button>
                <button class="btn-delete" onclick="deleteItem('services', '${s.id}')">Delete</button>
            </td>
        `;
        list.appendChild(row);
    });
    updateStats();
    loadChartData(); // Refresh chart when services/bookings might have changed
}

async function loadGallery() {
    const res = await authenticatedFetch('/api/gallery');
    if (!res) return;
    currentGallery = await res.json();
    const grid = document.getElementById('gallery-manage-grid');
    if (!grid) return;
    grid.innerHTML = '';
    currentGallery.forEach((g, idx) => {
        const card = document.createElement('div');
        card.className = 'gallery-manage-card';
        card.innerHTML = `
            <img src="${g.url}" alt="Work preview">
            <div class="gallery-manage-actions">
                <button class="btn-confirm" onclick="openGalleryEditModal(${idx})" style="padding: 4px 8px;">Edit</button>
                <button class="btn-delete" onclick="deleteItem('gallery', '${g.id}')" style="padding: 4px 8px;">Delete</button>
            </div>
        `;
        grid.appendChild(card);
    });
    updateStats();
}

// --- ACTIONS ---
async function confirmBooking(id) {
    const res = await authenticatedFetch(`/api/bookings/${id}/confirm`, { method: 'PATCH' });
    if (res && res.ok) loadBookings();
}

async function deleteItem(type, id) {
    if (!confirm(`Delete this from ${type}?`)) return;
    const res = await authenticatedFetch(`/api/${type}/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
        if (type === 'bookings') loadBookings();
        if (type === 'testimonials') loadTestimonials();
        if (type === 'services') loadServices();
        if (type === 'gallery') loadGallery();
    }
}

// --- MODAL LOGIC ---
window.openEditModal = function (index) {
    const service = currentServices[index];
    if (!service) return;
    document.getElementById('edit-modal-title').innerText = 'Edit Service';
    document.getElementById('edit-id').value = service.id;
    document.getElementById('edit-name-group').style.display = 'block';
    document.getElementById('edit-price-group').style.display = 'block';

    document.getElementById('edit-name').value = service.name;
    document.getElementById('edit-price').value = service.price;
    document.getElementById('edit-desc').value = service.desc;

    document.getElementById('edit-type').value = 'services';
    document.getElementById('edit-modal').style.display = 'flex';
}

window.openGalleryEditModal = function (index) {
    const item = currentGallery[index];
    if (!item) return;
    document.getElementById('edit-modal-title').innerText = 'Edit Gallery Item';
    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-name-group').style.display = 'none';
    document.getElementById('edit-price-group').style.display = 'none';

    document.getElementById('edit-desc').value = item.url;
    document.getElementById('edit-label-desc').innerText = 'Image URL';

    document.getElementById('edit-type').value = 'gallery';
    document.getElementById('edit-modal').style.display = 'flex';
}

window.closeEditModal = function () {
    document.getElementById('edit-modal').style.display = 'none';
    // Reset labels
    document.getElementById('edit-label-desc').innerText = 'Description';
}

document.getElementById('edit-service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;
    let data = {};

    if (type === 'services') {
        data = {
            name: document.getElementById('edit-name').value,
            price: document.getElementById('edit-price').value,
            desc: document.getElementById('edit-desc').value
        };
    } else {
        data = { url: document.getElementById('edit-desc').value };
    }

    const res = await authenticatedFetch(`/api/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res && res.ok) {
        window.closeEditModal();
        if (type === 'services') loadServices(); else loadGallery();
    }
});

// --- FORM HANDLERS ---
document.getElementById('add-service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('service-name').value,
        price: document.getElementById('service-price').value,
        desc: document.getElementById('service-desc').value
    };
    const res = await authenticatedFetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (res && res.ok) { e.target.reset(); loadServices(); }
});

document.getElementById('add-gallery-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('gallery-url').value;
    const res = await authenticatedFetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    if (res && res.ok) { e.target.reset(); loadGallery(); }
});

// --- NOTIFICATIONS & CHARTS ---
async function loadNotifications() {
    const res = await authenticatedFetch('/api/notifications');
    if (!res) return;
    const lines = await res.json();
    const list = document.getElementById('activity-list');
    if (!list) return;

    if (lines.length === 0) {
        list.innerHTML = '<p style="color: #666; padding: 10px;">No recent activity.</p>';
        return;
    }

    list.innerHTML = '';
    lines.forEach(line => {
        const match = line.match(/\[(.*?)\] (.*)/);
        if (match) {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <span class="activity-time">${match[1]}</span>
                <span class="activity-msg">${match[2]}</span>
            `;
            list.appendChild(item);
        }
    });
}

async function loadChartData() {
    const res = await authenticatedFetch('/api/stats/bookings');
    if (!res) return;
    const data = await res.json();
    renderBookingChart(data);
}

function renderBookingChart(data) {
    const ctx = document.getElementById('bookingChart');
    if (!ctx) return;

    const labels = Object.keys(data).map(d => {
        const date = new Date(d);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const values = Object.values(data);

    if (bookingChart) {
        bookingChart.destroy();
    }

    bookingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bookings',
                data: values,
                borderColor: '#c5a059',
                backgroundColor: 'rgba(197, 160, 89, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#888' },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#888' },
                    grid: { color: '#333' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Polling for notifications
setInterval(loadNotifications, 30000);

// --- INIT ---
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('adminSecret');
    window.location.href = 'login.html';
});

loadAllData();
