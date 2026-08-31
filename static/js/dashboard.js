// Dashboard pages: user-specific, people-leader, and business-unit views.

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function stat(val, label) {
    return `<div class="stat"><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>`;
}
function allocPill(v) {
    const cls = v >= 75 ? 'high' : v >= 40 ? '' : 'warn';
    return `<span class="pill ${cls}">${v}%</span>`;
}

// ---------- User specific (charts) ----------
const _charts = {};
function drawBar(canvasId, rows) {
    const ctx = document.getElementById(canvasId);
    if (_charts[canvasId]) _charts[canvasId].destroy();
    if (!rows.length) {
        _charts[canvasId] = null;
        const c = ctx.getContext('2d');
        c.clearRect(0, 0, ctx.width, ctx.height);
        c.font = '13px Inter, sans-serif';
        c.fillStyle = '#94a3b8';
        c.fillText('No data for this selection', 12, 24);
        return;
    }
    _charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rows.map(r => r.label),
            datasets: [{
                label: 'Average % Allocated',
                data: rows.map(r => r.value),
                backgroundColor: '#0b5ed7',
                hoverBackgroundColor: '#2f7ff0',
                borderRadius: 6,
                maxBarThickness: 24,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.parsed.x}% avg allocated` } },
            },
            scales: {
                x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#eef2f8' } },
                y: { grid: { display: false } },
            },
        },
    });
}

async function initUserDashboard() {
    const managerSel = document.getElementById('dashManager');
    const employeeSel = document.getElementById('dashEmployee');
    const monthSel = document.getElementById('dashMonth');
    const statsEl = document.getElementById('userStats');

    // Full employee option list (used when no manager is selected).
    const allEmployeeOptions = employeeSel.innerHTML;

    const managers = await apiFetch('/api/managers');
    managerSel.innerHTML = '<option value="">All managers</option>' +
        managers.map(m => `<option value="${esc(m.value)}">${esc(m.label)} (${m.reportees})</option>`).join('');

    async function refreshEmployees() {
        if (!managerSel.value) {
            employeeSel.innerHTML = allEmployeeOptions;
            return;
        }
        const reportees = await apiFetch(`/api/reportees?manager=${encodeURIComponent(managerSel.value)}`);
        employeeSel.innerHTML = '<option value="">All employees</option>' +
            reportees.map(r => `<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('');
    }

    async function load() {
        const params = new URLSearchParams();
        if (managerSel.value) params.set('manager', managerSel.value);
        if (employeeSel.value) params.set('employee', employeeSel.value);
        if (monthSel.value) params.set('month', monthSel.value);
        const data = await apiFetch('/api/dashboard/user-breakdown?' + params.toString());

        statsEl.innerHTML =
            stat(data.meta.allocations, 'Allocations') +
            stat(data.meta.employees, 'Employees') +
            stat(data.meta.avg + '%', 'Average Allocated');

        drawBar('chartCluster', data.by_cluster);
        drawBar('chartBu', data.by_bu);
        drawBar('chartType', data.by_project_type);
        drawBar('chartIl', data.by_il);
    }

    managerSel.addEventListener('change', async () => { await refreshEmployees(); load(); });
    employeeSel.addEventListener('change', load);
    monthSel.addEventListener('change', load);
    document.getElementById('dashReset').addEventListener('click', async () => {
        managerSel.value = ''; monthSel.value = '';
        await refreshEmployees();
        employeeSel.value = '';
        load();
    });
    load();
}

// ---------- People leader ----------
const _leaderCharts = {};
// Philips sequential blue ramp (light -> deep) used across every leader chart.
const UTIL_COLORS = { bench: '#b9cdea', under: '#6699de', healthy: '#0b5ed7', over: '#0a2e6b' };

function _destroy(id) {
    if (_leaderCharts[id]) { _leaderCharts[id].destroy(); _leaderCharts[id] = null; }
}

function statCard(val, label, tone) {
    return `<div class="stat ${tone || ''}"><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>`;
}

function utilBand(util) {
    if (util <= 0) return 'bench';
    if (util < 80) return 'under';
    if (util <= 100) return 'healthy';
    return 'over';
}
function utilPill(util) {
    return `<span class="pill u-${utilBand(util)}">${util}%</span>`;
}

