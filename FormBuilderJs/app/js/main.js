console.log("Loaded:", Formio);

// Initialize Bootstrap tooltips
$(function() {
    $('[data-toggle="tooltip"]').tooltip();
    
    // Reinitialize tooltips for dynamically created buttons
    $(document).on('DOMNodeInserted', function() {
        $('[data-toggle="tooltip"]').not('[data-toggle="tooltip"].bs-tooltip-auto').tooltip();
    });
    
    // Watch for changes in formsTableBody (for existingForms.html) and reinitialize tooltips
    var tableBody = document.getElementById('formsTableBody');
    if (tableBody) {
        var observer = new MutationObserver(function() {
            $('[data-toggle="tooltip"]').tooltip('dispose');
            $('[data-toggle="tooltip"]').tooltip();
        });
        
        observer.observe(tableBody, {
            childList: true,
            subtree: true
        });
    }
});

let builderInstance = null;

// Move history tracking OUTSIDE the Formio.builder callback
// so it persists across builder recreations (undo/redo)
let formHistory = [];
let historyIndex = -1;
let isSavingState = false;

// Form details tracking
let currentFormName = 'Untitled Form';
let formTags = [];
let formMetadata = {
    title: '',
    tags: [],
    formKey: ''
};

//
// Reusable function to load form JSON into builder
//
function loadFormJsonIntoBuilder(formJson) {
    console.log('Loading form JSON into builder...');
    console.log('Input schema:', formJson);
    
    try {
        // Reset metadata for fresh start
        formMetadata = {
            title: '',
            tags: [],
            formKey: ''
        };
        
        // Store original JSON for metadata extraction
        let extractedFormMetadata = null;
        
        // Handle multiple JSON formats
        if (formJson.forms && typeof formJson.forms === 'object' && !Array.isArray(formJson.forms)) {
            console.log('Detected FormIO form definition with forms object');
            const formsArray = Object.values(formJson.forms);
            if (formsArray.length > 0) {
                const firstForm = formsArray[0];
                console.log('First form from object:', {
                    title: firstForm.title,
                    tags: firstForm.tags,
                    hasComponents: !!firstForm.components
                });
                // Extract metadata from the forms node
                extractedFormMetadata = {
                    title: firstForm.title || '',
                    tags: (firstForm.tags && Array.isArray(firstForm.tags)) ? firstForm.tags : [],
                    formKey: Object.keys(formJson.forms)[0]
                };
                console.log('📋 Extracted form metadata:', extractedFormMetadata);
                formJson = { components: firstForm.components || [] };
            }
        }
        else if (formJson.forms && Array.isArray(formJson.forms) && formJson.forms.length > 0) {
            console.log('Detected FormIO form definition with forms array');
            const firstForm = formJson.forms[0];
            console.log('First form from array:', {
                title: firstForm.title,
                tags: firstForm.tags,
                hasComponents: !!firstForm.components
            });
            // Extract metadata from the forms node
            extractedFormMetadata = {
                title: firstForm.title || '',
                tags: (firstForm.tags && Array.isArray(firstForm.tags)) ? firstForm.tags : [],
                formKey: firstForm.name || ''
            };
            console.log('📋 Extracted form metadata:', extractedFormMetadata);
            formJson = { components: firstForm.components || [] };
        }
        else if (formJson.type) {
            console.log('Detected single component format');
            if (formJson.components && Array.isArray(formJson.components)) {
                formJson = { components: formJson.components };
            } else {
                formJson = { components: [formJson] };
            }
        }
        else if (!formJson.components) {
            console.log('No components found, creating empty schema');
            formJson = { components: [] };
        }

        console.log('Final schema for builder:', {
            componentCount: formJson.components ? formJson.components.length : 0,
            hasComponents: !!formJson.components
        });

        // Store metadata to be used after builder loads
        if (extractedFormMetadata) {
            formMetadata = extractedFormMetadata;
        }

        return Formio.builder(
            document.getElementById('builder'),
            formJson
        );
    } catch (ex) {
        console.error('Error loading form JSON:', ex);
        alert('Invalid form JSON');
        throw ex;
    }
}

// Save form state to history
const saveFormState = function() {
    if (isSavingState || !builderInstance) {
        console.log('Skipping save: isSavingState=', isSavingState, 'builderInstance=', !!builderInstance);
        return;
    }
    
    const schema = builderInstance.schema;
    console.log('saveFormState called. Schema components:', schema?.components?.length || 0);
    
    if (schema) {
        // Remove future history if we're not at the end
        formHistory = formHistory.slice(0, historyIndex + 1);
        // Add new state
        const schemaStr = JSON.stringify(schema);
        formHistory.push(schemaStr);
        historyIndex++;
        console.log('✓ Form state saved. History length:', formHistory.length, 'Index:', historyIndex);
    }
};

