// Landing page component

class LandingPage {
    constructor() {
        this.selectedTemplate = null;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.renderTemplates();
        
        // Check for pending form
        const pendingFormId = session.get('pendingFormId');
        if (pendingFormId) {
            session.remove('pendingFormId');
            document.getElementById('formCode').value = pendingFormId;
            this.showJoinForm();
        }
        
        // Check if authenticated
        const state = appStore.getState();
        if (state.isAuthenticated) {
            document.getElementById('userName').value = state.user.name;
            document.getElementById('userName').disabled = true;
            this.renderRecentForms();
        }
    }
    
    bindEvents() {
        // User name input
        const userNameInput = document.getElementById('userName');
        userNameInput.addEventListener('input', () => {
            this.validateName();
        });
        
        // Create form button
        const createFormBtn = document.getElementById('createFormBtn');
        createFormBtn.addEventListener('click', () => {
            this.showTemplates();
        });
        
        // Join form button
        const joinFormBtn = document.getElementById('joinFormBtn');
        joinFormBtn.addEventListener('click', () => {
            this.showJoinForm();
        });
        
        // Join button
        const joinBtn = document.getElementById('joinBtn');
        joinBtn.addEventListener('click', () => {
            this.handleJoinForm();
        });
        
        // Create button
        const createBtn = document.getElementById('createBtn');
        createBtn.addEventListener('click', () => {
            this.handleCreateForm();
        });
        
        // Form code input
        const formCodeInput = document.getElementById('formCode');
        formCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
    
    renderTemplates() {
        const templateGrid = document.getElementById('templateGrid');
        templateGrid.innerHTML = '';
        
        Object.entries(CONSTANTS.FORM_TEMPLATES).forEach(([key, template]) => {
            const templateCard = document.createElement('div');
            templateCard.className = 'template-card';
            templateCard.dataset.templateId = key;
            
            templateCard.innerHTML = `
                <div class="template-icon">${template.icon}</div>
                <h4 class="template-title">${template.title}</h4>
                <p class="template-description">${template.description}</p>
            `;
            
            templateCard.addEventListener('click', () => {
                this.selectTemplate(key);
            });
            
            templateGrid.appendChild(templateCard);
        });
    }
    
    selectTemplate(templateId) {
        // Remove previous selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selection to clicked template
        const selectedCard = document.querySelector(`[data-template-id="${templateId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        this.selectedTemplate = templateId;
        document.getElementById('createBtn').disabled = false;
    }
    
    showTemplates() {
        if (!this.validateName()) return;
        
        document.getElementById('action-buttons').classList.add('hidden');
        document.getElementById('join-section').classList.add('hidden');
        document.getElementById('template-section').classList.remove('hidden');
    }
    
    showJoinForm() {
        if (!this.validateName()) return;
        
        document.getElementById('action-buttons').classList.add('hidden');
        document.getElementById('template-section').classList.add('hidden');
        document.getElementById('join-section').classList.remove('hidden');
        
        // Focus on form code input
        document.getElementById('formCode').focus();
    }
    
    validateName() {
        const userName = document.getElementById('userName').value.trim();
        if (!userName) {
            Toast.error('Please enter your name');
            return false;
        }
        return true;
    }
    
    async handleCreateForm() {
        if (!this.validateName()) return;
        if (!this.selectedTemplate) {
            Toast.error('Please select a form template');
            return;
        }
        
        const userName = document.getElementById('userName').value.trim();
        const createBtn = document.getElementById('createBtn');
        
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        
        try {
            // Create guest user
            const user = await storeActions.createGuestUser(userName);
            if (!user) throw new Error('Failed to create user');
            
            // Generate form code
            const formCode = generateFormCode();
            
            // Get template data
            const template = CONSTANTS.FORM_TEMPLATES[this.selectedTemplate];
            
            // Create form data
            const formData = {
                formId: formCode,
                templateId: this.selectedTemplate,
                title: template.title,
                description: template.description,
                fields: template.fields,
                createdBy: user.id,
                formData: {},
                activeUsers: [],
                fieldLocks: {},
                screenshots: []
            };
            
            // Save form to localStorage first
            if (window.localSyncService) {
                window.localSyncService.saveForm(formCode, formData);
            }
            
            // Immediately set in store
            storeActions.setCurrentForm(formData);
            console.log('Form set in state after creation:', formData);
            
            // Try to create form via API
            try {
                console.log('Creating form on server:', formData);
                const response = await API.forms.create(formData);
                console.log('Form created on server:', response);
                // Update local data if needed
                Object.assign(formData, response.data);
                // Resave to local
                if (window.localSyncService) {
                    window.localSyncService.saveForm(formCode, formData);
                }
                session.set('newForm', formData);
                storeActions.setCurrentForm(formData);
            } catch (apiError) {
                console.warn('Failed to create form on server, continuing offline:', apiError);
                Toast.info('Form created offline - will sync when connection is restored');
            }
            
            // Reset button before navigation
            createBtn.disabled = false;
            createBtn.textContent = 'Create Form';
            
            // Navigate to form
            console.log('Navigating to form:', formCode);
            window.FormSyncApp.navigate(`/form/${formCode}`);
        } catch (error) {
            console.error('Error creating form:', error);
            Toast.error('Failed to create form');
            createBtn.disabled = false;
            createBtn.textContent = 'Create Form';
        }
    }
    
    async handleJoinForm() {
        if (!this.validateName()) return;
        
        const formCode = document.getElementById('formCode').value.trim().toUpperCase();
        if (!formCode) {
            Toast.error('Please enter form code');
            return;
        }
        
        if (formCode.length !== 6) {
            Toast.error('Form code must be 6 characters');
            return;
        }
        
        const userName = document.getElementById('userName').value.trim();
        const joinBtn = document.getElementById('joinBtn');
        
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';
        
        try {
            // Create guest user
            const user = await storeActions.createGuestUser(userName);
            if (!user) return;
            
            // Navigate to form
            window.FormSyncApp.navigate(`/form/${formCode}`);
        } catch (error) {
            console.error('Error joining form:', error);
            Toast.error('Failed to join form');
        } finally {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Join Form';
        }
    }

    async renderRecentForms() {
        const list = document.getElementById('forms-list');
        if (!list) return;

        list.innerHTML = '';

        const forms = new Map();

        // Get local forms
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('formsync_form_')) {
                const formId = key.replace('formsync_form_', '');
                const formData = JSON.parse(localStorage.getItem(key));
                forms.set(formId, {
                    formId,
                    title: formData.title,
                    description: formData.description,
                    lastActivity: new Date(formData.lastSaved)
                });
            }
        }

        // Get from server if connected
        if (window.socketService && window.socketService.isConnected()) {
            try {
                const response = await API.forms.getUserForms();
                if (response.success && response.data) {
                    response.data.forEach(form => {
                        forms.set(form.formId, {
                            formId: form.formId,
                            title: form.title,
                            description: form.description,
                            lastActivity: new Date(form.lastActivity)
                        });
                    });
                }
            } catch (error) {
                console.warn('Failed to fetch forms from server:', error);
            }
        }

        if (forms.size === 0) return;

        // Sort by lastActivity desc
        const sortedForms = Array.from(forms.values()).sort((a, b) => b.lastActivity - a.lastActivity);

        sortedForms.forEach(form => {
            const item = document.createElement('div');
            item.className = 'form-item';
            item.innerHTML = `
                <h4>${form.title}</h4>
                <p>${form.description}</p>
                <small>Code: ${form.formId} - Last active: ${form.lastActivity.toLocaleString()}</small>
            `;
            item.addEventListener('click', () => {
                window.FormSyncApp.navigate(`/form/${form.formId}`);
            });
            list.appendChild(item);
        });

        document.getElementById('recent-forms').classList.remove('hidden');
    }
}

// Initialize landing page when DOM is ready
let landingPage;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        landingPage = new LandingPage();
    });
} else {
    landingPage = new LandingPage();
} 