function drawTeamUtil(rows) {
    const id = 'chartTeamUtil';
    _destroy(id);
    const ctx = document.getElementById(id);
    const top = rows.slice(0, 12);
    _leaderCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(r => r.manager),
            datasets: [{
                data: top.map(r => r.avg_util),
                backgroundColor: top.map(r => UTIL_COLORS[utilBand(r.avg_util)]),
                borderRadius: 6,
                maxBarThickness: 26,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.parsed.x}% avg utilization` } },
            },
            scales: {
                x: { beginAtZero: true, suggestedMax: 100, ticks: { callback: v => v + '%' }, grid: { color: '#eef2f8' } },
                y: { grid: { display: false } },
            },
        },
    });
}

function drawMix(u) {
    const id = 'chartMix';
    _destroy(id);
    const ctx = document.getElementById(id);
    _leaderCharts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Zero allocation (0%)', 'Under-utilized (<80%)', 'Healthy (80-100%)', 'Over-allocated (>100%)'],
            datasets: [{
                data: [u.bench, u.under, u.healthy, u.over],
                backgroundColor: [UTIL_COLORS.bench, UTIL_COLORS.under, UTIL_COLORS.healthy, UTIL_COLORS.over],
                borderWidth: 2,
                borderColor: '#fff',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } },
                tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} reportees` } },
            },
        },
    });
}

function drawTrend(rows, selMonth) {
    const id = 'chartTrend';
    _destroy(id);
    const ctx = document.getElementById(id);
    _leaderCharts[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: rows.map(r => r.month),
            datasets: [{
                label: 'Avg utilization',
                data: rows.map(r => r.avg_util),
                borderColor: '#0b5ed7',
                backgroundColor: 'rgba(11, 94, 215, .12)',
                fill: true,
                tension: .35,
                pointRadius: rows.map(r => r.month === selMonth ? 5 : 3),
                pointBackgroundColor: rows.map(r => r.month === selMonth ? '#0a2e6b' : '#0b5ed7'),
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.parsed.y}% avg utilization` } },
            },
            scales: {
                y: { beginAtZero: true, suggestedMax: 100, ticks: { callback: v => v + '%' }, grid: { color: '#eef2f8' } },
                x: { grid: { display: false } },
            },
        },
    });
}

function drawCapacity(rows) {
    const id = 'chartCapacity';
    _destroy(id);
    const ctx = document.getElementById(id);
    const top = rows.slice(0, 12);
    _leaderCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(r => r.manager),
            datasets: [
                { label: 'Team size', data: top.map(r => r.team_size), backgroundColor: '#c7d7f0', borderRadius: 5, maxBarThickness: 22 },
                { label: 'Allocated', data: top.map(r => r.allocated), backgroundColor: '#0b5ed7', borderRadius: 5, maxBarThickness: 22 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } },
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
        },
    });
}

function drawProjects(rows) {
    const id = 'chartCapacity';
    _destroy(id);
    const ctx = document.getElementById(id);
    const top = rows.slice(0, 14);
    _leaderCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(r => r.name),
            datasets: [{
                label: 'Projects',
                data: top.map(r => r.projects),
                backgroundColor: '#5b8def',
                borderRadius: 5,
                maxBarThickness: 22,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.parsed.y} project(s)` } },
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
        },
    });
}

const STATUS_LABEL = { bench: 'Zero allocation', under: 'Under-utilized', healthy: 'Healthy', over: 'Over-allocated' };
function statusPill(status) {
    return `<span class="pill u-${status}">${STATUS_LABEL[status]}</span>`;
}

