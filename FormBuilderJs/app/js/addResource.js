function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

let resourceItems = [];
let sectionItems = [];
let componentItems = [];

function getListData(type) {
    switch (type) {
        case 'resource': return resourceItems;
        case 'section': return sectionItems;
        case 'component': return componentItems;
        default: return [];
    }
}

function getListId(type) {
    switch (type) {
        case 'resource': return 'resourceList';
        case 'section': return 'sectionList';
        case 'component': return 'componentList';
        default: return '';
    }
}

function getItemLabel(type) {
    switch (type) {
        case 'resource': return 'Resource';
        case 'section': return 'Section';
        case 'component': return 'Component';
        default: return 'Item';
    }
}

function getItemIcon(type) {
    switch (type) {
        case 'resource': return 'bi-database';
        case 'section': return 'bi-layers';
        case 'component': return 'bi-puzzle';
        default: return 'bi-box';
    }
}

function renderList(type) {
    const items = getListData(type);
    const listId = getListId(type);
    const container = document.getElementById(listId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <i class="bi bi-inbox"></i>
            <p>No ${getItemLabel(type).toLowerCase()}s added yet</p>
        </div>`;
        return;
    }

    let html = '<ul>';
    items.forEach(function(item, index) {
        html += `<li>
            <div class="resource-item-info">
                <i class="bi ${getItemIcon(type)}"></i>
                <span>${escapeHtml(item.name)}</span>
            </div>
            <div class="resource-item-actions">
                <button class="edit-btn" data-type="${type}" data-index="${index}" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="delete-btn" data-type="${type}" data-index="${index}" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

function addItem(type) {
    const label = getItemLabel(type);
    const name = prompt(`Enter ${label} name:`);
    if (!name || !name.trim()) return;

    const items = getListData(type);
    items.push({ name: name.trim() });
    renderList(type);
}

function deleteItem(type, index) {
    const items = getListData(type);
    if (index < 0 || index >= items.length) return;

    const label = getItemLabel(type);
    if (!confirm(`Delete ${label.toLowerCase()} "${items[index].name}"?`)) return;

    items.splice(index, 1);
    renderList(type);
}

function editItem(type, index) {
    const items = getListData(type);
    if (index < 0 || index >= items.length) return;

    const label = getItemLabel(type);
    const newName = prompt(`Edit ${label.toLowerCase()} name:`, items[index].name);
    if (!newName || !newName.trim()) return;

    items[index].name = newName.trim();
    renderList(type);
}

document.addEventListener('DOMContentLoaded', function() {
    var infoBtn = document.getElementById('structureInfoBtn');
    if (infoBtn && typeof $ !== 'undefined') {
        $(infoBtn).popover({
            content: '<pre class="structure-tree">Existing Resources\n│\n├── Group1 (Resource)\n│   ├── Section1\n│   │   ├── Component1\n│   │   ├── Component2\n│   │\n│   ├── Section2\n│\n├── Group2 (Resource)</pre>'
        });
    }

    document.querySelectorAll('.add-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const type = this.getAttribute('data-type');
            addItem(type);
        });
    });

    document.addEventListener('click', function(e) {
        const target = e.target.closest('.delete-btn');
        if (target) {
            e.preventDefault();
            const type = target.getAttribute('data-type');
            const index = parseInt(target.getAttribute('data-index'), 10);
            deleteItem(type, index);
        }
    });

    document.addEventListener('click', function(e) {
        const target = e.target.closest('.edit-btn');
        if (target) {
            e.preventDefault();
            const type = target.getAttribute('data-type');
            const index = parseInt(target.getAttribute('data-index'), 10);
            editItem(type, index);
        }
    });
});
