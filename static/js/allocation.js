// Project Allocation page: table CRUD + project search panel.

const EMPLOYEES = JSON.parse(document.getElementById('employeesData').textContent);
const MONTHS = JSON.parse(document.getElementById('monthsData').textContent);
// Months allowed for new/edited allocations (current month onward only).
const ALLOCATABLE_MONTHS = JSON.parse(document.getElementById('allocatableMonthsData').textContent);

let allocations = [];
let reporteesList = [];
let projects = [];
let activeRow = null; // draft row awaiting a project selection

const body = document.getElementById('allocBody');
const filterManager = document.getElementById('filterManager');
const filterEmp = document.getElementById('filterEmployee');
const filterMonth = document.getElementById('filterMonth');

// Selected filter values ('' means "all"). Driven by the searchable comboboxes below.
// `manager` is the primary filter: no allocations load until a manager is chosen.
const filterState = { manager: '', employee: '', month: '' };
let managerLoaded = false; // whether a manager has been selected and data fetched

function empOptions(selected) {
    return ['<option value="">Select employee</option>']
        .concat(EMPLOYEES.map(e => `<option value="${escapeHtml(e)}" ${e === selected ? 'selected' : ''}>${escapeHtml(e)}</option>`))
        .join('');
}
function monthOptions(selected) {
    return ['<option value="">Select month</option>']
        .concat(ALLOCATABLE_MONTHS.map(m => `<option value="${m}" ${m === selected ? 'selected' : ''}>${m}</option>`))
        .join('');
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function allocPill(v) {
    const cls = v >= 75 ? 'high' : v >= 40 ? '' : 'warn';
    return `<span class="pill ${cls}">${v}%</span>`;
}

function renderTable() {
    removeAllPops();
    if (!managerLoaded) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6"><i class="fa-solid fa-user-tie"></i>&nbsp; Select a <strong>Reporting Manager</strong> above to load their reportees.</td></tr>';
        return;
    }
    const fe = filterState.employee;
    const fm = filterState.month;

    const saved = allocations.filter(a => (!fe || a.employee === fe) && (!fm || a.month === fm));
    const roster = buildRosterRows().filter(r => !fe || r.emp === fe);

    let html = '';
    if (saved.length) {
        html += sectionHead('fa-clock-rotate-left', 'Previous month allocation', `${saved.length} row${saved.length === 1 ? '' : 's'}`);
        html += saved.map(savedRowHTML).join('');
    }
    if (roster.length) {
        html += roster.map(r => rowRosterHTML(r.emp, r.pid, r.title)).join('');
    }
    if (!html) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6">No reportees found for this manager.</td></tr>';
        return;
    }
    body.innerHTML = html;
    body.querySelectorAll('tr.roster-row').forEach(wireRowCombos);
}

function sectionHead(icon, title, hint) {
    return `<tr class="section-head"><td colspan="6">
        <span class="sh-title"><i class="fa-solid ${icon}"></i> ${title}</span>
        ${hint ? `<span class="sh-hint">${hint}</span>` : ''}
    </td></tr>`;
}

// One roster row per reportee per ongoing project (pre-filled so a new month can be
// added without re-entering the project). Reportees with no allocations get a blank row.
function buildRosterRows() {
    const byEmp = {};
    allocations.forEach(a => {
        (byEmp[a.employee] || (byEmp[a.employee] = new Map())).set(a.project_id, a.project_title);
    });
    const rows = [];
    reporteesList.forEach(r => {
        const projs = byEmp[r.name];
        if (projs && projs.size) {
            projs.forEach((title, pid) => rows.push({ emp: r.name, pid, title }));
        } else {
            rows.push({ emp: r.name, pid: '', title: '' });
        }
    });
    return rows;
}

