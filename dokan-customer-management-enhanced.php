<?php
/**
 * Plugin Name: Dokan Customer Management Enhanced
 * Plugin URI: https://wbcomdesigns.com
 * Description: Enhanced customer management for Dokan vendors with LearnDash integration, course progress tracking, and certificate management.
 * Version: 1.0.0
 * Author: Wbcom Designs
 * Text Domain: dokan-customer-management-enhanced
 * Domain Path: /languages
 * Requires at least: 5.8
 * Tested up to: 6.3
 * Requires PHP: 7.4
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DCME_VERSION', '1.0.0');
define('DCME_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DCME_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('DCME_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Main plugin class
class DokanCustomerManagementEnhanced {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        // add_action('admin_init', array($this, 'init'));
        $this->init();
    }
    
    public function init() {
        // Check dependencies
      
        if (!$this->check_dependencies()) {
            return;
        }
        
        // Load includes
        $this->includes();

        // Initialize components
        $this->init_components();
        
        // Load textdomain
        load_plugin_textdomain('dokan-customer-management-enhanced', false, dirname(DCME_PLUGIN_BASENAME) . '/languages');
    }
    
    private function check_dependencies() {
        // Check if Dokan Pro is active
        if (!class_exists('WeDevs_Dokan')) {
            add_action('admin_notices', function() {
                echo '<div class="notice notice-error"><p>' . __('Dokan Customer Management Enhanced requires Dokan to be active.', 'dokan-customer-management-enhanced') . '</p></div>';
            });
            return false;
        }
        
        // Check if LearnDash is active
        if (!defined('LEARNDASH_VERSION')) {
            add_action('admin_notices', function() {
                echo '<div class="notice notice-error"><p>' . __('Dokan Customer Management Enhanced requires LearnDash to be active.', 'dokan-customer-management-enhanced') . '</p></div>';
            });
            return false;
        }
        
        return true;
    }
    
    private function includes() {
        require_once DCME_PLUGIN_PATH . 'includes/class-dcme-core.php';
        require_once DCME_PLUGIN_PATH . 'includes/class-dcme-dashboard.php';
        require_once DCME_PLUGIN_PATH . 'includes/class-dcme-ajax.php';
        require_once DCME_PLUGIN_PATH . 'includes/class-dcme-learndash.php';
        require_once DCME_PLUGIN_PATH . 'includes/class-dcme-security.php';
    }
    
    private function init_components() {
        DCME_Core::instance();
        DCME_Dashboard::instance();
        DCME_Ajax::instance();
        DCME_LearnDash::instance();
        DCME_Security::instance();
    }
}

function dcme_get_vendor_orders( $vendor_id = '' ) {
    $vendor_id = ( !empty( $vendor_id ) ) ? $vendor_id : dokan_get_current_user_id();
        if( function_exists('dokan') ){
            $query_args = [
                        'seller_id' => $vendor_id,
                        'limit'     => -1,
                        'return'    => 'ids',
                    ];
            return dokan()->order->all( $query_args );
        }else{
            return array();
        }
}

  /**
     * Get collection of customer ids by vendor orders
     *
     * @return array
     */
function dcme_get_vendor_customers( $vendor_id = '' ) {
        $vendor_id = ( !empty( $vendor_id ) ) ? $vendor_id : dokan_get_current_user_id();
        $vendor_orders = dcme_get_vendor_orders( $vendor_id );
        $customers = [];
        if ( ! empty( $vendor_orders ) ) {
            foreach ( $vendor_orders as $order_id ) {
                $order = wc_get_order( $order_id );
                $customer_id = $order->get_customer_id();

                if( !empty( $customer_id ) ){
                    $customers[] = $order->get_customer_id();
                }
            }
        }
        $customers = array_unique( $customers );
        return $customers;
    }

/**
 * Initialize the plugin
 */
function dcme_init() {
    return DokanCustomerManagementEnhanced::instance();
}

// Start the plugin
add_action('plugins_loaded', 'dcme_init', 20);