async function initLeaderDashboard() {
    const managerSel = document.getElementById('leaderManager');
    const monthSel = document.getElementById('leaderMonth');
    const noteEl = document.getElementById('leaderMonthNote');
    const statsEl = document.getElementById('leaderStats');
    const headEl = document.getElementById('leaderHead');
    const bodyEl = document.getElementById('leaderBody');
    const tableTitle = document.getElementById('leaderTableTitle');
    let currentMonth = null;

    const managers = await apiFetch('/api/managers');
    managerSel.innerHTML = '<option value="">All teams</option>' +
        managers.map(m => `<option value="${esc(m.value)}">${esc(m.label)} (${m.reportees})</option>`).join('');

    async function load() {
        const params = new URLSearchParams();
        if (managerSel.value) params.set('manager', managerSel.value);
        if (monthSel.value) params.set('month', monthSel.value);
        const data = await apiFetch('/api/dashboard/people-leader?' + params.toString());

        if (!monthSel.options.length) {
            monthSel.innerHTML = data.months.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
            currentMonth = data.month;
            monthSel.value = data.month;
        }
        noteEl.textContent = monthSel.value === currentMonth ? 'Showing current month' : '';

        const k = data.kpis;
        const isTeam = data.scope === 'team';

        statsEl.innerHTML =
            (isTeam
                ? statCard(k.reportees, 'Reportees')
                : statCard(k.leaders, 'People Leaders') + statCard(k.reportees, 'Reportees')) +
            statCard(k.avg_util + '%', 'Avg Utilization') +
            statCard(k.fully_allocated, 'Fully Allocated', 'accent') +
            statCard(k.over_allocated, 'Over-allocated', 'deep') +
            statCard(k.bench, 'Zero Allocation', 'soft');

        drawMix(data.utilization);
        drawTrend(data.trend, data.month);

        if (isTeam) {
            document.getElementById('titleTeamUtil').textContent = 'Reportee Utilization';
            document.getElementById('titleTrend').textContent = `Team Utilization Trend — ${data.scope_label}`;
            document.getElementById('titleCapacity').textContent = 'Projects per Reportee';
            drawTeamUtil(data.by_reportee.map(r => ({ manager: r.name, avg_util: r.util })));
            drawProjects(data.by_reportee);
            renderReporteeTable(data.by_reportee);
            tableTitle.textContent = `Reportees — ${data.scope_label}`;
        } else {
            document.getElementById('titleTeamUtil').textContent = 'Team Utilization by Manager';
            document.getElementById('titleTrend').textContent = 'Utilization Trend (12 Months)';
            document.getElementById('titleCapacity').textContent = 'Team Size vs Allocated Reportees';
            drawTeamUtil(data.by_manager);
            drawCapacity(data.by_manager);
            renderManagerTable(data.by_manager);
            tableTitle.textContent = 'Team Breakdown';
        }
    }

    function renderManagerTable(rows) {
        headEl.innerHTML = `<tr>
            <th>Reporting Manager</th><th>Team Size</th><th>Allocated</th>
            <th>On Bench</th><th>Over-allocated</th><th>Avg Utilization</th><th>Coverage</th>
        </tr>`;
        if (!rows.length) { bodyEl.innerHTML = '<tr class="empty-row"><td colspan="7">No data.</td></tr>'; return; }
        bodyEl.innerHTML = rows.map(r => {
            const coverage = r.team_size ? Math.round((r.allocated / r.team_size) * 100) : 0;
            return `<tr>
                <td><strong>${esc(r.manager)}</strong></td>
                <td>${r.team_size}</td>
                <td>${r.allocated}</td>
                <td>${r.team_size - r.allocated}</td>
                <td>${r.over ? `<span class="pill u-over">${r.over}</span>` : '0'}</td>
                <td>${utilPill(r.avg_util)}</td>
                <td><div class="coverage-bar"><span style="width:${coverage}%"></span></div><span class="coverage-txt">${coverage}%</span></td>
            </tr>`;
        }).join('');
    }

    function renderReporteeTable(rows) {
        headEl.innerHTML = `<tr>
            <th>Reportee</th><th>Job Title</th><th>Projects</th><th>Utilization</th><th>Status</th>
        </tr>`;
        if (!rows.length) { bodyEl.innerHTML = '<tr class="empty-row"><td colspan="5">No reportees.</td></tr>'; return; }
        bodyEl.innerHTML = rows.map(r => `<tr>
            <td><strong>${esc(r.name)}</strong></td>
            <td>${esc(r.job_title || '—')}</td>
            <td>${r.projects}</td>
            <td>${utilPill(r.util)}</td>
            <td>${statusPill(r.status)}</td>
        </tr>`).join('');
    }

    managerSel.addEventListener('change', load);
    monthSel.addEventListener('change', load);
    document.getElementById('leaderReset').addEventListener('click', () => {
        managerSel.value = '';
        if (currentMonth) monthSel.value = currentMonth;
        load();
    });
    load();
}

// ---------- Business unit ----------
// Philips-blue categorical palette for BU share/segments.
const BU_PALETTE = ['#0b5ed7', '#2f7ff0', '#0a2e6b', '#6699de', '#0f2350', '#89b0e6', '#1b4f9c', '#b9cdea', '#3d6fc0', '#5b8def'];

