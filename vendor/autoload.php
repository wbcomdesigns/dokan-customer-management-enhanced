<?php
/**
 * Simple autoloader for DCME Enhanced plugin
 * This is a basic autoloader that follows PSR-4 standards
 */

spl_autoload_register(function ($class) {
    // Only autoload classes from our namespace
    $prefix = 'WbcomDesigns\\DokanCustomersEnhanced\\';
    $base_dir = __DIR__ . '/../includes/';
    
    // Check if the class uses the namespace prefix
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    // Get the relative class name
    $relative_class = substr($class, $len);
    
    // Replace namespace separators with directory separators
    // and append with .php
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    
    // If the file exists, require it
    if (file_exists($file)) {
        require $file;
    }
});