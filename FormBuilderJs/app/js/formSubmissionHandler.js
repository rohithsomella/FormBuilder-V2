/**
 * Shared Form Submission Handler
 * Handles form submission, error/success messages, and dynamicSelectionPanels transformation
 */

// Show Success Message
function showSuccessMessage(container, submissionId) {
    // console.log('✅ showSuccessMessage called with container:', container, 'ID:', submissionId);
    
    // Create or get messages container
    let messagesContainer = document.getElementById('formMessagesContainer');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.id = 'formMessagesContainer';
        messagesContainer.style.cssText = 'position: relative; width: 100%;';
        container.parentNode.insertBefore(messagesContainer, container);
        // console.log('✅ Created new messages container');
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
    // console.log('✅ Success message inserted into DOM');
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        if (successMsg.parentNode) {
            successMsg.remove();
            // console.log('✅ Success message removed after 5 seconds');
        }
    }, 5000);
}

// Show Error Message
function showErrorMessage(container, error) {
    // console.log('❌ showErrorMessage called with error:', error);
    
    // Create or get messages container
    let messagesContainer = document.getElementById('formMessagesContainer');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.id = 'formMessagesContainer';
        messagesContainer.style.cssText = 'position: relative; width: 100%;';
        container.parentNode.insertBefore(messagesContainer, container);
        // console.log('✅ Created new messages container');
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
    // console.log('='.repeat(60));
    // console.log('📤 HANDLING FORM SUBMISSION');
    // console.log('='.repeat(60));
    // console.log('Full submission object:', submission);
    // console.log('Form instance:', formInstance);
    
    // Get the form ID - try multiple sources (in priority order)
    var editingFormId = sessionStorage.getItem('editingFormId');
    var previewFormId = sessionStorage.getItem('previewFormId');
    var formId = editingFormId || previewFormId;
    
    // console.log('🔍 SOURCE 1 - sessionStorage:');
    // console.log('  editingFormId:', editingFormId);
    // console.log('  previewFormId:', previewFormId);
    // console.log('  formId (either):', formId);

    // Try to get formId from submission.form (if Formio set it)
    if (!formId && submission && submission.form) {
        // console.log('🔍 SOURCE 2 - submission.form:');
        // console.log('  submission.form:', submission.form);
        // console.warn('⚠️ FormId not in sessionStorage, using submission.form:', submission.form);
        formId = submission.form;
    }

    // Try to get formId from form schema stored in sessionStorage
    if (!formId) {
        // console.log('🔍 SOURCE 3 - previewFormSchema:');
        try {
            var previewFormSchema = sessionStorage.getItem('previewFormSchema');
            if (previewFormSchema) {
                var schema = JSON.parse(previewFormSchema);
                // console.log('  schema._id:', schema._id);
                // console.log('  schema.form:', schema.form);
                // console.log('  schema.name:', schema.name);
                // console.log('  schema.title:', schema.title);
                if (schema._id) {
                    // console.warn('⚠️ FormId not in sessionStorage, using schema._id:', schema._id);
                    formId = schema._id;
                } else if (schema.form) {
                    // console.warn('⚠️ FormId not in sessionStorage, using schema.form:', schema.form);
                    formId = schema.form;
                }
            }
        } catch (e) {
            // console.warn('Could not parse previewFormSchema:', e);
        }
    }

    // Try to get formId from the form instance (use actual ID, not name)
    if (!formId && formInstance) {
        // console.log('🔍 SOURCE 4 - formInstance:');
        // console.log('  formInstance._id:', formInstance._id);
        // console.log('  formInstance.form:', formInstance.form);
        // console.log('  formInstance.formId:', formInstance.formId);
        // console.log('  formInstance.url:', formInstance.url);
        
        if (formInstance._id) {
            // console.warn('⚠️ FormId not in sessionStorage, using formInstance._id:', formInstance._id);
            formId = formInstance._id;
        } else if (formInstance.form && typeof formInstance.form === 'object') {
            if (formInstance.form._id) {
                // console.warn('⚠️ FormId not in sessionStorage, using formInstance.form._id:', formInstance.form._id);
                formId = formInstance.form._id;
            }
        }
    }
    
    console.log('✅ FINAL formId selected:', formId);
    
    if (!formId) {
        console.error('❌ No form ID found in any source');
        alert('Cannot submit form - Form ID is missing. Please reload the form and try again.');
        return false;
    }

    // Get the submission data
    var submissionData = submission.data;
    
    // console.log('📋 Extracted submission data:', submissionData);
    // console.log('Submission data type:', typeof submissionData);
    
    // Validate submissionData
    if (!submissionData || (typeof submissionData === 'object' && Object.keys(submissionData).length === 0)) {
        console.error('❌ Submission data is empty or invalid:', submissionData);
        alert('Form data is empty. Please fill out the form before submitting.');
        return false;
    }
    
    // Start recursive transformation for dynamicSelectionPanels
    transformDynamicSelectionPanels(submissionData, formInstance);

    // console.log('📋 Transformed submission data:', submissionData);

    if (typeof FormBuilderApi === 'undefined') {
        console.error('❌ FormBuilderApi is NOT loaded!');
        alert('FormBuilderApi is not available');
        return false;
    }

    // Ensure the submission object has the correct form ID
    // console.log('📝 SETTING submission.form:');
    // console.log('  BEFORE - submission.form:', submission.form);
    // console.log('  SETTING TO - formId:', formId);
    submission.form = formId;
    // console.log('  AFTER - submission.form:', submission.form);

    // Extract form version ID (_fvid) from form schema
    // console.log('📝 EXTRACTING FORM VERSION ID:');
    try {
        var previewFormSchema = sessionStorage.getItem('previewFormSchema');
        if (previewFormSchema) {
            var schema = JSON.parse(previewFormSchema);
            if (schema._vid !== undefined) {
                submission._fvid = schema._vid;
                // console.log('  ✅ Set _fvid from schema._vid:', submission._fvid);
            } else {
                submission._fvid = 0;
                // console.log('  ℹ️ No _vid in schema, defaulting _fvid to 0');
            }
        } else {
            submission._fvid = 0;
            // console.log('  ℹ️ No previewFormSchema, defaulting _fvid to 0');
        }
    } catch (e) {
        submission._fvid = 0;
        // console.log('  ⚠️ Could not parse previewFormSchema, defaulting _fvid to 0:', e);
    }

    // Ensure submission has all required fields
    // console.log('📝 SETTING SUBMISSION FIELDS:');
    
    // Set project (empty for now)
    if (!submission.project) {
        submission.project = '';
        // console.log('  ✅ Set project to empty string');
    }

    // Set state to "submitted"
    if (!submission.state) {
        submission.state = 'submitted';
        // console.log('  ✅ Set state to "submitted"');
    }

    // Initialize externalIds as empty array
    if (!submission.externalIds) {
        submission.externalIds = [];
        // console.log('  ✅ Initialized externalIds as empty array');
    }

    // Initialize externalTokens as empty array
    if (!submission.externalTokens) {
        submission.externalTokens = [];
        // console.log('  ✅ Initialized externalTokens as empty array');
    }

    // Set version (__v) to 0
    if (submission.__v === undefined) {
        submission.__v = 0;
        // console.log('  ✅ Set __v (version) to 0');
    }
    
    // console.log('✅ FINAL SUBMISSION TO SEND:');
    // console.log('  Form ID:', submission.form);
    // console.log('  Submission ID:', submission._id || '(will be generated)');
    // console.log('  Form Version (_fvid):', submission._fvid);
    // console.log('  Project:', submission.project);
    // console.log('  State:', submission.state);
    // console.log('  Version (__v):', submission.__v);
    // console.log('  externalIds:', submission.externalIds);
    // console.log('  externalTokens:', submission.externalTokens);
    // console.log('  Data keys:', submission.data ? Object.keys(submission.data) : 'none');
    // console.log('  Other properties:', Object.keys(submission).filter(k => !['form', 'data', '_fvid', 'project', 'state', 'externalIds', 'externalTokens', '__v', '_id', 'created', 'modified', 'metadata'].includes(k)));

    // Send COMPLETE submission object to backend (new design)
    // console.log('🚀 Calling FormBuilderApi.submitFormData() with complete submission');
    
    FormBuilderApi.submitFormData(
        submission,  // Pass the complete submission object
        function(response) {
            console.log('✅ Form submission saved successfully:', response.submissionId);
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
            console.log('='.repeat(60));
            showErrorMessage(formContainer, error);
        }
    );

    // Prevent default submission
    return false;
}
