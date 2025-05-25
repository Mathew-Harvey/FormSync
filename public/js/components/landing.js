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
            const user = storeActions.createGuestUser(userName);
            
            // Generate form code
            const formCode = generateFormCode();
            
            // Get template data
            const template = CONSTANTS.FORM_TEMPLATES[this.selectedTemplate];
            
            // Create form on server
            const formData = {
                formId: formCode,
                templateId: this.selectedTemplate,
                title: template.title,
                description: template.description,
                fields: template.fields,
                createdBy: user.id
            };
            
            try {
                // Create form via API
                console.log('Creating form with data:', formData);
                const response = await API.forms.create(formData);
                console.log('Form created successfully:', response);
                
                // Reset button before navigation
                createBtn.disabled = false;
                createBtn.textContent = 'Create Form';
                
                // Navigate to form
                window.FormSyncApp.navigate(`/form/${formCode}`);
            } catch (apiError) {
                console.error('API error creating form:', apiError);
                console.error('Error details:', apiError.message, apiError.stack);
                
                // If API fails, store form data temporarily and navigate anyway
                // This allows the app to work even if the server is down
                session.set('newForm', {
                    ...formData,
                    formData: {},
                    activeUsers: [],
                    fieldLocks: {},
                    screenshots: []
                });
                
                Toast.warning('Creating form offline - server connection issue');
                
                // Reset button before navigation
                createBtn.disabled = false;
                createBtn.textContent = 'Create Form';
                
                // Navigate to form
                window.FormSyncApp.navigate(`/form/${formCode}`);
            }
        } catch (error) {
            console.error('Error creating form:', error);
            Toast.error('Failed to create form');
            createBtn.disabled = false;
            createBtn.textContent = 'Create Form';
        }
    }
    
    handleJoinForm() {
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
        
        // Create guest user
        storeActions.createGuestUser(userName);
        
        // Navigate to form
        window.FormSyncApp.navigate(`/form/${formCode}`);
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