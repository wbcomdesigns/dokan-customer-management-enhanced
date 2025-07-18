<?php
// includes/class-dcme-learndash.php

class DCME_LearnDash {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public static function get_customer_course_data($customer_id, $vendor_id) {
        $courses_data = array();
        $certificates_data = array();
        
        // Get vendor's groups/courses
        $vendor_courses = self::get_vendor_courses($vendor_id);
        
        foreach ($vendor_courses as $course_id) {
            // Check if customer is enrolled in this course with fallback
            if (self::user_has_course_access($course_id, $customer_id)) {
                $course_progress = self::get_user_course_progress($customer_id, $course_id);
                $completion_date = self::get_course_completion_date($customer_id, $course_id);
                
                $courses_data[] = array(
                    'id' => $course_id,
                    'title' => get_the_title($course_id),
                    'progress' => $course_progress ? $course_progress['percentage'] : 0,
                    'completed' => !empty($completion_date),
                    'completion_date' => $completion_date,
                    'enrolled_date' => self::get_course_enrolled_date($customer_id, $course_id),
                    'lessons_completed' => $course_progress ? $course_progress['completed'] : 0,
                    'total_lessons' => $course_progress ? $course_progress['total'] : 0,
                    'last_activity' => self::get_user_course_last_activity($customer_id, $course_id)
                );
                
                // Get certificates for this course
                $certificate = self::get_course_certificate($course_id, $customer_id);
                if ($certificate) {
                    $certificates_data[] = array(
                        'course_id' => $course_id,
                        'course_title' => get_the_title($course_id),
                        'certificate_link' => $certificate,
                        'earned_date' => $completion_date,
                        'certificate_id' => self::get_certificate_id($course_id, $customer_id)
                    );
                }
            }
        }
        
        return array(
            'courses' => $courses_data,
            'certificates' => $certificates_data
        );
    }

    /**
     * Check if user has course access with fallback
     */
    private static function user_has_course_access($course_id, $user_id) {
        if (function_exists('sfwd_lms_has_access')) {
            return sfwd_lms_has_access($course_id, $user_id);
        }
        
        // Fallback check
        if (function_exists('learndash_user_has_access')) {
            return learndash_user_has_access($user_id, $course_id);
        }
        
        return false;
    }

    /**
     * Get user course progress with fallback
     */
    private static function get_user_course_progress($user_id, $course_id) {
        if (function_exists('learndash_user_get_course_progress')) {
            return learndash_user_get_course_progress($user_id, $course_id);
        }
        
        // Fallback calculation
        if (function_exists('learndash_course_get_steps_count') && function_exists('learndash_course_get_completed_steps')) {
            $total_steps = learndash_course_get_steps_count($course_id);
            $completed_steps = count(learndash_course_get_completed_steps($user_id, $course_id));
            
            $percentage = $total_steps > 0 ? ($completed_steps / $total_steps) * 100 : 0;
            
            return array(
                'total' => $total_steps,
                'completed' => $completed_steps,
                'percentage' => round($percentage, 2)
            );
        }
        
        return array('total' => 0, 'completed' => 0, 'percentage' => 0);
    }

    /**
     * Get course completion date with fallback
     */
    private static function get_course_completion_date($user_id, $course_id) {
        if (function_exists('learndash_user_get_course_completed_date')) {
            return learndash_user_get_course_completed_date($user_id, $course_id);
        }
        
        // Fallback check
        $completed = get_user_meta($user_id, 'course_completed_' . $course_id, true);
        return $completed ? $completed : '';
    }

    /**
     * Get course certificate with fallback
     */
    private static function get_course_certificate($course_id, $user_id) {
        if (function_exists('learndash_get_course_certificate_link')) {
            return learndash_get_course_certificate_link($course_id, $user_id);
        }
        
        // Fallback check for certificate
        $cert_id = get_post_meta($course_id, 'certificate_id', true);
        if ($cert_id && self::get_course_completion_date($user_id, $course_id)) {
            return get_permalink($cert_id);
        }
        
        return false;
    }
    