function savedRowHTML(a) {
    return `
        <tr data-id="${a.id}">
            <td>${escapeHtml(a.employee)}</td>
            <td class="proj-id-cell">${escapeHtml(a.project_id)}</td>
            <td>${escapeHtml(a.project_title)}</td>
            <td>${escapeHtml(a.month)}</td>
            <td>${allocPill(a.allocation)}</td>
            <td class="col-actions">
                <button class="row-btn edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="row-btn del" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>`;
}

// Editable row for a reportee with the employee locked (quick allocate).
// If pid is supplied, the project is pre-filled (carry an ongoing project to a new month).
function rowRosterHTML(emp, pid = '', title = '') {
    const titleCell = pid
        ? `<td class="e-ptitle">${escapeHtml(title)}</td>`
        : '<td class="e-ptitle muted">Type or pick a project</td>';
    return `
        <tr class="roster-row" data-id="new" data-emp="${escapeHtml(emp)}">
            <td><div class="ros-emp">${escapeHtml(emp)}</div></td>
            <td class="proj-id-cell"><input class="e-pid combo-cell-input" placeholder="Search project&hellip;" autocomplete="off" value="${escapeHtml(pid)}" data-value="${escapeHtml(pid)}" data-picked="${escapeHtml(pid)}"></td>
            ${titleCell}
            <td><select class="e-month">${monthOptions('')}</select></td>
            <td><input type="number" class="alloc-input e-alloc" min="0" max="100" value="100"></td>
            <td class="col-actions"><button class="row-btn save" title="Save allocation"><i class="fa-solid fa-floppy-disk"></i></button></td>
        </tr>`;
}

const EMPLOYEE_SET = new Set(EMPLOYEES);

// Inline searchable combobox for a row input. Renders a fixed-position dropdown.
function attachCombo(input, { source, onPick }) {
    const pop = document.createElement('div');
    pop.className = 'combo-pop';
    pop.hidden = true;
    document.body.appendChild(pop);
    let items = [];

    function position() {
        const r = input.getBoundingClientRect();
        pop.style.left = r.left + 'px';
        pop.style.top = (r.bottom + 4) + 'px';
        pop.style.width = Math.max(r.width, 240) + 'px';
    }
    async function render(q) {
        items = await source(q);
        pop.innerHTML = items.length
            ? items.map((it, i) => `<div class="combo-opt" data-i="${i}"><span class="co-main">${escapeHtml(it.label)}</span>${it.sub ? `<span class="co-sub">${escapeHtml(it.sub)}</span>` : ''}</div>`).join('')
            : '<div class="combo-empty">No matches</div>';
    }
    async function open() {
        position();
        await render(input.value === input.dataset.picked ? '' : input.value);
        pop.hidden = false;
    }
    function pick(it) {
        input.value = it.label;
        input.dataset.value = it.value;
        input.dataset.picked = it.label;
        onPick(it);
        pop.hidden = true;
    }

    let t;
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(async () => { position(); await render(input.value); pop.hidden = false; }, 200);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { input.value = input.dataset.picked || ''; pop.hidden = true; }
        else if (e.key === 'Enter') {
            const first = pop.querySelector('.combo-opt');
            if (first) { e.preventDefault(); pick(items[+first.dataset.i]); }
        }
    });
    pop.addEventListener('mousedown', (e) => {
        const o = e.target.closest('.combo-opt');
        if (o) { e.preventDefault(); pick(items[+o.dataset.i]); }
    });
    input.addEventListener('blur', () => setTimeout(() => {
        if (input.value !== (input.dataset.picked || '')) input.value = input.dataset.picked || '';
        pop.hidden = true;
    }, 150));
    window.addEventListener('scroll', () => { pop.hidden = true; }, true);
}

function removeAllPops() {
    document.querySelectorAll('.combo-pop').forEach(p => p.remove());
}

