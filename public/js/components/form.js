// Form component - handles form rendering and field management

class FormManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.bindEvents();
        
        // Subscribe to field lock changes
        this.unsubscribeFieldLocks = appStore.subscribe((fieldLocks) => {
            if (window.formManager) {
                window.formManager.updateFieldLockStates();
            }
        }, state => state ? state.fieldLocks : null);
        
        // Subscribe to active users changes (for lock indicators)
        this.unsubscribeUsers = appStore.subscribe((activeUsers) => {
            if (window.formManager) {
                window.formManager.updateFieldLockStates();
            }
        }, state => state ? state.activeUsers : null);
        
        // Subscribe to form data changes (for field value updates)
        this.unsubscribeFormData = appStore.subscribe((formData) => {
            console.log('Form data subscription triggered:', formData);
            if (window.formManager) {
                window.formManager.updateFieldValues(formData);
            }
        }, state => state ? state.formData : null);
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
        console.log('renderFields called with:', fields);
        const container = document.getElementById('formFields');
        if (!container) {
            console.error('formFields container not found');
            return;
        }
        
        if (!fields || fields.length === 0) {
            console.log('No fields provided, showing error message');
            container.innerHTML = '<p class="error-message">No fields available. This form might be empty or failed to load.</p>';
            return;
        }
        
        console.log('Rendering', fields.length, 'fields');
        
        // Clear the container first
        container.innerHTML = '';
        
        // Append each field element to the container
        fields.forEach(field => {
            const fieldElement = this.createFieldElement(field);
            container.appendChild(fieldElement);
        });
        
        // Update field locking states after rendering
        this.updateFieldLockStates();
        console.log('Fields rendered successfully');
    }
    
    createFieldElement(field) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.dataset.fieldId = field.id;
        
        const label = document.createElement('label');
        label.innerHTML = `${field.label} ${field.required ? '<span class="required">*</span>' : ''}`;
        fieldDiv.appendChild(label);
        
        // Add lock indicator container
        const lockIndicator = document.createElement('div');
        lockIndicator.className = 'field-lock-indicator';
        lockIndicator.style.display = 'none';
        lockIndicator.innerHTML = '<span>🔒</span><span class="lock-user"></span>';
        fieldDiv.appendChild(lockIndicator);
        
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
    
    updateFieldLockStates() {
        const state = appStore.getState();
        const fieldLocks = state.fieldLocks || {};
        const activeUsers = state.activeUsers || [];
        
        Object.keys(fieldLocks).forEach(fieldId => {
            const lockedByUserId = fieldLocks[fieldId];
            const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
            
            if (fieldElement) {
                const lockIndicator = fieldElement.querySelector('.field-lock-indicator');
                const input = fieldElement.querySelector('input, select, textarea');
                
                if (lockIndicator && input) {
                    // Find the user who locked the field
                    const lockedByUser = activeUsers.find(user => user.userId === lockedByUserId);
                    
                    if (lockedByUser) {
                        // Show lock indicator
                        lockIndicator.style.display = 'flex';
                        lockIndicator.querySelector('.lock-user').textContent = lockedByUser.name;
                        
                        // Add locked class to field
                        fieldElement.classList.add('locked');
                        
                        // Disable input if not locked by current user
                        if (lockedByUserId !== state.user?.id) {
                            input.disabled = true;
                        } else {
                            input.disabled = false;
                        }
                    }
                }
            }
        });
        
        // Remove lock indicators for unlocked fields
        document.querySelectorAll('.form-field').forEach(fieldElement => {
            const fieldId = fieldElement.dataset.fieldId;
            if (!fieldLocks[fieldId]) {
                const lockIndicator = fieldElement.querySelector('.field-lock-indicator');
                const input = fieldElement.querySelector('input, select, textarea');
                
                if (lockIndicator) {
                    lockIndicator.style.display = 'none';
                }
                
                if (input) {
                    input.disabled = false;
                }
                
                fieldElement.classList.remove('locked');
            }
        });
    }
    
    updateFieldValues(formData) {
        if (!formData) return;
        
        console.log('FormManager.updateFieldValues called with:', formData);
        
        Object.entries(formData).forEach(([fieldId, value]) => {
            console.log(`Updating field ${fieldId} with value:`, value);
            
            // Try multiple selectors to find the input
            let input = document.getElementById(`field-${fieldId}`);
            console.log(`Trying field-${fieldId}:`, input);
            if (!input) {
                input = document.querySelector(`[data-field-id="${fieldId}"] input:not([type="hidden"]), [data-field-id="${fieldId}"] select, [data-field-id="${fieldId}"] textarea`);
                console.log(`Trying data-field-id="${fieldId}":`, input);
            }
            if (!input) {
                // For checkboxes, they might be nested differently
                input = document.querySelector(`[data-field-id="${fieldId}"] input[type="checkbox"]`);
                console.log(`Trying checkbox selector for ${fieldId}:`, input);
            }
            if (!input) {
                console.warn(`Could not find input for field ${fieldId}`);
                console.log('Available fields:', document.querySelectorAll('.form-field').length);
                document.querySelectorAll('.form-field').forEach(field => {
                    console.log('Field:', field.dataset.fieldId, field);
                });
                return;
            }
            
            // Don't update if the input is currently focused AND the field is locked by the current user
            const state = appStore.getState();
            const isMyField = state.fieldLocks?.[fieldId] === state.user?.id;
            console.log(`Field ${fieldId} - focused:`, document.activeElement === input, 'isMyField:', isMyField);
            if (document.activeElement === input && isMyField) {
                console.log(`Field ${fieldId} is focused and locked by me, skipping update`);
                return;
            }
            
            console.log(`Updating field ${fieldId}, input type:`, input.type, 'current value:', input.value);
            
            if (input.type === 'checkbox') {
                input.checked = Boolean(value);
            } else {
                input.value = value || '';
            }
            
            console.log(`Successfully updated field ${fieldId} with value:`, value, 'new input value:', input.value);
        });
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
        // Lock field locally first
        const state = appStore.getState();
        if (state.user) {
            storeActions.lockField(fieldId, state.user.id);
            this.updateFieldLockStates();
        }
        
        // Update via socket if connected
        if (window.socketService && window.socketService.isConnected()) {
            window.socketService.lockField(fieldId);
        }
    }
    
    handleFieldBlur(fieldId) {
        console.log('handleFieldBlur called for:', fieldId);
        console.log('Current focused element:', document.activeElement);
        // Unlock field locally first
        const state = appStore.getState();
        if (state.fieldLocks?.[fieldId] === state.user?.id) {
            storeActions.unlockField(fieldId);
            this.updateFieldLockStates();
        }
        
        // Update via socket if connected
        if (window.socketService && window.socketService.isConnected()) {
            window.socketService.unlockField(fieldId);
        }
    }
    
    handleFieldChange(fieldId, value) {
        console.log('FormManager.handleFieldChange called:', fieldId, value);
        storeActions.updateFieldValue(fieldId, value);
        
        // Update via socket if connected
        if (window.socketService && window.socketService.isConnected()) {
            console.log('Socket connected, sending field update');
            window.socketService.updateField(fieldId, value);
        } else {
            console.log('Socket not connected, field update not sent');
        }
    }
    
    copyFormCode() {
        const codeEl = document.getElementById('formCodeDisplay');
        let code = codeEl ? codeEl.textContent : '';
        if (!code) {
            const state = appStore.getState();
            code = state.currentForm?.formId || '';
        }
        if (!code) {
            // Check URL params
            const params = new URLSearchParams(window.location.search);
            code = params.get('form') || '';
            console.log('Retrieved formId from URL:', code);
        }
        if (!code) {
            console.error('Form code not found in DOM, state, or URL');
            Toast.error('No form code available to copy');
            return;
        }
        console.log('Copying form code:', code);
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
function initializeFormManager() {
    console.log('Initializing formManager');
    formManager = new FormManager();
    window.formManager = formManager;
    console.log('formManager initialized and assigned to window');
    
    // Check if there's a pending form to render
    const state = appStore.getState();
    if (state.currentForm && state.currentForm.fields) {
        console.log('Found pending form, rendering now');
        setTimeout(() => {
            formManager.renderFields(state.currentForm.fields);
        }, 50);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFormManager);
} else {
    initializeFormManager();
} 