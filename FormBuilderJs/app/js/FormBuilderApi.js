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
     * Update form configuration (uses UpdateForm endpoint)
     * @param {Object} formData - The form data object
     * @param {String} formData.formId - Form ID (GUID)
     * @param {String} formData.formName - Form name
     * @param {String} formData.formTitle - Form title
     * @param {String} formData.formTags - Form tags
     * @param {String} formData.formJson - Form JSON configuration
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function updateForm(formData, onSuccess, onError) {
        if (!formData || !formData.formId) {
            console.error('Form data with formId is required');
            if (onError) {
                onError('Form data with formId is required', 400);
            }
            return;
        }

        // Prepare the request payload
        var payload = {
            formId: formData.formId,
            formName: formData.formName || '',
            formTitle: formData.formTitle || '',
            formTags: formData.formTags || '',
            formJson: formData.formJson || ''
        };

        $.ajax({
            url: config.baseUrl + '/' + formData.formId,
            type: 'PUT',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                console.log('Form updated successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error updating form:', error);
                var errorMessage = 'Error updating form';
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
     * Launch form - open form preview in new window
     * @param {String} formId - The form ID to launch
     */
    function launchForm(formId) {
        console.log('Launch form:', formId);
        if (!formId) {
            alert('Form ID is required');
            return;
        }
        
        // Fetch the form from API
        getFormById(formId, 
            function(form) {
                console.log('Form retrieved for preview:', form);
                // Store form schema in sessionStorage
                sessionStorage.setItem('previewFormSchema', form.formJson);
                // Open preview page in new window
                window.open('previewPage.html', '_blank');
            },
            function(error) {
                console.error('Failed to load form for preview:', error);
                alert('Error loading form: ' + error);
            }
        );
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
            var name = (form.formName || '').toLowerCase();
            var tags = (form.formTags || '').toLowerCase();
            return name.includes(searchTerm) || tags.includes(searchTerm);
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
                '<td style="text-align: right;">' + escapeHtml(form.formTags || '') + '</td>' +
                '<td style="text-align: right;">' +
                '<button class="btn btn-sm btn-primary" title="Edit form details" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.editForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-pencil"></i>' +
                '</button> ' +
                '<button class="btn btn-sm btn-secondary" title="Copy form schema" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.copyForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-copy"></i>' +
                '</button> ' +
                '<button class="btn btn-sm btn-info" title="Preview form" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.launchForm(\'' + form.formId + '\')">' +
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
            row.innerHTML = '<td><strong>' + escapeHtml(form.formName || '') + '</strong></td>' +
                '<td style="text-align: right;">' +
                '<button class="btn btn-sm btn-info" title="Generate Report" data-toggle="tooltip" data-placement="bottom" onclick="FormBuilderApi.generateReport(\'' + form.formId + '\')">' +
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
     * Submit form submission data to the backend
     * @param {String} formId - The form ID
     * @param {Object} submissionData - The form submission data object
     * @param {Function} onSuccess - Callback function on success
     * @param {Function} onError - Callback function on error
     */
    function submitFormData(formId, submissionData, onSuccess, onError) {
        if (!formId || !submissionData) {
            console.error('Form ID and submission data are required');
            if (onError) {
                onError('Form ID and submission data are required', 400);
            }
            return;
        }

        var submissionUrl = config.baseUrl.replace('/api/forms', '/api/formsubmissions');
        var payload = {
            formId: formId,
            submissionData: JSON.stringify(submissionData)
        };

        console.log('Submitting form data to:', submissionUrl);
        console.log('Payload:', payload);

        $.ajax({
            url: submissionUrl,
            type: 'POST',
            contentType: config.contentType,
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(response) {
                console.log('Form submission saved successfully:', response);
                if (onSuccess) {
                    onSuccess(response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error submitting form:', error);
                var errorMessage = 'Error submitting form';
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