function empSource(q) {
    // When a manager is loaded, restrict to their reportees; otherwise all employees.
    const base = (managerLoaded && reporteesList.length) ? reporteesList.map(r => r.name) : EMPLOYEES;
    const n = (q || '').toLowerCase();
    const list = n ? base.filter(e => e.toLowerCase().includes(n)) : base;
    return list.slice(0, 300).map(e => ({ value: e, label: e }));
}
async function projSource(q) {
    const url = q ? `/api/projects?q=${encodeURIComponent(q)}&limit=300` : '/api/projects?limit=300';
    const list = await apiFetch(url);
    return list.map(p => ({ value: p.project_id, label: p.project_id, sub: p.title }));
}

function wireRowCombos(tr) {
    const emp = tr.querySelector('.e-emp');
    const pid = tr.querySelector('.e-pid');
    if (emp) attachCombo(emp, { source: empSource, onPick: () => {} });
    attachCombo(pid, {
        source: projSource,
        onPick: (it) => {
            const title = tr.querySelector('.e-ptitle');
            title.textContent = it.sub || '';
            title.classList.remove('muted');
        },
    });
}

function rowEditorHTML(emp, pid, title, month, alloc) {
    return `
        <td><input class="e-emp combo-cell-input" placeholder="Search employee&hellip;" autocomplete="off"
                   value="${escapeHtml(emp)}" data-value="${escapeHtml(emp)}" data-picked="${escapeHtml(emp)}"></td>
        <td class="proj-id-cell"><input class="e-pid combo-cell-input" placeholder="Search project&hellip;" autocomplete="off"
                   value="${escapeHtml(pid)}" data-value="${escapeHtml(pid)}" data-picked="${escapeHtml(pid)}"></td>
        <td class="e-ptitle ${title ? '' : 'muted'}">${escapeHtml(title) || 'Type or pick a project'}</td>
        <td><select class="e-month">${monthOptions(month)}</select></td>
        <td><input type="number" class="alloc-input e-alloc" min="0" max="100" value="${alloc}"></td>
        <td class="col-actions">
            <button class="row-btn save" title="Save"><i class="fa-solid fa-floppy-disk"></i></button>
            <button class="row-btn cancel" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
        </td>`;
}

function editRow(id) {
    const a = allocations.find(x => x.id === id);
    if (!a) return;
    removeAllPops();
    const tr = body.querySelector(`tr[data-id="${id}"]`);
    tr.classList.add('editing');
    tr.innerHTML = rowEditorHTML(a.employee, a.project_id, a.project_title, a.month, a.allocation);
    wireRowCombos(tr);
    activeRow = tr;
}

function addDraftRow() {
    const empty = body.querySelector('.empty-row');
    if (empty) body.innerHTML = '';
    removeAllPops();
    const tr = document.createElement('tr');
    tr.dataset.id = 'new';
    tr.classList.add('editing');
    tr.innerHTML = rowEditorHTML('', '', '', '', 100);
    body.prepend(tr);
    wireRowCombos(tr);
    activeRow = tr;
}

// Optional convenience: clicking a project in the right panel fills the active row.
function applyProjectToActiveRow(project) {
    if (!activeRow) { showToast('Click "Add Allocation" first', true); return; }
    const pid = activeRow.querySelector('.e-pid');
    const ptitle = activeRow.querySelector('.e-ptitle');
    pid.value = project.project_id;
    pid.dataset.value = project.project_id;
    pid.dataset.picked = project.project_id;
    ptitle.classList.remove('muted');
    ptitle.textContent = project.title;
}

