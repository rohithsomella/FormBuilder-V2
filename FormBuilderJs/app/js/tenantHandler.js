var TenantHandler = (function () {
    'use strict';

    var tenantPaginationState = {
        allTenants: [],
        filteredTenants: [],
        currentPage: 1,
        currentPageSet: 1,
        itemsPerPage: 10,
        pagesPerSet: 5,

    };

    function escapeHtml(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function (m) {
            return map[m];
        });
    }

    function loadTenantsTable() {

        FormBuilderApi.getTenants(

            function (tenants) {
                populateTenantsTable(tenants);
            },

            function (error) {
                console.log(error);
                showNoTenantsMessage(error);
            }

        );
    }
    function populateTenantsTable(tenants) {
        var tableBody = document.getElementById('tenantsTableBody');
        var loadingMessage = document.getElementById('tenantsLoadingMessage');
        var tenantsTable = document.getElementById('tenantsTable');
        var tableControls = document.getElementById('tenantsTableControls');
        var paginationControls = document.getElementById('tenantsPaginationControls');

        if (!tableBody || !loadingMessage || !tenantsTable) {
            return;
        }
        tableBody.innerHTML = '';
        var tenantCollection = Array.isArray(tenants)
            ? tenants
            : (tenants && Array.isArray(tenants.data) ? tenants.data : []);

        var tenantItems = tenantCollection.map(function (tenant) {
            return {
                id: tenant.tenantId,
                name: tenant.tenantName,
                status: tenant.isDeleted ? "Inactive" : "Active",
                created: tenant.created,
                updated: tenant.updated
            };

        });

        if (!tenantItems.length) {
            showNoTenantsMessage('No tenants available');
            if (tableControls) tableControls.style.display = 'none';
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }

        tenantPaginationState.allTenants = tenantItems;
        tenantPaginationState.filteredTenants = tenantItems;
        tenantPaginationState.currentPage = 1;
        tenantPaginationState.currentPageSet = 1;

        loadingMessage.style.display = 'none';
        tenantsTable.style.display = 'table';
        if (tableControls) tableControls.style.display = 'flex';
        if (paginationControls) paginationControls.style.display = 'flex';

        initializeTenantSearchAndFilter();
        displayPaginatedTenants();
        renderTenantPaginationControls();
    }

    function showNoTenantsMessage(message) {
        var loadingMessage = document.getElementById('tenantsLoadingMessage');
        var tenantsTable = document.getElementById('tenantsTable');

        if (!loadingMessage || !tenantsTable) {
            return;
        }

        tenantsTable.style.display = 'none';
        loadingMessage.style.display = 'block';
        loadingMessage.innerHTML = '<i class="bi bi-exclamation-circle"></i> <strong>' + escapeHtml(message) + '</strong>';
        loadingMessage.className = 'alert alert-warning';
    }

    function initializeTenantSearchAndFilter() {
        var searchInput = document.getElementById('tenantsSearchInput');
        var filterSelect = document.getElementById('tenantsFilterSelect');

        if (searchInput) {
            searchInput.onkeyup = function () {
                tenantPaginationState.currentPage = 1;
                tenantPaginationState.currentPageSet = 1;
                applyTenantFiltersAndSearch();
            };
        }

        if (filterSelect) {
            filterSelect.onchange = function () {
                tenantPaginationState.currentPage = 1;
                tenantPaginationState.currentPageSet = 1;
                applyTenantFiltersAndSearch();
            };
        }
    }

    function applyTenantFiltersAndSearch() {
        var searchInput = document.getElementById('tenantsSearchInput');
        var filterSelect = document.getElementById('tenantsFilterSelect');
        var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        var sortBy = filterSelect ? filterSelect.value : '';

        tenantPaginationState.filteredTenants = tenantPaginationState.allTenants.filter(function (tenant) {
            var name = (tenant.name || '').toLowerCase();
            return name.includes(searchTerm);
        });

        if (sortBy === 'name-asc') {
            tenantPaginationState.filteredTenants.sort(function (a, b) {
                return (a.name || '').localeCompare(b.name || '');
            });
        }
        else if (sortBy === 'name-desc') {
            tenantPaginationState.filteredTenants.sort(function (a, b) {
                return (b.name || '').localeCompare(a.name || '');
            });
        }
        else if (sortBy === 'date-desc') {
            tenantPaginationState.filteredTenants.sort(function (a, b) {
                var dateA = new Date(a.updated || a.created || 0);
                var dateB = new Date(b.updated || b.created || 0);

                return dateB - dateA;
            });
        }
        else if (sortBy === 'date-asc') {
            tenantPaginationState.filteredTenants.sort(function (a, b) {
                var dateA = new Date(a.updated || a.created || 0);
                var dateB = new Date(b.updated || b.created || 0);

                return dateA - dateB;
            });
        }

        displayPaginatedTenants();
        renderTenantPaginationControls();
    }

    function displayPaginatedTenants() {
        var tableBody = document.getElementById('tenantsTableBody');
        var tenantsTable = document.getElementById('tenantsTable');

        if (!tableBody || !tenantsTable) {
            return;
        }

        tableBody.innerHTML = '';

        var startIndex = (tenantPaginationState.currentPage - 1) * tenantPaginationState.itemsPerPage;
        var endIndex = startIndex + tenantPaginationState.itemsPerPage;
        var pageItems = tenantPaginationState.filteredTenants.slice(startIndex, endIndex);

        pageItems.forEach(function (tenant) {

            // Show Updated date if available, otherwise Created date
            var isUpdated = tenant.updated &&
                new Date(tenant.updated).getTime() !== new Date(tenant.created).getTime();

            var displayDate = isUpdated ? tenant.updated : tenant.created;

            var formattedDate = displayDate
                ? new Date(displayDate).toLocaleString()
                : '';

            var row = document.createElement('tr');

            row.innerHTML =
                '<td>' +
                '<strong>' + escapeHtml(tenant.name || '') + '</strong>' +
                '<br>' +
                '<small style="color:#6c757d;font-size:12px;">' +
                (isUpdated ? 'Updated: ' : 'Created: ') +
                formattedDate +
                '</small>' +
                '</td>' +

                '<td style="text-align:right;">' +
                '<div style="display:inline-flex;justify-content:center;align-items:center;gap:6px;margin-left:auto;">' +
                '<button class="btn btn-sm btn-success" title="Open tenant" data-toggle="tooltip" data-placement="bottom" onclick="TenantHandler.openTenant(\'' + tenant.id + '\')">' +
                'Open <i class="bi bi-eye"></i>' +
                
                '</button> ' +
                '<button class="btn btn-sm btn-primary" title="Edit tenant" data-toggle="tooltip" data-placement="bottom" onclick="TenantHandler.editTenant(\'' + tenant.id + '\')">' +
                'Edit <i class="bi bi-pencil"></i>' +
                '</button> ' +

                '<button class="btn btn-sm btn-danger" title="Delete tenant" data-toggle="tooltip" data-placement="bottom" onclick="TenantHandler.deleteTenant(\'' + tenant.id + '\')">' +
                'Delete <i class="bi bi-trash"></i>' +
                '</button>' +

                '</div>' +
                '</td>';

            tableBody.appendChild(row);
        });

        tenantsTable.style.display = 'table';
    }
    function renderTenantPaginationControls() {
        var totalPages = Math.ceil(tenantPaginationState.filteredTenants.length / tenantPaginationState.itemsPerPage);
        var pageNumbersDiv = document.getElementById('tenantsPageNumbers');
        var nextPageBtn = document.getElementById('tenantsNextPageBtn');
        var prevPageBtn = document.getElementById('tenantsPrevPageBtn');
        var paginationInfo = document.getElementById('tenantsPaginationInfo');

        if (!pageNumbersDiv) {
            return;
        }

        pageNumbersDiv.innerHTML = '';

        var startPage = (tenantPaginationState.currentPageSet - 1) * tenantPaginationState.pagesPerSet + 1;
        var endPage = Math.min(startPage + tenantPaginationState.pagesPerSet - 1, totalPages);

        for (var i = startPage; i <= endPage; i++) {
            var btn = document.createElement('button');
            btn.className = 'page-btn' + (i === tenantPaginationState.currentPage ? ' active' : '');
            btn.textContent = i;
            btn.onclick = function (page) {
                return function () {
                    tenantPaginationState.currentPage = page;
                    displayPaginatedTenants();
                    renderTenantPaginationControls();
                };
            }(i);
            pageNumbersDiv.appendChild(btn);
        }

        if (prevPageBtn) {
            prevPageBtn.style.display = startPage > 1 ? 'inline-block' : 'none';
            prevPageBtn.disabled = startPage <= 1;
        }

        if (nextPageBtn) {
            nextPageBtn.style.display = endPage < totalPages ? 'inline-block' : 'none';
        }

        if (paginationInfo) {
            paginationInfo.textContent = 'Page ' + tenantPaginationState.currentPage + ' of ' + totalPages;
        }
    }

    function previousTenantPage() {
        if (tenantPaginationState.currentPageSet > 1) {
            tenantPaginationState.currentPageSet--;
            tenantPaginationState.currentPage = (tenantPaginationState.currentPageSet - 1) * tenantPaginationState.pagesPerSet + 1;
            displayPaginatedTenants();
            renderTenantPaginationControls();
        }
    }

    function nextTenantPage() {
        var totalPages = Math.ceil(tenantPaginationState.filteredTenants.length / tenantPaginationState.itemsPerPage);
        var maxPageSet = Math.ceil(totalPages / tenantPaginationState.pagesPerSet);
        if (tenantPaginationState.currentPageSet < maxPageSet) {
            tenantPaginationState.currentPageSet++;
            tenantPaginationState.currentPage = (tenantPaginationState.currentPageSet - 1) * tenantPaginationState.pagesPerSet + 1;
            displayPaginatedTenants();
            renderTenantPaginationControls();
        }
    }

    // edit tenant - handles pulling the correct record data and opening the modal
    function editTenant(tenantId) {
        var tenant = tenantPaginationState.allTenants.find(function (t) {
            return t.id === tenantId;
        });

        if (!tenant) {
            alert('Tenant not found');
            return;
        }

        $('#tenantMessage').hide().removeClass('alert-success alert-danger').text('');

        // Load values into the Bootstrap modal inputs
        $('#editTenantId').val(tenant.id);
        $('#editTenantName').val(tenant.name);

        // Open the modal display
        $('#editTenantModal').modal('show');
    }

    // save tenant 
    function saveTenant() {
        console.log("Save button clicked");

        var tenantId = $('#editTenantId').val();
        var tenantName = $('#editTenantName').val().trim();

        if (!tenantName) {
            $('#tenantMessage')
                .removeClass('alert-success')
                .addClass('alert alert-danger')
                .text('Tenant name cannot be empty.')
                .show();
            return;
        }

        var tenantData = {
            tenantId: tenantId,
            tenantName: tenantName
        };

        // Call API helper to update the record on the server
        FormBuilderApi.updateTenant(
            tenantData,
            function (response) {
                $('#tenantMessage')
                    .removeClass('alert-danger')
                    .addClass('alert alert-success')
                    .text('Tenant updated successfully.')
                    .show();

                setTimeout(function () {
                    $('#editTenantModal').modal('hide');
                    $('#tenantMessage').hide();

                    loadTenantsTable();
                }, 1200);
            },
            function (error) {

                $('#tenantMessage')
                    .removeClass('alert-success')
                    .addClass('alert alert-danger')
                    .text(error || 'An error occurred while updating.')
                    .show();
            }
        );
    }


    function openTenant(tenantId) {
        alert('Open tenant action for ' + tenantId);
    }

    // Delete Tenants
    function deleteTenant(tenantId) {
        if (!tenantId) {
            alert('Invalid Tenant ID');
            return;
        }

        if (!confirm('Are you sure you want to delete this tenant?')) {
            return;
        }


        FormBuilderApi.deleteTenant(
            tenantId,
            function (response) {
                alert('Tenant deleted successfully.');
                loadTenantsTable();
            },
            function (error) {
                console.error('API deletion failed:', error);
                alert('Unable to delete tenant: ' + error);
            }
        );
    }
    return {
        loadTenantsTable: loadTenantsTable,
        editTenant: editTenant,
        saveTenant: saveTenant,
        openTenant: openTenant,
        deleteTenant: deleteTenant,
        previousTenantPage: previousTenantPage,
        nextTenantPage: nextTenantPage
    };

})();
