/**
 * Reports Page - JavaScript functionality
 * Handles report generation, data export, and submission selection
 */

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

// Initialize report page
document.addEventListener('DOMContentLoaded', function() {
    // Load reports table when page loads
    FormBuilderApi.loadReportsTable();

    // Handle Export to JSON button
    var exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', function() {
            var reportModal = document.getElementById('reportModal');
            if (reportModal && reportModal.submissionsData) {
                var selectedSubmissions = getSelectedSubmissions();

                // Requirement Check: Alert if no report is selected
                if (selectedSubmissions.length === 0) {
                    alert('Select one report');
                    return;
                }

                exportToJson(selectedSubmissions, reportModal.formName);
            }
        });
    }

    // Handle Export to CSV button
    var exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function() {
            var reportModal = document.getElementById('reportModal');
            if (reportModal && reportModal.submissionsData) {
                var selectedSubmissions = getSelectedSubmissions();

                // Requirement Check: Alert if no report is selected
                if (selectedSubmissions.length === 0) {
                    alert('Select one report');
                    return;
                }

                exportToCsv(selectedSubmissions, reportModal.formName);
            }
        });
    }
});

/**
 * Generate report for a form
 * @param {String} formId - The form ID
 */
function generateReport(formId) {
    if (!formId) {
        console.error('Form ID is required');
        return;
    }

    console.log('Generating report for form ID:', formId);

    // Get form details first
    FormBuilderApi.getFormById(formId, 
        function(form) {
            console.log('Form loaded:', form);
            // Fetch submissions
            FormBuilderApi.getFormSubmissions(formId,
                function(submissions) {
                    console.log('Submissions loaded:', submissions);
                    displayReportDialog(form, submissions);
                },
                function(error, statusCode) {
                    console.error('Failed to load submissions:', error);
                    showReportError(error);
                }
            );
        },
        function(error, statusCode) {
            console.error('Failed to load form:', error);
            showReportError(error);
        }
    );
}

/**
 * Display the report dialog with submissions
 * @param {Object} form - The form object
 * @param {Array} submissions - Array of submission objects
 */

/**
 * Display the report dialog with submissions
 * @param {Object} form - The form object
 * @param {Array} submissions - Array of submission objects
 */
function displayReportDialog(form, submissions) {
    var modalLabel = document.getElementById('reportModalLabel');
    var submissionsTableBody = document.getElementById('submissionsTableBody');
    var submissionsTable = document.getElementById('submissionsTable');
    var reportLoadingMessage = document.getElementById('reportLoadingMessage');
    var reportErrorMessage = document.getElementById('reportErrorMessage');
    var reportModal = document.getElementById('reportModal');

    if (!modalLabel || !submissionsTableBody || !submissionsTable || !reportModal) {
        console.error('Report modal elements not found in DOM');
        return;
    }

    // Set modal title
    modalLabel.textContent = form.formName || form.title || 'Form Report';

    // Clear previous content
    submissionsTableBody.innerHTML = '';
    reportLoadingMessage.style.display = 'none';
    reportErrorMessage.style.display = 'none';

    if (!submissions || submissions.length === 0) {
        reportErrorMessage.innerHTML = '<i class="bi bi-info-circle"></i> <strong>No submissions found for this form.</strong>';
        reportErrorMessage.style.display = 'block';
        submissionsTable.style.display = 'none';
    } else {
        // Populate submissions table
        submissions.forEach(function (submission, index) {
            var row = document.createElement('tr');

            // Format dates safely (ONLY DATE, NO TIME)
            var submissionDate = submission.submissionDate || submission.created || submission.createdAt;
            var formattedSubDate = submissionDate ? new Date(submissionDate).toLocaleDateString() : 'N/A';

            var modifiedDate = submission.modifiedDate || submission.modified || submission.updatedAt;
            var formattedModDate = modifiedDate ? new Date(modifiedDate).toLocaleDateString() : 'N/A';
            var submissionId = submission.submissionId || submission.id || submission._id || '';
            var version = submission.version || submission._vid || '1.0';

            row.innerHTML =
                '<td><input type="checkbox" class="submission-checkbox" data-index="' + index + '" title="Select this submission"></td>' +
                '<td>' + escapeHtml(submissionId) + '</td>' +
                '<td>' + escapeHtml(String(version)) + '</td>' +
                '<td>' + escapeHtml(formattedSubDate) + '</td>' +
                '<td>' + escapeHtml(formattedModDate) + '</td>' +
                '<td style="text-align: center;">' +
                '<button class="btn btn-sm btn-outline-secondary view-submission-btn" title="View Submission" data-index="' + index + '">' +
                '<i class="bi bi-eye"></i>' +
                '</button>' +
                '</td>';

            // Row click event (excluding checkbox and action button clicks)
            row.style.cursor = 'pointer';
            row.addEventListener('click', function (event) {
                if (event.target.type === 'checkbox' || event.target.closest('.view-submission-btn')) {
                    return;
                }
                var checkbox = row.querySelector('.submission-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    var changeEvent = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                }
            });

            // Action button click event
            var viewBtn = row.querySelector('.view-submission-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    viewSubmissionDetails(submission);
                });
            }

            submissionsTableBody.appendChild(row);
        });

        submissionsTable.style.display = 'table';
        try {
            initializeSelectAllCheckbox();
        } catch (error) {
            console.error('Error initializing checkboxes:', error);
        }
    }

    // Store submissions in modal for export functions
    reportModal.submissionsData = submissions;
    reportModal.formName = form.formName || form.title;

    // Show modal
    try {
        if ($('#reportModal').length > 0) {
            $('#reportModal').modal('show');
        } else {
            console.error('Report modal element not found for display');
        }
    } catch (error) {
        console.error('Error showing modal:', error);
    }
}

