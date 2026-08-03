/**
 * FormBuilder API - jQuery AJAX Integration
 * This module handles all communication with the FormBuilder API backend
 * Base URL: https://localhost:7286/api/forms
 */

var FormBuilderApi = (function() {
    'use strict';

    // Configuration
    var config = {
        baseUrl: 'http://localhost:5155/api/forms',
        tenantBaseUrl: 'http://localhost:5155/api/tenant',
        contentType: 'application/json'
    };


    //  get tenants
    function getTenants(onSuccess, onError) {
        console.log('Fetching tenants from:', config.tenantBaseUrl);
        $.ajax({
            url: config.tenantBaseUrl,
            type: 'GET',
            contentType: config.contentType,
            dataType: 'json',
            success: function (response) {
                console.log('Tenants retrieved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function (xhr, status, error) {
                console.error('Error retrieving tenants:', error);
                console.error('Status Code:', xhr.status);
                console.error('Response:', xhr.responseText);

                var errorMessage = 'Error retrieving tenants';

                if (xhr.status === 0) {
                    errorMessage = 'Network error: Cannot reach the API server at ' + config.tenantBaseUrl + '. Make sure the backend is running.';
                } else if (xhr.status === 404) {
                    errorMessage = 'API endpoint not found. Check the URL: ' + config.tenantBaseUrl;
                } else if (xhr.status === 500) {
                    errorMessage = 'Server error: ' + (xhr.responseJSON ? xhr.responseJSON.message : 'Internal server error');
                } else if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }

                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    // update tenant

    function updateTenant(tenantData, onSuccess, onError) {

        if (!tenantData || !tenantData.tenantId) {

            console.error('Tenant data with tenantId is required');

            if (onError) {
                onError('Tenant data with tenantId is required', 400);
            }

            return;
        }

        var payload = {

            tenantId: tenantData.tenantId,

            tenantName: tenantData.tenantName || ''

        };

        $.ajax({

            url: config.tenantBaseUrl + '/' + tenantData.tenantId,

            type: 'PUT',

            contentType: config.contentType,
            dataType: 'json',

            data: JSON.stringify(payload),

            success: function (response) {

                console.log('Tenant updated successfully:', response);

                if (onSuccess) {
                    onSuccess(response);
                }
            },

            error: function (xhr) {

                console.error('Error updating tenant');

                var errorMessage = xhr.responseJSON?.message || xhr.responseText || 'Error updating tenant';
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    // Open tenant

   function getFormsByTenantId(tenantId, onSuccess, onError) {

    $.ajax({
        url: config.baseUrl + "/" + tenantId + "/tenantForms",
        type: "GET",
        contentType: config.contentType,
        dataType: "json",

        success: function (response) {
            if (onSuccess) {
                onSuccess(response);
            }
        },

        error: function (xhr) {

            if (onError) {
                onError(xhr.responseText);
            }
        }
    });
}
    // save tenant
    function saveTenant(tenantData, onSuccess, onError) {

        if (!tenantData) {
            console.error('Tenant data is required');
            if (onError) {
                onError('Tenant data is required', 400);
            }
            return;
        }

        var payload = {
            tenantName: tenantData.tenantName || ''
        };

        $.ajax({
            url: config.tenantBaseUrl,
            type: 'POST',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),

            success: function (response) {
                console.log('Tenant saved successfully:', response);

                if (onSuccess) {
                    onSuccess(response);
                }
            },

            error: function (xhr) {

                console.error('Error saving tenant');

                var errorMessage = 'Error saving tenant';

                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }

                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }
    // delete form
    function deleteTenant(tenantId, onSuccess, onError) {
        if (!tenantId) {
            console.error('Tenant ID is required for deletion');
            if (onError) onError('Tenant ID is required', 400);
            return;
        }

        $.ajax({
            url: config.tenantBaseUrl + '/' + tenantId,
            type: 'DELETE',
            contentType: config.contentType,
            dataType: 'json',
            success: function (response) {
                console.log('Tenant deleted successfully from database:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function (xhr) {
                console.error('Error deleting tenant on server');
                var errorMessage = 'Error deleting tenant';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }


    //  * Get all forms
    //  * @param {Function} onSuccess - Callback function on success
    //  * @param {Function} onError - Callback function on error
    //  */
    function getAllForms(onSuccess, onError) {
        console.log('Fetching forms from:', config.baseUrl);
        $.ajax({
            url: config.baseUrl,
            type: 'GET',
            contentType: config.contentType,
            dataType: 'json',
            success: function(response) {
                console.log('Forms retrieved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error retrieving forms:', error);
                console.error('Status Code:', xhr.status);
                console.error('Response:', xhr.responseText);
                console.error('Status Text:', xhr.statusText);
                
                var errorMessage = 'Error retrieving forms';
                
                if (xhr.status === 0) {
                    errorMessage = 'Network error: Cannot reach the API server at ' + config.baseUrl + '. Make sure the backend is running.';
                } else if (xhr.status === 404) {
                    errorMessage = 'API endpoint not found. Check the URL: ' + config.baseUrl;
                } else if (xhr.status === 500) {
                    errorMessage = 'Server error: ' + (xhr.responseJSON ? xhr.responseJSON.message : 'Internal server error');
                } else if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Get form by ID
     * @param {String} formId - The form ID (GUID)
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function getFormById(formId, onSuccess, onError) {
        if (!formId) {
            console.error('Form ID is required');
            if (onError) {
                onError('Form ID is required', 400);
            }
            return;
        }

        $.ajax({
            url: config.baseUrl + '/' + formId,
            type: 'GET',
            contentType: config.contentType,
            dataType: 'json',
            success: function(response) {
                console.log('Form retrieved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error retrieving form:', error);
                var errorMessage = 'Error retrieving form';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Save a new form
     * @param {Object} formData - The form data object
     * @param {String} formData.Name - Form name
     * @param {String} formData.Title - Form title
     * @param {Array} formData.Tags - Form tags
     * @param {Object} formData.Components - Form JSON configuration
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function saveForm(formData, onSuccess, onError) {
        if (!formData) {
            if (onError) {
                onError('Form data is required', 400);
            }
            return;
        }

        // Get tenantId - send as-is
        var tenantId = formData.tenantId || sessionStorage.getItem('editingFormTenantId') || null;

        // Prepare the request payload
        var payload = {
            name: formData.name || '',
            title: formData.title || '',
            tags: formData.tags || [],
            // Ensure components is a string (JSON stringified)
            components: typeof formData.components === 'string' ? formData.components : JSON.stringify(formData.components || {}),
            tenantId: tenantId
        };

        $.ajax({
            url: config.baseUrl,
            type: 'POST',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                var errorMessage = 'Error saving form';
                try {
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    }
                } catch (e) {
                    if (xhr.status === 0) {
                        errorMessage = 'Network error: Cannot reach the backend at ' + config.baseUrl;
                    } else if (xhr.status === 400) {
                        errorMessage = 'Bad request: Invalid form data';
                    } else if (xhr.status === 404) {
                        errorMessage = 'API endpoint not found: ' + config.baseUrl;
                    } else if (xhr.status === 500) {
                        errorMessage = 'Server error: ' + (xhr.responseText || 'Internal server error');
                    }
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Update form configuration (uses UpdateForm endpoint)
     * @param {Object} formData - The form data object
     * @param {String} formData.id - Form ID (MongoDB ObjectId)
     * @param {String} formData.name - Form name
     * @param {String} formData.title - Form title
     * @param {Array} formData.tags - Form tags
     * @param {Object} formData.components - Form JSON configuration
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function updateForm(formData, onSuccess, onError) {
        if (!formData || !formData.id) {
            if (onError) {
                onError('Form data with id is required', 400);
            }
            return;
        }

        // Get tenantId - send as-is
        var tenantId = formData.tenantId || sessionStorage.getItem('editingFormTenantId') || null;

        // Prepare the request payload
        var payload = {
            id: formData.id,
            name: formData.name || '',
            title: formData.title || '',
            tags: formData.tags || [],
            // Ensure components is a string (JSON stringified)
            components: typeof formData.components === 'string' ? formData.components : JSON.stringify(formData.components || {}),
            // Include tenantId
            tenantId: tenantId
        };

        console.log('📤 PUT payload tenantId:', payload.tenantId);

        var updateUrl = config.baseUrl + '/' + formData.id;

        $.ajax({
            url: updateUrl,
            type: 'PUT',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                var errorMessage = 'Error updating form';
                try {
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    }
                } catch (e) {
                    if (xhr.status === 0) {
                        errorMessage = 'Network error: Cannot reach the backend at ' + updateUrl;
                    } else if (xhr.status === 400) {
                        errorMessage = 'Bad request: Invalid form data';
                    } else if (xhr.status === 404) {
                        errorMessage = 'Form not found or endpoint not found: ' + updateUrl;
                    } else if (xhr.status === 500) {
                        errorMessage = 'Server error: ' + (xhr.responseText || 'Internal server error');
                    }
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Escape HTML to prevent XSS attacks
     * @param {String} text - Text to escape
     * @returns {String} Escaped HTML text
     */
    function escapeHtml(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
    }


    //  * Load and display forms in a table (for existingForms.html)
    //  * Detects if a tenantId parameter is present in the URL query string.
    //  */
    function loadFormsTable() {
     
        var urlParams = new URLSearchParams(window.location.search);
        var tenantId = urlParams.get('tenantId');

        if (tenantId) {
            console.log("Tenant ID detected in URL:", tenantId);
            
            // Store tenant ID in sessionStorage so it's available when editing forms
            // This ensures tenant context is preserved even if form doesn't have project field
            sessionStorage.setItem('editingFormTenantId', tenantId);
            console.log('✅ Tenant ID stored in sessionStorage for editing context');
            
            getFormsByTenantId(tenantId, 
                function(tenantForms) {
                    populateFormsTable(tenantForms);
                },
                function(error) {
                    console.error('Failed to load forms for tenant:', error);
                    showNoFormsMessage(error || 'Failed to fetch forms for this tenant.');
                }
            );
            return;
        }

        console.log("No tenant ID in URL. Fetching all forms...");
        getAllForms(
            function(forms) {
                populateFormsTable(forms);
            },
            function(error, statusCode) {
                console.error('Failed to load forms:', error);
                showNoFormsMessage(error);
            }
        );
    }
    /**
     * Populate the forms table with data
     * @param {Array} forms - Array of form objects
     */
    function populateFormsTable(forms) {
        var tableBody = document.getElementById('formsTableBody');
        var loadingMessage = document.getElementById('formsLoadingMessage');
        var formsTable = document.getElementById('formsTable');
        var tableControls = document.getElementById('tableControls');
        var paginationControls = document.getElementById('paginationControls');

        if (!tableBody || !loadingMessage || !formsTable) {
            console.error('Required table elements not found in DOM');
            return;
        }

        tableBody.innerHTML = '';

        if (!forms || forms.length === 0) {
            showNoFormsMessage('No forms available');
            if (tableControls) tableControls.style.display = 'none';
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }

        // Store forms and initialize pagination
        paginationState.allForms = forms;
        paginationState.filteredForms = forms;
        paginationState.currentPage = 1;
        paginationState.currentPageSet = 1;

        loadingMessage.style.display = 'none';
        formsTable.style.display = 'table';
        if (tableControls) tableControls.style.display = 'flex';
        if (paginationControls) paginationControls.style.display = 'flex';

        // Initialize controls and display
        initializeSearchAndFilter();
        displayPaginatedForms();
        renderPaginationControls();
    }

    /**
     * Show no forms message
     * @param {String} message - Message to display
     */
    function showNoFormsMessage(message) {
        var loadingMessage = document.getElementById('formsLoadingMessage');
        var formsTable = document.getElementById('formsTable');

        if (!loadingMessage || !formsTable) {
            console.error('Required message elements not found in DOM');
            return;
        }

        formsTable.style.display = 'none';
        loadingMessage.style.display = 'block';
        loadingMessage.innerHTML = '<i class="bi bi-exclamation-circle"></i> <strong>' + escapeHtml(message) + '</strong>';
        loadingMessage.className = 'alert alert-warning';
    }

    /**
     * Edit form - navigate to form builder
     * @param {String} formId - The form ID to edit
     */
    function editForm(formId) {
        console.log('Edit form:', formId);
        
        // Find the form from already loaded forms instead of fetching again
        var form = paginationState.allForms.find(function(f) {
            return f.id === formId;
        });
        
        if (!form) {
            console.error('Form not found in loaded forms:', formId);
            alert('Form not found');
            return;
        }
        
        console.log('Form found for editing:', form);
        console.log('Form object keys:', Object.keys(form));
        console.log('Form.tenantId:', form.tenantId);
        console.log('Form.project:', form.project);
        
        // Store form data in sessionStorage
        sessionStorage.setItem('editingFormId', formId);
        console.log('Final tenantId being stored:', form.tenantId);
        
        sessionStorage.setItem('editingFormData', JSON.stringify({
            id: form.id,
            name: form.name,
            title: form.title,
            tags: form.tags,
            components: form.components,
            versionId: form.versionId,
            tenantId: form.tenantId  // Include tenant ID in the stored data
        }));
        // Redirect to builder
        window.location.href = 'index.html';
    }

    /**
     * View form - navigate to form viewer
     * @param {String} formId - The form ID to view
     */
    function viewForm(formId) {
        console.log('View form:', formId);
        if (!formId) {
            alert('Form ID is required');
            return;
        }
        // Fetch form and open preview page
        launchForm(formId);
    }

    /**
     * Copy form - duplicate an existing form
     * @param {String} formId - The form ID to copy
     */
    function copyForm(formId) {
        console.log('Copy form:', formId);
        
        // Find the form from already loaded forms instead of fetching again
        var form = paginationState.allForms.find(function(f) {
            return f.id === formId;
        });
        
        if (!form) {
            console.error('Form not found in loaded forms:', formId);
            alert('Form not found');
            return;
        }
        
        console.log('Form found for copying:', form);
        // Store only the form schema (components) in sessionStorage for copy mode
        // Do NOT store id, name, title, tags - this prevents form details from populating
        sessionStorage.setItem('copyingFormData', JSON.stringify({
            components: form.components
        }));
        sessionStorage.removeItem('editingFormId');
        sessionStorage.removeItem('editingFormData');
        // Redirect to builder
        window.location.href = 'index.html';
    }

    /**
     * Launch form - open form preview in new window
     * @param {String} formId - The form ID to launch
     */
    function launchForm(formId) {
        console.log('Launch form:', formId);
        
        // Clear any submission data from previous submission viewer
        sessionStorage.removeItem('submissionData');
        console.log('✅ Cleared submission data from sessionStorage');
        
        if (!formId) {
            alert('Form ID is required');
            return;
        }
        
        // Find the form from already loaded forms instead of fetching again
        var form = paginationState.allForms.find(function(f) {
            // Try both 'id' and '_id' fields
            return f.id === formId || f._id === formId;
        });
        
        if (!form) {
            console.error('Form not found in loaded forms:', formId);
            console.log('Available forms:', paginationState.allForms);
            alert('Form not found');
            return;
        }
        
        console.log('Form found for preview:', form);
        console.log('Form keys:', Object.keys(form));
        console.log('Form._id:', form._id);
        console.log('Form.id:', form.id);
        
        // Parse components if it's a string (from API)
        let components = form.components;
        if (typeof components === 'string') {
            try {
                components = JSON.parse(components);
            } catch (e) {
                console.error('Error parsing components:', e);
                components = [];
            }
        }
        
        // Get the correct form ID - use _id if available, otherwise id
        const actualFormId = form._id || form.id;
        console.log('Actual form ID to use:', actualFormId);
        
        // Create a proper Formio form schema - INCLUDE THE _id!
        const formSchema = {
            _id: actualFormId,  // ✅ Include the MongoDB ObjectId
            display: 'form',
            type: 'form',
            title: form.title || form.name || 'Untitled Form',
            name: form.name || 'form',
            components: components || [],
            _vid: form._vid || 0  // ✅ Include form version
        };
        
        console.log('📄 Creating form schema for preview with _id:', actualFormId);
        console.log('📄 Creating form schema with _vid:', form._vid || 0);
        
        // Store form schema in sessionStorage
        sessionStorage.setItem('previewFormSchema', JSON.stringify(formSchema));
        // Also store the form ID in sessionStorage for easy access
        if (actualFormId) {
            sessionStorage.setItem('previewFormId', actualFormId);
            console.log('✅ Stored previewFormId in sessionStorage:', actualFormId);
        }
        // Open preview page in new window
        window.open('previewPage.html', '_blank');
    }

    /**
     * Delete form - remove a form
     * @param {String} formId - The form ID to delete
     */
    function deleteForm(formId) {
        console.log('Delete form:', formId);
        
        if (!formId) {
            alert('Form ID is required');
            return;
        }

        // Confirmation dialog
        if (!confirm('Are you sure you want to delete this form? ')) {
            console.log('Delete cancelled by user');
            return;
        }

        $.ajax({
            url: config.baseUrl + '/' + formId,
            type: 'DELETE',
            contentType: config.contentType,
            dataType: 'json',
            success: function(response) {
                console.log('Form deleted successfully:', response);
                alert('Form deleted successfully!');
                // Refresh the forms table
                loadFormsTable();
            },
            error: function(xhr, status, error) {
                console.error('Error deleting form:', error);
                var errorMessage = 'Error deleting form';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 404) {
                    errorMessage = 'Form not found';
                } else if (xhr.status === 0) {
                    errorMessage = 'Network error: Cannot reach the API server. Make sure the backend is running.';
                }
                alert(errorMessage);
            }
        });
    }

    // Pagination state
    var paginationState = {
        allForms: [],
        filteredForms: [],
        currentPage: 1,
        currentPageSet: 1,
        itemsPerPage: 10,
        pagesPerSet: 5
    };

    /**
     * Initialize search and filter event listeners
     */
    function initializeSearchAndFilter() {
        var searchInput = document.getElementById('searchInput');
        var filterSelect = document.getElementById('filterSelect');

        if (searchInput) {
            searchInput.addEventListener('keyup', function() {
                paginationState.currentPage = 1;
                paginationState.currentPageSet = 1;
                applyFiltersAndSearch();
            });
        }

        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                paginationState.currentPage = 1;
                paginationState.currentPageSet = 1;
                applyFiltersAndSearch();
            });
        }
    }

    /**
     * Apply filters and search to forms
     */
    function applyFiltersAndSearch() {
        var searchInput = document.getElementById('searchInput');
        var filterSelect = document.getElementById('filterSelect');
        var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        var sortBy = filterSelect ? filterSelect.value : '';

        // Filter by search term
        paginationState.filteredForms = paginationState.allForms.filter(function(form) {
            var title = (form.title || '').toLowerCase();
            var tags = (form.tags || []).join(' ').toLowerCase();
            return title.includes(searchTerm) || tags.includes(searchTerm);
        });

        // Sort forms
        if (sortBy === 'name-asc') {
            paginationState.filteredForms.sort(function(a, b) {
                return (a.title || '').localeCompare(b.title || '');
            });
        } else if (sortBy === 'name-desc') {
            paginationState.filteredForms.sort(function(a, b) {
                return (b.title || '').localeCompare(a.title || '');
            });
        } else if (sortBy === 'date-desc') {
            paginationState.filteredForms.sort(function(a, b) {
                return new Date(b.modified || 0) - new Date(a.modified || 0);
            });
        } else if (sortBy === 'date-asc') {
            paginationState.filteredForms.sort(function(a, b) {
                return new Date(a.modified || 0) - new Date(b.modified || 0);
            });
        }

        displayPaginatedForms();
        renderPaginationControls();
    }

    /**
     * Display forms for current page
     */
   
function displayPaginatedForms() {
    var tableBody = document.getElementById('formsTableBody');
    var formsTable = document.getElementById('formsTable');

    if (!tableBody || !formsTable) {
        return;
    }
    tableBody.innerHTML = '';

    var startIndex = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
    var endIndex = startIndex + paginationState.itemsPerPage;
    var pageItems = paginationState.filteredForms.slice(startIndex, endIndex);

    pageItems.forEach(function (form) {
        var tagsDisplay = (form.tags || []).join(', ');
        // Show Updated if available, otherwise Created
        var dateText = '';

        if (form.modified) {
            dateText = 'Updated: ' + new Date(form.modified).toLocaleString();
        }
        else if (form.created) {
            dateText = 'Created: ' + new Date(form.created).toLocaleString();
        }

        var row = document.createElement('tr');

        row.innerHTML =
            '<td>' +
                '<strong>' + escapeHtml(form.title || '') + '</strong><br>' +
                '<small class="text-muted">' + dateText + '</small>' +
            '</td>' +

            '<td style="text-align:right;">' +
                escapeHtml(tagsDisplay) +
            '</td>' +

            '<td style="text-align:right;">' +

                '<button class="btn btn-sm btn-primary" title="Edit form details" onclick="FormBuilderApi.editForm(\'' + form.id + '\')">' +
                    '<i class="bi bi-pencil"></i>' +
                '</button> ' +

                '<button class="btn btn-sm btn-secondary" title="Copy form schema" onclick="FormBuilderApi.copyForm(\'' + form.id + '\')">' +
                    '<i class="bi bi-copy"></i>' +
                '</button> ' +

                '<button class="btn btn-sm btn-info" title="Preview form" onclick="FormBuilderApi.launchForm(\'' + form.id + '\')">' +
                    '<i class="bi bi-box-arrow-up-right"></i>' +
                '</button> ' +

                '<button class="btn btn-sm btn-danger" title="Delete form" onclick="FormBuilderApi.deleteForm(\'' + form.id + '\')">' +
                    '<i class="bi bi-trash"></i>' +
                '</button>' +

            '</td>';

        tableBody.appendChild(row);
    });

    formsTable.style.display = 'table';
}
    /**
     * Render pagination controls
     */
    function renderPaginationControls() {
        var totalPages = Math.ceil(paginationState.filteredForms.length / paginationState.itemsPerPage);
        var pageNumbersDiv = document.getElementById('pageNumbers');
        var nextPageBtn = document.getElementById('nextPageBtn');
        var prevPageBtn = document.getElementById('prevPageBtn');
        var paginationInfo = document.getElementById('paginationInfo');

        if (!pageNumbersDiv) {
            return;
        }

        pageNumbersDiv.innerHTML = '';

        var startPage = (paginationState.currentPageSet - 1) * paginationState.pagesPerSet + 1;
        var endPage = Math.min(startPage + paginationState.pagesPerSet - 1, totalPages);

        for (var i = startPage; i <= endPage; i++) {
            var btn = document.createElement('button');
            btn.className = 'page-btn' + (i === paginationState.currentPage ? ' active' : '');
            btn.textContent = i;
            btn.onclick = function(page) {
                return function() {
                    paginationState.currentPage = page;
                    displayPaginatedForms();
                    renderPaginationControls();
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
            paginationInfo.textContent = 'Page ' + paginationState.currentPage + ' of ' + totalPages;
        }
    }

    /**
     * Go to previous page set
     */
    function previousPage() {
        if (paginationState.currentPageSet > 1) {
            paginationState.currentPageSet--;
            paginationState.currentPage = (paginationState.currentPageSet - 1) * paginationState.pagesPerSet + 1;
            displayPaginatedForms();
            renderPaginationControls();
        }
    }

    /**
     * Go to next page set
     */
    function nextPage() {
        var totalPages = Math.ceil(paginationState.filteredForms.length / paginationState.itemsPerPage);
        var maxPageSet = Math.ceil(totalPages / paginationState.pagesPerSet);
        if (paginationState.currentPageSet < maxPageSet) {
            paginationState.currentPageSet++;
            paginationState.currentPage = (paginationState.currentPageSet - 1) * paginationState.pagesPerSet + 1;
            displayPaginatedForms();
            renderPaginationControls();
        }
    }

    /**
     * Load and populate reports table (reuses forms pagination)
     */
    function loadReportsTable() {
        getAllForms(
            function(forms) {
                populateReportsTable(forms);
            },
            function(error, statusCode) {
                console.error('Failed to load forms for reports:', error);
                showNoReportsMessage(error);
            }
        );
    }

    /**
     * Populate the reports table with form data (reuses forms pagination)
     * @param {Array} forms - Array of form objects
     */
    function populateReportsTable(forms) {
        var tableBody = document.getElementById('reportsTableBody');
        var loadingMessage = document.getElementById('reportsLoadingMessage');
        var reportsTable = document.getElementById('reportsTable');
        var tableControls = document.getElementById('tableControls');
        var paginationControls = document.getElementById('paginationControls');

        if (!tableBody || !loadingMessage || !reportsTable) {
            console.error('Required reports table elements not found in DOM');
            return;
        }

        tableBody.innerHTML = '';

        if (!forms || forms.length === 0) {
            showNoReportsMessage('No forms available');
            if (tableControls) tableControls.style.display = 'none';
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }

        // Store forms and initialize pagination (reuse existing paginationState)
        paginationState.allForms = forms;
        paginationState.filteredForms = forms;
        paginationState.currentPage = 1;
        paginationState.currentPageSet = 1;

        loadingMessage.style.display = 'none';
        reportsTable.style.display = 'table';
        if (tableControls) tableControls.style.display = 'flex';
        if (paginationControls) paginationControls.style.display = 'flex';

        // Initialize controls and display (reuse existing functions with reports context)
        initializeSearchAndFilter();
        displayReportsPage();
        renderReportsPaginationControls();
    }

    /**
     * Display reports for current page (reports-specific renderer)
     */
    function displayReportsPage() {
        var tableBody = document.getElementById('reportsTableBody');
        var reportsTable = document.getElementById('reportsTable');

        if (!tableBody || !reportsTable) {
            return;
        }

        tableBody.innerHTML = '';

        var startIndex = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
        var endIndex = startIndex + paginationState.itemsPerPage;
        var pageItems = paginationState.filteredForms.slice(startIndex, endIndex);

        pageItems.forEach(function(form) {
            var row = document.createElement('tr');
            row.innerHTML = '<td><strong>' + escapeHtml(form.title || '') + '</strong></td>' +
                '<td style="text-align: right;">' +
                '<button class="btn btn-sm btn-info" title="Generate Report" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.generateReport(\'' + form.id + '\')">' +
                '<i class="bi bi-file-earmark-pdf"></i> Generate Report' +
                '</button>' +
                '</td>';
            tableBody.appendChild(row);
        });

        reportsTable.style.display = 'table';
    }

    /**
     * Render pagination controls for reports
     */
    function renderReportsPaginationControls() {
        var totalPages = Math.ceil(paginationState.filteredForms.length / paginationState.itemsPerPage);
        var pageNumbersDiv = document.getElementById('pageNumbers');
        var nextPageBtn = document.getElementById('nextPageBtn');
        var prevPageBtn = document.getElementById('prevPageBtn');
        var paginationInfo = document.getElementById('paginationInfo');

        if (!pageNumbersDiv) {
            return;
        }

        pageNumbersDiv.innerHTML = '';

        var startPage = (paginationState.currentPageSet - 1) * paginationState.pagesPerSet + 1;
        var endPage = Math.min(startPage + paginationState.pagesPerSet - 1, totalPages);

        for (var i = startPage; i <= endPage; i++) {
            var btn = document.createElement('button');
            btn.className = 'page-btn' + (i === paginationState.currentPage ? ' active' : '');
            btn.textContent = i;
            btn.onclick = function(page) {
                return function() {
                    paginationState.currentPage = page;
                    displayReportsPage();
                    renderReportsPaginationControls();
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
            paginationInfo.textContent = 'Page ' + paginationState.currentPage + ' of ' + totalPages;
        }
    }

    /**
     * Submit a complete Form.io submission document to the backend.
     * The entire submission object (including id, form, data, metadata, etc.) is sent as-is.
     * @param {Object} submission - The complete Form.io submission object with form, data, and other properties
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function submitFormData(submission, onSuccess, onError) {
        // Validate submission is an object
        if (!submission || typeof submission !== 'object') {
            if (onError) {
                onError('Submission must be a valid object', 400);
            }
            return;
        }

        // Validate form property exists and is not empty
        if (!submission.form || (typeof submission.form === 'string' && submission.form.trim() === '')) {
            if (onError) {
                onError('Submission must contain a "form" property with the Form ID', 400);
            }
            return;
        }

        // Validate data property exists - allow empty objects as valid data
        if (submission.data === undefined || submission.data === null) {
            if (onError) {
                onError('Submission must contain form data', 400);
            }
            return;
        }

        var submissionUrl = config.baseUrl.replace('/api/forms', '/api/formsubmissions');
        var payload = submission; // Send the entire submission as-is

        $.ajax({
            url: submissionUrl,
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                var errorMessage = 'Error submitting form';
                
                try {
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    }
                } catch (e) {
                    if (xhr.status === 0) {
                        errorMessage = 'Network error: Cannot reach the backend at ' + submissionUrl;
                    } else if (xhr.status === 400) {
                        errorMessage = 'Bad request: ' + (xhr.responseText || 'Invalid form data');
                    } else if (xhr.status === 404) {
                        errorMessage = 'API endpoint not found: ' + submissionUrl;
                    } else if (xhr.status === 500) {
                        errorMessage = 'Server error: ' + (xhr.responseText || 'Internal server error');
                    }
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Show no reports message
     * @param {String} message - Message to display
     */
    function showNoReportsMessage(message) {
        var loadingMessage = document.getElementById('reportsLoadingMessage');
        var reportsTable = document.getElementById('reportsTable');
        
        if (loadingMessage) {
            loadingMessage.className = 'alert alert-warning';
            loadingMessage.innerHTML = '<i class="bi bi-exclamation-circle"></i> <strong>' + escapeHtml(message) + '</strong>';
            loadingMessage.style.display = 'block';
        }
        
        if (reportsTable) {
            reportsTable.style.display = 'none';
        }
    }

    /**
     * Get form submissions for a form
     * @param {String} formId - The form ID
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function getFormSubmissions(formId, onSuccess, onError) {
        if (!formId) {
            console.error('Form ID is required');
            if (onError) {
                onError('Form ID is required', 400);
            }
            return;
        }

        var submissionsUrl = config.baseUrl.replace('/api/forms', '/api/formsubmissions') + '/form/' + formId;
        
        console.log('Fetching submissions from:', submissionsUrl);

        $.ajax({
            url: submissionsUrl,
            type: 'GET',
            contentType: config.contentType,
            dataType: 'json',
            success: function(response) {
                console.log('Form submissions retrieved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error retrieving form submissions:', error);
                var errorMessage = 'Error retrieving form submissions';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Generate report for a form - wrapper that delegates to reports.js
     * @param {String} formId - The form ID
     */
    function generateReport(formId) {
        if (typeof window.generateReport === 'function') {
            window.generateReport(formId);
        } else {
            console.error('generateReport function not found in reports.js');
        }
    }

    /**
     * Save a custom resource from Add Resource page
     * @param {Object} resourceData - The resource data object
     * @param {String} resourceData.resourceType - Resource type
     * @param {String} resourceData.componentName - Component name
     * @param {String} resourceData.description - Description (optional)
     * @param {String} resourceData.json - Component JSON
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function saveResource(resourceData, onSuccess, onError) {
        if (!resourceData) {
            console.error('Resource data is required');
            if (onError) {
                onError('Resource data is required', 400);
            }
            return;
        }

        var resourceUrl = config.baseUrl.replace('/api/forms', '/api/resources');
        
        var payload = {
            resourceType: resourceData.resourceType || resourceData.type,
            componentName: resourceData.componentName,
            description: resourceData.description || null,
            resourceJson: resourceData.json
        };

        $.ajax({
            url: resourceUrl,
            type: 'POST',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                console.log('Resource saved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error saving resource:', error);
                var errorMessage = 'Error saving resource';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 0) {
                    errorMessage = 'Network error: Cannot reach the API server. Make sure the backend is running.';
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Get all resources
     * @param {String} resourceType - Optional resource type filter
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function getAllResources(resourceType, onSuccess, onError) {
        var resourceUrl = config.baseUrl.replace('/api/forms', '/api/resources');
        if (resourceType) {
            resourceUrl += '?resourceType=' + encodeURIComponent(resourceType);
        }

        $.ajax({
            url: resourceUrl,
            type: 'GET',
            contentType: config.contentType,
            dataType: 'json',
            success: function(response) {
                console.log('Resources retrieved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error retrieving resources:', error);
                var errorMessage = 'Error retrieving resources';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    /**
     * Get all resources grouped by resource type
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function getResourcesList(onSuccess, onError) {
        var resourceUrl = config.baseUrl.replace('/api/forms', '/api/resources') + '/grouped/list';

        $.ajax({
            url: resourceUrl,
            type: 'GET',
            contentType: config.contentType,
            dataType: 'json',
            success: function(response) {
                console.log('Grouped resources retrieved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error retrieving grouped resources:', error);
                var errorMessage = 'Error retrieving grouped resources';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 0) {
                    errorMessage = 'Network error: Cannot reach the API server. Make sure the backend is running.';
                }
                if (onError) {
                    onError(errorMessage, xhr.status);
                }
            }
        });
    }

    // Public API
    return {
        getAllForms: getAllForms,
        getTenants: getTenants,
        saveTenant: saveTenant,
        updateTenant: updateTenant,
        getFormsByTenantId: getFormsByTenantId,
        deleteTenant: deleteTenant,
        getFormById: getFormById,
        saveForm: saveForm,
        updateForm: updateForm,
        loadFormsTable: loadFormsTable,
        loadReportsTable: loadReportsTable,
        editForm: editForm,
        viewForm: viewForm,
        copyForm: copyForm,
        launchForm: launchForm,
        deleteForm: deleteForm,
        generateReport: generateReport,
        getFormSubmissions: getFormSubmissions,
        previousPage: previousPage,
        nextPage: nextPage,
        submitFormData: submitFormData,
        saveResource: saveResource,
        getAllResources: getAllResources,
        getResourcesList: getResourcesList,
        config: config
    };

})();

