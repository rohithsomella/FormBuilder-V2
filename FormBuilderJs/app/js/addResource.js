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

function showNotification(message, type) {
    var existing = document.querySelector('.resource-notification');
    if (existing) existing.remove();

    var notif = document.createElement('div');
    notif.className = 'resource-notification alert alert-' + (type === 'error' ? 'danger' : 'success');
    notif.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;max-width:420px;padding:12px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);font-size:14px;';
    notif.innerHTML = '<i class="bi bi-' + (type === 'error' ? 'exclamation-circle' : 'check-circle') + '"></i> ' + escapeHtml(message);
    document.body.appendChild(notif);

    setTimeout(function() { notif.remove(); }, 4000);
}

let resourceItems = [];
let componentItems = [];

let currentModalType = 'resource';

function getListData(type) {
    switch (type) {
        case 'resource': return resourceItems;
        case 'component': return componentItems;
        default: return [];
    }
}

function getListId(type) {
    switch (type) {
        case 'resource': return 'resourceList';
        case 'component': return 'componentList';
        default: return '';
    }
}

function getItemLabel(type) {
    switch (type) {
        case 'resource': return 'Resource';
        case 'component': return 'Component';
        default: return 'Item'; 
    }
}

function getItemIcon(type) {
    switch (type) {
        case 'resource': return 'bi-database';
        case 'component': return 'bi-puzzle';
        default: return 'bi-box';
    }
}

function getItemDisplay(item, type) {
    // Display resourceType with count for resources, componentName for components
    if (type === 'resource') {
        // For grouped resources, always show the count if itemCount property exists
        if (item.hasOwnProperty('itemCount') && item.itemCount !== null && item.itemCount !== undefined) {
            return item.resourceType + ' (' + item.itemCount + ' Components)';
        }
        return item.resourceType || item.name || '';
    } else if (type === 'component') {
        return item.componentName || item.name || '';
    }
    return item.componentName || item.resourceType || item.name || '';
}

