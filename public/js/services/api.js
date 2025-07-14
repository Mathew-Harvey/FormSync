// API service for HTTP requests

const API = {
    baseURL: CONSTANTS.API_BASE_URL,
    
    async request(endpoint, options = {}) {
        const state = appStore.getState();
        const token = state.user?.token;
        
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },
    
    // Form endpoints
    forms: {
        create(data) {
            return API.request('/api/forms', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        
        get(formId) {
            return API.request(`/api/forms/${formId}`);
        },
        
        update(formId, data) {
            return API.request(`/api/forms/${formId}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        },
        
        delete(formId) {
            return API.request(`/api/forms/${formId}`, {
                method: 'DELETE'
            });
        },
        
        getTemplates() {
            return API.request('/api/forms/templates');
        },

        getUserForms() {
            return API.request('/api/forms/user');
        }
    },
    
    // User endpoints
    users: {
        get(userId) {
            return API.request(`/api/users/${userId}`);
        },
        
        update(userId, data) {
            return API.request(`/api/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        }
    },
    
    // Auth endpoints
    auth: {
        login(name, color) {
            return API.request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ name, color })
            });
        },
        
        logout() {
            return API.request('/api/auth/logout', {
                method: 'POST'
            });
        }
    }
}; 