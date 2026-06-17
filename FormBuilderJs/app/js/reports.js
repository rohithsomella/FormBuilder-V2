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
                var dataToExport = selectedSubmissions.length > 0 ? selectedSubmissions : reportModal.submissionsData;
                exportToJson(dataToExport, reportModal.formName);
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
                var dataToExport = selectedSubmissions.length > 0 ? selectedSubmissions : reportModal.submissionsData;
                exportToCsv(dataToExport, reportModal.formName);
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
    modalLabel.textContent = form.formName || 'Form Report';

    // Clear previous content
    submissionsTableBody.innerHTML = '';
    reportLoadingMessage.style.display = 'none';
    reportErrorMessage.style.display = 'none';

    if (!submissions || submissions.length === 0) {
        reportErrorMessage.innerHTML = '<i class="bi bi-info-circle"></i> <strong>No submissions found for this form.</strong>';
        reportErrorMessage.style.display = 'block';
        submissionsTable.style.display = 'none';
    } else {
        // Populate submissions table with checkboxes
        submissions.forEach(function(submission, index) {
            var row = document.createElement('tr');
            var submissionDate = new Date(submission.submissionDate);
            var formattedDate = submissionDate.toLocaleString();
            
            row.innerHTML = '<td><input type="checkbox" class="submission-checkbox" data-index="' + index + '" title="Select this submission"></td>' +
                '<td>' + escapeHtml(submission.submissionId || '') + '</td>' +
                '<td>' + escapeHtml(formattedDate) + '</td>';
            
            // Make entire row clickable to toggle checkbox
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(event) {
                // Don't toggle if clicking the checkbox directly
                if (event.target.type === 'checkbox') {
                    return;
                }
                var checkbox = row.querySelector('.submission-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // Trigger change event to update select all checkbox
                    var changeEvent = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                }
            });
            
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
    reportModal.formName = form.formName;

    // Show modal
    try {
        if ($('#reportModal').length > 0) {
            $('#reportModal').modal('show');
            console.log('Modal shown successfully');
        } else {
            console.error('Report modal element not found for display');
        }
    } catch (error) {
        console.error('Error showing modal:', error);
    }
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
 * Export submissions to CSV
 * @param {Array} submissions - Array of submission objects
 * @param {String} formName - Name of the form
 */
function exportToCsv(submissions, formName) {
    if (!submissions || submissions.length === 0) {
        alert('No data to export');
        return;
    }

    var csv = 'Submission ID,Submission Date\n';
    submissions.forEach(function(submission) {
        var submissionDate = new Date(submission.submissionDate);
        var formattedDate = submissionDate.toLocaleString();
        csv += '"' + (submission.submissionId || '') + '","' + formattedDate + '"\n';
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
