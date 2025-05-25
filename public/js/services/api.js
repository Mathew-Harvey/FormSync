// API service for HTTP requests

const API = {
    baseURL: CONSTANTS.API_BASE_URL,
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
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
        login(email, password) {
            return API.request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
        },
        
        register(data) {
            return API.request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        
        logout() {
            return API.request('/api/auth/logout', {
                method: 'POST'
            });
        }
    }
}; 