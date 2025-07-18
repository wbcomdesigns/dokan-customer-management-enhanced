<?php
// includes/class-dcme-security.php

class DCME_Security {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        add_action('init', array($this, 'add_capabilities'));
    }
    
    public function add_capabilities() {
        // Add custom capability for viewing customers
        $vendor_role = get_role('seller');
        if ($vendor_role) {
            $vendor_role->add_cap('dokanpro_view_customers');
        }
        
        // Add capability to shop manager as well
        $shop_manager_role = get_role('shop_manager');
        if ($shop_manager_role) {
            $shop_manager_role->add_cap('dokanpro_view_customers');
        }
    }
    
    public static function vendor_can_view_customer($vendor_id, $customer_id) {
        // Check if current user is the vendor
        if (get_current_user_id() !== $vendor_id) {
            return false;
        }
        
        // Check if user has permission
        if (!current_user_can('dokanpro_view_customers')) {
            return false;
        }
        
        // Check if customer has purchased from this vendor OR has access to vendor's courses
        return self::customer_belongs_to_vendor($vendor_id, $customer_id);
    }
    
    public static function customer_belongs_to_vendor($vendor_id, $customer_id) {
        // Check if customer has orders from this vendor
        if (self::customer_has_orders_from_vendor($vendor_id, $customer_id)) {
            return true;
        }
        
        // Check if customer has access to vendor's LearnDash courses
        if (DCME_LearnDash::customer_has_vendor_course_access($customer_id, $vendor_id)) {
            return true;
        }
        
        return false;
    }
    
    private static function customer_has_orders_from_vendor($vendor_id, $customer_id) {
        global $wpdb;
        
        // Check if customer has orders from this vendor
        $order_count = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*)
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'shop_order'
            AND p.post_author = %d
            AND pm.meta_key = '_customer_user'
            AND pm.meta_value = %d
        ", $vendor_id, $customer_id));
        
        return $order_count > 0;
    }
    
    public static function get_vendor_customers($vendor_id) {
        global $wpdb;
        
        // Get customers from orders
        $order_customer_ids = $wpdb->get_col($wpdb->prepare("
            SELECT DISTINCT pm.meta_value
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'shop_order'
            AND p.post_author = %d
            AND pm.meta_key = '_customer_user'
            AND pm.meta_value > 0
        ", $vendor_id));
        
        // Get customers from LearnDash course enrollments
        $course_customer_ids = self::get_customers_from_vendor_courses($vendor_id);
        
        // Merge and get unique customer IDs
        $all_customer_ids = array_unique(array_merge($order_customer_ids, $course_customer_ids));
        
        if (empty($all_customer_ids)) {
            return array();
        }
        
        // Get user data for these customers
        $customers = get_users(array(
            'include' => $all_customer_ids,
            'fields' => 'all'
        ));
        
        return $customers;
    }
    
    private static function get_customers_from_vendor_courses($vendor_id) {
        $vendor_courses = DCME_LearnDash::get_vendor_courses($vendor_id);
        $customer_ids = array();
        
        foreach ($vendor_courses as $course_id) {
            $course_users = learndash_get_course_users_list($course_id);
            if (!empty($course_users)) {
                $customer_ids = array_merge($customer_ids, $course_users);
            }
        }
        
        return array_unique($customer_ids);
    }
    
    public static function sanitize_customer_data($data) {
        if (!is_array($data)) {
            return array();
        }
        
        $sanitized = array();
        
        foreach ($data as $key => $value) {
            switch ($key) {
                case 'customer_id':
                    $sanitized[$key] = intval($value);
                    break;
                case 'search':
                    $sanitized[$key] = sanitize_text_field($value);
                    break;
                case 'course_status':
                case 'course_id':
                    $sanitized[$key] = sanitize_text_field($value);
                    break;
                case 'enrollment_date':
                    $sanitized[$key] = sanitize_text_field($value);
                    break;
                default:
                    $sanitized[$key] = sanitize_text_field($value);
            }
        }
        
        return $sanitized;
    }
    
    /**
     * Verify AJAX nonce
     *
     * @param string $nonce
     * @return bool
     */
    public static function verify_nonce($nonce) {
        return wp_verify_nonce($nonce, 'dcme_nonce');
    }
    
    /**
     * Check if current user can manage customers
     *
     * @return bool
     */
    public static function current_user_can_manage_customers() {
        return current_user_can('dokanpro_view_customers') || current_user_can('manage_woocommerce');
    }
    
    /**
     * Sanitize and validate search term
     *
     * @param string $search_term
     * @return string
     */
    public static function sanitize_search_term($search_term) {
        $search_term = sanitize_text_field($search_term);
        
        // Remove excessive whitespace
        $search_term = preg_replace('/\s+/', ' ', $search_term);
        
        // Trim and limit length
        $search_term = substr(trim($search_term), 0, 100);
        
        return $search_term;
    }
    
    /**
     * Validate filter values
     *
     * @param array $filters
     * @return array
     */
    public static function validate_filters($filters) {
        $valid_filters = array();
        
        // Course status filter
        if (isset($filters['course_status'])) {
            $valid_statuses = array('completed', 'in-progress', 'not-started');
            if (in_array($filters['course_status'], $valid_statuses)) {
                $valid_filters['course_status'] = $filters['course_status'];
            }
        }
        
        // Course ID filter
        if (isset($filters['course_id']) && is_numeric($filters['course_id'])) {
            $valid_filters['course_id'] = intval($filters['course_id']);
        }
        
        // Enrollment date filter
        if (isset($filters['enrollment_date'])) {
            $date = sanitize_text_field($filters['enrollment_date']);
            if (strtotime($date)) {
                $valid_filters['enrollment_date'] = $date;
            }
        }
        
        return $valid_filters;
    }
}