/**
 * Handle viewing individual submission details when clicking the Eye icon
 */
function viewSubmissionDetails(submission) {
    console.log('Viewing submission details:', submission);
    // Add custom code or open preview modal here
    alert('Submission Details:\n' + JSON.stringify(submission, null, 2));
}

/**
 * Initialize select all checkbox functionality
 */
function initializeSelectAllCheckbox() {
    var selectAllCheckbox = document.getElementById('selectAllCheckbox');
    var submissionCheckboxes = document.querySelectorAll('.submission-checkbox');

    if (!selectAllCheckbox) {
        return;
    }

    // Handle select all checkbox
    selectAllCheckbox.addEventListener('change', function() {
        var isChecked = this.checked;
        submissionCheckboxes.forEach(function(checkbox) {
            checkbox.checked = isChecked;
        });
    });

    // Handle individual submission checkboxes
    submissionCheckboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            // Update select all checkbox state
            var allChecked = Array.from(submissionCheckboxes).every(function(cb) {
                return cb.checked;
            });
            var someChecked = Array.from(submissionCheckboxes).some(function(cb) {
                return cb.checked;
            });

            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
        });
    });
}

/**
 * Get selected submissions
 * @returns {Array} Array of selected submission objects
 */
function getSelectedSubmissions() {
    var submissionCheckboxes = document.querySelectorAll('.submission-checkbox:checked');
    var reportModal = document.getElementById('reportModal');
    var selectedSubmissions = [];

    submissionCheckboxes.forEach(function(checkbox) {
        var index = parseInt(checkbox.getAttribute('data-index'));
        if (reportModal.submissionsData && reportModal.submissionsData[index]) {
            selectedSubmissions.push(reportModal.submissionsData[index]);
        }
    });

    return selectedSubmissions;
}

/**
 * Show error message in report dialog
 * @param {String} message - Error message to display
 */
function showReportError(message) {
    var reportErrorMessage = document.getElementById('reportErrorMessage');
    var submissionsTable = document.getElementById('submissionsTable');
    var reportLoadingMessage = document.getElementById('reportLoadingMessage');

    if (reportErrorMessage) {
        reportErrorMessage.innerHTML = '<i class="bi bi-exclamation-circle"></i> <strong>' + escapeHtml(message) + '</strong>';
        reportErrorMessage.style.display = 'block';
    }

    if (submissionsTable) {
        submissionsTable.style.display = 'none';
    }

    if (reportLoadingMessage) {
        reportLoadingMessage.style.display = 'none';
    }

    var reportModal = document.getElementById('reportModal');
    if (reportModal) {
        $('#reportModal').modal('show');
    }
}

/**
 * Export submissions to JSON
 * @param {Array} submissions - Array of submission objects
 * @param {String} formName - Name of the form
 */
function exportToJson(submissions, formName) {
    if (!submissions || submissions.length === 0) {
        alert('No data to export');
        return;
    }

    var dataStr = JSON.stringify(submissions, null, 2);
    var dataBlob = new Blob([dataStr], { type: 'application/json' });
    var url = URL.createObjectURL(dataBlob);
    var link = document.createElement('a');
    link.href = url;
    link.download = (formName || 'report') + '_' + new Date().getTime() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Flatten nested object to get leaf-level keys only
 * @param {Object} obj - Object to flatten
 * @param {String} prefix - Prefix for nested keys
 * @returns {Object} Flattened object with leaf-level keys only
 */
function flattenObject(obj, prefix = '') {
    var flattened = {};
    
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            var value = obj[key];
            var newKey = prefix ? prefix + '.' + key : key;

            // Check if value is an object (but not null, date, or array)
            if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                // Recursively flatten nested objects
                var nested = flattenObject(value, newKey);
                for (var nestedKey in nested) {
                    if (nested.hasOwnProperty(nestedKey)) {
                        flattened[nestedKey] = nested[nestedKey];
                    }
                }
            } else if (Array.isArray(value)) {
                // Handle arrays by joining with ", " delimiter
                flattened[newKey] = value.map(function(item) {
                    return typeof item === 'object' ? JSON.stringify(item) : String(item);
                }).join(', ');
            } else {
                // Leaf-level value
                flattened[newKey] = value;
            }
        }
    }
    
    return flattened;
}