    public static function get_vendor_courses($vendor_id) {
        // Get courses associated with vendor's groups or products
        // This implementation depends on how your system links vendors to courses
        
        global $wpdb;
        
        // Method 1: Get courses from vendor's WooCommerce products
        $product_courses = self::get_courses_from_vendor_products($vendor_id);
        
        // Method 2: Get courses from LearnDash groups if vendor manages groups
        $group_courses = self::get_courses_from_vendor_groups($vendor_id);
        
        // Combine and return unique courses
        $all_courses = array_merge($product_courses, $group_courses);
        return array_unique($all_courses);
    }
    
    private static function get_courses_from_vendor_products($vendor_id) {
        global $wpdb;
        
        // Get LearnDash courses that are associated with vendor's WooCommerce products
        $course_ids = $wpdb->get_col($wpdb->prepare("
            SELECT DISTINCT pm2.meta_value
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id
            INNER JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id
            WHERE p.post_type = 'product'
            AND p.post_author = %d
            AND pm1.meta_key = '_related_course'
            AND pm2.meta_key = '_related_course'
            AND pm2.meta_value != ''
        ", $vendor_id));
        
        // Alternative: Check for LearnDash WooCommerce integration
        $woo_course_ids = $wpdb->get_col($wpdb->prepare("
            SELECT DISTINCT pm2.meta_value
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id
            WHERE p.post_type = 'product'
            AND p.post_author = %d
            AND pm2.meta_key = '_learndash_woocommerce'
            AND pm2.meta_value != ''
        ", $vendor_id));
        
        return array_merge($course_ids, $woo_course_ids);
    }
    
    private static function get_courses_from_vendor_groups($vendor_id) {
        global $wpdb;
        
        // Get groups managed by vendor (if using custom meta)
        $group_ids = $wpdb->get_col($wpdb->prepare("
            SELECT p.ID
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'groups'
            AND pm.meta_key = '_group_vendor_id'
            AND pm.meta_value = %d
        ", $vendor_id));
        
        $course_ids = array();
        foreach ($group_ids as $group_id) {
            $group_courses = learndash_group_enrolled_courses($group_id);
            $course_ids = array_merge($course_ids, $group_courses);
        }
        
        return $course_ids;
    }
    
    private static function get_course_enrolled_date($user_id, $course_id) {
        $user_course_access = ld_course_access_from($course_id, $user_id);
        return isset($user_course_access['access_from']) ? $user_course_access['access_from'] : '';
    }
    
    private static function get_certificate_id($course_id, $user_id) {
        // Generate or retrieve certificate verification ID
        $certificate_meta = get_user_meta($user_id, 'course_certificate_' . $course_id, true);
        if (isset($certificate_meta['certificate_id'])) {
            return $certificate_meta['certificate_id'];
        }
        
        // Generate new certificate ID
        $cert_id = 'CERT-' . $course_id . '-' . $user_id . '-' . time();
        update_user_meta($user_id, 'course_certificate_' . $course_id, array(
            'certificate_id' => $cert_id,
            'generated_date' => current_time('mysql')
        ));
        
        return $cert_id;
    }
    
    private static function get_user_course_last_activity($user_id, $course_id) {
        global $wpdb;
        
        // Get last activity from LearnDash activity table
        $last_activity = $wpdb->get_var($wpdb->prepare("
            SELECT activity_updated
            FROM {$wpdb->prefix}learndash_user_activity
            WHERE user_id = %d
            AND course_id = %d
            ORDER BY activity_updated DESC
            LIMIT 1
        ", $user_id, $course_id));
        
        return $last_activity ? $last_activity : '';
    }
    
    /**
     * Get vendor's LearnDash groups
     *
     * @param int $vendor_id
     * @return array
     */
    public static function get_vendor_groups($vendor_id) {
        global $wpdb;
        
        // This depends on how you associate vendors with groups
        // Method 1: Custom meta field
        $group_ids = $wpdb->get_col($wpdb->prepare("
            SELECT p.ID
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'groups'
            AND pm.meta_key = '_group_vendor_id'
            AND pm.meta_value = %d
        ", $vendor_id));
        
        return $group_ids;
    }
    
    /**
     * Check if customer has access to vendor's courses
     *
     * @param int $customer_id
     * @param int $vendor_id
     * @return bool
     */
    public static function customer_has_vendor_course_access($customer_id, $vendor_id) {
        $vendor_courses = self::get_vendor_courses($vendor_id);
        
        foreach ($vendor_courses as $course_id) {
            if (sfwd_lms_has_access($course_id, $customer_id)) {
                return true;
            }
        }
        
        return false;
    }
}