<?php
/**
 * Dashboard Enhanced Customers Template
 *
 * Load enhanced customers template with LearnDash integration
 *
 * @package dokan-customer-management-enhanced
 */

$vendor_id = get_current_user_id();
$customers = DCME_Security::get_vendor_customers($vendor_id);
?>

<?php do_action( 'dokan_dashboard_wrap_start' ); ?>

<div class="dokan-dashboard-wrap">

    <?php
        /**
         *  dokan_dashboard_content_before hook
         *
         *  @hooked get_dashboard_side_navigation
         *
         *  @since 2.4
         */
        do_action( 'dokan_dashboard_content_before' );
        do_action( 'dokan_customers_content_before' );
    ?>

    <div class="dokan-dashboard-content dokan-customers-content">

        <header class="dokan-dashboard-header">
            <span class="left-header-content">
                <h1 class="entry-title">
                    <?php esc_html_e( 'Customers', 'dokan-customer-management-enhanced' ); ?>
                </h1>
            </span>
            <div class="dokan-clearfix"></div>
        </header><!-- .entry-header -->

        <?php
            /**
             *  dokan_customers_content_inside_before hook
             *
             *  @since 2.4
             */
            do_action( 'dokan_customers_content_inside_before' );
        ?>

        <article class="dokan-customers-area">

            <!-- Enhanced Search and Filters Section -->
            <div class="dcme-filters-section">
                <div class="dcme-search-box">
                    <input type="text" id="dcme-customer-search" placeholder="🔍 Search customers by name, email, course, or certificate...">
                </div>
                
                <div class="dcme-filters">
                    <div class="dcme-filter-item">
                        <label>Course Status</label>
                        <select id="dcme-course-status-filter">
                            <option value=""><?php _e('All Statuses', 'dokan-customer-management-enhanced'); ?></option>
                            <option value="in-progress"><?php _e('In Progress', 'dokan-customer-management-enhanced'); ?></option>
                            <option value="completed"><?php _e('Completed', 'dokan-customer-management-enhanced'); ?></option>
                            <option value="not-started"><?php _e('Not Started', 'dokan-customer-management-enhanced'); ?></option>
                        </select>
                    </div>
                    
                    <div class="dcme-filter-item">
                        <label>Enrolled Course</label>
                        <select id="dcme-course-filter">
                            <option value=""><?php _e('All Courses', 'dokan-customer-management-enhanced'); ?></option>
                            <?php
                            $vendor_courses = DCME_LearnDash::get_vendor_courses($vendor_id);
                            foreach ($vendor_courses as $course_id) {
                                echo '<option value="' . esc_attr($course_id) . '">' . esc_html(get_the_title($course_id)) . '</option>';
                            }
                            ?>
                        </select>
                    </div>
                    
                    <div class="dcme-filter-item">
                        <label>Enrollment Date</label>
                        <input type="date" id="dcme-enrollment-date-filter">
                    </div>
                    
                    <div class="dcme-filter-item">
                        <label>Certificate Status</label>
                        <select id="dcme-certificate-filter">
                            <option value=""><?php _e('All', 'dokan-customer-management-enhanced'); ?></option>
                            <option value="has-certificates"><?php _e('Has Certificates', 'dokan-customer-management-enhanced'); ?></option>
                            <option value="no-certificates"><?php _e('No Certificates', 'dokan-customer-management-enhanced'); ?></option>
                        </select>
                    </div>
                    
                    <div class="dcme-filter-item">
                        <label>&nbsp;</label>
                        <button id="dcme-clear-filters" class="dokan-btn dokan-btn-default">
                            <?php _e('Clear Filters', 'dokan-customer-management-enhanced'); ?>
                        </button>
                    </div>
                </div>
            </div>

            <?php if ( count( $customers ) > 0 ) { ?>
                <!-- Enhanced Customer Table -->
                <div class="dcme-customers-table-wrapper">
                    <table class="dokan-table dokan-table-striped dcme-customers-table">
                        <thead>
                            <tr>
                                <th><?php _e('Customer', 'dokan-customer-management-enhanced'); ?></th>
                                <th><?php _e('Email', 'dokan-customer-management-enhanced'); ?></th>
                                <th><?php _e('Phone', 'dokan-customer-management-enhanced'); ?></th>
                                <th><?php _e('Courses', 'dokan-customer-management-enhanced'); ?></th>
                                <th><?php _e('Progress', 'dokan-customer-management-enhanced'); ?></th>
                                <th><?php _e('Certificates', 'dokan-customer-management-enhanced'); ?></th>
                                <!-- <th><?php //_e('Last Activity', 'dokan-customer-management-enhanced'); ?></th> -->
                                <th><?php _e('Actions', 'dokan-customer-management-enhanced'); ?></th>
                            </tr>
                        </thead>
                        <tbody id="dcme-customers-tbody">
                            <?php foreach ($customers as $customer): 
                                $customer_data = DCME_LearnDash::get_customer_course_data($customer->ID, $vendor_id);
                                $avg_progress = DCME_Dashboard::calculate_average_progress($customer_data['courses']);
                                $certificate_count = count($customer_data['certificates']);
                                $course_count = count($customer_data['courses']);
                                
                                // Get last activity
                                $last_activity = '';
                                if (!empty($customer_data['courses'])) {
                                    $latest_activity = '';
                                    foreach ($customer_data['courses'] as $course) {
                                        if (!empty($course['last_activity']) && $course['last_activity'] > $latest_activity) {
                                            $latest_activity = $course['last_activity'];
                                        }
                                    }
                                    $last_activity = $latest_activity ? human_time_diff(strtotime($latest_activity)) . ' ' . __('ago', 'dokan-customer-management-enhanced') : __('No activity', 'dokan-customer-management-enhanced');
                                } else {
                                    $last_activity = human_time_diff(strtotime($customer->user_registered)) . ' ' . __('ago', 'dokan-customer-management-enhanced');
                                }
                            ?>
                            <tr data-customer-id="<?php echo esc_attr($customer->ID); ?>">
                                <td>
                                    <a href="#" class="dcme-customer-name" data-customer-id="<?php echo esc_attr($customer->ID); ?>">
                                        <?php echo esc_html($customer->display_name); ?>
                                    </a>
                                </td>
                                <td>
                                    <a href="mailto:<?php echo esc_attr($customer->user_email); ?>">
                                        <?php echo esc_html($customer->user_email); ?>
                                    </a>
                                </td>
                                <td><?php echo esc_html(get_user_meta($customer->ID, 'billing_phone', true)); ?></td>
                                <td><?php echo $course_count; ?> <?php _e('enrolled', 'dokan-customer-management-enhanced'); ?></td>
                                <td>
                                    <div class="dcme-progress-mini">
                                        <div class="dcme-progress-bar" style="width: <?php echo esc_attr($avg_progress); ?>%"></div>
                                    </div>
                                    <?php echo round($avg_progress); ?>%
                                </td>
                                <td><?php echo $certificate_count; ?> <?php _e('earned', 'dokan-customer-management-enhanced'); ?></td>
                                <!-- <td><?php //echo esc_html($last_activity); ?></td> -->
                                <td>
                                    <button class="dokan-btn dokan-btn-sm dcme-view-details" data-customer-id="<?php echo esc_attr($customer->ID); ?>">
                                        <?php _e('View Details', 'dokan-customer-management-enhanced'); ?>
                                    </button>
                                    
                                    <!-- Legacy view orders link -->
                                    <a class="dokan-btn dokan-btn-default dokan-btn-sm" href="<?php echo esc_url(DCME_Dashboard::get_navigation_url('orders') . '?customer_id=' . $customer->ID . '&seller_order_filter_nonce=' . wp_create_nonce('seller-order-filter-nonce')); ?>" title="<?php _e('View Orders', 'dokan-customer-management-enhanced'); ?>">
                                        <i class="far fa-eye"></i>
                                    </a>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <?php
                // Pagination (keeping original pagination logic)
                $user_count = count($customers);
                $paged = isset($_GET['pagenum']) ? absint($_GET['pagenum']) : 1;
                $limit = 10;
                $num_of_pages = ceil($user_count / $limit);
                $base_url = DCME_Dashboard::get_navigation_url('customers');

                if ($num_of_pages > 1) {
                    echo '<div class="pagination-wrap">';
                    $page_links = paginate_links(array(
                        'current'   => $paged,
                        'total'     => $num_of_pages,
                        'base'      => $base_url . '%_%',
                        'format'    => '?pagenum=%#%',
                        'add_args'  => false,
                        'type'      => 'array',
                    ));

                    echo "<ul class='pagination'>\n\t<li>";
                    echo join("</li>\n\t<li>", $page_links);
                    echo "</li>\n</ul>\n";
                    echo '</div>';
                }
                ?>

            <?php } else { ?>
                <div class="dokan-error">
                    <?php esc_html_e('No customers found', 'dokan-customer-management-enhanced'); ?>
                </div>
            <?php } ?>

        </article>

        <?php
            /**
             *  dokan_customers_content_inside_after hook
             *
             *  @since 2.4
             */
            do_action( 'dokan_customers_content_inside_after' );
        ?>

    </div> <!-- #primary .content-area -->

    <?php
        /**
         *  dokan_dashboard_content_after hook
         *  dokan_customers_content_after hook
         *
         *  @since 2.4
         */
        do_action( 'dokan_dashboard_content_after' );
        do_action( 'dokan_customers_content_after' );
    ?>

