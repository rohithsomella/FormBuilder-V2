import Container from '../container/Container';
import _ from 'lodash';

export default class DataPopupComponent extends Container {
  static schema(...extend) {
    return Container.schema({
      type: 'datapopup',
      label: 'Data Popup',
      key: 'dataPopup',
      input: true,
      tableView: false,
      components: [
        {
          type: 'textarea',
          key: 'dataPopupTextarea',
          label: 'Selected Data',
          rows: 10,
          tableView: false,
          input: true,
          disabled: false
        }
      ]
    }, ...extend);
  }

  static get builderInfo() {
    return {
      title: 'Data Popup',
      group: 'data',
      icon: 'table',
      weight: 35,
      documentation: '/userguide/form-building/data-components#data-popup',
      showPreview: false,
      schema: DataPopupComponent.schema()
    };
  }

  get defaultSchema() {
    return DataPopupComponent.schema();
  }

  init() {
    super.init();
    this.gridInitialized = false;
    this.buttonCreated = false;
    this.selectedRows = []; // Store selected rows
    
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
    
    // Delay button creation to allow child components to fully render
    setTimeout(() => {
      this.createPopupButton(element);
    }, 1500);
    
    return result;
  }

  createPopupButton(element) {
    // Skip if button already created
    if (this.buttonCreated) {
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 20;
    
    const attachButtonToTextarea = () => {
      retryCount++;
      
      // Wait for child components to exist and be attached
      if (!this.components || this.components.length === 0) {
        if (retryCount >= maxRetries) {
          console.warn('DataPopup: Max retries reached. Child components not found.');
          return;
        }
        setTimeout(attachButtonToTextarea, 500);
        return;
      }
      
      // Get the first child (should be the textarea)
      const textareaComp = this.components[0];
      
      // Wait for textarea component to have its input ref
      if (!textareaComp.refs || !textareaComp.refs.input) {
        if (retryCount >= maxRetries) {
          console.warn('DataPopup: Max retries reached. Textarea component refs not ready.');
          return;
        }
        setTimeout(attachButtonToTextarea, 500);
        return;
      }
      
      const textarea = textareaComp.refs.input;
      
      // Handle NodeList - get first element
      let textareaElement = textarea;
      if (textarea instanceof NodeList || Array.isArray(textarea)) {
        textareaElement = textarea[0];
      }
      
      if (!textareaElement) {
        if (retryCount >= maxRetries) {
          console.warn('DataPopup: Max retries reached. Textarea element is null.');
          return;
        }
        setTimeout(attachButtonToTextarea, 500);
        return;
      }
      
      // Check if button already exists
      if (textareaElement.parentElement && textareaElement.parentElement.querySelector('[data-datapopup-button]')) {
        this.buttonCreated = true;
        return;
      }
      
      // Verify textarea has a parent element
      if (!textareaElement.parentElement) {
        if (retryCount >= maxRetries) {
          console.warn('DataPopup: Max retries reached. Textarea element has no parent.');
          return;
        }
        setTimeout(attachButtonToTextarea, 500);
        return;
      }
      
      const container = textareaElement.parentElement;
      
      // Ensure container has relative positioning
      if (container && container.style) {
        if (container.style.position !== 'relative' && container.style.position !== 'absolute' && container.style.position !== 'fixed') {
          container.style.position = 'relative';
        }
      }
      
      // Add padding to textarea
      if (textareaElement && textareaElement.style) {
        textareaElement.style.paddingBottom = '38px';
      }
      
      // Create button
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-info btn-sm';
      button.setAttribute('data-datapopup-button', 'true');
      button.innerHTML = '<i class="fa fa-table"></i>';
      button.style.cssText = `
        position: absolute;
        left: 8px;
        bottom: 8px;
        padding: 6px 10px;
        z-index: 9999;
        cursor: pointer;
        border: none;
        border-radius: 3px;
        background-color: #17a2b8;
        color: white;
        font-size: 12px;
      `;
      button.title = 'Open Data Popup';
      
      this.addEventListener(button, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openDataPopup();
      });
      
      if (container) {
        container.appendChild(button);
        this.buttonCreated = true;
        console.log('✓ Data Popup button added');
      }
    };
    
    attachButtonToTextarea();
  }

