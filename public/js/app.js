// Main application entry point

class App {
    constructor() {
        this.currentPage = null;
        this.init();
    }
    
    init() {
        // Initialize components
        this.initializeEventListeners();
        this.checkRoute();
        
        // Listen for route changes
        window.addEventListener('popstate', () => this.checkRoute());
        
        // Subscribe to page changes
        appStore.subscribe((newPage) => {
            if (newPage && newPage !== this.currentPage) {
                this.navigateToPage(newPage);
            }
        }, state => state.currentPage);
    }
    
    initializeEventListeners() {
        // Global event delegation
        document.addEventListener('click', (e) => {
            // Handle internal links
            if (e.target.matches('a[href^="/"]')) {
                e.preventDefault();
                const path = e.target.getAttribute('href');
                this.navigate(path);
            }
        });
    }
    
    checkRoute() {
        const path = window.location.pathname;
        const params = getQueryParams();
        
        if (path === '/' || path === '/index.html') {
            // Check if there's a form parameter in the URL
            if (params.form) {
                // Store form ID for after login
                session.set('pendingFormId', params.form);
            }
            storeActions.setCurrentPage('landing');
        } else if (path.startsWith('/form/')) {
            const formId = path.split('/')[2];
            if (formId) {
                this.loadForm(formId);
            } else {
                this.navigate('/');
            }
        } else {
            this.navigate('/');
        }
    }
    
    navigate(path) {
        window.history.pushState({}, '', path);
        this.checkRoute();
    }
    
    navigateToPage(page) {
        console.log('Navigating to page:', page);
        
        // Handle undefined page
        if (!page) {
            console.error('No page specified for navigation');
            return;
        }
        
        if (this.currentPage === page) {
            console.log('Already on page:', page);
            return;
        }
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
            p.classList.add('hidden');
        });
        
        // Show target page
        const targetPage = document.getElementById(`${page}-page`);
        console.log('Target page element:', targetPage);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            targetPage.classList.add('active');
            this.currentPage = page;
            console.log('Page shown:', page);
        } else {
            console.error('Page element not found:', `${page}-page`);
        }
    }
    
    async loadForm(formId) {
        console.log('loadForm called with formId:', formId);
        const state = appStore.getState();
        
        // Check if user is authenticated
        if (!state.user) {
            console.log('User not authenticated, storing pending form ID');
            // Store form ID for after login
            session.set('pendingFormId', formId);
            Toast.warning('Please enter your name to join the form');
            this.navigate('/');
            return;
        }
        
        console.log('User authenticated, navigating to form page');
        // Navigate to form page
        storeActions.setCurrentPage('form');
        
        // Join form via socket
        if (window.socketService && window.socketService.isConnected()) {
            console.log('Socket connected, joining form via socket');
            window.socketService.joinForm(formId);
        } else {
            console.log('Socket not connected, attempting to load form from localStorage');
            if (window.localSyncService) {
                const localForm = window.localSyncService.loadForm(formId);
                if (localForm) {
                    console.log('Found form in localStorage, setting current form:', localForm);
                    storeActions.setCurrentForm(localForm);
                } else {
                    console.log('Form not found in localStorage');
                    Toast.error('Form not found locally. Please check connection.');
                }
            } else {
                console.log('localSyncService not available');
                Toast.error('Connection error. Please refresh the page.');
            }
            // Set pending form join
            if (window.socketService) {
                window.socketService.pendingFormId = formId;
            }
        }
    }
}

// Create a temporary placeholder for FormSyncApp
window.FormSyncApp = {
    navigate: function(path) {
        console.warn('App not initialized yet, queueing navigation to:', path);
        // Queue the navigation for when app is ready
        window.FormSyncApp._pendingNavigation = path;
    }
};

// Initialize app and all components when DOM is ready
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize core app
        app = new App();
        window.FormSyncApp = app;
        
        // Initialize WebRTC manager globally
        window.webRTCManager = new WebRTCManager();
        
        // Initialize video component
        window.videoComponent = new VideoComponent();
        
        // Handle any pending navigation
        if (window.FormSyncApp._pendingNavigation) {
            app.navigate(window.FormSyncApp._pendingNavigation);
            delete window.FormSyncApp._pendingNavigation;
        }
    });
} else {
    app = new App();
    window.FormSyncApp = app;
    
    // Initialize WebRTC manager globally
    window.webRTCManager = new WebRTCManager();
    
    // Initialize video component
    window.videoComponent = new VideoComponent();
} 