async function saveRow(tr) {
    const id = tr.dataset.id;
    const empInput = tr.querySelector('.e-emp');
    const employee = (empInput?.dataset.value || empInput?.value || tr.dataset.emp || '').trim();
    const project_id = (tr.querySelector('.e-pid').dataset.value || '').trim();
    const month = tr.querySelector('.e-month').value;
    const allocation = parseFloat(tr.querySelector('.e-alloc').value);

    if (!employee) return showToast('Please select an employee', true);
    if (!EMPLOYEE_SET.has(employee)) return showToast('Pick a valid employee from the list', true);
    if (!project_id) return showToast('Please select a project', true);
    if (!month) return showToast('Please select a month', true);
    if (isNaN(allocation) || allocation < 0 || allocation > 100) return showToast('Allocation must be 0-100', true);

    try {
        if (id === 'new') {
            await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify({ employee, project_id, month, allocation }) });
            showToast('Allocation added');
        } else {
            await apiFetch(`/api/allocations/${id}`, { method: 'PATCH', body: JSON.stringify({ employee, project_id, month, allocation }) });
            showToast('Allocation updated');
        }
        activeRow = null;
        removeAllPops();
        await loadAllocations();
    } catch (e) {
        showToast(e.message, true);
    }
}

async function deleteRow(id) {
    if (!confirm('Delete this allocation?')) return;
    try {
        await apiFetch(`/api/allocations/${id}`, { method: 'DELETE' });
        showToast('Allocation deleted');
        await loadAllocations();
    } catch (e) {
        showToast(e.message, true);
    }
}

async function loadAllocations() {
    if (!filterState.manager) {
        allocations = []; reporteesList = []; managerLoaded = false;
        empCombo.clear(); empCombo.setItems(EMPLOYEES); filterState.employee = '';
        renderTable();
        return;
    }
    const [allocs, reportees] = await Promise.all([
        apiFetch(`/api/allocations?manager=${encodeURIComponent(filterState.manager)}`),
        apiFetch(`/api/reportees?manager=${encodeURIComponent(filterState.manager)}`),
    ]);
    allocations = allocs;
    reporteesList = reportees;
    managerLoaded = true;
    // Scope the employee filter to this manager's reportees.
    empCombo.clear();
    empCombo.setItems(reportees.map(r => r.name));
    filterState.employee = '';
    renderTable();
}

// ---- Project search panel ----
const projList = document.getElementById('projList');
const projCount = document.getElementById('projCount');
const projectSearch = document.getElementById('projectSearch');

function renderProjects(list) {
    if (!list.length) { projList.innerHTML = '<p class="muted" style="padding:8px">No projects found.</p>'; return; }
    projList.innerHTML = list.map(p => `
        <div class="proj-item" data-pid="${escapeHtml(p.project_id)}">
            <div class="pid">${escapeHtml(p.project_id)}</div>
            <div class="ptitle">${escapeHtml(p.title || '(no title)')}</div>
            <div class="pmeta">${escapeHtml(p.bu || '-')} &middot; ${escapeHtml(p.project_type || '-')} &middot; ${escapeHtml(p.spoc || '-')}</div>
        </div>`).join('');
}

let projTotal = null;
async function loadProjects(q = '') {
    const url = q ? `/api/projects?q=${encodeURIComponent(q)}&limit=100000` : '/api/projects?limit=100000';
    projects = await apiFetch(url);
    if (!q) projTotal = projects.length;
    projCount.textContent = q
        ? `Showing ${projects.length} of ${projTotal ?? projects.length} projects`
        : `${projects.length} projects in funnel`;
    renderProjects(projects);
}

