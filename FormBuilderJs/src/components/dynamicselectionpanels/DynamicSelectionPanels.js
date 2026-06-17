import Container from '../container/Container';

export default class DynamicSelectionPanelsComponent extends Container {
  static schema(...extend) {
  return Container.schema({
    label: 'Dynamic Selection Panels',
    tableView: false,
    validateWhenHidden: false,
    key: 'dynamicSelectionPanels',
    type: 'dynamicselectionpanels',
    input: true,
    components: [
      {
        label: 'Panel generating container',  
        tableView: false,
        validateWhenHidden: false,
        key: 'panelGeneratingContainer',
        type: 'container',
        input: true,
        components: []
      },
      {
        label: 'Columns',
        columns: [
          {
            components: [
              {
                label: 'Select Sections',
                widget: 'choicesjs',
                tableView: true,
                data: {
                  values: [
                    {
                      label: '-- Select Sections --',
                      value: 'selectSections'
                    }
                  ]
                },
                validateWhenHidden: false,
                key: 'selectSections',
                type: 'select',
                input: true,
                defaultValue: 'selectSections'
              }
            ],
            width: 4,
            offset: 0,
            push: 0,
            pull: 0,
            size: 'md',
	        currentWidth: 4
          },
          {
            components: [],
            width: 8,
            offset: 0,
            push: 0,
            pull: 0,
            size: 'md',
          currentWidth: 8
          }
        ],
        key: 'columns',
        type: 'columns',
        input: false,
        tableView: false
      }
    ]
  }, ...extend);

}

  static get builderInfo() {
    return {
      title: 'Dynamic Selection Panels',
      group: 'premium',
      icon: 'square',
      weight: 10,
      documentation: '/userguide/form-building/custom-components#dynamic-selection-panels',
      showPreview: false,
      schema: DynamicSelectionPanelsComponent.schema()
    };
  }

  get defaultSchema() {
    return DynamicSelectionPanelsComponent.schema();
  }


  init() {
    super.init();

    this.dynamicPanels = {};
    this.panelOrder = [];
    this.dynamicPanelsArea = null; // Will hold reference to our dedicated panels container

    // Ensure child components are created from schema
    if (!this.components || this.components.length === 0) {
      if (this.component.components && this.component.components.length > 0) {
        this.component.components.forEach((compSchema) => {
          this.addComponent(compSchema, {});
        });
      }
    }
  }

  attach(element) {
    const result = super.attach(element);

    this.loadRefs(element, {
      panelsContainer: 'single'
    });

    // Register a dummy table module with Quill to suppress warnings
    if (window.Quill && !window.Quill.imports['modules/table']) {
      window.Quill.register({
        'modules/table': class TableModule {
          constructor(quill, options) {
            // Dummy module - does nothing, just prevents warnings
            console.log('⚠️ Table module disabled - not available in this implementation');
          }
        }
      }, true);
    }

    this.setupDropdownListener();
    this.initializePanelsContainer();

    return result;
  }

  initializePanelsContainer() {
    const container = this.refs.panelsContainer;

    if (container) {
      container.style.cssText = `
        padding: 15px;
        min-height: 300px;
        border: 1px solid #e3e6f0;
        border-radius: 4px;
        background-color: #f9f9f9;
        overflow-y: auto;
      `;

      console.log('✓ Panels container initialized');
    }
  }