  openDataPopup() {
    // Create modal if it doesn't exist
    if (!this.modal) {
      this.createModal();
    }
    this.modal.style.display = 'block';
    
    // Initialize jqGrid if not already done
    if (!this.gridInitialized) {
      this.initializeGrid();
    }
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.id = `popup-${this.id}`;
    this.modal.style.cssText = `
      display: none;
      position: fixed;
      z-index: 10000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: rgba(0,0,0,0.4);
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background-color: #fefefe;
      margin: 2% auto;
      padding: 20px;
      border: 1px solid #888;
      width: 90%;
      max-width: 1000px;
      border-radius: 4px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-height: 90vh;
      overflow-y: auto;
    `;

    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      color: #aaa;
      float: right;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
    `;
    closeBtn.onclick = () => {
      this.modal.style.display = 'none';
    };

    const title = document.createElement('h2');
    title.textContent = 'Select Data';
    title.style.marginTop = '0';

    const gridContainer = document.createElement('div');
    gridContainer.id = `grid-${this.id}`;
    gridContainer.style.cssText = `
      width: 100%;
      height: 300px;
      margin-top: 20px;
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 3px;
    `;

    const helpText = document.createElement('p');
    helpText.textContent = 'Click "Add" button to add row to selection';
    helpText.style.cssText = `
      margin-top: 10px;
      font-size: 12px;
      color: #666;
      font-style: italic;
    `;

    // Selected rows section
    const selectedTitle = document.createElement('h3');
    selectedTitle.textContent = 'Selected Rows:';
    selectedTitle.style.marginTop = '30px';

    const selectedContainer = document.createElement('div');
    selectedContainer.id = `selected-${this.id}`;
    selectedContainer.style.cssText = `
      width: 100%;
      min-height: 100px;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 10px;
      background-color: #f9f9f9;
    `;

    // Buttons at bottom
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      margin-top: 20px;
      text-align: right;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    `;

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm Selection';
    confirmBtn.className = 'btn btn-success';
    confirmBtn.style.cssText = `
      padding: 8px 16px;
      margin-left: 10px;
      cursor: pointer;
      border: none;
      border-radius: 3px;
      background-color: #28a745;
      color: white;
      font-size: 14px;
    `;
    confirmBtn.onclick = () => this.confirmSelection();

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear All';
    clearBtn.className = 'btn btn-secondary';
    clearBtn.style.cssText = `
      padding: 8px 16px;
      margin-left: 10px;
      cursor: pointer;
      border: none;
      border-radius: 3px;
      background-color: #6c757d;
      color: white;
      font-size: 14px;
    `;
    clearBtn.onclick = () => {
      this.selectedRows = [];
      this.updateSelectedRowsDisplay();
    };

    buttonContainer.appendChild(clearBtn);
    buttonContainer.appendChild(confirmBtn);

    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(helpText);
    modalContent.appendChild(gridContainer);
    modalContent.appendChild(selectedTitle);
    modalContent.appendChild(selectedContainer);
    modalContent.appendChild(buttonContainer);
    this.modal.appendChild(modalContent);
    document.body.appendChild(this.modal);
  }

