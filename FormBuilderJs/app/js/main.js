console.log("Loaded:", Formio);

let builderInstance = null;

// Move history tracking OUTSIDE the Formio.builder callback
// so it persists across builder recreations (undo/redo)
let formHistory = [];
let historyIndex = -1;
let isSavingState = false;

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

Formio.builder(
    document.getElementById('builder'),
    {}
)
.then(function(builder){

    builderInstance = builder;

    console.log("Builder Loaded", builder);

    // Save initial form state (empty form)
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
                        // Reset builder and history
                        formHistory = [];
                        historyIndex = -1;
                        
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

            // Handle multiple JSON formats:
            // 1. FormIO form definition: { "title": "...", "forms": {...} } - forms is an OBJECT
            if (formJson.forms && typeof formJson.forms === 'object' && !Array.isArray(formJson.forms)) {
                console.log('Detected FormIO form definition with forms object');
                // Convert forms object to array and get first form
                const formsArray = Object.values(formJson.forms);
                console.log('Forms array length:', formsArray.length);
                if (formsArray.length > 0) {
                    const firstForm = formsArray[0];
                    console.log('First form has components:', !!firstForm.components);
                    formJson = {
                        components: firstForm.components || []
                    };
                }
            }
            // 2. FormIO form definition: { "title": "...", "forms": [...] } - forms is an ARRAY
            else if (formJson.forms && Array.isArray(formJson.forms) && formJson.forms.length > 0) {
                console.log('Detected FormIO form definition with forms array');
                const firstForm = formJson.forms[0];
                console.log('First form has components:', !!firstForm.components);
                formJson = {
                    components: firstForm.components || []
                };
            }
            // 3. FormIO single component
            else if (formJson.type) {
                console.log('Detected single component format');
                if (formJson.components && Array.isArray(formJson.components)) {
                    formJson = { components: formJson.components };
                } else {
                    formJson = { components: [formJson] };
                }
            }
            // 4. Downloaded format or already correct
            else if (!formJson.components) {
                console.log('No components found, creating empty schema');
                formJson = { components: [] };
            }

            console.log('Final schema for builder:', {
                componentCount: formJson.components ? formJson.components.length : 0,
                hasComponents: !!formJson.components
            });

            Formio.builder(
                document.getElementById('builder'),
                formJson
            )
            .then(function(builder){

                builderInstance = builder;

                console.log("JSON Loaded successfully");
                
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
            console.log('Form preview loaded successfully in modal');
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
            // TODO: Implement backend save logic here
            // Example: POST to /api/forms with formSchema
            alert('Form saved successfully!');
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

// Menu Toggle Functions
function toggleMenu() {
    try {
        const menu = document.getElementById('dropdownMenu');
        const overlay = document.getElementById('menuOverlay');
        
        if (menu && overlay) {
            menu.classList.toggle('show');
            overlay.classList.toggle('show');
        } else {
            console.log('Warning: menu or overlay not found');
        }
    } catch (err) {
        console.error('Error toggling menu:', err);
    }
}

// Close menu when clicking on overlay (attach directly, not in DOMContentLoaded)
try {
    const overlay = document.getElementById('menuOverlay');
    const menu = document.getElementById('dropdownMenu');
    
    if (overlay && menu) {
        overlay.addEventListener('click', function() {
            if (menu) {
                menu.classList.remove('show');
                overlay.classList.remove('show');
            }
        });
        
        // Close menu when clicking on menu items
        const menuItems = menu.querySelectorAll('.dropdown-menu-items a');
        menuItems.forEach(link => {
            link.addEventListener('click', function() {
                menu.classList.remove('show');
                overlay.classList.remove('show');
            });
        });
    } else {
        console.log('Warning: menu or overlay not found for event listeners');
    }
} catch (err) {
    console.error('Error setting up menu event listeners:', err);
}

// Form Details Modal - Wait for jQuery to be available
if (typeof $ !== 'undefined') {
    try {
        $('.edit-form-btn').click(function () {
            $('#formDetailsModal').modal('show');
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

        const tags = [];

        $('#tagInput').keydown(function (e) {

            if (e.key === ' ') {

                e.preventDefault();

                let tag = $(this)
                    .val()
                    .trim()
                    .toUpperCase();

                if (!tag)
                    return;

                tags.push(tag);

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
});