//
// Populate form details from extracted metadata
//
function populateFormDetails() {
    console.log('🔧 Populating form details from metadata...');
    console.log('Current formTags:', formTags);
    console.log('formMetadata:', formMetadata);
    if (typeof $ === 'undefined') return;
    
    try {
        // Only populate from metadata if not already set from editing data
        if (!currentFormName || currentFormName === 'Untitled Form') {
            if (formMetadata.title) {
                console.log('Setting form name to:', formMetadata.title);
                currentFormName = formMetadata.title;
            }
        }
        
        // Populate form name input
        $('#formNameInput').val(currentFormName);
        
        // Merge tags: prioritize existing formTags, then add metadata tags
        let tagsToDisplay = [];
        
        // Add existing formTags
        if (formTags && Array.isArray(formTags) && formTags.length > 0) {
            tagsToDisplay = formTags.slice(); // Copy existing tags
            console.log('Using existing formTags:', tagsToDisplay);
        }
        
        // Add metadata tags if not already present
        if (formMetadata.tags && Array.isArray(formMetadata.tags) && formMetadata.tags.length > 0) {
            console.log('Found metadata tags:', formMetadata.tags);
            formMetadata.tags.forEach(function(metaTag) {
                if (metaTag && !tagsToDisplay.includes(metaTag)) {
                    tagsToDisplay.push(metaTag);
                    console.log('Added metadata tag:', metaTag);
                }
            });
        }
        
        // Update formTags with merged result
        formTags = tagsToDisplay;
        console.log('Final tags to render:', formTags);
        
        // Render tags
        $('#tagContainer').empty();
        if (formTags && formTags.length > 0) {
            console.log('🏷️ Rendering', formTags.length, 'tags');
            formTags.forEach(function(tag) {
                const cleanTag = tag.trim();
                if (cleanTag) {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag-chip';
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'tag-remove';
                    closeBtn.type = 'button';
                    closeBtn.innerHTML = '&times;';
                    
                    tagEl.innerHTML = cleanTag;
                    tagEl.appendChild(closeBtn);
                    
                    closeBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        formTags = formTags.filter(t => t.trim() !== cleanTag);
                        tagEl.remove();
                    });
                    document.getElementById('tagContainer').appendChild(tagEl);
                    console.log('✓ Tag rendered:', cleanTag);
                }
            });
        } else {
            console.log('No tags to render');
        }
        console.log('✓ Form details populated');
    } catch (e) {
        console.error('Error populating form details:', e);
    }
}

// Undo functionality
const performUndo = function() {
    console.log('performUndo called. History length:', formHistory.length, 'Current index:', historyIndex);
    
    if (historyIndex > 0) {
        historyIndex--;
        const previousSchema = JSON.parse(formHistory[historyIndex]);
        
        console.log('✓ Performing undo to index:', historyIndex, 'Components:', previousSchema?.components?.length || 0);
        
        // Clear the builder and recreate with previous schema
        const builderContainer = document.getElementById('builder');
        builderContainer.innerHTML = '';
        
        // Set flag to prevent auto-save during undo
        isSavingState = true;
        
        // Recreate the builder with previous schema
        Formio.builder(builderContainer, previousSchema)
            .then(function(newBuilder) {
                builderInstance = newBuilder;
                console.log('✓ Builder recreated for undo');
                
                // Re-attach the change listener
                if (builderInstance) {
                    console.log('📡 Attaching change listener after undo');
                    builderInstance.on('change', function(schema) {
                        console.log('📢 Change event fired after undo! Components:', schema?.components?.length || 0);
                        saveFormState();
                    });
                }
                
                isSavingState = false;
                console.log('✓ Undo completed. Form restored to index:', historyIndex);
            })
            .catch(function(err) {
                isSavingState = false;
                console.error('✗ Error during undo:', err);
            });
    } else {
        console.log('✗ Nothing to undo (index is at start)');
    }
};

// Redo functionality
const performRedo = function() {
    console.log('performRedo called. History length:', formHistory.length, 'Current index:', historyIndex);
    
    if (historyIndex < formHistory.length - 1) {
        historyIndex++;
        const nextSchema = JSON.parse(formHistory[historyIndex]);
        
        console.log('✓ Performing redo to index:', historyIndex, 'Components:', nextSchema?.components?.length || 0);
        
        // Clear the builder and recreate with next schema
        const builderContainer = document.getElementById('builder');
        builderContainer.innerHTML = '';
        
        // Set flag to prevent auto-save during redo
        isSavingState = true;
        
        // Recreate the builder with next schema
        Formio.builder(builderContainer, nextSchema)
            .then(function(newBuilder) {
                builderInstance = newBuilder;
                console.log('✓ Builder recreated for redo');
                
                // Re-attach the change listener
                if (builderInstance) {
                    console.log('📡 Attaching change listener after redo');
                    builderInstance.on('change', function(schema) {
                        console.log('📢 Change event fired after redo! Components:', schema?.components?.length || 0);
                        saveFormState();
                    });
                }
                
                isSavingState = false;
                console.log('✓ Redo completed. Form restored to index:', historyIndex);
            })
            .catch(function(err) {
                isSavingState = false;
                console.error('✗ Error during redo:', err);
            });
    } else {
        console.log('✗ Nothing to redo (index is at end)');
    }
};

