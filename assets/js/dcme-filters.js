/**
 * DCME Filters - Advanced filtering and search functionality
 */

var DCME_Filters = {
    
    // Filter state
    state: {
        currentFilters: {},
        currentSearch: '',
        isFiltering: false,
        lastFilterTime: 0
    },
    
    // Configuration
    config: {
        searchDelay: 300,
        minSearchLength: 2,
        maxSearchLength: 100,
        filterThrottleDelay: 500
    },
    
    /**
     * Initialize filters
     */
    init: function() {
        this.bindEvents();
        this.setupValidation();
        this.loadSavedFilters();
        console.log('DCME Filters initialized');
    },
    
    /**
     * Bind filter events
     */
    bindEvents: function() {
        var self = this;
        
        // Search input with debouncing
        $('#dcme-customer-search').on('input', function() {
            self.handleSearchInput($(this).val());
        });
        
        // Filter dropdowns and inputs
        $('.dcme-filters select, .dcme-filters input[type="date"]').on('change', function() {
            self.handleFilterChange();
        });
        
        // Clear filters button
        $('#dcme-clear-filters').on('click', function(e) {
            e.preventDefault();
            self.clearAllFilters();
        });
        
        // Advanced filter toggle (if implemented)
        $(document).on('click', '.dcme-advanced-filters-toggle', function(e) {
            e.preventDefault();
            self.toggleAdvancedFilters();
        });
        
        // Export filtered results (if implemented)
        $(document).on('click', '.dcme-export-filtered', function(e) {
            e.preventDefault();
            self.exportFilteredResults();
        });
    },
    
    /**
     * Handle search input with validation and debouncing
     */
    handleSearchInput: function(searchTerm) {
        var self = this;
        
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Validate search term
        searchTerm = this.validateSearchTerm(searchTerm);
        
        // Update state
        this.state.currentSearch = searchTerm;
        
        // Debounce search
        this.searchTimeout = setTimeout(function() {
            self.performSearch(searchTerm);
        }, this.config.searchDelay);
    },
    
    /**
     * Validate search term
     */
    validateSearchTerm: function(term) {
        if (!term) return '';
        
        // Trim whitespace
        term = term.trim();
        
        // Limit length
        if (term.length > this.config.maxSearchLength) {
            term = term.substring(0, this.config.maxSearchLength);
            this.showSearchWarning('Search term truncated to ' + this.config.maxSearchLength + ' characters');
        }
        
        // Remove potentially harmful characters
        term = term.replace(/[<>]/g, '');
        
        return term;
    },
    
    /**
     * Perform search operation
     */
    performSearch: function(searchTerm) {
        // Don't search for very short terms
        if (searchTerm.length > 0 && searchTerm.length < this.config.minSearchLength) {
            return;
        }
        
        this.updateResults();
        this.trackFilterEvent('search', {term: searchTerm});
    },
    
    /**
     * Handle filter change
     */
    handleFilterChange: function() {
        // Throttle filter changes to prevent excessive requests
        var now = Date.now();
        if (now - this.state.lastFilterTime < this.config.filterThrottleDelay) {
            return;
        }
        this.state.lastFilterTime = now;
        
        this.state.currentFilters = this.getFilterValues();
        this.updateResults();
        this.saveFilters();
        this.trackFilterEvent('filter_changed', this.state.currentFilters);
    },
    
    /**
     * Get current filter values
     */
    getFilterValues: function() {
        var filters = {};
        
        // Course status filter
        var courseStatus = $('#dcme-course-status-filter').val();
        if (courseStatus) {
            filters.course_status = courseStatus;
        }
        
        // Course selection filter
        var courseId = $('#dcme-course-filter').val();
        if (courseId) {
            filters.course_id = parseInt(courseId);
        }
        
        // Enrollment date filter
        var enrollmentDate = $('#dcme-enrollment-date-filter').val();
        if (enrollmentDate) {
            filters.enrollment_date = enrollmentDate;
        }
        
        // Certificate status filter
        var certificateStatus = $('#dcme-certificate-filter').val();
        if (certificateStatus) {
            filters.certificate_status = certificateStatus;
        }
        
        return filters;
    },
    
    /**
     * Apply filters and update results
     */
    apply: function(filters) {
        this.state.currentFilters = filters || this.getFilterValues();
        this.updateResults();
    },
    
    /**
     * Clear all filters
     */
    clearAllFilters: function() {
        // Clear form inputs
        $('#dcme-customer-search').val('');
        $('.dcme-filters select').val('');
        $('.dcme-filters input').val('');
        
        // Reset state
        this.state.currentFilters = {};
        this.state.currentSearch = '';
        
        // Update results
        this.updateResults();
        
        // Clear saved filters
        this.clearSavedFilters();
        
        this.trackFilterEvent('filters_cleared');
    },
    
    /**
     * Update results based on current filters and search
     */
    updateResults: function() {
        if (this.state.isFiltering) {
            return; // Prevent concurrent requests
        }
        
        this.state.isFiltering = true;
        
        // Show loading state
        this.showLoadingState();
        
        var self = this;
        var data = {
            action: 'dcme_filter_customers',
            search: this.state.currentSearch,
            filters: this.state.currentFilters,
            nonce: dcme_ajax.nonce
        };
        
        $.ajax({
            url: dcme_ajax.ajax_url,
            type: 'POST',
            data: data,
            timeout: 30000,
            success: function(response) {
                self.state.isFiltering = false;
                
                if (response.success) {
                    self.renderResults(response.data);
                    self.updateFilterSummary(response.data);
                } else {
                    self.showError(response.data || dcme_ajax.strings.error);
                }
            },
            error: function(xhr, status, error) {
                self.state.isFiltering = false;
                console.error('Filter AJAX Error:', status, error);
                self.showError(dcme_ajax.strings.error);
            }
        });
    },
    
    /**
     * Render filtered results
     */
    renderResults: function(customers) {
        if (!customers || customers.length === 0) {
            this.showNoResults();
            return;
        }
        
        var html = '';
        var searchTerm = this.state.currentSearch;
        
        customers.forEach(function(customer) {
            html += DCME_Filters.createCustomerRow(customer, searchTerm);
        });
        
        $('#dcme-customers-tbody').html(html);
        
        // Update result count
        this.updateResultCount(customers.length);
    },
    
    /**
     * Create customer table row
     */
    createCustomerRow: function(customer, searchTerm) {
        return `
            <tr data-customer-id="${customer.ID}">
                <td>
                    <a href="#" class="dcme-customer-name" data-customer-id="${customer.ID}">
                        ${this.highlightSearch(customer.display_name, searchTerm)}
                    </a>
                </td>
                <td>
                    <a href="mailto:${this.escapeHtml(customer.user_email)}">
                        ${this.highlightSearch(customer.user_email, searchTerm)}
                    </a>
                </td>
                <td>${this.highlightSearch(customer.phone || '', searchTerm)}</td>
                <td>
                    <span class="dcme-course-count">${customer.course_count}</span> 
                    <small>enrolled</small>
                </td>
                <td>
                    <div class="dcme-progress-mini">
                        <div class="dcme-progress-bar" style="width: ${customer.avg_progress}%"></div>
                    </div>
                    <span class="dcme-progress-text">${Math.round(customer.avg_progress)}%</span>
                </td>
                <td>
                    <span class="dcme-cert-count">${customer.certificate_count}</span> 
                    <small>earned</small>
                </td>
                <td>
                    <span class="dcme-last-activity">${customer.last_activity} ago</span>
                </td>
                <td>
                    <button class="dokan-btn dokan-btn-sm dcme-view-details" data-customer-id="${customer.ID}">
                        View Details
                    </button>
                </td>
            </tr>
        `;
    },
    
    /**
     * Highlight search terms in text
     */
    highlightSearch: function(text, searchTerm) {
        if (!searchTerm || searchTerm.length < this.config.minSearchLength) {
            return this.escapeHtml(text);
        }
        
        var escapedText = this.escapeHtml(text);
        var escapedTerm = this.escapeRegex(searchTerm);
        var regex = new RegExp('(' + escapedTerm + ')', 'gi');
        
        return escapedText.replace(regex, '<mark>$1</mark>');
    },
    
    /**
     * Show loading state
     */
    showLoadingState: function() {
        $('#dcme-customers-tbody').html(`
            <tr>
                <td colspan="8" class="dcme-loading">
                    <i class="fas fa-spinner fa-spin"></i> ${dcme_ajax.strings.loading}
                </td>
            </tr>
        `);
        
        // Disable filter controls
        $('.dcme-filters select, .dcme-filters input, #dcme-customer-search').prop('disabled', true);
    },
    
    /**
     * Show no results message
     */
    showNoResults: function() {
        var message = 'No customers found';
        var submessage = 'Try adjusting your filters or search terms';
        
        if (this.state.currentSearch) {
            submessage = 'No customers match "' + this.escapeHtml(this.state.currentSearch) + '"';
        }
        
        $('#dcme-customers-tbody').html(`
            <tr>
                <td colspan="8" class="dcme-no-results">
                    <i class="fas fa-search"></i>
                    <p>${message}</p>
                    <small>${submessage}</small>
                </td>
            </tr>
        `);
        
        this.updateResultCount(0);
        this.enableFilterControls();
    },
    
    /**
     * Show error message
     */
    showError: function(message) {
        $('#dcme-customers-tbody').html(`
            <tr>
                <td colspan="8" class="dcme-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${this.escapeHtml(message)}
                </td>
            </tr>
        `);
        
        this.enableFilterControls();
    },
    
    /**
     * Enable filter controls
     */
    enableFilterControls: function() {
        $('.dcme-filters select, .dcme-filters input, #dcme-customer-search').prop('disabled', false);
    },
    
    /**
     * Update result count
     */
    updateResultCount: function(count) {
        var $counter = $('.dcme-result-count');
        if ($counter.length === 0) {
            // Create counter if it doesn't exist
            $('.dcme-filters-section').append('<div class="dcme-result-count"></div>');
            $counter = $('.dcme-result-count');
        }
        
        var text = count === 1 ? '1 customer found' : count + ' customers found';
        $counter.text(text);
    },
    
    /**
     * Update filter summary
     */
    updateFilterSummary: function(customers) {
        // Calculate summary statistics
        var stats = this.calculateFilterStats(customers);
        
        // Update UI with stats if summary panel exists
        if ($('.dcme-filter-summary').length > 0) {
            this.updateSummaryPanel(stats);
        }
    },
    
    /**
     * Calculate filter statistics
     */
    calculateFilterStats: function(customers) {
        if (!customers || customers.length === 0) {
            return {
                total: 0,
                avgProgress: 0,
                totalCertificates: 0,
                completedCourses: 0
            };
        }
        
        var totalProgress = 0;
        var totalCertificates = 0;
        var completedCourses = 0;
        
        customers.forEach(function(customer) {
            totalProgress += customer.avg_progress || 0;
            totalCertificates += customer.certificate_count || 0;
            if (customer.avg_progress === 100) {
                completedCourses++;
            }
        });
        
        return {
            total: customers.length,
            avgProgress: Math.round(totalProgress / customers.length),
            totalCertificates: totalCertificates,
            completedCourses: completedCourses
        };
    },
    
    /**
     * Setup validation
     */
    setupValidation: function() {
        var self = this;
        
        // Validate date inputs
        $('#dcme-enrollment-date-filter').on('change', function() {
            var date = $(this).val();
            if (date && !self.isValidDate(date)) {
                $(this).addClass('error');
                self.showValidationError('Please enter a valid date');
            } else {
                $(this).removeClass('error');
            }
        });
        
        // Validate search input length
        $('#dcme-customer-search').on('input', function() {
            var length = $(this).val().length;
            if (length > self.config.maxSearchLength) {
                $(this).addClass('warning');
            } else {
                $(this).removeClass('warning');
            }
        });
    },
    
    /**
     * Save filters to localStorage
     */
    saveFilters: function() {
        try {
            var filterData = {
                filters: this.state.currentFilters,
                search: this.state.currentSearch,
                timestamp: Date.now()
            };
            localStorage.setItem('dcme_filters', JSON.stringify(filterData));
        } catch (error) {
            console.warn('Could not save filters:', error);
        }
    },
    
    /**
     * Load saved filters
     */
    loadSavedFilters: function() {
        try {
            var saved = localStorage.getItem('dcme_filters');
            if (saved) {
                var filterData = JSON.parse(saved);
                
                // Only load if saved within last hour
                if (Date.now() - filterData.timestamp < 3600000) {
                    this.applySavedFilters(filterData);
                }
            }
        } catch (error) {
            console.warn('Could not load saved filters:', error);
        }
    },
    
    /**
     * Apply saved filters to form
     */
    applySavedFilters: function(filterData) {
        // Apply search term
        if (filterData.search) {
            $('#dcme-customer-search').val(filterData.search);
            this.state.currentSearch = filterData.search;
        }
        
        // Apply filter values
        if (filterData.filters) {
            Object.keys(filterData.filters).forEach(function(key) {
                var value = filterData.filters[key];
                var $element = $('#dcme-' + key.replace('_', '-') + '-filter');
                if ($element.length) {
                    $element.val(value);
                }
            });
            
            this.state.currentFilters = filterData.filters;
        }
    },
    
    /**
     * Clear saved filters
     */
    clearSavedFilters: function() {
        try {
            localStorage.removeItem('dcme_filters');
        } catch (error) {
            console.warn('Could not clear saved filters:', error);
        }
    },
    
    /**
     * Show search warning
     */
    showSearchWarning: function(message) {
        // Show temporary warning message
        var $warning = $('<div class="dcme-search-warning">' + message + '</div>');
        $('.dcme-search-box').append($warning);
        
        setTimeout(function() {
            $warning.fadeOut(function() {
                $warning.remove();
            });
        }, 3000);
    },
    
    /**
     * Show validation error
     */
    showValidationError: function(message) {
        console.warn('Validation error:', message);
        // Could show toast notification or inline error
    },
    
    /**
     * Track filter events for analytics
     */
    trackFilterEvent: function(action, data) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: 'dcme_filters',
                custom_parameters: data
            });
        }
        console.log('Filter event:', action, data);
    },
    
    /**
     * Toggle advanced filters (if implemented)
     */
    toggleAdvancedFilters: function() {
        $('.dcme-advanced-filters').slideToggle();
    },
    
    /**
     * Export filtered results (if implemented)
     */
    exportFilteredResults: function() {
        // Implementation for exporting filtered customer data
        console.log('Export functionality would be implemented here');
    },
    
    /**
     * Utility: Validate date
     */
    isValidDate: function(dateString) {
        var date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
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
    }
};