function drawBuAvg(rows) {
    const id = 'chartBuAvg';
    _destroy(id);
    const top = rows.slice(0, 12);
    _leaderCharts[id] = new Chart(document.getElementById(id), {
        type: 'bar',
        data: {
            labels: top.map(r => r.bu),
            datasets: [{
                data: top.map(r => r.avg_allocation),
                backgroundColor: top.map(r => UTIL_COLORS[utilBand(r.avg_allocation)]),
                borderRadius: 6,
                maxBarThickness: 26,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.parsed.x}% avg allocation` } },
            },
            scales: {
                x: { beginAtZero: true, suggestedMax: 100, ticks: { callback: v => v + '%' }, grid: { color: '#eef2f8' } },
                y: { grid: { display: false } },
            },
        },
    });
}

function drawBuShare(rows) {
    const id = 'chartBuShare';
    _destroy(id);
    const top = rows.slice(0, 10);
    _leaderCharts[id] = new Chart(document.getElementById(id), {
        type: 'doughnut',
        data: {
            labels: top.map(r => r.bu),
            datasets: [{
                data: top.map(r => r.total_alloc),
                backgroundColor: top.map((_, i) => BU_PALETTE[i % BU_PALETTE.length]),
                borderWidth: 2,
                borderColor: '#fff',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
                tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} allocation pts` } },
            },
        },
    });
}

function drawBuTrend(rows) {
    const id = 'chartBuTrend';
    _destroy(id);
    _leaderCharts[id] = new Chart(document.getElementById(id), {
        type: 'line',
        data: {
            labels: rows.map(r => r.month),
            datasets: [{
                label: 'Total allocation',
                data: rows.map(r => r.total),
                borderColor: '#0b5ed7',
                backgroundColor: 'rgba(11, 94, 215, .12)',
                fill: true,
                tension: .35,
                pointRadius: 3,
                pointBackgroundColor: '#0b5ed7',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${c.parsed.y} allocation pts` } },
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#eef2f8' } },
                x: { grid: { display: false } },
            },
        },
    });
}

function drawBuMix(rows) {
    const id = 'chartBuMix';
    _destroy(id);
    const top = rows.slice(0, 12);
    _leaderCharts[id] = new Chart(document.getElementById(id), {
        type: 'bar',
        data: {
            labels: top.map(r => r.bu),
            datasets: [
                { label: 'Employees', data: top.map(r => r.employees), backgroundColor: '#0b5ed7', borderRadius: 5, maxBarThickness: 20 },
                { label: 'Projects', data: top.map(r => r.projects), backgroundColor: '#b9cdea', borderRadius: 5, maxBarThickness: 20 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
        },
    });
}

async function initBuDashboard() {
    const monthSel = document.getElementById('buMonth');
    const noteEl = document.getElementById('buMonthNote');
    const statsEl = document.getElementById('buStats');
    const bodyEl = document.getElementById('buBody');

    async function load() {
        const params = new URLSearchParams();
        if (monthSel.value) params.set('month', monthSel.value);
        const data = await apiFetch('/api/dashboard/business-unit?' + params.toString());

        if (monthSel.options.length <= 1) {
            monthSel.innerHTML = '<option value="">All months</option>' +
                data.months.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
        }
        noteEl.textContent = monthSel.value ? `Showing ${monthSel.value}` : 'Showing all months';

        const k = data.kpis;
        statsEl.innerHTML =
            statCard(k.business_units, 'Business Units') +
            statCard(k.employees, 'Allocated Employees') +
            statCard(k.projects, 'Active Projects', 'accent') +
            statCard(k.avg_allocation + '%', 'Avg Allocation') +
            statCard(k.total_alloc, 'Total Allocation Pts', 'deep');

        drawBuAvg(data.by_bu);
        drawBuShare(data.by_bu);
        drawBuTrend(data.trend);
        drawBuMix(data.by_bu);

        const grandTotal = data.by_bu.reduce((s, r) => s + r.total_alloc, 0) || 1;
        if (!data.by_bu.length) {
            bodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">No data.</td></tr>';
            return;
        }
        bodyEl.innerHTML = data.by_bu.map(r => {
            const share = Math.round((r.total_alloc / grandTotal) * 100);
            return `<tr>
                <td><strong>${esc(r.bu)}</strong></td>
                <td>${r.employees}</td>
                <td>${r.projects}</td>
                <td>${r.allocations}</td>
                <td>${utilPill(r.avg_allocation)}</td>
                <td><div class="coverage-bar"><span style="width:${share}%"></span></div><span class="coverage-txt">${share}%</span></td>
            </tr>`;
        }).join('');
    }

    monthSel.addEventListener('change', load);
    document.getElementById('buReset').addEventListener('click', () => { monthSel.value = ''; load(); });
    load();
}
