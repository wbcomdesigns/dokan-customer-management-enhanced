<?php
// includes/class-dcme-dashboard.php

class DCME_Dashboard {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        add_filter('dokan_get_dashboard_nav', array($this, 'add_customers_menu'));
        add_filter('dokan_query_var_filter', array($this, 'add_customers_query_var'));
        add_action('dokan_load_custom_template', array($this, 'load_customers_template'));
    }
    
    public function add_customers_menu($nav) {
        $nav['customers'] = array(
            'title' => __('Customers', 'dokan-customer-management-enhanced'),
            'icon'  => '<i class="fas fa-users"></i>',
            'url'   => self::get_navigation_url('customers'),
            'pos'   => 51
        );
        return $nav;
    }
    
    public function add_customers_query_var($query_vars) {
        $query_vars[] = 'customers';
        return $query_vars;
    }
    
    public function load_customers_template($query_vars) {
        if (isset($query_vars['customers'])) {
            include DCME_PLUGIN_PATH . 'templates/dashboard/customers.php';
        }
    }

    /**
     * Get vendor's customers from orders
     *
     * @return array
     */
    public static function get_vendor_customers($vendor_id) {
        global $wpdb;
        
        // Get unique customers who have purchased from this vendor
        $customer_ids = dcme_get_vendor_customers( $vendor_id );

        if (empty($customer_ids)) {
            return array();
        }
        
        // Get user data for these customers
        $customers = get_users(array(
            'include' => $customer_ids,
            'fields' => 'all'
        ));
        
        return $customers;
    }

    /**
     * Calculate average progress for customer courses
     *
     * @param array $courses
     * @return float
     */
    public static function calculate_average_progress($courses) {
        if (empty($courses)) {
            return 0;
        }
        
        $total_progress = 0;
        foreach ($courses as $course) {
            if( isset( $course['status'] ) && 'completed' === $course['status'] ){
                $total_progress += 100;
            }else{
                $total_progress += isset($course['progress']) ? floatval($course['progress']) : 0;
            }
        }
        
        return round($total_progress / count($courses), 2);
    }

    /**
     * Check if current page is Dokan seller dashboard
     *
     * @return bool
     */
    public static function is_seller_dashboard() {
        if (function_exists('dokan_is_seller_dashboard')) {
            return dokan_is_seller_dashboard();
        }
        
        // Fallback check
        global $wp_query;
        return isset($wp_query->query_vars['dashboard']) || 
               (isset($_GET['page']) && $_GET['page'] === 'dokan');
    }

    /**
     * Get Dokan navigation URL with fallback
     *
     * @param string $page
     * @return string
     */
    public static function get_navigation_url($page) {
        if (function_exists('dokan_get_navigation_url')) {
            return dokan_get_navigation_url($page);
        }
        
        // Fallback URL construction
        $vendor_dashboard = get_option('dokan_dashboard', 'dashboard');
        return home_url("/{$vendor_dashboard}/{$page}/");
    }
}