// ---- Searchable comboboxes for the filters ----
// Turns a text input + list container into a type-to-search dropdown.
// `items` may be strings or {value, label} objects.
function setupCombobox({ input, list, items, allLabel, onSelect }) {
    let open = false;
    let norm = items.map(i => (typeof i === 'string' ? { value: i, label: i } : i));

    function render(filter = '') {
        const needle = filter.trim().toLowerCase();
        const matches = needle
            ? norm.filter(i => i.label.toLowerCase().includes(needle) || i.value.toLowerCase().includes(needle))
            : norm;
        const rows = [`<div class="combo-opt combo-all" data-val="">${allLabel}</div>`]
            .concat(matches.map(i => `<div class="combo-opt" data-val="${escapeHtml(i.value)}" data-label="${escapeHtml(i.label)}"><span class="co-main">${escapeHtml(i.label)}</span>${i.sub ? `<span class="co-sub">${escapeHtml(i.sub)}</span>` : ''}</div>`));
        list.innerHTML = matches.length || !needle
            ? rows.join('')
            : '<div class="combo-empty">No matches</div>';
    }

    function openList() { render(input.value === input.dataset.label ? '' : input.value); list.hidden = false; open = true; }
    function closeList() { list.hidden = true; open = false; }

    function choose(val, label) {
        input.dataset.selected = val;
        input.dataset.label = label || '';
        input.value = label || '';
        onSelect(val);
        closeList();
    }

    input.addEventListener('focus', openList);
    input.addEventListener('click', openList);
    input.addEventListener('input', () => { if (!open) { list.hidden = false; open = true; } render(input.value); });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { input.value = input.dataset.label || ''; closeList(); }
        else if (e.key === 'Enter') {
            const first = list.querySelector('.combo-opt');
            if (first) { e.preventDefault(); choose(first.dataset.val, first.dataset.label || ''); }
        }
    });
    // Use mousedown so selection fires before the input blur closes the list.
    list.addEventListener('mousedown', (e) => {
        const opt = e.target.closest('.combo-opt');
        if (opt) { e.preventDefault(); choose(opt.dataset.val, opt.dataset.label || ''); }
    });
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (input.value !== (input.dataset.label || '')) input.value = input.dataset.label || '';
            closeList();
        }, 120);
    });

    return {
        clear() { input.value = ''; input.dataset.selected = ''; input.dataset.label = ''; },
        setItems(newItems) { norm = newItems.map(i => (typeof i === 'string' ? { value: i, label: i } : i)); },
    };
}

const empCombo = setupCombobox({
    input: filterEmp,
    list: document.getElementById('listEmployee'),
    items: EMPLOYEES,
    allLabel: 'All employees',
    onSelect: (val) => { filterState.employee = val; renderTable(); },
});
const monthCombo = setupCombobox({
    input: filterMonth,
    list: document.getElementById('listMonth'),
    items: MONTHS,
    allLabel: 'All months',
    onSelect: (val) => { filterState.month = val; renderTable(); },
});

// Manager filter drives lazy loading: allocations load only after a manager is picked.
let managerCombo = null;
async function initManagers() {
    const managers = await apiFetch('/api/managers');
    const items = managers.map(m => ({ value: m.value, label: m.label, sub: `${m.reportees} reportee${m.reportees === 1 ? '' : 's'}` }));
    managerCombo = setupCombobox({
        input: filterManager,
        list: document.getElementById('listManager'),
        items,
        allLabel: 'None',
        onSelect: (val) => {
            filterState.manager = val;
            filterState.employee = ''; filterState.month = '';
            empCombo.clear(); monthCombo.clear();
            loadAllocations();
        },
    });
}

// ---- Event wiring ----
document.getElementById('addRowBtn').addEventListener('click', addDraftRow);
document.getElementById('clearFilters').addEventListener('click', () => {
    if (managerCombo) managerCombo.clear();
    empCombo.clear(); empCombo.setItems(EMPLOYEES); monthCombo.clear();
    filterState.manager = ''; filterState.employee = ''; filterState.month = '';
    managerLoaded = false;
    allocations = [];
    renderTable();
});

body.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    if (e.target.closest('.edit')) editRow(parseInt(tr.dataset.id));
    else if (e.target.closest('.del')) deleteRow(parseInt(tr.dataset.id));
    else if (e.target.closest('.save')) saveRow(tr);
    else if (e.target.closest('.cancel')) { activeRow = null; renderTable(); }
});

projList.addEventListener('click', (e) => {
    const item = e.target.closest('.proj-item');
    if (!item) return;
    const project = projects.find(p => p.project_id === item.dataset.pid);
    if (project) applyProjectToActiveRow(project);
});

let searchTimer;
projectSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProjects(projectSearch.value.trim()), 250);
});

loadProjects();
renderTable();
initManagers();
