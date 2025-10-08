<?php
// includes/class-dcme-ajax.php

class DCME_Ajax {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
         add_action('wp_ajax_nopriv_dcme_get_customer_details', array($this, 'get_customer_details'));
        add_action('wp_ajax_dcme_get_customer_details', array($this, 'get_customer_details'));
        add_action('wp_ajax_nopriv_dcme_filter_customers', array($this, 'filter_customers'));
        add_action('wp_ajax_dcme_filter_customers', array($this, 'filter_customers'));
        add_action('wp_ajax_dcme_search_customers', array($this, 'search_customers'));
    }
    
    public function get_customer_details() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'dcme_nonce')) {
            wp_die(__('Security check failed', 'dokan-customer-management-enhanced'));
        }
        
        $customer_id = intval($_POST['customer_id']);
        $vendor_id = get_current_user_id();
        
        // Security check - ensure customer belongs to vendor
        if (!DCME_Security::vendor_can_view_customer($vendor_id, $customer_id)) {
            wp_send_json_error(__('Access denied', 'dokan-customer-management-enhanced'));
        }
        // Get customer data
        $customer_data = $this->prepare_customer_data($customer_id, $vendor_id);
        
        wp_send_json_success($customer_data);
    }
    
    public function filter_customers() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'dcme_nonce')) {
            wp_die(__('Security check failed', 'dokan-customer-management-enhanced'));
        }
        
        $vendor_id = get_current_user_id();
        $filters = DCME_Security::sanitize_customer_data($_POST['filters']);
        $search = sanitize_text_field($_POST['search']);
        
        // Get filtered customers
        $customers = $this->get_filtered_customers($vendor_id, $filters, $search);
        
        wp_send_json_success($customers);
    }
    
    public function search_customers() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'dcme_nonce')) {
            wp_die(__('Security check failed', 'dokan-customer-management-enhanced'));
        }
        
        $vendor_id = get_current_user_id();
        $search_term = sanitize_text_field($_POST['search']);
        
        // Get search results
        $customers = $this->search_vendor_customers($vendor_id, $search_term);
        
        wp_send_json_success($customers);
    }
    
    private function prepare_customer_data($customer_id, $vendor_id) {
        $customer = get_userdata($customer_id);
        $learndash_data = DCME_LearnDash::get_customer_course_data($customer_id, $vendor_id);
        
        return array(
            'basic_info' => array(
                'name' => $customer->display_name,
                'email' => $customer->user_email,
                'phone' => get_user_meta($customer_id, 'billing_phone', true),
                'address' => $this->get_customer_address($customer_id),
                'registered' => $customer->user_registered,
                'last_login' => get_user_meta($customer_id, 'last_login', true)
            ),
            'courses' => $learndash_data['courses'],
            'certificates' => $learndash_data['certificates'],
            'orders' => $this->get_customer_orders($customer_id, $vendor_id)
        );
    }
    
    private function get_customer_address($customer_id) {
        $address_parts = array(
            get_user_meta($customer_id, 'billing_address_1', true),
            get_user_meta($customer_id, 'billing_address_2', true),
            get_user_meta($customer_id, 'billing_city', true),
            get_user_meta($customer_id, 'billing_state', true),
            get_user_meta($customer_id, 'billing_postcode', true),
            get_user_meta($customer_id, 'billing_country', true)
        );
        
        return implode(', ', array_filter($address_parts));
    }
    
    private function get_customer_orders($customer_id, $vendor_id) {
        // Get orders for this customer from this vendor
        $orders = $this->get_vendor_customer_orders($vendor_id, $customer_id);
        $formatted_orders = array();
        foreach ($orders as $order) {
            $wc_order = wc_get_order($order);
            if ($wc_order) {
                $formatted_orders[] = array(
                    'id' => $wc_order->get_id(),
                    'date' => $wc_order->get_date_created()->format('Y-m-d'),
                    'total' => $wc_order->get_formatted_order_total(),
                    'status' => $wc_order->get_status(),
                    'items' => $this->get_order_items($wc_order)
                );
            }
        }
        
        return $formatted_orders;
    }

    private function get_vendor_customer_orders($vendor_id, $customer_id)
    {
        global $wpdb;

        if (!function_exists('dokan')) {
            return [];
        }

        $query_args = [
            'seller_id' => $vendor_id,
            'customer_id' => $customer_id,
            'limit'     => -1,
            'return'    => 'ids',
        ];
        return dokan()->order->all($query_args);
    }

    private function get_order_items($order) {
        $items = array();
        foreach ($order->get_items() as $item) {
            $items[] = array(
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => $order->get_total($item)
            );
        }
        return $items;
    }
    
    private function get_filtered_customers($vendor_id, $filters, $search) {
        $customers = DCME_Dashboard::get_vendor_customers($vendor_id);
        $filtered_customers = array();
        
        foreach ($customers as $customer) {
            // Apply search filter
            if (!empty($search)) {
                $search_fields = array(
                    $customer->display_name,
                    $customer->user_email,
                    get_user_meta($customer->ID, 'billing_phone', true)
                );
                
                $match_found = false;
                foreach ($search_fields as $field) {
                    if (stripos($field, $search) !== false) {
                        $match_found = true;
                        break;
                    }
                }
                
                if (!$match_found) {
                    continue;
                }
            }
            
            // Get customer course data for filtering
            $course_data = DCME_LearnDash::get_customer_course_data($customer->ID, $vendor_id);
            
            // Apply course status filter
            if (!empty($filters['course_status'])) {
                $status_match = false;
                foreach ($course_data['courses'] as $course) {
                    switch ($filters['course_status']) {
                        case 'completed':
                            if ($course['progress'] == 100) {
                                $status_match = true;
                            }
                            break;
                        case 'in-progress':
                            if ($course['progress'] > 0 && $course['progress'] < 100) {
                                $status_match = true;
                            }
                            break;
                        case 'not-started':
                            if ($course['progress'] == 0) {
                                $status_match = true;
                            }
                            break;
                    }
                    if ($status_match) break;
                }
                if (!$status_match) continue;
            }
            
            // Apply course filter
            if (!empty($filters['course_id'])) {
                $course_match = false;
                foreach ($course_data['courses'] as $course) {
                    if ($course['id'] == $filters['course_id']) {
                        $course_match = true;
                        break;
                    }
                }
                if (!$course_match) continue;
            }
            
            // Apply certificate status filter
            if (!empty($filters['certificate_status'])) {
                $certificate_match = false;
                $certificate_count = count($course_data['certificates']);
                switch ($filters['certificate_status']) {
                    case 'has-certificates':
                        if ($certificate_count > 0) {
                            $certificate_match = true;
                        }
                        break;
                    case 'no-certificates':
                        if ($certificate_count == 0) {
                            $certificate_match = true;
                        }
                        break;
                }
                
                if (!$certificate_match) continue;
            }

            // Apply enrollment date filter
            if (!empty($filters['enrollment_date'])) {
                $enrollment_match = false;
               
                foreach ($course_data['courses']as $key => $enrolled_data ) {
                    $customer_enrolled_date = date('Y-m-d', strtotime($enrolled_data['enrolled_date']));
                    if ($customer_enrolled_date === $filters['enrollment_date']) {
                        $enrollment_match = true;
                    }
                }
                
                
                if (!$enrollment_match) continue;
            }
            
            // Add to filtered results
            $avg_progress = DCME_Dashboard::calculate_average_progress($course_data['courses']);
            $filtered_customers[] = array(
                'ID' => $customer->ID,
                'display_name' => $customer->display_name,
                'user_email' => $customer->user_email,
                'phone' => get_user_meta($customer->ID, 'billing_phone', true),
                'course_count' => count($course_data['courses']),
                'avg_progress' => $avg_progress,
                'certificate_count' => count($course_data['certificates']),
                'last_activity' => human_time_diff(strtotime($customer->user_registered))
            );
        }
        
        return $filtered_customers;
    }
    
    private function search_vendor_customers($vendor_id, $search_term) {
        return $this->get_filtered_customers($vendor_id, array(), $search_term);
    }
}