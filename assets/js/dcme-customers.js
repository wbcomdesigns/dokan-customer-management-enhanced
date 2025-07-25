(function( $ ) {
	'use strict';

/**
 * DCME Customers - Main JavaScript functionality
 */

jQuery(document).ready(function($) {
    'use strict';
    
    // Initialize the customer management system
    DCME_Customers.init();
    
    // Initialize modal if available
    if (typeof DCME_Modal !== 'undefined') {
        // Modal is available, events will be handled by DCME_Customers
        console.log('DCME Modal integration ready');
    }
    
    // Initialize filters if available
    if (typeof DCME_Filters !== 'undefined') {
        DCME_Filters.init();
        console.log('DCME Filters integration ready');
    }
});

var DCME_Customers = {
    
    // Configuration
    config: {
        searchDelay: 300,
        modalAnimationDuration: 300,
        progressAnimationDuration: 1000
    },
    
    // State management
    state: {
        currentCustomerId: null,
        currentTab: 'basic-info',
        isLoading: false,
        searchTimeout: null
    },
    
    /**
     * Initialize the customer management system
     */
    init: function() {
        this.bindEvents();
        this.initFilters();
        this.setupAccessibility();
        console.log('DCME Customers initialized successfully');
    },
    
    /**
     * Bind all event handlers
     */
    bindEvents: function() {
        var self = this;
        
        // Customer name/button clicks - open modal
        jQuery(document).on('click', '.dcme-customer-name, .dcme-view-details', function(e) {
            e.preventDefault();
            self.openCustomerModal(jQuery(this));
        });
        
        // Modal close events
        jQuery(document).on('click', '.dcme-modal-close', function(e) {
            e.preventDefault();
            self.closeModal();
        });
        
        // Close modal when clicking outside
        jQuery(document).on('click', '.dcme-modal', function(e) {
            if (e.target === this) {
                self.closeModal();
            }
        });
        
        // Tab switching
        jQuery(document).on('click', '.dcme-tab', function(e) {
            e.preventDefault();
            self.switchTab(jQuery(this));
        });
        
        // Search functionality with debouncing
        jQuery('#dcme-customer-search').on('keyup', function() {
            self.handleSearch(jQuery(this).val());
        });
        
        // Filter changes
        jQuery('.dcme-filters select, .dcme-filters input').on('change', function() {
            self.applyFilters();
        });
        
        // Clear filters
        jQuery('#dcme-clear-filters').on('click', function(e) {
            e.preventDefault();
            self.clearFilters();
        });
        
        // Keyboard shortcuts
        jQuery(document).on('keydown', function(e) {
            self.handleKeyboardShortcuts(e);
        });
        
        // Window resize handling
        jQuery(window).on('resize', debounce(function() {
            self.handleResize();
        }, 250));
    },
    
    /**
     * Open customer details modal
     */
    openCustomerModal: function($trigger) {
        var customerId = $trigger.data('customer-id');
        var customerName = $trigger.closest('tr').find('.dcme-customer-name').text().trim();
        
        if (!customerId) {
            this.showError('Invalid customer ID');
            return;
        }
        
        // Use DCME_Modal if available, otherwise handle inline
        if (typeof DCME_Modal !== 'undefined') {
            DCME_Modal.open(customerId, customerName);
        } else {
            // Fallback modal handling
            this.openModalFallback(customerId, customerName);
        }
    },
    
    /**
     * Fallback modal opening if DCME_Modal is not available
     */
    openModalFallback: function(customerId, customerName) {
        this.state.currentCustomerId = customerId;
        
        // Update modal title
        jQuery('#dcme-modal-title').text(dcme_ajax.strings.customer_details + ': ' + customerName);
        
        // Show modal with animation
        jQuery('#dcme-customer-modal').fadeIn(this.config.modalAnimationDuration);
        jQuery('body').addClass('dcme-modal-open');
        
        // Load default tab content
        this.loadTabContent('basic-info');
        
        // Focus management for accessibility
        jQuery('.dcme-modal-close').focus();
        
        // Track analytics
        this.trackEvent('modal_opened', {customer_id: customerId});
    },
    
    /**
     * Close modal
     */
    closeModal: function() {
        var self = this;
        
        jQuery('#dcme-customer-modal').fadeOut(this.config.modalAnimationDuration, function() {
            jQuery('body').removeClass('dcme-modal-open');
            
            // Reset modal state
            self.resetModalState();
        });
        
        // Return focus to trigger element
        if (this.state.currentCustomerId) {
            jQuery('[data-customer-id="' + this.state.currentCustomerId + '"]').first().focus();
        }
        
        this.trackEvent('modal_closed');
    },
    
    /**
     * Reset modal to initial state
     */
    resetModalState: function() {
        this.state.currentCustomerId = null;
        this.state.currentTab = 'basic-info';
        this.state.isLoading = false;
        
        // Clear tab content
        jQuery('#dcme-tab-content').empty();
        
        // Reset active tab
        jQuery('.dcme-tab').removeClass('dcme-tab-active');
        jQuery('.dcme-tab[data-tab="basic-info"]').addClass('dcme-tab-active');
    },
    
    /**
     * Switch between modal tabs
     */
    switchTab: function($tab) {
        if (this.state.isLoading) {
            return;
        }
        
        var tabName = $tab.data('tab');
        
        if (tabName === this.state.currentTab) {
            return;
        }
        
        // Update tab active state
        jQuery('.dcme-tab').removeClass('dcme-tab-active');
        $tab.addClass('dcme-tab-active');
        
        // Load tab content
        this.loadTabContent(tabName);
        
        this.trackEvent('tab_switched', {tab: tabName});
    },
    
    /**
     * Load tab content via AJAX
     */
    loadTabContent: function(tabName) {
        if (!this.state.currentCustomerId) {
            this.showError('No customer selected');
            return;
        }
        
        this.state.currentTab = tabName;
        this.state.isLoading = true;
        
        // Show loading state
        this.showLoading();
        
        var self = this;
        
        // AJAX request
        $.ajax({
            url: dcme_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'dcme_get_customer_details',
                customer_id: this.state.currentCustomerId,
                tab: tabName,
                nonce: dcme_ajax.nonce
            },
            timeout: 30000,
            success: function(response) {
                self.state.isLoading = false;
                
                if (response.success) {
                    self.renderTabContent(tabName, response.data);
                } else {
                    self.showError(response.data || dcme_ajax.strings.error);
                }
            },
            error: function(xhr, status, error) {
                self.state.isLoading = false;
                console.error('AJAX Error:', status, error);
                self.showError(dcme_ajax.strings.error);
            }
        });
    },
    
    /**
     * Render tab content based on data
     */
    renderTabContent: function(tabName, data) {
        var content = '';
        
        try {
            switch (tabName) {
                case 'basic-info':
                    content = this.renderBasicInfo(data.basic_info);
                    break;
                case 'courses':
                    content = this.renderCourses(data.courses);
                    break;
                case 'certificates':
                    content = this.renderCertificates(data.certificates);
                    break;
                case 'orders':
                    content = this.renderOrders(data.orders);
                    break;
                default:
                    content = '<div class="dcme-error">Invalid tab</div>';
            }
            
            jQuery('#dcme-tab-content').html(content);
            
            // Animate progress bars if on courses tab
            if (tabName === 'courses') {
                this.animateProgressBars();
            }
            
        } catch (error) {
            console.error('Error rendering tab content:', error);
            this.showError('Error displaying content');
        }
    },
    
    /**
     * Render basic info tab
     */
    renderBasicInfo: function(info) {
        if (!info) {
            return '<div class="dcme-error">No customer information available</div>';
        }
        
        return `
            <div class="dcme-info-grid">
                <div class="dcme-info-card">
                    <h4><i class="fas fa-user"></i> Contact Information</h4>
                    <p><strong>Name:</strong> ${this.escapeHtml(info.name || 'Not provided')}</p>
                    <p><strong>Email:</strong> <a href="mailto:${this.escapeHtml(info.email)}">${this.escapeHtml(info.email)}</a></p>
                    <p><strong>Phone:</strong> ${this.escapeHtml(info.phone || 'Not provided')}</p>
                    <p><strong>Address:</strong> ${this.escapeHtml(info.address || 'Not provided')}</p>
                </div>
                <div class="dcme-info-card">
                    <h4><i class="fas fa-calendar"></i> Account Details</h4>
                    <p><strong>Registered:</strong> ${this.formatDate(info.registered)}</p>
                    <p><strong>Last Login:</strong> ${info.last_login ? this.formatDate(info.last_login) : 'Never logged in'}</p>
                    <p><strong>Customer Since:</strong> ${this.getTimeSince(info.registered)}</p>
                </div>
            </div>
        `;
    },
    
    /**
     * Render courses tab
     */
    renderCourses: function(courses) {
        if (!courses || courses.length === 0) {
            return '<div class="dcme-no-results"><i class="fas fa-graduation-cap"></i><p>No courses enrolled yet.</p></div>';
        }
        
        var html = '';
        courses.forEach(function(course) {
            var progressClass = course.progress === 100 ? 'completed' : course.progress > 0 ? 'in-progress' : 'not-started';
            html += `
                <div class="dcme-course-item ${progressClass}">
                    <h3>${DCME_Customers.escapeHtml(course.title)}</h3>
                    <div class="dcme-course-meta">
                        <span><strong>Progress:</strong> ${Math.round(course.progress)}%</span>
                        <span><strong>Enrolled:</strong> ${DCME_Customers.formatDate(course.enrolled_date)}</span>
                        ${course.completion_date != '0' ? `<span><strong>Completed:</strong> ${DCME_Customers.formatDate(course.completion_date)}</span>` : '<span><strong>Completed:</strong>Not Yet'}
                    </div>
                    <div class="dcme-progress-bar-container">
                        <div class="dcme-progress-bar" data-progress="${course.progress}" style="width: 0%"></div>
                    </div>
                    <div class="dcme-course-stats">
                        <div class="dcme-stat">
                            <span class="dcme-stat-number">${course.lessons_completed}</span>
                            <span class="dcme-stat-label">Lessons Completed</span>
                        </div>
                        <div class="dcme-stat">
                            <span class="dcme-stat-number">${course.total_lessons}</span>
                            <span class="dcme-stat-label">Total Lessons</span>
                        </div>
                        <div class="dcme-stat">
                            <span class="dcme-stat-number">${course.completed ? 'Yes' : 'No'}</span>
                            <span class="dcme-stat-label">Completed</span>
                        </div>  
                    </div>
                </div>
            `;
        });
        // <div class="dcme-stat">
        //                     <span class="dcme-stat-number">${course.last_activity ? DCME_Customers.getTimeSince(course.last_activity) : 'No activity'}</span>
        //                     <span class="dcme-stat-label">Last Activity</span>
        //                 </div>
        
        return html;
    },
    
    /**
     * Render certificates tab
     */
    renderCertificates: function(certificates) {
        if (!certificates || certificates.length === 0) {
            return '<div class="dcme-no-results"><i class="fas fa-certificate"></i><p>No certificates earned yet.</p></div>';
        }
        
        var html = '';
        certificates.forEach(function(cert) {
            console.log(cert.earned_date);
            console.log(DCME_Customers.formatDate(cert.earned_date));
            html += `
                <div class="dcme-certificate-item">
                    <div class="dcme-certificate-info">
                        <h4><i class="fas fa-award"></i> ${DCME_Customers.escapeHtml(cert.course_title)} Certificate</h4>
                        <p><strong>Earned:</strong> ${DCME_Customers.formatDate(cert.earned_date)}</p>
                        <p><strong>Certificate ID:</strong> <code>${DCME_Customers.escapeHtml(cert.certificate_id)}</code></p>
                    </div>
                    <div class="dcme-certificate-badge">
                        <i class="fas fa-check-circle"></i> Earned
                    </div>
                </div>
            `;
        });
        
        return html;
    },
    
    /**
     * Render orders tab
     */
    renderOrders: function(orders) {
        if (!orders || orders.length === 0) {
            return '<div class="dcme-no-results"><i class="fas fa-shopping-cart"></i><p>No purchase history found.</p></div>';
        }
        
        var html = `
            <table class="dcme-orders-table">
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Items</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        orders.forEach(function(order) {
            var itemsList = order.items.map(function(item) {
                return `${item.name} (×${item.quantity})`;
            }).join(', ');
            
            html += `
                <tr>
                    <td><strong>#${order.id}</strong></td>
                    <td>${DCME_Customers.formatDate(order.date)}</td>
                    <td>${order.total}</td>
                    <td><span class="dcme-status dcme-status-${order.status}">${DCME_Customers.escapeHtml(order.status)}</span></td>
                    <td title="${DCME_Customers.escapeHtml(itemsList)}">${DCME_Customers.truncateText(itemsList, 50)}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        return html;
    },
    
    /**
     * Handle search with debouncing
     */
    handleSearch: function(searchTerm) {
        var self = this;
        
        // Clear previous timeout
        if (this.state.searchTimeout) {
            clearTimeout(this.state.searchTimeout);
        }
        
        // Set new timeout
        this.state.searchTimeout = setTimeout(function() {
            self.performSearch(searchTerm);
        }, this.config.searchDelay);
    },
    
    /**
     * Perform search operation
     */
    performSearch: function(searchTerm) {
        searchTerm = searchTerm.trim();
        
        if (searchTerm.length < 2 && searchTerm.length > 0) {
            return; // Don't search for single characters
        }
        
        this.applyFilters();
        this.trackEvent('search_performed', {term: searchTerm});
    },
    
    /**
     * Apply all filters
     */
    applyFilters: function() {
        // Use DCME_Filters if available, otherwise handle inline
        if (typeof DCME_Filters !== 'undefined') {
            DCME_Filters.apply();
        } else {
            // Fallback filter handling
            this.applyFiltersFallback();
        }
    },
    
    /**
     * Fallback filter application
     */
    applyFiltersFallback: function() {
        var filters = this.getFilterValues();
        var searchTerm = jQuery('#dcme-customer-search').val().trim();
        
        // Show loading state
        this.showTableLoading();
        
        var self = this;
        
        $.ajax({
            url: dcme_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'dcme_filter_customers',
                search: searchTerm,
                filters: filters,
                nonce: dcme_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    self.renderFilteredResults(response.data);
                } else {
                    self.showTableError(response.data || dcme_ajax.strings.error);
                }
            },
            error: function() {
                self.showTableError(dcme_ajax.strings.error);
            }
        });
    },
    
    /**
     * Get current filter values
     */
    getFilterValues: function() {
        return {
            course_status: jQuery('#dcme-course-status-filter').val(),
            course_id: jQuery('#dcme-course-filter').val(),
            enrollment_date: jQuery('#dcme-enrollment-date-filter').val(),
            certificate_status: jQuery('#dcme-certificate-filter').val()
        };
    },
    
    /**
     * Clear all filters
     */
    clearFilters: function() {
        jQuery('.dcme-filters select').val('');
        jQuery('.dcme-filters input').val('');
        jQuery('#dcme-customer-search').val('');
        
        this.applyFilters();
        this.trackEvent('filters_cleared');
    },
    
    /**
     * Render filtered results
     */
    renderFilteredResults: function(customers) {
        if (!customers || customers.length === 0) {
            jQuery('#dcme-customers-tbody').html(`
                <tr>
                    <td colspan="8" class="dcme-no-results">
                        <i class="fas fa-search"></i>
                        <p>No customers found matching your criteria.</p>
                    </td>
                </tr>
            `);
            return;
        }
        
        var html = '';
        var searchTerm = jQuery('#dcme-customer-search').val().trim();
        
        customers.forEach(function(customer) {
            html += `
                <tr data-customer-id="${customer.ID}">
                    <td>
                        <a href="#" class="dcme-customer-name" data-customer-id="${customer.ID}">
                            ${DCME_Customers.highlightSearch(customer.display_name, searchTerm)}
                        </a>
                    </td>
                    <td>${DCME_Customers.highlightSearch(customer.user_email, searchTerm)}</td>
                    <td>${DCME_Customers.highlightSearch(customer.phone || '', searchTerm)}</td>
                    <td>${customer.course_count} enrolled</td>
                    <td>
                        <div class="dcme-progress-mini">
                            <div class="dcme-progress-bar" style="width: ${customer.avg_progress}%"></div>
                        </div>
                        ${Math.round(customer.avg_progress)}%
                    </td>
                    <td>${customer.certificate_count} earned</td>
                    <td>${customer.last_activity} ago</td>
                    <td>
                        <button class="dokan-btn dokan-btn-sm dcme-view-details" data-customer-id="${customer.ID}">
                            View Details
                        </button>
                    </td>
                </tr>
            `;
        });
        
        jQuery('#dcme-customers-tbody').html(html);
    },
    
    /**
     * Highlight search terms in text
     */
    highlightSearch: function(text, searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return this.escapeHtml(text);
        }
        
        var escapedText = this.escapeHtml(text);
        var escapedTerm = this.escapeRegex(searchTerm);
        var regex = new RegExp('(' + escapedTerm + ')', 'gi');
        
        return escapedText.replace(regex, '<mark>$1</mark>');
    },
    
    /**
     * Show loading state in tab content
     */
    showLoading: function() {
        jQuery('#dcme-tab-content').html('<div class="dcme-loading">' + dcme_ajax.strings.loading + '</div>');
    },
    
    /**
     * Show loading state in table
     */
    showTableLoading: function() {
        jQuery('#dcme-customers-tbody').html(`
            <tr>
                <td colspan="8" class="dcme-loading">
                    ${dcme_ajax.strings.loading}
                </td>
            </tr>
        `);
    },
    
    /**
     * Show error message in tab content
     */
    showError: function(message) {
        jQuery('#dcme-tab-content').html('<div class="dcme-error">' + this.escapeHtml(message) + '</div>');
    },
    
    /**
     * Show error message in table
     */
    showTableError: function(message) {
        jQuery('#dcme-customers-tbody').html(`
            <tr>
                <td colspan="8" class="dcme-error">
                    ${this.escapeHtml(message)}
                </td>
            </tr>
        `);
    },
    
    /**
     * Animate progress bars
     */
    animateProgressBars: function() {
        jQuery('.dcme-progress-bar').each(function() {
            var $bar = jQuery(this);
            var progress = $bar.data('progress') || 0;
            
            setTimeout(function() {
                $bar.animate({
                    width: progress + '%'
                }, DCME_Customers.config.progressAnimationDuration);
            }, 100);
        });
    },
    
    /**
     * Initialize filter functionality
     */
    initFilters: function() {
        // Set up filter dependencies and validation
        console.log('Filters initialized');
    },
    
    /**
     * Setup accessibility features
     */
    setupAccessibility: function() {
        // Add ARIA labels and keyboard navigation
        jQuery('.dcme-customer-name').attr('role', 'button').attr('tabindex', '0');
        jQuery('.dcme-view-details').attr('aria-label', 'View customer details');
        jQuery('.dcme-modal-close').attr('aria-label', 'Close modal');
    },
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts: function(e) {
        // ESC key closes modal
        if (e.keyCode === 27 && jQuery('#dcme-customer-modal').is(':visible')) {
            this.closeModal();
        }
        
        // Enter key on customer name
        if (e.keyCode === 13 && jQuery(e.target).hasClass('dcme-customer-name')) {
            e.preventDefault();
            this.openCustomerModal(jQuery(e.target));
        }
    },
    
    /**
     * Handle window resize
     */
    handleResize: function() {
        // Adjust modal size if needed
        if (jQuery('#dcme-customer-modal').is(':visible')) {
            // Responsive adjustments
        }
    },
    
    /**
     * Track analytics events
     */
    trackEvent: function(eventName, data) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, {
                event_category: 'dcme_customers',
                custom_parameters: data
            });
        }
        console.log('Event tracked:', eventName, data);
    },
    
    /**
     * Utility: Escape HTML
     */
    escapeHtml: function(text) {
        if (!text) return '';
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
    },
    
    /**
     * Utility: Escape regex
     */
    escapeRegex: function(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    /**
     * Utility: Format date
     */
      formatDate: function(dateString) {

        if (!dateString) return 'Not available';
        
        var date;
        
        // Check if it's a Unix timestamp (10 digits = seconds, 13 digits = milliseconds)
        if (/^\d{10}$/.test(dateString)) {
            date = new Date(Number(dateString) * 1000); // Convert seconds to milliseconds
        } else if (/^\d{13}$/.test(dateString)) {
            date = new Date(Number(dateString)); // Already in milliseconds
        } else {
            date = new Date(dateString); // Regular date string
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    },
    
    /**
     * Utility: Get time since
     */
    getTimeSince: function(dateString) {
        if (!dateString) return 'Unknown';
        
        var date = new Date(dateString);
        var now = new Date();
        var seconds = Math.floor((now - date) / 1000);
        
        var intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (var key in intervals) {
            var interval = Math.floor(seconds / intervals[key]);
            if (interval >= 1) {
                return interval + ' ' + key + (interval > 1 ? 's' : '') + ' ago';
            }
        }
        
        return 'Just now';
    },
    
    /**
     * Utility: Truncate text
     */
    truncateText: function(text, length) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length) + '...';
    }
};

/**
 * Debounce function utility
 */
function debounce(func, wait) {
    var timeout;
    return function executedFunction() {
        var context = this;
        var args = arguments;
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}



})( jQuery );