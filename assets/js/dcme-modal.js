/**
 * DCME Modal - Modal functionality for customer details
 */

var DCME_Modal = {
    
    // Modal state
    state: {
        isOpen: false,
        currentCustomerId: null,
        currentTab: 'basic-info',
        customerData: null
    },
    
    // Configuration
    config: {
        animationDuration: 300,
        focusTrap: true
    },
    
    /**
     * Open modal with customer data
     */
    open: function(customerId, customerName) {
        if (this.state.isOpen) {
            this.close();
        }
        
        this.state.currentCustomerId = customerId;
        this.state.isOpen = true;
        
        // Update modal title
        this.setTitle(dcme_ajax.strings.customer_details + ': ' + customerName);
        
        // Show modal with animation
        this.showModal();
        
        // Load default tab content
        this.loadTabContent('basic-info');
        
        // Setup focus management
        this.setupFocusTrap();
        
        // Prevent body scroll
        this.preventBodyScroll(true);
        
        // Bind escape key
        this.bindEscapeKey();
    },
    
    /**
     * Close modal
     */
    close: function() {
        if (!this.state.isOpen) {
            return;
        }
        
        var self = this;
        
        // Hide modal with animation
        $('#dcme-customer-modal').fadeOut(this.config.animationDuration, function() {
            self.onModalClosed();
        });
    },
    
    /**
     * Modal closed callback
     */
    onModalClosed: function() {
        this.state.isOpen = false;
        this.state.currentCustomerId = null;
        this.state.customerData = null;
        
        // Reset modal state
        this.resetModal();
        
        // Restore body scroll
        this.preventBodyScroll(false);
        
        // Remove escape key binding
        this.unbindEscapeKey();
        
        // Restore focus
        this.restoreFocus();
    },
    
    /**
     * Show modal with animation
     */
    showModal: function() {
        $('#dcme-customer-modal').fadeIn(this.config.animationDuration);
    },
    
    /**
     * Set modal title
     */
    setTitle: function(title) {
        $('#dcme-modal-title').text(title);
    },
    
    /**
     * Reset modal to initial state
     */
    resetModal: function() {
        // Clear tab content
        $('#dcme-tab-content').empty();
        
        // Reset active tab
        $('.dcme-tab').removeClass('dcme-tab-active');
        $('.dcme-tab[data-tab="basic-info"]').addClass('dcme-tab-active');
        
        this.state.currentTab = 'basic-info';
    },
    
    /**
     * Load tab content
     */
    loadTabContent: function(tabName) {
        if (!this.state.currentCustomerId) {
            this.showError('No customer selected');
            return;
        }
        
        this.state.currentTab = tabName;
        
        // Show loading state
        this.showLoading();
        
        var self = this;
        
        // Make AJAX request
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
                if (response.success) {
                    self.state.customerData = response.data;
                    self.renderTabContent(tabName, response.data);
                } else {
                    self.showError(response.data || dcme_ajax.strings.error);
                }
            },
            error: function(xhr, status, error) {
                console.error('Modal AJAX Error:', status, error);
                self.showError(dcme_ajax.strings.error);
            }
        });
    },
    
    /**
     * Render tab content
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
                    content = '<div class="dcme-error">Invalid tab selected</div>';
            }
            
            $('#dcme-tab-content').html(content);
            
            // Post-render actions
            this.postRenderActions(tabName);
            
        } catch (error) {
            console.error('Error rendering modal content:', error);
            this.showError('Error displaying content');
        }
    },
    
    /**
     * Post-render actions
     */
    postRenderActions: function(tabName) {
        // Animate progress bars for courses tab
        if (tabName === 'courses') {
            this.animateProgressBars();
        }
        
        // Setup tooltips or other UI enhancements
        this.setupTooltips();
        
        // Ensure accessibility
        this.updateAccessibility();
    },
    
    /**
     * Render basic info content
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
                <div class="dcme-info-card">
                    <h4><i class="fas fa-chart-line"></i> Learning Summary</h4>
                    <p><strong>Courses Enrolled:</strong> ${this.getCourseCount()}</p>
                    <p><strong>Average Progress:</strong> ${this.getAverageProgress()}%</p>
                    <p><strong>Certificates Earned:</strong> ${this.getCertificateCount()}</p>
                </div>
            </div>
        `;
    },
    
    /**
     * Render courses content
     */
    renderCourses: function(courses) {
        if (!courses || courses.length === 0) {
            return `
                <div class="dcme-no-results">
                    <i class="fas fa-graduation-cap"></i>
                    <p>No courses enrolled yet.</p>
                    <small>This customer hasn't enrolled in any courses from your store.</small>
                </div>
            `;
        }
        
        var html = '';
        var self = this;
        
        courses.forEach(function(course) {
            var statusClass = course.progress === 100 ? 'completed' : course.progress > 0 ? 'in-progress' : 'not-started';
            
            html += `
                <div class="dcme-course-item ${statusClass}">
                    <h3>${self.escapeHtml(course.title)}</h3>
                    <div class="dcme-course-meta">
                        <span><strong>Progress:</strong> ${Math.round(course.progress)}%</span>
                        <span><strong>Enrolled:</strong> ${self.formatDate(course.enrolled_date)}</span>
                        ${course.completion_date ? `<span><strong>Completed:</strong> ${self.formatDate(course.completion_date)}</span>` : ''}
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
                        <div class="dcme-stat">
                            <span class="dcme-stat-number">${course.last_activity ? self.getTimeSince(course.last_activity) : 'No activity'}</span>
                            <span class="dcme-stat-label">Last Activity</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        return html;
    },
    
    /**
     * Render certificates content
     */
    renderCertificates: function(certificates) {
        if (!certificates || certificates.length === 0) {
            return `
                <div class="dcme-no-results">
                    <i class="fas fa-certificate"></i>
                    <p>No certificates earned yet.</p>
                    <small>Complete courses to earn certificates.</small>
                </div>
            `;
        }
        
        var html = '';
        var self = this;
        
        certificates.forEach(function(cert) {
            html += `
                <div class="dcme-certificate-item">
                    <div class="dcme-certificate-info">
                        <h4><i class="fas fa-award"></i> ${self.escapeHtml(cert.course_title)} Certificate</h4>
                        <p><strong>Earned:</strong> ${self.formatDate(cert.earned_date)}</p>
                        <p><strong>Certificate ID:</strong> <code>${self.escapeHtml(cert.certificate_id)}</code></p>
                        ${cert.certificate_link ? `<p><strong>Verification:</strong> <a href="${cert.certificate_link}" target="_blank" rel="noopener">View Certificate</a></p>` : ''}
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
     * Render orders content
     */
    renderOrders: function(orders) {
        if (!orders || orders.length === 0) {
            return `
                <div class="dcme-no-results">
                    <i class="fas fa-shopping-cart"></i>
                    <p>No purchase history found.</p>
                    <small>This customer hasn't made any purchases yet.</small>
                </div>
            `;
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
        
        var self = this;
        orders.forEach(function(order) {
            var itemsList = order.items.map(function(item) {
                return `${item.name} (×${item.quantity})`;
            }).join(', ');
            
            html += `
                <tr>
                    <td><strong>#${order.id}</strong></td>
                    <td>${self.formatDate(order.date)}</td>
                    <td>${self.escapeHtml(order.total)}</td>
                    <td><span class="dcme-status dcme-status-${order.status}">${self.escapeHtml(order.status)}</span></td>
                    <td title="${self.escapeHtml(itemsList)}">${self.truncateText(itemsList, 50)}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        return html;
    },
    
    /**
     * Show loading state
     */
    showLoading: function() {
        $('#dcme-tab-content').html('<div class="dcme-loading">' + dcme_ajax.strings.loading + '</div>');
    },
    
    /**
     * Show error message
     */
    showError: function(message) {
        $('#dcme-tab-content').html('<div class="dcme-error">' + this.escapeHtml(message) + '</div>');
    },
    
    /**
     * Animate progress bars
     */
    animateProgressBars: function() {
        setTimeout(function() {
            $('.dcme-progress-bar').each(function() {
                var $bar = $(this);
                var progress = $bar.data('progress') || 0;
                
                $bar.animate({
                    width: progress + '%'
                }, 1000);
            });
        }, 100);
    },
    
    /**
     * Setup tooltips
     */
    setupTooltips: function() {
        // Add tooltips to elements with title attributes
        $('[title]').each(function() {
            $(this).attr('data-toggle', 'tooltip');
        });
    },
    
    /**
     * Update accessibility
     */
    updateAccessibility: function() {
        // Ensure proper ARIA labels and roles
        $('.dcme-stat').attr('role', 'button').attr('tabindex', '0');
        $('.dcme-certificate-item').attr('role', 'article');
    },
    
    /**
     * Setup focus trap for accessibility
     */
    setupFocusTrap: function() {
        if (!this.config.focusTrap) {
            return;
        }
        
        var $modal = $('#dcme-customer-modal');
        var $focusableElements = $modal.find('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        var $firstElement = $focusableElements.first();
        var $lastElement = $focusableElements.last();
        
        // Focus first element
        $firstElement.focus();
        
        // Trap focus within modal
        $modal.on('keydown.dcme-focus-trap', function(e) {
            if (e.keyCode === 9) { // Tab key
                if (e.shiftKey) {
                    if (document.activeElement === $firstElement[0]) {
                        e.preventDefault();
                        $lastElement.focus();
                    }
                } else {
                    if (document.activeElement === $lastElement[0]) {
                        e.preventDefault();
                        $firstElement.focus();
                    }
                }
            }
        });
    },
    
    /**
     * Prevent body scroll
     */
    preventBodyScroll: function(prevent) {
        if (prevent) {
            $('body').addClass('dcme-modal-open');
        } else {
            $('body').removeClass('dcme-modal-open');
        }
    },
    
    /**
     * Bind escape key
     */
    bindEscapeKey: function() {
        var self = this;
        $(document).on('keydown.dcme-modal', function(e) {
            if (e.keyCode === 27) { // Escape key
                e.preventDefault();
                self.close();
            }
        });
    },
    
    /**
     * Unbind escape key
     */
    unbindEscapeKey: function() {
        $(document).off('keydown.dcme-modal');
        $('#dcme-customer-modal').off('keydown.dcme-focus-trap');
    },
    
    /**
     * Restore focus to trigger element
     */
    restoreFocus: function() {
        if (this.state.currentCustomerId) {
            var $trigger = $('[data-customer-id="' + this.state.currentCustomerId + '"]').first();
            if ($trigger.length) {
                $trigger.focus();
            }
        }
    },
    
    /**
     * Get course count from current data
     */
    getCourseCount: function() {
        if (this.state.customerData && this.state.customerData.courses) {
            return this.state.customerData.courses.length;
        }
        return 0;
    },
    
    /**
     * Get average progress from current data
     */
    getAverageProgress: function() {
        if (!this.state.customerData || !this.state.customerData.courses || this.state.customerData.courses.length === 0) {
            return 0;
        }
        
        var totalProgress = 0;
        this.state.customerData.courses.forEach(function(course) {
            totalProgress += course.progress || 0;
        });
        
        return Math.round(totalProgress / this.state.customerData.courses.length);
    },
    
    /**
     * Get certificate count from current data
     */
    getCertificateCount: function() {
        if (this.state.customerData && this.state.customerData.certificates) {
            return this.state.customerData.certificates.length;
        }
        return 0;
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
     * Utility: Format date
     */
    formatDate: function(dateString) {
        if (!dateString) return 'Not available';
        
        var date = new Date(dateString);
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