/**
 * Escape CSV value to handle commas, quotes, and newlines
 * @param {*} value - Value to escape
 * @returns {String} Escaped value for CSV
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    
    var stringValue = String(value);

    // If value contains comma, double quote, or newline, wrap in quotes and escape quotes
    if (stringValue.indexOf(',') !== -1 || stringValue.indexOf('"') !== -1 || stringValue.indexOf('\n') !== -1) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
}

/**
 * Parse submission data - handles both JSON strings and objects
 * @param {*} submissionData - Raw submission data from database
 * @returns {Object} Parsed submission object
 */
function parseSubmissionData(submissionData) {
    if (typeof submissionData === 'string') {
        try {
            return JSON.parse(submissionData);
        } catch (e) {
            console.error('Error parsing submission data:', e);
            return { rawData: submissionData };
        }
    }
    return submissionData;
}

/**
 * Extract form data from submission object
 * Handles various possible structures (data, submissionData, formData, or root level)
 * @param {Object} submission - Submission object
 * @returns {Object} Form data object
 */
function extractFormData(submission) {
    // Check if submission has a specific data field
    if (submission.data) {
        var data = submission.data;
        return typeof data === 'string' ? parseSubmissionData(data) : data;
    }

    // Check for submissionData field
    if (submission.submissionData) {
        var submData = submission.submissionData;
        return typeof submData === 'string' ? parseSubmissionData(submData) : submData;
    }
    // Check for formData field
    if (submission.formData) {
        var formData = submission.formData;
        return typeof formData === 'string' ? parseSubmissionData(formData) : formData;
    }
    // Otherwise, assume root level contains the form data (but exclude metadata fields)
    var formData = {};
    var metadataFields = ['submissionId', 'formId', 'submissionDate', 'id', 'createdAt', 'updatedAt', 'userId'];
    
    for (var key in submission) {
        if (submission.hasOwnProperty(key) && metadataFields.indexOf(key) === -1) {
            var value = submission[key];
            // Try to parse if it's a JSON string
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    formData[key] = parseSubmissionData(value);
                } catch (e) {
                    formData[key] = value;
                }
            } else {
                formData[key] = value;
            }
        }
    }
    
    return formData;
}

/**
 * Export submissions to CSV with flattened nested data
 * @param {Array} submissions - Array of submission objects
 * @param {String} formName - Name of the form
 */
function exportToCsv(submissions, formName) {
    if (!submissions || submissions.length === 0) {
        alert('No data to export');
        return;
    }

    // Collect all unique leaf-level keys from all submissions
    var allKeys = {};
    var flattenedSubmissions = [];

    submissions.forEach(function (submission) {
        // Extract the actual form data from the submission
        var formData = extractFormData(submission);

        // Flatten the form data
        var flattened = flattenObject(formData);
        flattenedSubmissions.push(flattened);

        // Collect all keys
        for (var key in flattened) {
            if (flattened.hasOwnProperty(key)) {
                allKeys[key] = true;
            }
        }
    });
    // Sort keys for consistent column order
    var sortedKeys = Object.keys(allKeys).sort();

    // Extract leaf-only key names for headers (remove path prefixes)
    var leafKeyNames = sortedKeys.map(function (fullKey) {
        // Get the last part after the final dot
        var parts = fullKey.split('.');
        return parts[parts.length - 1];
    });

    // Create header row: Form Name, Form ID, Submission Date, then all other keys (leaf names only)
    var headerRow = ['Form Name', 'Form ID', 'Submission Date'].concat(leafKeyNames);
    var csv = headerRow.map(function (header) {
        return escapeCsvValue(header);
    }).join(',') + '\n';
    // Add data rows
    submissions.forEach(function (submission, index) {
        var flattened = flattenedSubmissions[index];
        var rowValues = [
            formName || '',
            submission.formId || '',
            submission.submissionDate ? new Date(submission.submissionDate).toLocaleString() : ''
        ];
        // Add values for all keys (empty string if key not present in this submission)
        sortedKeys.forEach(function (key) {
            rowValues.push(flattened[key] !== undefined ? flattened[key] : '');
        });
        
        csv += rowValues.map(function(value) {
            return escapeCsvValue(value);
        }).join(',') + '\n';
    });

    var dataBlob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(dataBlob);
    var link = document.createElement('a');
    link.href = url;
    link.download = (formName || 'report') + '_' + new Date().getTime() + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