// Setup keyboard shortcuts (outside builder callback to prevent duplicate listeners)
document.addEventListener('keydown', function(e) {
    // Check if Ctrl key is pressed and focus is not in an input field
    if ((e.ctrlKey || e.metaKey) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        // Undo: Ctrl+Z
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            performUndo();
        }
        // Redo: Ctrl+Y
        if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            performRedo();
        }
    }
});

// Setup button click handlers (attach directly, not in DOMContentLoaded)
// because this script runs at end of HTML after DOM is already loaded
try {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    console.log('=== UNDO/REDO SETUP ===');
    console.log('Undo button found:', !!undoBtn);
    console.log('Redo button found:', !!redoBtn);

    if (undoBtn) {
        undoBtn.addEventListener('click', function(e) {
            console.log('Undo button clicked! History:', formHistory.length, 'Index:', historyIndex);
            e.preventDefault();
            e.stopPropagation();
            performUndo();
        });
        console.log('Undo event listener attached');
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function(e) {
            console.log('Redo button clicked! History:', formHistory.length, 'Index:', historyIndex);
            e.preventDefault();
            e.stopPropagation();
            performRedo();
        });
        console.log('Redo event listener attached');
    }
} catch (err) {
    console.error('Error setting up undo/redo buttons:', err);
}

// Check if we're editing a form from existingForms.html
var initialFormSchema = {};
var editingFormData = null;
var isCopyingForm = false;

try {
    const editingFormDataStr = sessionStorage.getItem('editingFormData');
    console.log('📋 Checking editing form data... Found:', !!editingFormDataStr);
    if (editingFormDataStr) {
        editingFormData = JSON.parse(editingFormDataStr);
        console.log('✏️ Loading form for editing:', editingFormData.formName);
        
        // Store the form name and tags from editing data
        currentFormName = editingFormData.formName || 'Untitled Form';
        const tagsString = editingFormData.formTags || '';
        formTags = tagsString.split(',').filter(tag => tag.trim());
        console.log('Tags from editing data:', {
            raw: tagsString,
            parsed: formTags,
            count: formTags.length
        });
        
        // Parse the formJson
        if (editingFormData.formJson) {
            try {
                initialFormSchema = typeof editingFormData.formJson === 'string' 
                    ? JSON.parse(editingFormData.formJson) 
                    : editingFormData.formJson;
                console.log('✓ Form JSON parsed successfully. Components:', initialFormSchema.components?.length || 0);
            } catch (e) {
                console.error('Error parsing form JSON:', e);
                initialFormSchema = {};
            }
        }
    } else {
        // Check for copy form data
        const copyingFormDataStr = sessionStorage.getItem('copyingFormData');
        console.log('📋 Checking copying form data... Found:', !!copyingFormDataStr);
        if (copyingFormDataStr) {
            const copyingFormData = JSON.parse(copyingFormDataStr);
            console.log('📋 Loading form for copying (schema only)');
            isCopyingForm = true;
            
            // Parse the formJson - but DON'T populate form details
            if (copyingFormData.formJson) {
                try {
                    initialFormSchema = typeof copyingFormData.formJson === 'string' 
                        ? JSON.parse(copyingFormData.formJson) 
                        : copyingFormData.formJson;
                    console.log('✓ Form JSON parsed successfully for copy. Components:', initialFormSchema.components?.length || 0);
                } catch (e) {
                    console.error('Error parsing form JSON for copy:', e);
                    initialFormSchema = {};
                }
            }
        } else {
            console.log('🆕 No editing or copying data found - starting with empty form');
        }
    }
} catch (e) {
    console.error('Error loading form data:', e);
}