  findComponentByKey(key) {
    const search = (components) => {
      if (!components) return null;
      for (const comp of components) {
        if (comp.component && comp.component.key === key) {
          return comp;
        }
        if (comp.components && comp.components.length > 0) {
          const found = search(comp.components);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.components);
  }

  setupDropdownListener() {
    const selectComponent = this.findComponentByKey('selectSections');
    console.log('✅✅Select component found:', selectComponent);

    if (!selectComponent) {
      console.warn('Select component not found');
      return;
    }

    // Listen to form.io component's change event
    selectComponent.on('change', (valueObj) => {
      console.log('🔔 Select component change event fired');
      console.log('🔍 Full valueObj.data:', valueObj?.data);
      console.log('🔍 Full valueObj.changed:', valueObj?.changed);
      
      // Explore mainContainer if it exists
      if (valueObj?.data?.mainContainer) {
        console.log('🔍 valueObj.data.mainContainer keys:', Object.keys(valueObj.data.mainContainer));
        console.log('🔍 valueObj.data.mainContainer:', valueObj.data.mainContainer);
        console.log('🔍 mainContainer.dynamicSelectionPanels:', valueObj.data.mainContainer.dynamicSelectionPanels);
      }
      
      let selectedValue = undefined;
      let source = 'UNKNOWN';
      
      // Method 1: Check selectComponent's own data/value properties
      if (selectComponent.value !== undefined && selectComponent.value !== null) {
        selectedValue = selectComponent.value;
        source = 'selectComponent.value';
        console.log('✓ Method 1 - selectComponent.value:', selectedValue);
      }
      
      // Method 2: Check valueObj.data.mainContainer.dynamicSelectionPanels
      if (!selectedValue && valueObj?.data?.mainContainer?.dynamicSelectionPanels?.selectSections) {
        selectedValue = valueObj.data.mainContainer.dynamicSelectionPanels.selectSections;
        source = 'mainContainer.dynamicSelectionPanels.selectSections';
        console.log('✓ Method 2 - Found in mainContainer:', selectedValue);
      }
      
      // Method 3: Check valueObj.changed for selectSections
      if (!selectedValue && valueObj?.changed?.selectSections !== undefined) {
        selectedValue = valueObj.changed.selectSections;
        source = 'valueObj.changed.selectSections';
        console.log('✓ Method 3 - valueObj.changed.selectSections:', selectedValue);
      }
      
      // Method 4: Search through all parent container properties
      if (!selectedValue && valueObj?.data) {
        for (const containerKey in valueObj.data) {
          const container = valueObj.data[containerKey];
          if (container && typeof container === 'object' && container.dynamicSelectionPanels?.selectSections !== undefined) {
            selectedValue = container.dynamicSelectionPanels.selectSections;
            source = `valueObj.data.${containerKey}.dynamicSelectionPanels.selectSections`;
            console.log(`✓ Method 4 - Found in container "${containerKey}":`, selectedValue);
            break;
          }
        }
      }
      
      // Method 5: Check selectComponent.data (component's internal state)
      if (!selectedValue && selectComponent.data && selectComponent.data.selectSections !== undefined) {
        selectedValue = selectComponent.data.selectSections;
        source = 'selectComponent.data.selectSections';
        console.log('✓ Method 5 - selectComponent.data.selectSections:', selectedValue);
      }
      
      console.log(`📌 Final selectedValue: ${selectedValue} (from ${source})`);
      
      this.handleComponentChange(selectedValue, selectComponent);
    });

    console.log('✓ Component listener attached');
  }

  handleComponentChange(value, selectComponent) {
    console.log('Selected Value:', value);

    // Find the label for this value from the select options
    const selectedText = selectComponent.component.data?.values?.find(
      opt => opt.value === value
    )?.label || value;

    console.log('Selected Text:', selectedText);

    console.log('🔍 Checking condition:', {
      selectedValue: !!value,
      selectedText: !!selectedText,
      isNotDefault: selectedText !== '-- Select Sections --',
      valueIsNotDefault: value !== 'selectSections'
    });

    if (
      value &&
      selectedText &&
      selectedText !== '-- Select Sections --' &&
      value !== 'selectSections'
    ) {
      console.log('✅ Condition passed, creating panel...');
      this.createPanel(value, selectedText);
    } else {
      console.log('❌ Condition failed, skipping panel creation');
    }
  }

  createPanel(optionKey, optionLabel) {
    console.log('📦 createPanel called with:', { optionKey, optionLabel });

    // Prevent duplicates
    if (this.dynamicPanels[optionKey]) {
      console.warn('⚠️ Panel already exists for:', optionKey);
      return;
    }

    // Get or create dedicated dynamic panels area
    let panelsContainer = this.dynamicPanelsArea;
    
    if (!panelsContainer) {
      // First time - create a dedicated container for dynamic panels
      const panelsContainerComponent = this.components.find(
        comp => comp.component.key === 'panelGeneratingContainer'
      );
      
      console.log('🔎 Found panelsContainerComponent:', !!panelsContainerComponent);
      
      if (panelsContainerComponent && panelsContainerComponent.element) {
        // Create a dedicated div inside panelGeneratingContainer for our dynamic panels
        panelsContainer = document.createElement('div');
        panelsContainer.id = `dynamic-panels-area-${Date.now()}`;
        panelsContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 15px;
          background-color: #fafafa;
          border-radius: 4px;
          min-height: 100px;
        `;
        
        // Prepend to the container (so it's not affected by newly added child components)
        panelsContainerComponent.element.insertBefore(panelsContainer, panelsContainerComponent.element.firstChild);
        this.dynamicPanelsArea = panelsContainer;
        
        console.log('✅ Created dedicated dynamic panels area');
      } else {
        console.warn('❌ Could not find panelGeneratingContainer');
        return;
      }
    }

    console.log('🎯 Using panelsContainer for new panel');

    const panel = document.createElement('div');
    panel.className = `dynamic-panel panel-${optionKey}`;
    panel.setAttribute('data-panel-key', optionKey);
    panel.style.cssText = `
      background-color: white;
      border: 1px solid #d3d8e8;
      border-radius: 4px;
      margin: 0;
      padding: 0;
      box-shadow: 0 2px 4px rgba(0,0,0,.05);
      overflow: hidden;
      transition: all .3s ease;
    `;

    // header
    const panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header';
    panelHeader.style.cssText = `
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:12px 15px;
      background-color:#f8f9fa;
      border-bottom:1px solid #e3e6f0;
    `;

    const headerTitle = document.createElement('h5');
    headerTitle.textContent = optionLabel;
    headerTitle.style.cssText = `
      margin:0;
      color:#333;
      font-weight:600;
      font-size:14px;
    `;

    // close button
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'panel-close-btn';
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background:none;
      border:none;
      font-size:24px;
      color:#999;
      cursor:pointer;
      width:30px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center;
    `;

    closeButton.addEventListener('mouseover', () => {
      closeButton.style.color = '#dc3545';
    });

    closeButton.addEventListener('mouseout', () => {
      closeButton.style.color = '#999';
    });

    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePanel(optionKey);
    });

    panelHeader.appendChild(headerTitle);
    panelHeader.appendChild(closeButton);

    // body
    const panelBody = document.createElement('div');
    panelBody.className = 'panel-body tab-pane active';
    panelBody.setAttribute('data-panel-content', optionKey);
    panelBody.style.cssText = `
      padding:15px;
      min-height:80px;
      color:#555;
    `;

    panel.appendChild(panelHeader);
    panel.appendChild(panelBody);

    this.dynamicPanels[optionKey] = {
      element: panel,
      closeButton,
      header: panelHeader,
      body: panelBody,
      textareaComponent: null
    };

    if (!this.panelOrder.includes(optionKey)) {
      this.panelOrder.push(optionKey);
    }

    panelsContainer.appendChild(panel);

    // Add textarea component to panel body using schema
    const textareaSchema = {
      label: 'Text Area',
      applyMaskOn: 'change',
      editor: 'quill',
      autoExpand: false,
      hideLabel: true,
      tableView: true,
      validateWhenHidden: false,
      key: `textArea_${optionKey}`,
      type: 'textarea',
      rows: 2,
      isUploadEnabled: false,
      input: true,
      defaultValue: '<p><br></p>',
      // Minimal Quill modules - only basic formatting
      quillModules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          ['blockquote', 'code-block'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['clean']
        ]
      }
    };

    // Create component without adding it to parent's component tree
    setTimeout(() => {
      try {
        // Get the Formio component class
        const TextAreaComponent = Formio.Components.components.textarea;

        // Create instance directly without using addComponent
        const textareaComponent = new TextAreaComponent(textareaSchema, {
          components: [],
          data: {}
        });

        console.log(`🔧 TextAreaComponent created for ${optionLabel}`);

        // Render it in the panel body
        const html = textareaComponent.render();
        console.log(`🔧 TextAreaComponent rendered, HTML length:`, html.length);
        
        panelBody.innerHTML = html;

        // Attach to the panel body
        textareaComponent.attach(panelBody);
        console.log(`🔧 TextAreaComponent attached to panel body`);

        // Store textarea reference
        this.dynamicPanels[optionKey].textareaComponent = textareaComponent;

        // Try different approaches to find and initialize Quill
        setTimeout(() => {
          console.log(`🔍 Checking for Quill in panel ${optionLabel}...`);
          console.log(`   textareaComponent.quill:`, textareaComponent.quill);
          console.log(`   textareaComponent.editor:`, textareaComponent.editor);
          console.log(`   textareaComponent properties:`, Object.keys(textareaComponent));
          
          // Approach 1: Direct quill property
          let quillEditor = textareaComponent.quill;
          
          // Approach 2: Look for Quill in the rendered element
          if (!quillEditor) {
            const qlContainer = panelBody.querySelector('.ql-container');
            if (qlContainer && window.Quill) {
              console.log(`🔍 Found .ql-container, trying to access Quill instance...`);
              // Try to find the Quill instance from the editor element
              const editorElement = panelBody.querySelector('.ql-editor');
              if (editorElement && editorElement.__quill) {
                quillEditor = editorElement.__quill;
                console.log(`✅ Found Quill instance on editor element`);
              }
            }
          }
          
          if (quillEditor) {
            console.log(`✅ Quill editor found! Setting up event listeners...`);
            
            // Log current content
            console.log(`📄 Current Quill content:`, quillEditor.root.innerHTML);
            
            // Listen for Quill text changes
            quillEditor.on('text-change', (delta, oldDelta, source) => {
              if (source === 'user') {
                const htmlContent = quillEditor.root.innerHTML;
                console.log(`📝 [USER INPUT] Quill text changed in ${optionLabel}:`, htmlContent);
                
                // Update the component's internal value
                textareaComponent.value = htmlContent;
                if (textareaComponent.data) {
                  textareaComponent.data[textareaComponent.key] = htmlContent;
                }
                if (textareaComponent.submission && textareaComponent.submission.data) {
                  textareaComponent.submission.data[textareaComponent.key] = htmlContent;
                }
                
                // Trigger form change to update parent
                this.triggerChange();
              }
            });
            
            // Also listen for selection change to detect any interaction
            quillEditor.on('selection-change', (range, oldRange, source) => {
              console.log(`📍 Quill selection changed in ${optionLabel}, range:`, range);
            });
            
            console.log(`✅ Quill event listeners attached for panel: ${optionLabel}`);
          } else {
            console.warn(`⚠️ Quill editor NOT found for panel: ${optionLabel}`);
            console.log(`   Panel body HTML:`, panelBody.innerHTML.substring(0, 200));
          }
        }, 500);  // Increased timeout to 500ms for Quill to fully initialize

        console.log(`✅ Textarea component rendered in panel: ${optionLabel}`);
      } catch (error) {
        console.error(`❌ Error rendering textarea in panel: ${optionLabel}`, error);
      }
    }, 100);

    console.log(
      `✅ Dynamic panel created for: ${optionLabel}`
    );
  }

  hidePanel(optionKey) {
    if (!this.dynamicPanels[optionKey]) {
      return;
    }

    this.dynamicPanels[optionKey].element.remove();

    delete this.dynamicPanels[optionKey];

    this.panelOrder =
      this.panelOrder.filter(x => x !== optionKey);
  }

  getValue() {
    // Don't call super.getValue() - build our own object
    console.log('📦 Getting values for dynamicSelectionPanels...');
    console.log('📦 Available panels:', Object.keys(this.dynamicPanels));

    // Start with empty selectSections object
    const selectSectionsData = {};

    // Extract all textarea content using Quill
    Object.keys(this.dynamicPanels).forEach((panelKey) => {
      const panel = this.dynamicPanels[panelKey];
      if (panel.textareaComponent) {
        let textareaValue = '';
        
        // Primary: Get content from Quill editor
        if (panel.textareaComponent.quill) {
          textareaValue = panel.textareaComponent.quill.root.innerHTML;
          console.log(`📝 Got Quill HTML for ${panelKey}:`, textareaValue);
        }
        // Fallback: Get from component value
        else if (typeof panel.textareaComponent.getValue === 'function') {
          textareaValue = panel.textareaComponent.getValue();
          console.log(`📝 Got getValue for ${panelKey}:`, textareaValue);
        }
        // Last resort: Direct value property
        else if (panel.textareaComponent.value) {
          textareaValue = panel.textareaComponent.value;
          console.log(`📝 Got value property for ${panelKey}:`, textareaValue);
        }
        
        selectSectionsData[panelKey] = textareaValue;
      }
    });

    // Build the result object
    const result = {
      panelGeneratingContainer: {},
      selectSections: Object.keys(selectSectionsData).length > 0 ? selectSectionsData : {}
    };

    console.log('✅ All textarea data collected:', selectSectionsData);
    console.log('✅ Final getValue result:', result);
    return result;
  }

  setValue(value) {
    if (!value || !value.visiblePanels) {
      return false;
    }

    value.visiblePanels.forEach((key) => {
      this.createPanel(key, key);
    });

    return true;
  }

  // Get selectSections data in the correct nested object format for submission
  getSelectSectionsData() {
    console.log('🎯 getSelectSectionsData called');
    console.log('🎯 Available panels:', Object.keys(this.dynamicPanels));
    const selectSectionsData = {};

    Object.keys(this.dynamicPanels).forEach((panelKey) => {
      const panel = this.dynamicPanels[panelKey];
      console.log(`\n🔍 Processing panel ${panelKey}`);
      
      let textareaValue = '';
      let sourceMethod = 'NONE';
      
      if (!panel.body) {
        console.warn(`⚠️ No panel.body found for ${panelKey}`);
        selectSectionsData[panelKey] = textareaValue;
        return;
      }
      
      // METHOD 1: Try to read directly from Quill editor in DOM
      const qlEditor = panel.body.querySelector('.ql-editor');
      if (qlEditor) {
        const domContent = qlEditor.innerHTML;
        console.log(`   ✓ Method 1 - Found .ql-editor in DOM:`, domContent.substring(0, 50) + '...');
        if (domContent && domContent !== '<p><br></p>' && domContent.trim() !== '') {
          textareaValue = domContent;
          sourceMethod = 'DOM .ql-editor (BEST)';
          console.log(`   ✅ Using Method 1 - DOM .ql-editor`);
        }
      }
      
      // METHOD 2: If no content yet, try component.data
      if (!textareaValue && panel.textareaComponent && panel.textareaComponent.data) {
        const dataValue = panel.textareaComponent.data[panel.textareaComponent.key];
        console.log(`   ✓ Method 2 - component.data:`, dataValue ? dataValue.substring(0, 50) : 'empty');
        if (dataValue && dataValue !== '<p><br></p>') {
          textareaValue = dataValue;
          sourceMethod = 'component.data';
          console.log(`   ✅ Using Method 2 - component.data`);
        }
      }
      
      // METHOD 3: Try component.value
      if (!textareaValue && panel.textareaComponent && panel.textareaComponent.value) {
        console.log(`   ✓ Method 3 - component.value:`, panel.textareaComponent.value.substring(0, 50));
        if (panel.textareaComponent.value !== '<p><br></p>') {
          textareaValue = panel.textareaComponent.value;
          sourceMethod = 'component.value';
          console.log(`   ✅ Using Method 3 - component.value`);
        }
      }
      
      // METHOD 4: Try Quill if it exists
      if (!textareaValue && panel.textareaComponent && panel.textareaComponent.quill) {
        const quillHtml = panel.textareaComponent.quill.root.innerHTML;
        console.log(`   ✓ Method 4 - Quill instance:`, quillHtml.substring(0, 50));
        if (quillHtml && quillHtml !== '<p><br></p>') {
          textareaValue = quillHtml;
          sourceMethod = 'component.quill';
          console.log(`   ✅ Using Method 4 - Quill instance`);
        }
      }
      
      console.log(`   📌 Final value for ${panelKey}: "${textareaValue.substring(0, 30)}..." (source: ${sourceMethod})`);
      selectSectionsData[panelKey] = textareaValue;
    });

    console.log('\n✅ Final selectSectionsData:', selectSectionsData);
    return selectSectionsData;
  }
}