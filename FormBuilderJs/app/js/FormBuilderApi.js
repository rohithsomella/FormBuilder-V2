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

        if (!tableBody || !loadingMessage || !formsTable) {
            console.error('Required table elements not found in DOM');
            return;
        }

        tableBody.innerHTML = ''; // Clear existing rows

        if (!forms || forms.length === 0) {
            showNoFormsMessage('No forms available');
            return;
        }

        loadingMessage.style.display = 'none';
        formsTable.style.display = 'table';

        forms.forEach(function(form) {
            var row = document.createElement('tr');
            row.innerHTML = '<td><strong>' + escapeHtml(form.formName || '') + '</strong></td>' +
                '<td>' + escapeHtml(form.formTitle || '') + '</td>' +
                '<td>' + escapeHtml(form.formTags || '') + '</td>' +
                '<td>' +
                '<button class="btn btn-sm btn-primary" onclick="FormBuilderApi.editForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-pencil"></i> Edit' +
                '</button> ' +
                '<button class="btn btn-sm btn-info" onclick="FormBuilderApi.viewForm(\'' + form.formId + '\')">' +
                '<i class="bi bi-eye"></i> View' +
                '</button>' +
                '</td>';
            tableBody.appendChild(row);
        });
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
        // TODO: Navigate to form builder with this form
        alert('Edit form: ' + formId);
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

    // Public API
    return {
        getAllForms: getAllForms,
        getFormById: getFormById,
        saveForm: saveForm,
        updateForm: updateForm,
        loadFormsTable: loadFormsTable,
        editForm: editForm,
        viewForm: viewForm,
        config: config
    };

})();

// Usage Examples (commented out):
//
// Get all forms
// FormBuilderApi.getAllForms(
//     function(forms) {
//         console.log('All forms:', forms);
//     },
//     function(error, statusCode) {
//         console.error('Failed to get forms:', error);
//     }
// );
//
// Get form by ID
// FormBuilderApi.getFormById('550e8400-e29b-41d4-a716-446655440000',
//     function(form) {
//         console.log('Form:', form);
//     },
//     function(error, statusCode) {
//         console.error('Failed to get form:', error);
//     }
// );
//
// Save a new form
// FormBuilderApi.saveForm({
//     formName: 'Contact Form',
//     formTitle: 'Contact Us',
//     formTags: 'contact,support',
//     formJson: JSON.stringify({ data: 'form configuration' })
// },
//     function(response) {
//         console.log('Form saved:', response);
//     },
//     function(error, statusCode) {
//         console.error('Failed to save form:', error);
//     }
// );
