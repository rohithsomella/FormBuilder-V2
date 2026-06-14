/**
 * FormBuilder API - jQuery AJAX Integration
 * This module handles all communication with the FormBuilder API backend
 * Base URL: https://localhost:7286/api/forms
 */

var FormBuilderApi = (function() {
    'use strict';

    // Configuration
    var config = {
        baseUrl: 'https://localhost:7286/api/forms',
        contentType: 'application/json'
    };

    /**
     * Get all forms
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
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
     * @param {String} formData.formName - Form name
     * @param {String} formData.formTitle - Form title
     * @param {String} formData.formTags - Form tags
     * @param {String} formData.formJson - Form JSON configuration
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function saveForm(formData, onSuccess, onError) {
        if (!formData) {
            console.error('Form data is required');
            if (onError) {
                onError('Form data is required', 400);
            }
            return;
        }

        // Prepare the request payload
        var payload = {
            formName: formData.formName || '',
            formTitle: formData.formTitle || '',
            formTags: formData.formTags || '',
            formJson: formData.formJson || ''
        };

        $.ajax({
            url: config.baseUrl,
            type: 'POST',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                console.log('Form saved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error saving form:', error);
                var errorMessage = 'Error saving form';
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
     * Update form configuration (uses SaveForm endpoint)
     * @param {Object} formData - The form data object
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function updateForm(formData, onSuccess, onError) {
        // Since we're using SaveForm SP, we use the same endpoint
        saveForm(formData, onSuccess, onError);
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
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    /**
     * Load and display all forms in a table (for existingForms.html)
     */
    function loadFormsTable() {
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
        // Get the form details and redirect to builder
        getFormById(formId, 
            function(form) {
                console.log('Form retrieved for editing:', form);
                // Store form data in sessionStorage
                sessionStorage.setItem('editingFormId', formId);
                sessionStorage.setItem('editingFormData', JSON.stringify({
                    formId: form.formId,
                    formName: form.formName,
                    formTitle: form.formTitle,
                    formTags: form.formTags,
                    formJson: form.formJson
                }));
                // Redirect to builder
                window.location.href = 'index.html';
            },
            function(error) {
                console.error('Failed to load form for editing:', error);
                alert('Error loading form: ' + error);
            }
        );
    }

    /**
     * View form - navigate to form viewer
     * @param {String} formId - The form ID to view
     */
    function viewForm(formId) {
        console.log('View form:', formId);
        // TODO: Navigate to form viewer with this form
        alert('View form: ' + formId);
    }

    /**
     * Copy form - duplicate an existing form
     * @param {String} formId - The form ID to copy
     */
    function copyForm(formId) {
        console.log('Copy form:', formId);
        // Get the form and load schema only (without form details)
        getFormById(formId, 
            function(form) {
                console.log('Form retrieved for copying:', form);
                // Store only the form schema (JSON) in sessionStorage for copy mode
                // Do NOT store formId, formName, formTitle, formTags - this prevents form details from populating
                sessionStorage.setItem('copyingFormData', JSON.stringify({
                    formJson: form.formJson
                }));
                sessionStorage.removeItem('editingFormId');
                sessionStorage.removeItem('editingFormData');
                // Redirect to builder
                window.location.href = 'index.html';
            },
            function(error) {
                console.error('Failed to load form for copying:', error);
                alert('Error loading form: ' + error);
            }
        );
    }

    /**
     * Launch form - open form in new window
     * @param {String} formId - The form ID to launch
     */
    function launchForm(formId) {
        console.log('Launch form:', formId);
        // TODO: Implement form launch functionality
        alert('Launch form: ' + formId);
    }

    /**
     * Delete form - remove a form
     * @param {String} formId - The form ID to delete
     */
    function deleteForm(formId) {
        console.log('Delete form:', formId);
        // TODO: Implement form delete functionality
        alert('Delete form: ' + formId);
    }

    // Pagination state
    var paginationState = {
        allForms: [],
        filteredForms: [],
        currentPage: 1,
        currentPageSet: 1,
        itemsPerPage: 5,
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
            var name = (form.formName || '').toLowerCase();
            var title = (form.formTitle || '').toLowerCase();
            var tags = (form.formTags || '').toLowerCase();
            return name.includes(searchTerm) || title.includes(searchTerm) || tags.includes(searchTerm);
        });

        // Sort forms
        if (sortBy === 'name-asc') {
            paginationState.filteredForms.sort(function(a, b) {
                return (a.formName || '').localeCompare(b.formName || '');
            });
        } else if (sortBy === 'name-desc') {
            paginationState.filteredForms.sort(function(a, b) {
                return (b.formName || '').localeCompare(a.formName || '');
            });
        } else if (sortBy === 'date-desc') {
            paginationState.filteredForms.sort(function(a, b) {
                return new Date(b.createdDate || 0) - new Date(a.createdDate || 0);
            });
        } else if (sortBy === 'date-asc') {
            paginationState.filteredForms.sort(function(a, b) {
                return new Date(a.createdDate || 0) - new Date(b.createdDate || 0);
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

        pageItems.forEach(function(form) {
            var row = document.createElement('tr');
            row.innerHTML = '<td><strong>' + escapeHtml(form.formName || '') + '</strong></td>' +
                '<td>' + escapeHtml(form.formTitle || '') + '</td>' +
                '<td>' + escapeHtml(form.formTags || '') + '</td>' +
                '<td>' +
                '<button class="btn btn-sm btn-primary" title="Edit form details" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.editForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-pencil"></i>' +
                '</button> ' +
                '<button class="btn btn-sm btn-secondary" title="Copy form schema" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.copyForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-copy"></i>' +
                '</button> ' +
                '<button class="btn btn-sm btn-info" title="Launch form" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.launchForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-box-arrow-up-right"></i>' +
                '</button> ' +
                '<button class="btn btn-sm btn-danger" title="Delete form" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.deleteForm(\'' + form.formId + '\')">' +
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

    // Public API
    return {
        getAllForms: getAllForms,
        getFormById: getFormById,
        saveForm: saveForm,
        updateForm: updateForm,
        loadFormsTable: loadFormsTable,
        editForm: editForm,
        viewForm: viewForm,
        copyForm: copyForm,
        launchForm: launchForm,
        deleteForm: deleteForm,
        previousPage: previousPage,
        nextPage: nextPage,
        config: config
    };

})();