  initializeGrid() {
    const gridElement = document.getElementById(`grid-${this.id}`);
    
    if (!gridElement) return;

    // Sample data for prototype
    const sampleData = [
      { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive' },
      { id: 4, name: 'Alice Williams', email: 'alice@example.com', status: 'Active' },
      { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', status: 'Active' }
    ];

    // Create table HTML
    let tableHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
          <tr>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Name</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Email</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Status</th>
            <th style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    sampleData.forEach((row, index) => {
      tableHTML += `
        <tr class="data-row-${this.id}" data-index="${index}" style="border-bottom: 1px solid #dee2e6;">
          <td style="padding: 10px;">${row.name}</td>
          <td style="padding: 10px;">${row.email}</td>
          <td style="padding: 10px;">
            <span style="padding: 4px 8px; border-radius: 3px; background-color: ${row.status === 'Active' ? '#d4edda' : '#f8d7da'}; color: ${row.status === 'Active' ? '#155724' : '#721c24'};">
              ${row.status}
            </span>
          </td>
          <td style="padding: 10px; text-align: center;">
            <button class="btn-add-row" data-index="${index}" style="padding: 4px 12px; cursor: pointer; border: none; border-radius: 3px; background-color: #007bff; color: white; font-size: 12px;">Add</button>
          </td>
        </tr>
      `;
    });

    tableHTML += `
        </tbody>
      </table>
    `;

    gridElement.innerHTML = tableHTML;

    // Add click handlers to Add buttons
    const addButtons = gridElement.querySelectorAll('.btn-add-row');
    addButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = btn.getAttribute('data-index');
        this.addRowToSelection(sampleData[index]);
      });
    });

    // Hover effects on rows
    const rows = gridElement.querySelectorAll(`.data-row-${this.id}`);
    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = '#f0f0f0';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = 'transparent';
      });
    });

    this.gridInitialized = true;
  }

  addRowToSelection(rowData) {
    // Check for duplicates
    const isDuplicate = this.selectedRows.some(row => 
      row.id === rowData.id && 
      row.name === rowData.name && 
      row.email === rowData.email
    );
    
    if (isDuplicate) {
      alert('This row is already selected!');
      return;
    }
    
    // Add row to selection
    this.selectedRows.push(rowData);
    this.updateSelectedRowsDisplay();
  }

  updateSelectedRowsDisplay() {
    const selectedContainer = document.getElementById(`selected-${this.id}`);
    
    if (!selectedContainer) return;
    
    if (this.selectedRows.length === 0) {
      selectedContainer.innerHTML = '<p style="color: #999; margin: 0;">No rows selected</p>';
      return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    
    this.selectedRows.forEach((row, index) => {
      html += `
        <tr style="border-bottom: 1px solid #ddd; padding: 5px 0;">
          <td style="padding: 8px; flex: 1;">${row.name} (${row.email}) - ${row.status}</td>
          <td style="padding: 8px; text-align: right; white-space: nowrap;">
            <button class="btn-edit-row" data-index="${index}" style="padding: 4px 8px; margin-right: 5px; cursor: pointer; border: none; border-radius: 2px; background-color: #ffc107; color: black; font-size: 11px;">Edit</button>
            <button class="btn-remove-row" data-index="${index}" style="padding: 4px 8px; cursor: pointer; border: none; border-radius: 2px; background-color: #dc3545; color: white; font-size: 11px;">Remove</button>
          </td>
        </tr>
      `;
    });
    
    html += '</table>';
    selectedContainer.innerHTML = html;
    
    // Add event listeners
    selectedContainer.querySelectorAll('.btn-edit-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = btn.getAttribute('data-index');
        this.editRowData(parseInt(index));
      });
    });
    
    selectedContainer.querySelectorAll('.btn-remove-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = btn.getAttribute('data-index');
        this.selectedRows.splice(parseInt(index), 1);
        this.updateSelectedRowsDisplay();
      });
    });
  }

  editRowData(index) {
    const row = this.selectedRows[index];
    
    // Create edit dialog
    const editDialog = document.createElement('div');
    editDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 4px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 10001;
      min-width: 400px;
    `;
    
    editDialog.innerHTML = `
      <h3 style="margin-top: 0;">Edit Row</h3>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
        <input type="text" id="edit-name" value="${row.name}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Email:</label>
        <input type="text" id="edit-email" value="${row.email}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Status:</label>
        <select id="edit-status" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; box-sizing: border-box;">
          <option value="Active" ${row.status === 'Active' ? 'selected' : ''}>Active</option>
          <option value="Inactive" ${row.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div style="text-align: right;">
        <button id="edit-cancel" style="padding: 8px 16px; margin-right: 10px; cursor: pointer; border: 1px solid #ddd; border-radius: 3px; background-color: #f8f9fa;">Cancel</button>
        <button id="edit-save" style="padding: 8px 16px; cursor: pointer; border: none; border-radius: 3px; background-color: #28a745; color: white;">Save</button>
      </div>
    `;
    
    document.body.appendChild(editDialog);
    
    document.getElementById('edit-cancel').addEventListener('click', () => {
      editDialog.remove();
    });
    
    document.getElementById('edit-save').addEventListener('click', () => {
      this.selectedRows[index].name = document.getElementById('edit-name').value;
      this.selectedRows[index].email = document.getElementById('edit-email').value;
      this.selectedRows[index].status = document.getElementById('edit-status').value;
      editDialog.remove();
      this.updateSelectedRowsDisplay();
    });
  }

  confirmSelection() {
    if (this.selectedRows.length === 0) {
      alert('Please select at least one row');
      return;
    }
    
    // Format as comma-separated values without keys
    const formattedData = this.selectedRows.map(row => 
      `${row.id},${row.name},${row.email},${row.status}`
    ).join('\n');
    
    // Populate textarea
    const textareaComponent = this.getTextareaComponent();
    
    if (textareaComponent) {
      if (textareaComponent.refs && textareaComponent.refs.input) {
        let textareaElement = textareaComponent.refs.input;
        
        // Handle NodeList
        if (textareaElement instanceof NodeList || Array.isArray(textareaElement)) {
          textareaElement = textareaElement[0];
        }
        
        if (textareaElement) {
          textareaElement.value = formattedData;
          textareaComponent.data[textareaComponent.component.key] = formattedData;
          textareaComponent.triggerChange();
          console.log('✓ Selected rows populated in textarea');
        }
      }
    }
    
    // Close modal
    if (this.modal) {
      this.modal.style.display = 'none';
      this.selectedRows = [];
    }
  }

  getTextareaComponent() {
  if (!this.components) {
    return null;
  }

  return this.components.find(
    comp => comp.component.key === 'dataPopupTextarea'
  );
}
}
