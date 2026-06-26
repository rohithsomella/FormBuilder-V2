/**
 * Shared Form Submission Handler
 * Handles form submission, error/success messages, and dynamicSelectionPanels transformation
 */

// Show Success Message
function showSuccessMessage(container, submissionId) {
    console.log('✅ showSuccessMessage called with container:', container, 'ID:', submissionId);
    
    // Create or get messages container
    let messagesContainer = document.getElementById('formMessagesContainer');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.id = 'formMessagesContainer';
        messagesContainer.style.cssText = 'position: relative; width: 100%;';
        container.parentNode.insertBefore(messagesContainer, container);
        console.log('✅ Created new messages container');
    }
    
    var successMsg = document.createElement('div');
    successMsg.style.cssText = `
        padding: 15px;
        margin: 10px 20px;
        border-radius: 4px;
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
    `;
    successMsg.innerHTML = '<i class="bi bi-check-circle"></i> <strong>Form submitted successfully!</strong> Submission ID: ' + submissionId;
    messagesContainer.appendChild(successMsg);
    console.log('✅ Success message inserted into DOM');
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        if (successMsg.parentNode) {
            successMsg.remove();
            console.log('✅ Success message removed after 5 seconds');
        }
    }, 5000);
}

// Show Error Message
function showErrorMessage(container, error) {
    console.log('❌ showErrorMessage called with error:', error);
    
    // Create or get messages container
    let messagesContainer = document.getElementById('formMessagesContainer');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.id = 'formMessagesContainer';
        messagesContainer.style.cssText = 'position: relative; width: 100%;';
        container.parentNode.insertBefore(messagesContainer, container);
        console.log('✅ Created new messages container');
    }
    
    var errorMsg = document.createElement('div');
    errorMsg.style.cssText = `
        padding: 15px;
        margin: 10px 20px;
        border-radius: 4px;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
    `;
    errorMsg.innerHTML = '<i class="bi bi-exclamation-circle"></i> <strong>Error submitting form:</strong> ' + error;
    messagesContainer.appendChild(errorMsg);
    console.log('❌ Error message inserted into DOM');
}

// Transform dynamicSelectionPanels data
function transformDynamicSelectionPanels(data, formInstance, depth) {
    depth = depth || 0;
    if (depth > 10) return; // Prevent infinite recursion
    
    if (!data || typeof data !== 'object') return;
    
    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            var value = data[key];
            
            // Found dynamicSelectionPanels
            if (key === 'dynamicSelectionPanels' && value && value.selectSections !== undefined) {
                console.log('🔍 Found dynamicSelectionPanels at level', depth, ', transforming...');
                
                // Get the component instance
                var dynamicPanelsComponent = formInstance.getComponent('dynamicSelectionPanels');
                
                if (dynamicPanelsComponent && typeof dynamicPanelsComponent.getSelectSectionsData === 'function') {
                    console.log('✅ Got dynamicPanelsComponent, calling getSelectSectionsData()');
                    var selectSectionsData = dynamicPanelsComponent.getSelectSectionsData();
                    value.selectSections = selectSectionsData;
                    console.log('✅ Transformed selectSections to:', selectSectionsData);
                } else {
                    console.warn('⚠️ Could not find dynamicPanelsComponent or getSelectSectionsData method');
                }
            }
            
            // Recursively check nested objects
            if (typeof value === 'object' && value !== null) {
                transformDynamicSelectionPanels(value, formInstance, depth + 1);
            }
        }
    }
}

// Main Form Submission Handler
function handleFormSubmission(submission, formInstance, formContainer) {
    console.log('📤 Handling form submission...');
    
    // Get the form ID - check both editing mode and preview mode
    var editingFormId = sessionStorage.getItem('editingFormId');
    var previewFormId = sessionStorage.getItem('previewFormId');
    var formId = editingFormId || previewFormId;
    
    console.log('Editing form ID from session:', editingFormId);
    console.log('Preview form ID from session:', previewFormId);
    console.log('Using form ID:', formId);
    
    if (!formId) {
        console.warn('❌ No form ID found - form not saved yet. Please save the form first.');
        alert('Please save the form first before submitting.');
        return false;
    }

    // Get just the data part of the submission
    var submissionData = submission.data;
    console.log('📋 Original submission data:', submissionData);

    // Start recursive transformation
    transformDynamicSelectionPanels(submissionData, formInstance);

    console.log('📋 Transformed submission data:', submissionData);
    console.log('FormBuilderApi:', FormBuilderApi);

    if (typeof FormBuilderApi === 'undefined') {
        console.error('❌ FormBuilderApi is NOT loaded!');
        alert('FormBuilderApi is not available');
        return false;
    }

    // Send to backend
    console.log('🚀 Calling FormBuilderApi.submitFormData()');
    FormBuilderApi.submitFormData(
        formId,
        submissionData,
        function(response) {
            console.log('✅ Form submission saved successfully:', response);
            showSuccessMessage(formContainer, response.submissionId);

            // Reset the form after a delay so message is visible
            setTimeout(function() {
                if (formInstance && typeof formInstance.clear === 'function') {
                    formInstance.clear();
                } else if (formInstance) {
                    formInstance.submission = { data: {} };
                }
            }, 1500); // Wait 1.5 seconds before clearing
        },
        function(error, statusCode) {
            console.error('❌ Error submitting form:', error);
            showErrorMessage(formContainer, error);
        }
    );

    // Prevent default submission
    return false;
}
