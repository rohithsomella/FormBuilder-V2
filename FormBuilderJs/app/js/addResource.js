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

let currentModalType = 'resource';

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

function getItemDisplay(item) {
    if (item.groupName1) {
        return item.groupName1 + ' / ' + item.groupName2 + ' - ' + item.componentName;
    }
    if (item.parentGroup && item.sectionName) {
        return item.parentGroup + ' / ' + item.sectionName + ' - ' + item.componentName;
    }
    if (item.parentGroup && item.parentSection) {
        return item.parentGroup + ' / ' + item.parentSection + ' / ' + item.componentName;
    }
    return item.name || '';
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
                <span>${escapeHtml(getItemDisplay(item))}</span>
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

function clearForm() {
    document.getElementById('resGroupName1').value = '';
    document.getElementById('resGroupDropdown').innerHTML = '';
    document.getElementById('sectionName').value = '';
    document.getElementById('sectionDropdown').innerHTML = '';
    document.getElementById('resComponentName').value = '';
    document.getElementById('resDescription').value = '';
    document.getElementById('resJson').value = '';
}

function populateGroupDropdown() {
    var dd = document.getElementById('resGroupDropdown');
    dd.innerHTML = '<option value="">-- Select Group --</option>';
    resourceItems.forEach(function(item, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = item.groupName1 + ' / ' + item.groupName2 + ' - ' + item.componentName;
        dd.appendChild(opt);
    });
}

function populateSectionDropdown(groupIdx) {
    var dd = document.getElementById('sectionDropdown');
    dd.innerHTML = '<option value="">-- Select Section --</option>';
    sectionItems.forEach(function(item, idx) {
        var parentKey = resourceItems[groupIdx].groupName1 + ' / ' + resourceItems[groupIdx].groupName2;
        if (item.parentGroup === parentKey) {
            var opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = item.sectionName + ' - ' + item.componentName;
            dd.appendChild(opt);
        }
    });
}

function showGroupTextBox() {
    document.getElementById('resGroupName1').style.display = '';
    document.getElementById('resGroupDropdown').style.display = 'none';
}

function showGroupDropdown() {
    document.getElementById('resGroupName1').style.display = 'none';
    document.getElementById('resGroupDropdown').style.display = '';
}

function showSectionTextBox() {
    document.getElementById('sectionName').style.display = '';
    document.getElementById('sectionDropdown').style.display = 'none';
}

function showSectionDropdown() {
    document.getElementById('sectionName').style.display = 'none';
    document.getElementById('sectionDropdown').style.display = '';
}

function openModal(type) {
    currentModalType = type;
    clearForm();

    var titleEl = document.querySelector('#addResourceModal .modal-title');

    if (type === 'resource') {
        titleEl.textContent = 'Add Resource';
        document.getElementById('groupNameLabel').innerHTML = 'Group Name <span class="required">*</span>';
        document.getElementById('sectionNameLabel').innerHTML = 'Section Name <span class="required">*</span>';
        showGroupTextBox();
        showSectionTextBox();
    }
    else if (type === 'section') {
        titleEl.textContent = 'Add Section';
        document.getElementById('groupNameLabel').innerHTML = 'Group Name <span class="required">*</span>';
        document.getElementById('sectionNameLabel').innerHTML = 'Section Name <span class="required">*</span>';
        showGroupDropdown();
        showSectionTextBox();
        populateGroupDropdown();
    }
    else if (type === 'component') {
        titleEl.textContent = 'Add Component';
        document.getElementById('groupNameLabel').innerHTML = 'Group Name <span class="required">*</span>';
        document.getElementById('sectionNameLabel').innerHTML = 'Section Name <span class="required">*</span>';
        showGroupDropdown();
        showSectionDropdown();
        populateGroupDropdown();
        populateSectionDropdown();
    }

    $('#addResourceModal').modal('show');
}

function handleSubmit() {
    var groupInput = document.getElementById('resGroupName1');
    var groupDropdown = document.getElementById('resGroupDropdown');
    var sectionInput = document.getElementById('sectionName');
    var sectionDropdown = document.getElementById('sectionDropdown');

    var groupName1, groupName2, compName, description, json;

    if (currentModalType === 'resource') {
        groupName1 = groupInput.value.trim();
        groupName2 = sectionInput.value.trim();
        compName = document.getElementById('resComponentName').value.trim();
        description = document.getElementById('resDescription').value.trim();
        json = document.getElementById('resJson').value.trim();

        if (!groupName1) { alert('Group Name is required'); return; }
        if (!groupName2) { alert('Section Name is required'); return; }
        if (!compName) { alert('Component Name is required'); return; }
        if (!json) { alert('JSON is required'); return; }

        resourceItems.push({
            groupName1: groupName1,
            groupName2: groupName2,
            componentName: compName,
            description: description,
            json: json
        });
        renderList('resource');
    }
    else if (currentModalType === 'section') {
        var selectedGroupIdx = groupDropdown.value;
        groupName2 = sectionInput.value.trim();
        compName = document.getElementById('resComponentName').value.trim();
        description = document.getElementById('resDescription').value.trim();
        json = document.getElementById('resJson').value.trim();

        if (!selectedGroupIdx) { alert('Please select a Group'); return; }
        if (!groupName2) { alert('Section Name is required'); return; }
        if (!compName) { alert('Component Name is required'); return; }
        if (!json) { alert('JSON is required'); return; }

        var parentResource = resourceItems[selectedGroupIdx];
        sectionItems.push({
            parentGroup: parentResource.groupName1 + ' / ' + parentResource.groupName2,
            sectionName: groupName2,
            componentName: compName,
            description: description,
            json: json
        });
        renderList('section');
    }
    else if (currentModalType === 'component') {
        var selectedGroupIdx = groupDropdown.value;
        var selectedSectionIdx = sectionDropdown.value;
        compName = document.getElementById('resComponentName').value.trim();
        description = document.getElementById('resDescription').value.trim();
        json = document.getElementById('resJson').value.trim();

        if (!selectedGroupIdx) { alert('Please select a Group'); return; }
        if (!selectedSectionIdx) { alert('Please select a Section'); return; }
        if (!compName) { alert('Component Name is required'); return; }
        if (!json) { alert('JSON is required'); return; }

        var parentResource = resourceItems[selectedGroupIdx];
        var parentSection = sectionItems[selectedSectionIdx];
        componentItems.push({
            parentGroup: parentResource.groupName1 + ' / ' + parentResource.groupName2,
            parentSection: parentSection.sectionName,
            componentName: compName,
            description: description,
            json: json
        });
        renderList('component');
    }

    $('#addResourceModal').modal('hide');
}

function deleteItem(type, index) {
    const items = getListData(type);
    if (index < 0 || index >= items.length) return;

    const label = getItemLabel(type);
    if (!confirm(`Delete ${label.toLowerCase()} "${getItemDisplay(items[index])}"?`)) return;

    items.splice(index, 1);
    renderList(type);
}

function editItem(type, index) {
    const items = getListData(type);
    if (index < 0 || index >= items.length) return;

    const label = getItemLabel(type);
    const current = getItemDisplay(items[index]);
    const newName = prompt(`Edit ${label.toLowerCase()} name:`, current);
    if (!newName || !newName.trim()) return;

    var item = items[index];
    if (item.groupName1) {
        item.groupName1 = newName.trim();
    }
    else if (item.sectionName) {
        item.sectionName = newName.trim();
    }
    else if (item.componentName) {
        item.componentName = newName.trim();
    }
    else {
        item.name = newName.trim();
    }
    renderList(type);
}

document.addEventListener('DOMContentLoaded', function() {
    var infoBtn = document.getElementById('structureInfoBtn');
    if (infoBtn && typeof $ !== 'undefined') {
        $(infoBtn).popover({
            content: '<pre class="structure-tree">Existing Resources\n│\n├── Group1 (Resource)\n│   ├── Section1\n│   │   ├── Component1\n│   │   ├── Component2\n│   │\n│   ├── Section2\n│\n├── Group2 (Resource)</pre>'
        });
    }

    document.getElementById('submitResourceBtn').addEventListener('click', handleSubmit);

    document.querySelectorAll('.add-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var type = this.getAttribute('data-type');
            openModal(type);
        });
    });

    document.getElementById('resGroupDropdown').addEventListener('change', function() {
        if (currentModalType === 'component' && this.value) {
            populateSectionDropdown(parseInt(this.value, 10));
        }
    });

    document.addEventListener('click', function(e) {
        var target = e.target.closest('.delete-btn');
        if (target) {
            e.preventDefault();
            deleteItem(target.getAttribute('data-type'), parseInt(target.getAttribute('data-index'), 10));
        }
    });

    document.addEventListener('click', function(e) {
        var target = e.target.closest('.edit-btn');
        if (target) {
            e.preventDefault();
            editItem(target.getAttribute('data-type'), parseInt(target.getAttribute('data-index'), 10));
        }
    });
});