// Initialize builder with the form (empty or from editing)
loadFormJsonIntoBuilder(initialFormSchema)
.then(function(builder){
    builderInstance = builder;
    console.log("Builder Loaded", builder);

    // NOTE: Do NOT clear sessionStorage here - we need editingFormData for the Save button!
    // It will be cleared AFTER successful update/save

    // Populate form details from extracted metadata (skip for copy operations)
    if (!isCopyingForm) {
        populateFormDetails();
    } else {
        console.log('⏭️ Skipping form details population for copy operation');
    }

    // Save initial form state
    console.log('💾 Saving initial form state...');
    const initialSchema = builderInstance.schema;
    if (initialSchema) {
        formHistory.push(JSON.stringify(initialSchema));
        historyIndex++;
        console.log('✓ Initial form state saved. History length:', formHistory.length, 'Index:', historyIndex);
    }

    // Listen for form changes to save history
    if (builderInstance) {
        console.log('📡 Attaching change event listener to builder');
        builderInstance.on('change', function(schema) {
            console.log('📢 Change event fired! Components:', schema?.components?.length || 0);
            saveFormState();
        });
    }

    // Wait for sidebar to be rendered, then add toggle button
    setTimeout(function() {
        const sidebar = document.querySelector('.formcomponents');
        if (sidebar && !document.getElementById('sidebarToggle')) {
            // Create toggle button outside sidebar so it doesn't hide
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'sidebarToggle';
            toggleBtn.className = 'btn btn-light sidebar-toggle-btn';
            toggleBtn.title = 'Toggle Sidebar';
            toggleBtn.innerHTML = '<i class="bi bi-arrow-bar-right"></i>';
            
            // Add to body instead of sidebar
            document.body.insertBefore(toggleBtn, document.body.firstChild);
            
            // Add click handler - query sidebar fresh each time to avoid stale references
            toggleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const sidebarElement = document.querySelector('.formcomponents');
                if (sidebarElement) {
                    sidebarElement.classList.toggle('hidden');
                    toggleBtn.innerHTML = sidebarElement.classList.contains('hidden') 
                        ? '<i class="bi bi-arrow-bar-right"></i>' 
                        : '<i class="bi bi-arrow-bar-left"></i>';
                }
            });
        }
    }, 200);

})
.catch(function(error) {
    console.error('Error loading builder:', error);
    alert('Error loading form builder');
});

//
// New Edit Button - Check if form is empty
//
try {
    const newEditBtn = document.getElementById('newEdit');
    if (newEditBtn) {
        newEditBtn.addEventListener('click', function(){
            // Check if drag-and-drop area is empty
            const dragDropAlert = document.querySelector('.drag-and-drop-alert');
            const hasComponents = dragDropAlert && dragDropAlert.querySelector('.builder-component');
            
            if (!hasComponents) {
                // Show confirmation popup
                showConfirmationPopup(
                    "Form is not saved yet, do you want to open new edit workspace?",
                    function() {
                        console.log("Opening new edit workspace");
                        
                        // Clear session storage
                        console.log('🧹 Clearing session storage...');
                        sessionStorage.removeItem('editingFormId');
                        sessionStorage.removeItem('editingFormData');
                        sessionStorage.removeItem('copyingFormData');
                        console.log('✓ Session storage cleared');
                        
                        // Reset builder and history
                        formHistory = [];
                        historyIndex = -1;
                        
                        // Reset form details
                        if (typeof $ !== 'undefined') {
                            console.log('🧹 Clearing form details...');
                            currentFormName = 'Untitled Form';
                            formTags = [];
                            $('#formNameInput').val('');
                            $('#formTitleInput').val('');
                            $('#tagContainer').empty();
                            $('#tagInput').val('');
                            console.log('✓ Form details cleared');
                        }
                        
                        // Reset the form name in navbar
                        $('.form-name-input').val('Untitled Form');
                        console.log('✓ Navbar form name reset to "Untitled Form"');
                        
                        // Reset builder
                        Formio.builder(
                            document.getElementById('builder'),
                            {}
                        )
                        .then(function(builder){
                            builderInstance = builder;
                            console.log("New Builder Loaded");
                            
                            // Save initial state
                            console.log('💾 Saving new builder initial state...');
                            const newSchema = builderInstance.schema;
                            if (newSchema) {
                                formHistory.push(JSON.stringify(newSchema));
                                historyIndex++;
                                console.log('✓ New builder state saved. History length:', formHistory.length, 'Index:', historyIndex);
                            }
                            
                            // Attach change listener
                            if (builderInstance) {
                                console.log('📡 Attaching change event listener to new builder');
                                builderInstance.on('change', function(schema) {
                                    console.log('📢 Change event fired! Components:', schema?.components?.length || 0);
                                    saveFormState();
                                });
                            }
                        });
                    },
                    function() {
                        console.log("Cancelled new edit workspace");
                    }
                );
            } else {
                console.log("Form has components, proceed normally");
            }
        });
    } else {
        console.log('Warning: newEdit button not found');
    }
} catch (err) {
    console.error('Error setting up newEdit button:', err);
}