function renderList(type) {
    const items = getListData(type);
    const listId = getListId(type);
    const container = document.getElementById(listId);
    if (!container) {
        console.warn(`Container not found for type: ${type}, listId: ${listId}`);
        return;
    }

    console.log(`Rendering ${type} list with ${items.length} items:`, items);

    if (items.length === 0) {
        var emptyMessage = '';
        if (type === 'resource') {
            emptyMessage = 'No resources added yet';
        } else if (type === 'component') {
            emptyMessage = 'No components added yet';
        }
        container.innerHTML = `<div class="empty-state">
            <i class="bi bi-inbox"></i>
            <p>${emptyMessage}</p>
        </div>`;
        return;
    }

    let html = '<ul>';
    items.forEach(function(item, index) {
        const display = getItemDisplay(item, type);
        console.log(`Item ${index} (${type}):`, item, '-> Display:', display);
        html += `<li>
            <div class="resource-item-info">
                <i class="bi ${getItemIcon(type)}"></i>
                <span>${escapeHtml(display)}</span>
            </div>
            <div class="resource-item-actions" style="display: none;">
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
    console.log(`Final HTML for ${type}:`, html);
    container.innerHTML = html;
}

function clearForm() {
    document.getElementById('resResourceTypeText').value = '';
    document.getElementById('resResourceTypeDropdown').value = '';
    document.getElementById('resComponentName').value = '';
    document.getElementById('resDescription').value = '';
    document.getElementById('resJson').value = '';
}

function openModal(type) {
    currentModalType = type;
    clearForm();

    var titleEl = document.querySelector('#addResourceModal .modal-title');
    var resourceTypeText = document.getElementById('resResourceTypeText');
    var resourceTypeDropdown = document.getElementById('resResourceTypeDropdown');

    if (type === 'resource') {
        titleEl.textContent = 'Add Resource';
        resourceTypeText.style.display = '';
        resourceTypeDropdown.style.display = 'none';
    } else if (type === 'component') {
        titleEl.textContent = 'Add Component';
        resourceTypeText.style.display = 'none';
        resourceTypeDropdown.style.display = '';
    }

    $('#addResourceModal').modal('show');
}

function handleSubmit() {
    var resourceTypeText = document.getElementById('resResourceTypeText');
    var resourceTypeDropdown = document.getElementById('resResourceTypeDropdown');
    
    var resourceType = (resourceTypeText.style.display !== 'none' ? resourceTypeText.value : resourceTypeDropdown.value).trim();
    var compName = document.getElementById('resComponentName').value.trim();
    var description = document.getElementById('resDescription').value.trim();
    var json = document.getElementById('resJson').value.trim();

    if (!resourceType) { alert('Resource Type is required'); return; }
    if (!compName) { alert('Component Name is required'); return; }
    if (!json) { alert('JSON is required'); return; }

    var item = {
        resourceType: resourceType,
        componentName: compName,
        description: description,
        json: json
    };

    // Add to local list based on resource type
    switch (resourceType) {
        case 'resource':
            resourceItems.push(item);
            renderList('resource');
            break;
        case 'component':
            componentItems.push(item);
            renderList('component');
            break;
    }

    var payload = {
        resourceType: resourceType,
        componentName: compName,
        description: description,
        json: json
    };

    var btn = document.getElementById('submitResourceBtn');
    var originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

    FormBuilderApi.saveResource(payload,
        function(response) {
            showNotification('Resource saved successfully!', 'success');
            $('#addResourceModal').modal('hide');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            // Reload the resources, components, and dropdown (single API call)
            initializeResourcesAndDropdown();
        },
        function(error) {
            showNotification(error || 'Failed to save resource', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    );
}

function deleteItem(type, index) {
    const items = getListData(type);
    if (index < 0 || index >= items.length) return;

    const label = getItemLabel(type);
    if (!confirm(`Delete ${label.toLowerCase()} "${getItemDisplay(items[index], type)}"?`)) return;

    items.splice(index, 1);
    renderList(type);
}

function editItem(type, index) {
    const items = getListData(type);
    if (index < 0 || index >= items.length) return;

    const label = getItemLabel(type);
    const current = getItemDisplay(items[index], type);
    const newName = prompt(`Edit ${label.toLowerCase()} name:`, current);
    if (!newName || !newName.trim()) return;

    var item = items[index];
    if (type === 'resource') {
        item.resourceType = newName.trim();
    } else if (type === 'component') {
        item.componentName = newName.trim();
    }
    renderList(type);
}

function initializeResourcesAndDropdown() {
    console.log('=== Initializing Resources and Dropdown ===');
    
    FormBuilderApi.getResourcesList(
        function(groups) {
            try {
                console.log('✓ [SUCCESS] getResourcesList callback triggered');
                console.log('✓ [DATA] groups received:', groups);
                console.log('✓ [TYPE] groups type:', typeof groups);
                console.log('✓ [LENGTH] groups.length:', groups ? groups.length : 'null/undefined');
                
                // Verify groups is an array
                if (!Array.isArray(groups)) {
                    console.error('✗ [ERROR] groups is not an array:', groups);
                    groups = [];
                }
                
                // Clear existing items
                console.log('→ Clearing resourceItems and componentItems...');
                resourceItems = [];
                componentItems = [];
                var resourceTypes = [];
                console.log('✓ [STATE] After clear - resourceItems:', resourceItems, 'componentItems:', componentItems);
                
                // Process grouped data
                if (groups && groups.length > 0) {
                    console.log(`→ Processing ${groups.length} resource groups...`);
                    groups.forEach(function(group, idx) {
                        console.log(`  [${idx}] Processing group:`, group);
                        try {
                            // Add to resources list grouped
                            const resourceItem = {
                                resourceType: group.resourceType,
                                itemCount: group.itemCount,
                                componentsList: group.componentsList,
                                createdDate: group.createdDate
                            };
                            console.log(`  [${idx}] Created resourceItem:`, resourceItem);
                            resourceItems.push(resourceItem);
                            console.log(`  [${idx}] ✓ Pushed to resourceItems. Total: ${resourceItems.length}`);
                            
                            // Extract resource types for dropdown
                            resourceTypes.push(group.resourceType);
                            console.log(`  [${idx}] ✓ Added type "${group.resourceType}" to resourceTypes. Total: ${resourceTypes.length}`);
                        } catch (e) {
                            console.error(`  [${idx}] ✗ Error processing group:`, e);
                        }
                    });
                    console.log(`✓ [FINAL] resourceItems array populated with ${resourceItems.length} items:`, resourceItems);
                    console.log(`✓ [FINAL] resourceTypes array:`, resourceTypes);
                } else {
                    console.warn('⚠ No groups returned from API or empty array');
                }
                
                // Also fetch all individual resources for components list
                console.log('→ Calling FormBuilderApi.getAllResources...');
                FormBuilderApi.getAllResources(
                    null,  // ← resourceType filter (none, get all)
                    function(allResources) {
                        console.log('✓ [SUCCESS] getAllResources callback triggered');
                        console.log('✓ [DATA] allResources received:', allResources);
                        
                        if (!Array.isArray(allResources)) {
                            console.error('✗ allResources is not an array:', allResources);
                            allResources = [];
                        }
                        
                        // Populate component items from all resources
                        componentItems = [];
                        console.log('✓ Reset componentItems to []');
                        
                        if (allResources && allResources.length > 0) {
                            console.log(`→ Processing ${allResources.length} individual resources for components...`);
                            allResources.forEach(function(resource, idx) {
                                console.log(`  [${idx}] Processing resource:`, resource);
                                const componentItem = {
                                    componentName: resource.componentName,
                                    resourceId: resource.resourceId
                                };
                                componentItems.push(componentItem);
                                console.log(`  [${idx}] ✓ Added component. Total: ${componentItems.length}`);
                            });
                            console.log(`✓ [FINAL] componentItems array populated with ${componentItems.length} items:`, componentItems);
                        } else {
                            console.warn('⚠ No resources returned from getAllResources API');
                        }
                        
                        // Render both lists
                        console.log('→→→ RENDERING LISTS ←←←');
                        console.log('→ Current state before render:');
                        console.log('  resourceItems:', resourceItems);
                        console.log('  componentItems:', componentItems);
                        
                        console.log('→ Calling renderList("resource")...');
                        try {
                            renderList('resource');
                            console.log('✓ renderList("resource") completed');
                        } catch (e) {
                            console.error('✗ Error in renderList("resource"):', e);
                        }
                        
                        console.log('→ Calling renderList("component")...');
                        try {
                            renderList('component');
                            console.log('✓ renderList("component") completed');
                        } catch (e) {
                            console.error('✗ Error in renderList("component"):', e);
                        }
                        
                        // Bind dropdown with unique resource types
                        console.log('→ Binding dropdown with resource types:', resourceTypes);
                        var dropdown = document.getElementById('resResourceTypeDropdown');
                        if (dropdown) {
                            console.log('✓ Dropdown element found');
                            dropdown.innerHTML = '<option value="">-- Select Resource Type --</option>';
                            resourceTypes.sort();
                            resourceTypes.forEach(function(type, idx) {
                                console.log(`  [${idx}] Creating option for type: "${type}"`);
                                var option = document.createElement('option');
                                option.value = type;
                                option.textContent = type;
                                dropdown.appendChild(option);
                            });
                            console.log(`✓ Dropdown populated with ${resourceTypes.length} types`);
                        } else {
                            console.error('✗ Dropdown element NOT found - check your HTML!');
                            console.error('  Looking for element: #resResourceTypeDropdown');
                            console.error('  Page DOM elements:', document.querySelectorAll('[id*="Dropdown"], [id*="resource"], [id*="component"]'));
                        }
                    },
                    function(error) {
                        console.error('✗ [ERROR] getAllResources failed:', error);
                        console.error('  Error details:', {
                            message: error,
                            stack: error.stack
                        });
                    }
                );
            } catch (e) {
                console.error('✗ [EXCEPTION] Error in getResourcesList callback:', e);
                console.error('  Stack:', e.stack);
            }
        },
        function(error) {
            console.error('✗ [ERROR] getResourcesList failed:', error);
            console.error('  Error details:', {
                message: error,
                stack: error.stack
            });
        }
    );
}

document.addEventListener('DOMContentLoaded', function() {
    var infoBtn = document.getElementById('structureInfoBtn');
    if (infoBtn && typeof $ !== 'undefined') {
        $(infoBtn).popover({
            content: '<pre class=\"structure-tree\">Resource Types:\n\n• Resource\n• Component\n\nEach resource has:\n- Resource Type\n- Component Name</pre>'
        });
    }

    // Load all resources, components, and bind dropdown on page load (single API call)
    initializeResourcesAndDropdown();

    document.getElementById('submitResourceBtn').addEventListener('click', handleSubmit);

    document.querySelectorAll('.add-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var type = this.getAttribute('data-type');
            openModal(type);
        });
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
