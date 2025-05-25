// Form component - handles form rendering and field management

class FormManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // Copy form code button
        const copyBtn = document.getElementById('copyCodeBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyFormCode());
        }
        
        // Form submission
        const form = document.getElementById('collaborativeForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }
        
        // Save progress button
        const saveBtn = document.getElementById('saveProgressBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveProgress());
        }
    }
    
    renderFields(fields) {
        const container = document.getElementById('formFields');
        if (!container) return;
        
        container.innerHTML = '';
        
        fields.forEach(field => {
            const fieldEl = this.createFieldElement(field);
            container.appendChild(fieldEl);
        });
    }
    
    createFieldElement(field) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.dataset.fieldId = field.id;
        
        const label = document.createElement('label');
        label.innerHTML = `${field.label} ${field.required ? '<span class="required">*</span>' : ''}`;
        fieldDiv.appendChild(label);
        
        let input;
        
        switch (field.type) {
            case 'textarea':
                input = document.createElement('textarea');
                input.rows = 4;
                break;
                
            case 'select':
                input = document.createElement('select');
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select an option';
                input.appendChild(defaultOption);
                
                field.options.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option;
                    optionEl.textContent = option;
                    input.appendChild(optionEl);
                });
                break;
                
            case 'checkbox':
                const wrapper = document.createElement('div');
                wrapper.className = 'checkbox-wrapper';
                
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'checkbox-input';
                input.name = field.id;
                
                // Add event listeners for checkbox
                input.addEventListener('change', () => this.handleFieldChange(field.id, input.checked));
                
                const checkLabel = document.createElement('label');
                checkLabel.appendChild(input);
                checkLabel.appendChild(document.createTextNode(' ' + field.label));
                
                wrapper.appendChild(checkLabel);
                fieldDiv.appendChild(wrapper);
                
                // Skip the regular label for checkbox
                fieldDiv.removeChild(label);
                break;
                
            case 'screenshot':
                // Create screenshot capture field
                const screenshotDiv = document.createElement('div');
                screenshotDiv.className = 'screenshot-field';
                
                const captureBtn = document.createElement('button');
                captureBtn.type = 'button';
                captureBtn.className = 'btn btn-secondary';
                captureBtn.innerHTML = '📸 Capture Screenshot';
                captureBtn.onclick = () => this.captureScreenshotForField(field.id);
                
                const preview = document.createElement('div');
                preview.className = 'screenshot-preview';
                preview.id = `preview-${field.id}`;
                
                screenshotDiv.appendChild(captureBtn);
                screenshotDiv.appendChild(preview);
                fieldDiv.appendChild(screenshotDiv);
                
                // Store screenshot data in a hidden input
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = field.id;
                input.id = `input-${field.id}`;
                fieldDiv.appendChild(input);
                break;
                
            default:
                input = document.createElement('input');
                input.type = field.type || 'text';
        }
        
        if (field.type !== 'checkbox' && field.type !== 'screenshot') {
            input.name = field.id;
            input.id = `field-${field.id}`;
            input.required = field.required;
            
            // Add event listeners
            input.addEventListener('focus', () => this.handleFieldFocus(field.id));
            input.addEventListener('blur', () => this.handleFieldBlur(field.id));
            input.addEventListener('input', debounce(() => this.handleFieldChange(field.id, input.value), 300));
            
            fieldDiv.appendChild(input);
        }
        
        return fieldDiv;
    }
    
    async captureScreenshotForField(fieldId) {
        try {
            // Use the screenshot manager to capture
            if (!window.screenshotManager) {
                Toast.error('Screenshot manager not initialized');
                return;
            }
            
            const dataUrl = await window.screenshotManager.captureScreenshot();
            if (!dataUrl) return;
            
            // Update the preview
            const preview = document.getElementById(`preview-${fieldId}`);
            if (preview) {
                preview.innerHTML = `
                    <img src="${dataUrl}" alt="Screenshot" class="screenshot-thumbnail">
                    <button type="button" class="remove-screenshot" onclick="formManager.removeScreenshot('${fieldId}')">❌</button>
                `;
            }
            
            // Update the hidden input value
            const input = document.querySelector(`[name="${fieldId}"]`);
            if (input) {
                input.value = dataUrl;
                this.handleFieldChange(fieldId, dataUrl);
            }
            
            Toast.success('Screenshot captured');
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            Toast.error('Failed to capture screenshot');
        }
    }
    
    removeScreenshot(fieldId) {
        const preview = document.getElementById(`preview-${fieldId}`);
        if (preview) {
            preview.innerHTML = '';
        }
        
        const input = document.querySelector(`[name="${fieldId}"]`);
        if (input) {
            input.value = '';
            this.handleFieldChange(fieldId, '');
        }
    }
    
    handleFieldFocus(fieldId) {
        if (window.socketService) {
            window.socketService.lockField(fieldId);
        }
    }
    
    handleFieldBlur(fieldId) {
        if (window.socketService) {
            window.socketService.unlockField(fieldId);
        }
    }
    
    handleFieldChange(fieldId, value) {
        storeActions.updateFieldValue(fieldId, value);
        
        if (window.socketService) {
            window.socketService.updateField(fieldId, value);
        }
    }
    
    copyFormCode() {
        const codeEl = document.getElementById('formCodeDisplay');
        if (!codeEl) return;
        
        const code = codeEl.textContent;
        copyToClipboard(code).then(success => {
            if (success) {
                Toast.success('Form code copied to clipboard!');
            } else {
                Toast.error('Failed to copy form code');
            }
        });
    }
    
    handleSubmit() {
        const state = appStore.getState();
        const formData = state.formData;
        
        console.log('Form submitted:', formData);
        Toast.success('Form submitted successfully!');
        
        // In a real app, this would send data to the server
    }
    
    saveProgress() {
        const state = appStore.getState();
        storage.set(CONSTANTS.STORAGE_KEYS.FORM_DATA, {
            formId: state.currentForm?.formId,
            data: state.formData,
            timestamp: new Date().toISOString()
        });
        
        Toast.success('Progress saved!');
    }
}

// Initialize form manager
let formManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        formManager = new FormManager();
        window.formManager = formManager;
    });
} else {
    formManager = new FormManager();
    window.formManager = formManager;
} 