</div><!-- .dokan-dashboard-wrap -->

<!-- Customer Details Modal -->
<div id="dcme-customer-modal" class="dcme-modal">
    <div class="dcme-modal-content">
        <div class="dcme-modal-header">
            <h2 id="dcme-modal-title"><?php _e('Customer Details', 'dokan-customer-management-enhanced'); ?></h2>
            <span class="dcme-modal-close">&times;</span>
        </div>
        
        <div class="dcme-modal-tabs">
            <div class="dcme-tab dcme-tab-active" data-tab="basic-info"><?php _e('Basic Info', 'dokan-customer-management-enhanced'); ?></div>
            <div class="dcme-tab" data-tab="courses"><?php _e('Course Progress', 'dokan-customer-management-enhanced'); ?></div>
            <div class="dcme-tab" data-tab="certificates"><?php _e('Certificates', 'dokan-customer-management-enhanced'); ?></div>
            <div class="dcme-tab" data-tab="orders"><?php _e('Purchase History', 'dokan-customer-management-enhanced'); ?></div>
        </div>
        
        <div class="dcme-modal-body">
            <div id="dcme-tab-content">
                <!-- Content loaded via AJAX -->
            </div>
        </div>
    </div>
</div>

<?php do_action( 'dokan_dashboard_wrap_end' ); ?>