//
// Confirmation Popup Function
//
function showConfirmationPopup(message, onConfirm, onCancel) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    // Create popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 400px;
        text-align: center;
    `;

    // Message
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        font-size: 16px;
        margin-bottom: 30px;
        color: #333;
    `;

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
    `;

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.style.cssText = `
        padding: 10px 24px;
        border: 1px solid #6c757d;
        background: #f8f9fa;
        color: #333;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    cancelBtn.addEventListener('click', function() {
        overlay.remove();
        if (onCancel) onCancel();
    });

    // OK button
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'btn btn-primary';
    okBtn.style.cssText = `
        padding: 10px 24px;
        border: none;
        background: #007bff;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    okBtn.addEventListener('click', function() {
        overlay.remove();
        if (onConfirm) onConfirm();
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(okBtn);

    popup.appendChild(messageEl);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

//
// Load JSON file into edit mode
//
try {
    const jsonFileInput = document.getElementById('jsonFile');
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', function(e){

    const file = e.target.files[0];

    if(!file){
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event){
        try{
            let formJson = JSON.parse(event.target.result);

            console.log('Raw JSON loaded:', {
                hasForms: !!formJson.forms,
                formsIsArray: Array.isArray(formJson.forms),
                formsType: typeof formJson.forms,
                formsKeys: formJson.forms ? Object.keys(formJson.forms).slice(0, 5) : []
            });

            loadFormJsonIntoBuilder(formJson)
            .then(function(builder){
                builderInstance = builder;
                console.log("JSON Loaded successfully");
                
                // Populate form details from extracted metadata
                populateFormDetails();
                
                // Save loaded form state to history
                console.log('💾 Saving loaded JSON form state...');
                const loadedSchema = builderInstance.schema;
                if (loadedSchema) {
                    formHistory.push(JSON.stringify(loadedSchema));
                    historyIndex++;
                    console.log('✓ JSON form state saved. History length:', formHistory.length, 'Index:', historyIndex);
                }
                
                // Attach change listener
                if (builderInstance) {
                    console.log('📡 Attaching change event listener to loaded builder');
                    builderInstance.on('change', function(schema) {
                        console.log('📢 Change event fired! Components:', schema?.components?.length || 0);
                        saveFormState();
                    });
                }
            });
        }
        catch(ex){
            alert("Invalid JSON file");
            console.error(ex);
        }
    };

    reader.readAsText(file);
        });
    } else {
        console.log('Warning: jsonFile input not found');
    }
} catch (err) {
    console.error('Error setting up jsonFile listener:', err);
}

//
// Download JSON Button
//
try {
    const downloadJsonBtn = document.getElementById('downloadJson');
    if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', function(){

    if (!builderInstance) {
        alert('Builder not loaded yet');
        return;
    }

    // Get the form schema from builder
    const formSchema = builderInstance.schema;
    
    if (!formSchema || Object.keys(formSchema).length === 0) {
        alert('No form created yet. Please add components first.');
        return;
    }

    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(formSchema, null, 2);

    // Create blob from JSON
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'form-' + new Date().getTime() + '.json';

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Form downloaded as JSON');
        });
    } else {
        console.log('Warning: downloadJson button not found');
    }
} catch (err) {
    console.error('Error setting up downloadJson button:', err);
}

//
// Preview Form in Modal Dialog (Same Page)
//
try {
    const previewFormBtn = document.getElementById('previewForm');
    if (previewFormBtn) {
        previewFormBtn.addEventListener('click', function(){

    if (!builderInstance) {
        alert('Builder not loaded yet');
        return;
    }

    // Get the form schema from builder
    const formSchema = builderInstance.schema;
    
    if (!formSchema || !formSchema.components || formSchema.components.length === 0) {
        alert('No form created yet. Please add components first.');
        return;
    }

    console.log('Opening form preview in modal:', formSchema);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'previewOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        overflow: auto;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        max-width: 1400px;
        width: 95%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
    `;

    // Create header with close button
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        background: white;
        z-index: 10001;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Form Preview';
    title.style.cssText = 'margin: 0; color: #333;';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 32px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeBtn.addEventListener('click', function() {
        overlay.remove();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create form container
    const formContainer = document.createElement('div');
    formContainer.id = 'previewFormContainer';
    formContainer.style.cssText = 'padding: 20px;';

    // Add Formio_Template.css to head if not already there
    // Path is relative to the HTML file location (app/html/)
    const cssPath = '../css/Formio_Template.css';
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssPath;
        document.head.appendChild(cssLink);
        console.log('✓ Added Formio_Template.css to head');
    }

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(formContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Load form using existing Formio object   
    Formio.createForm(formContainer, formSchema)
        .then(function(form) {
            console.log('✓ Form preview loaded successfully in modal');
            console.log('Form instance:', form);
            console.log('FormBuilderApi available?', typeof FormBuilderApi !== 'undefined');

            // Try multiple event names to find the right one
            var eventHandlers = {
                'submitForm': function() {
                    console.log('✓ submitForm event handler attached');
                },
                'submit': function() {
                    console.log('✓ submit event handler attached');
                },
                'formSubmit': function() {
                    console.log('✓ formSubmit event handler attached');
                }
            };

            // Handle form submission - try the primary event
            form.on('submitForm', function(submission) {
                console.log('🔔 SUBMITFORM EVENT FIRED!', submission);
                handleFormSubmission(submission, form);
            });

            // Also try alternative events
            form.on('submit', function(submission) {
                console.log('🔔 SUBMIT EVENT FIRED!', submission);
                handleFormSubmission(submission, form);
            });

            // Also listen for form errors
            form.on('error', function(error) {
                console.error('Form error:', error);
            });

            function handleFormSubmission(submission, formInstance) {
                console.log('📤 Handling form submission...');
                
                // Get the form ID if we're editing an existing form
                var editingFormId = sessionStorage.getItem('editingFormId');
                console.log('Editing form ID from session:', editingFormId);
                
                if (!editingFormId) {
                    console.warn('❌ No form ID found - form not saved yet. Please save the form first.');
                    alert('Please save the form first before submitting.');
                    return false;
                }

                // Get just the data part of the submission
                var submissionData = submission.data;
                console.log('📋 Original submission data:', submissionData);

                // Recursively search for and transform dynamicSelectionPanels at any level
                var transformDynamicSelectionPanels = function(data, depth) {
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
                                transformDynamicSelectionPanels(value, depth + 1);
                            }
                        }
                    }
                };
                
                // Start recursive search from submission data
                transformDynamicSelectionPanels(submissionData);

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
                    editingFormId,
                    submissionData,
                    function(response) {
                        console.log('✅ Form submission saved successfully:', response);
                        // Show success message
                        var successMsg = document.createElement('div');
                        successMsg.style.cssText = `
                            padding: 15px;
                            margin: 10px 20px;
                            border-radius: 4px;
                            background-color: #d4edda;
                            border: 1px solid #c3e6cb;
                            color: #155724;
                        `;
                        successMsg.innerHTML = '<i class="bi bi-check-circle"></i> <strong>Form submitted successfully!</strong> Submission ID: ' + response.submissionId;
                        formContainer.insertBefore(successMsg, formContainer.firstChild);
                        
                        // Auto-hide after 5 seconds
                        setTimeout(function() {
                            successMsg.remove();
                        }, 5000);

                        // Reset the form
                        if (formInstance && typeof formInstance.clear === 'function') {
                            formInstance.clear();
                        } else if (formInstance) {
                            formInstance.submission = { data: {} };
                        }
                    },
                    function(error, statusCode) {
                        console.error('❌ Error submitting form:', error);
                        // Show error message
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
                        formContainer.insertBefore(errorMsg, formContainer.firstChild);
                    }
                );

                // Prevent default submission
                return false;
            }
        })
        .catch(function(error) {
            console.error('Error loading form preview:', error);
            formContainer.innerHTML = '<p style="color: red; padding: 20px;">Error loading form: ' + error.message + '</p>';
        });

    // Close modal when clicking outside
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
        });
    } else {
        console.log('Warning: previewForm button not found');
    }
} catch (err) {
    console.error('Error setting up previewForm button:', err);
}

