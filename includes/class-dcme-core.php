<?php
// includes/class-dcme-core.php

class DCME_Core {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
    }
    
    public function init() {
        // Core initialization
    }
    
    public function enqueue_scripts() {
        // Check if we're on Dokan dashboard with fallback
        if (!DCME_Dashboard::is_seller_dashboard()) {
            return;
        }
        
        wp_enqueue_style('dcme-dashboard', DCME_PLUGIN_URL . 'assets/css/dcme-dashboard.css', array(), DCME_VERSION);
        wp_enqueue_style('dcme-modal', DCME_PLUGIN_URL . 'assets/css/dcme-modal.css', array(), DCME_VERSION);
        wp_enqueue_script('jquery');
        wp_enqueue_script('dcme-customers', DCME_PLUGIN_URL . 'assets/js/dcme-customers.js', array('jquery'), DCME_VERSION, true);
        wp_enqueue_script('dcme-modal', DCME_PLUGIN_URL . 'assets/js/dcme-modal.js', array('jquery'), DCME_VERSION, true);
        wp_enqueue_script('dcme-filters', DCME_PLUGIN_URL . 'assets/js/dcme-filters.js', array('jquery'), DCME_VERSION, true);
        
        // Localize script for AJAX
        wp_localize_script('dcme-customers', 'dcme_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('dcme_nonce'),
            'strings' => array(
                'loading' => __('Loading...', 'dokan-customer-management-enhanced'),
                'error' => __('An error occurred. Please try again.', 'dokan-customer-management-enhanced'),
                'customer_details' => __('Customer Details', 'dokan-customer-management-enhanced'),
                'no_data' => __('No data available.', 'dokan-customer-management-enhanced'),
            )
        ));
    }
}