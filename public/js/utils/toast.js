// Toast notification system

const Toast = {
    container: null,
    
    init() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            console.error('Toast container not found');
        }
    },
    
    show(message, type = 'info', duration = 4000) {
        if (!this.container) {
            this.init();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type} fade-in`;
        
        const icon = this.getIcon(type);
        const iconElement = document.createElement('span');
        iconElement.className = 'toast-icon';
        iconElement.textContent = icon;
        
        const messageElement = document.createElement('span');
        messageElement.className = 'toast-message';
        messageElement.textContent = message;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close';
        closeButton.textContent = '×';
        closeButton.onclick = () => this.remove(toast);
        
        toast.appendChild(iconElement);
        toast.appendChild(messageElement);
        toast.appendChild(closeButton);
        
        this.container.appendChild(toast);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }
        
        return toast;
    },
    
    remove(toast) {
        if (!toast || !toast.parentElement) return;
        
        toast.classList.add('slide-out');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    },
    
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    },
    
    success(message, duration) {
        return this.show(message, 'success', duration);
    },
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    },
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    },
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    },
    
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};

// Initialize toast system when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Toast.init());
} else {
    Toast.init();
} 