//
// Save Button Handler
//
try {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function(){
            if (!builderInstance) {
                alert('Builder not loaded yet');
                return;
            }

            const formSchema = builderInstance.schema;
            
            if (!formSchema || !formSchema.components || formSchema.components.length === 0) {
                alert('No form created yet. Please add components first.');
                return;
            }

            console.log("Form saved:", formSchema);
            
            // Check if we're editing an existing form
            var editingFormDataStr = sessionStorage.getItem('editingFormData');
            var hasSeenUpdateModal = sessionStorage.getItem('hasSeenUpdateModal');
            
            console.log('Save button clicked - editingFormData exists:', !!editingFormDataStr, 'hasSeenUpdateModal:', hasSeenUpdateModal);
            
            if (editingFormDataStr && hasSeenUpdateModal === 'true') {
                // QUICK UPDATE MODE - Skip modal, direct update
                console.log('✓ Quick update - skipping modal, direct update');
                try {
                    var editingFormData = JSON.parse(editingFormDataStr);
                    var updateData = {
                        formId: editingFormData.formId,
                        formName: editingFormData.formName,
                        formTitle: editingFormData.formTitle,
                        formTags: editingFormData.formTags,
                        formJson: JSON.stringify(formSchema)
                    };
                    
                    FormBuilderApi.updateForm(updateData,
                        function(response) {
                            console.log('Form updated successfully:', response);
                            alert('Form updated successfully!');
                        },
                        function(error) {
                            console.error('Error updating form:', error);
                            alert('Error updating form: ' + error);
                        }
                    );
                } catch (e) {
                    console.error('Error parsing editing form data:', e);
                    alert('Error updating form');
                }
            } else if (editingFormDataStr && hasSeenUpdateModal !== 'true') {
                // FIRST UPDATE - Show modal with disabled fields
                console.log('First update - showing modal with disabled fields');
                sessionStorage.setItem('hasSeenUpdateModal', 'true');
                $('#formDetailsModal').modal('show');
            } else {
                // NEW FORM MODE - Show modal for details
                console.log('New form - showing modal for form details');
                $('#formDetailsModal').modal('show');
            }
        });
    } else {
        console.log('Warning: saveBtn button not found');
    }
} catch (err) {
    console.error('Error setting up saveBtn button:', err);
}

try {
    const themeBtn = document.getElementById("themeToggle");
    const themeCss = document.getElementById("themeStylesheet");

    if (themeBtn && themeCss) {
        let darkMode = false;

        themeBtn.addEventListener("click", function () {

            darkMode = !darkMode;

            if (darkMode) {

                themeCss.href =
                "https://cdn.jsdelivr.net/npm/bootswatch@4.6.2/dist/darkly/bootstrap.min.css";

                document.body.classList.add("dark-mode");

                themeBtn.innerHTML =
                '<i class="bi bi-sun-fill"></i>';
            }
            else {

                themeCss.href =
                "https://cdn.jsdelivr.net/npm/bootswatch@4.6.2/dist/flatly/bootstrap.min.css";

                document.body.classList.remove("dark-mode");

                themeBtn.innerHTML =
                '<i class="bi bi-moon-fill"></i>';
            }

        });
    } else {
        console.log('Warning: themeToggle or themeStylesheet not found');
    }
} catch (err) {
    console.error('Error setting up theme toggle:', err);
}

// Form Details Modal - Wait for jQuery to be available
console.log('=== Checking jQuery availability ===');
console.log('typeof $:', typeof $);
console.log('jQuery available:', typeof $ !== 'undefined');

if (typeof $ !== 'undefined') {
    try {
        console.log('✓ jQuery is available, initializing modal...');

        $('.edit-form-btn').click(function () {
            console.log('✓✓ Edit button clicked!');
            // Populate modal with current form name
            $('#formNameInput').val(currentFormName);
            // Generate camelCase automatically
            let camelCase = currentFormName
                .toLowerCase()
                .replace(/(?:^\w|[A-Z]|\b\w)/g,
                    (word, index) => index === 0
                        ? word.toLowerCase()
                        : word.toUpperCase())
                .replace(/\s+/g, '');
            $('#formTitleInput').val(camelCase);
            
            // Repopulate tags from current formTags array
            $('#tagContainer').empty();
            $('#tagInput').val('');
            console.log('🏷️ Rendering', formTags.length, 'tags in modal');
            if (formTags && formTags.length > 0) {
                formTags.forEach(function(tag) {
                    const cleanTag = tag.trim();
                    if (cleanTag) {
                        $('#tagContainer').append(
                            `<span class="tag-chip">
                                ${cleanTag}
                                <i class="bi bi-x tag-remove"></i>
                            </span>`
                        );
                    }
                });
            }
            
            // Check if in edit mode
            var editingFormDataStr = sessionStorage.getItem('editingFormData');
            if (editingFormDataStr) {
                // EDIT MODE - Disable form details fields and change button text
                $('#formNameInput').prop('disabled', true);
                $('#formTitleInput').prop('disabled', true);
                $('#tagInput').prop('disabled', true);
                $('#saveFormDetails').text('Update').removeClass('btn-primary').addClass('btn-success');
                console.log('✓ Edit mode: Form details disabled, button changed to Update');
            } else {
                // NEW FORM MODE - Enable form details fields and set button to Save
                $('#formNameInput').prop('disabled', false);
                $('#formTitleInput').prop('disabled', false);
                $('#tagInput').prop('disabled', false);
                $('#saveFormDetails').text('Save').removeClass('btn-success').addClass('btn-primary');
                console.log('✓ Create mode: Form details enabled, button set to Save');
            }
            
            console.log('✓ Modal populated with form data');
            $('#formDetailsModal').modal('show');
            console.log('✓ Modal opened');
        });

        $('#formNameInput').on('input', function () {

            let value = $(this).val();

            let camelCase = value
                .toLowerCase()
                .replace(/(?:^\w|[A-Z]|\b\w)/g,
                    (word, index) => index === 0
                        ? word.toLowerCase()
                        : word.toUpperCase())
                .replace(/\s+/g, '');

            $('#formTitleInput').val(camelCase);
        });

        $('#tagInput').keydown(function (e) {

            if (e.key === ' ') {

                e.preventDefault();

                let tag = $(this)
                    .val()
                    .trim()
                    .toUpperCase();

                if (!tag)
                    return;

                formTags.push(tag);

                $('#tagContainer').append(
                    `<span class="tag-chip">
                        ${tag}
                        <i class="bi bi-x tag-remove"></i>
                    </span>`
                );

                $(this).val('');
            }
        });

        $(document).on('click', '.tag-remove', function () {

            $(this).parent().remove();
            // Also remove from formTags array
            const tagText = $(this).parent().text().trim();
            const index = formTags.indexOf(tagText);
            if (index > -1) {
                formTags.splice(index, 1);
            }

        });

        // Save Form Details Button Handler
        $('#saveFormDetails').click(function () {
            const newFormName = $('#formNameInput').val().trim();
            
            if (!newFormName) {
                alert('Form name cannot be empty');
                return;
            }
            
            if (!builderInstance) {
                alert('Builder not loaded yet');
                return;
            }

            const formSchema = builderInstance.schema;
            
            if (!formSchema || !formSchema.components || formSchema.components.length === 0) {
                alert('No form created yet. Please add components first.');
                return;
            }
            
            // Update the current form name
            currentFormName = newFormName;
            
            // Update the form name in the navbar
            $('.form-name-input').val(newFormName);
            
            console.log('✓ Form details prepared:', {
                formName: newFormName,
                formTitle: $('#formTitleInput').val(),
                tags: formTags,
                schema: formSchema
            });
            
            // Disable the save button while saving
            $(this).prop('disabled', true).text('Saving...');
            const self = this;
            
            // Check if we're updating an existing form
            var editingFormDataStr = sessionStorage.getItem('editingFormData');
            
            if (editingFormDataStr) {
                // Update existing form
                try {
                    var editingFormData = JSON.parse(editingFormDataStr);
                    console.log('Updating existing form:', editingFormData.formId);
                    
                    var updateData = {
                        formId: editingFormData.formId,
                        formName: editingFormData.formName,
                        formTitle: editingFormData.formTitle,
                        formTags: editingFormData.formTags,
                        formJson: JSON.stringify(formSchema)
                    };
                    
                    FormBuilderApi.updateForm(updateData,
                        function(response) {
                            console.log('Form updated successfully:', response);
                            $('#formDetailsModal').modal('hide');
                            alert('Form updated successfully!');
                            $(self).prop('disabled', false).text('Update');
                        },
                        function(error) {
                            console.error('Error updating form:', error);
                            alert('Error updating form: ' + error);
                            $(self).prop('disabled', false).text('Update');
                        }
                    );
                } catch (e) {
                    console.error('Error parsing editing form data:', e);
                    alert('Error updating form');
                    $(self).prop('disabled', false).text('Update');
                }
            } else {
                // Save new form
                var saveData = {
                    formName: newFormName,
                    formTitle: $('#formTitleInput').val() || newFormName,
                    formTags: formTags.join(','),
                    formJson: JSON.stringify(formSchema)
                };
                
                FormBuilderApi.saveForm(saveData,
                    function(response) {
                        console.log('Form saved successfully:', response);
                        
                        // Store the new form as editing data for next updates
                        // Use returned FormId, or generate one if not returned or is zeros
                        let formId = response.formId;
                        if (!formId || formId === '00000000-0000-0000-0000-000000000000') {
                            // Generate a GUID on the frontend as fallback
                            formId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                                return v.toString(16);
                            });
                            console.log('Generated FormId on frontend:', formId);
                        }
                        
                        console.log('Storing FormId for future updates:', formId);
                        sessionStorage.setItem('editingFormData', JSON.stringify({
                            formId: formId,
                            formName: saveData.formName,
                            formTitle: saveData.formTitle,
                            formTags: saveData.formTags,
                            formJson: saveData.formJson
                        }));
                        sessionStorage.setItem('hasSeenUpdateModal', 'true'); // Already seen modal on first save
                        console.log('✓ Form is now marked as existing form for quick updates');
                        
                        // Close modal
                        $('#formDetailsModal').modal('hide');
                        alert('Form saved successfully!');
                        // Clear form name input and reset
                        $('#formNameInput').val('');
                        formTags = [];
                        $('#tagContainer').empty();
                        // Re-enable the button
                        $(self).prop('disabled', false).text('Save');
                    },
                    function(error) {
                        console.error('Error saving form:', error);
                        alert('Error saving form: ' + error);
                        // Re-enable the button
                        $(self).prop('disabled', false).text('Save');
                    }
                );
            }
        });

        console.log('✓ jQuery modal and form details initialized');
    } catch (err) {
        console.error('Error initializing jQuery components:', err);
    }
} else {
    console.log('Warning: jQuery not available for modal initialization');
}

// Page-specific initialization
document.addEventListener('DOMContentLoaded', function() {
    // Load forms table for existingForms.html page
    if (document.getElementById('formsTable')) {
        FormBuilderApi.loadFormsTable();
    }
    
    // Load reports table for reports.html page
    if (document.getElementById('reportsTable')) {
        FormBuilderApi.loadReportsTable();
    }
});

