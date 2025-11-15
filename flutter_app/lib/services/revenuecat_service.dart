import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'dart:io' show Platform;
import '../utils/logger.dart';

/// Service for managing RevenueCat subscriptions and purchases
class RevenueCatService {
  static final RevenueCatService _instance = RevenueCatService._internal();
  factory RevenueCatService() => _instance;
  RevenueCatService._internal();

  static const String _apiKey = 'appl_OWAqYvjjtNklHIlrXiONlngrlgx';
  bool _initialized = false;
  CustomerInfo? _customerInfo;
  
  // Debug: Track initialization steps
  final List<String> _initSteps = [];
  
  /// Get current customer info (cached)
  CustomerInfo? get customerInfo => _customerInfo;
  
  /// Check if user has active subscription
  bool get hasActiveSubscription {
    return _customerInfo?.entitlements.active.isNotEmpty ?? false;
  }
  
  /// Get active entitlements
  Map<String, EntitlementInfo> get activeEntitlements {
    return _customerInfo?.entitlements.active ?? {};
  }

  /// Initialize RevenueCat SDK
  Future<void> initialize({String? userId}) async {
    final startTime = DateTime.now();
    _initSteps.clear();
    
    if (_initialized) {
      AppLogger.info('RevenueCat already initialized', tag: 'RevenueCatService');
      return;
    }

    try {
      _addInitStep('🚀 Starting RevenueCat initialization');
      AppLogger.info('🔍 [RevenueCat Debug] Starting initialization...', tag: 'RevenueCatService');
      AppLogger.debug('Platform: ${Platform.operatingSystem}', tag: 'RevenueCatService');
      AppLogger.debug('API Key: $_apiKey', tag: 'RevenueCatService');
      AppLogger.debug('User ID provided: ${userId != null}', tag: 'RevenueCatService');
      
      // Step 1: Check if Purchases class is available
      _addInitStep('Step 1: Checking Purchases class availability');
      AppLogger.debug('🔍 [RevenueCat Debug] Checking Purchases class...', tag: 'RevenueCatService');
      try {
        // Try to verify the class is loaded by checking its type
        final purchasesType = Purchases;
        AppLogger.debug('✅ [RevenueCat Debug] Purchases class found: ${purchasesType.toString()}', tag: 'RevenueCatService');
      } catch (e) {
        AppLogger.error('❌ [RevenueCat Debug] Purchases class not available', error: e, tag: 'RevenueCatService');
        throw Exception('Purchases class not available: $e');
      }
      
      // Step 2: Create configuration
      _addInitStep('Step 2: Creating PurchasesConfiguration');
      AppLogger.debug('🔍 [RevenueCat Debug] Creating configuration with API key...', tag: 'RevenueCatService');
      PurchasesConfiguration configuration;
      try {
        configuration = PurchasesConfiguration(_apiKey);
        AppLogger.debug('✅ [RevenueCat Debug] Configuration created successfully', tag: 'RevenueCatService');
        _addInitStep('Configuration created');
      } catch (e, stackTrace) {
        AppLogger.error('❌ [RevenueCat Debug] Failed to create configuration', error: e, stackTrace: stackTrace, tag: 'RevenueCatService');
        _addInitStep('❌ Configuration creation failed: $e');
        rethrow;
      }
      
      // Step 3: Set user ID if provided
      if (userId != null) {
        _addInitStep('Step 3: Setting user ID');
        AppLogger.debug('🔍 [RevenueCat Debug] Setting user ID: $userId', tag: 'RevenueCatService');
        try {
          configuration.appUserID = userId;
          AppLogger.debug('✅ [RevenueCat Debug] User ID set', tag: 'RevenueCatService');
          _addInitStep('User ID set');
        } catch (e) {
          AppLogger.warning('⚠️ [RevenueCat Debug] Failed to set user ID', error: e, tag: 'RevenueCatService');
          _addInitStep('⚠️ User ID setting failed: $e');
        }
      }
      
      // Step 4: Configure Purchases
      _addInitStep('Step 4: Calling Purchases.configure()');
      AppLogger.debug('🔍 [RevenueCat Debug] Calling Purchases.configure()...', tag: 'RevenueCatService');
      AppLogger.debug('🔍 [RevenueCat Debug] Configuration details: appUserID=${configuration.appUserID}, apiKey=${_apiKey.substring(0, 8)}...', tag: 'RevenueCatService');
      
      try {
        await Purchases.configure(configuration);
        final configureTime = DateTime.now().difference(startTime).inMilliseconds;
        AppLogger.debug('✅ [RevenueCat Debug] Purchases.configure() completed in ${configureTime}ms', tag: 'RevenueCatService');
        _addInitStep('✅ Purchases.configure() completed');
      } catch (e, stackTrace) {
        AppLogger.error('❌ [RevenueCat Debug] Purchases.configure() failed', error: e, stackTrace: stackTrace, tag: 'RevenueCatService');
        AppLogger.error('❌ [RevenueCat Debug] Error type: ${e.runtimeType}', tag: 'RevenueCatService');
        AppLogger.error('❌ [RevenueCat Debug] Error message: ${e.toString()}', tag: 'RevenueCatService');
        _addInitStep('❌ Purchases.configure() failed: $e');
        rethrow;
      }
      
      // Step 5: Set log level
      _addInitStep('Step 5: Setting log level');
      AppLogger.debug('🔍 [RevenueCat Debug] Setting log level...', tag: 'RevenueCatService');
      try {
        if (kDebugMode) {
          await Purchases.setLogLevel(LogLevel.debug);
          AppLogger.debug('✅ [RevenueCat Debug] Log level set to debug', tag: 'RevenueCatService');
          _addInitStep('Log level set to debug');
        }
      } catch (e) {
        AppLogger.warning('⚠️ [RevenueCat Debug] Failed to set log level', error: e, tag: 'RevenueCatService');
        _addInitStep('⚠️ Log level setting failed: $e');
        // Don't fail initialization if log level fails
      }
      
      // Step 6: Mark as initialized
      _initialized = true;
      final initTime = DateTime.now().difference(startTime).inMilliseconds;
      AppLogger.success('✅ [RevenueCat Debug] RevenueCat initialized successfully in ${initTime}ms', tag: 'RevenueCatService');
      AppLogger.info('📋 [RevenueCat Debug] Initialization steps:', tag: 'RevenueCatService');
      for (var step in _initSteps) {
        AppLogger.info('  - $step', tag: 'RevenueCatService');
      }
      _addInitStep('✅ Initialization complete');
      
      // Step 7: Load initial customer info
      _addInitStep('Step 7: Loading initial customer info');
      AppLogger.debug('🔍 [RevenueCat Debug] Loading initial customer info...', tag: 'RevenueCatService');
      try {
        await refreshCustomerInfo();
        AppLogger.debug('✅ [RevenueCat Debug] Initial customer info loaded', tag: 'RevenueCatService');
        _addInitStep('✅ Customer info loaded');
      } catch (e) {
        AppLogger.warning('⚠️ [RevenueCat Debug] Failed to load initial customer info', error: e, tag: 'RevenueCatService');
        _addInitStep('⚠️ Customer info loading failed: $e');
        
        // Check if it's an API key error
        if (e is PlatformException && e.code == '11') {
          AppLogger.error('❌ [RevenueCat Debug] Invalid API Key detected!', tag: 'RevenueCatService');
          AppLogger.error('❌ [RevenueCat Debug] Current API Key: $_apiKey', tag: 'RevenueCatService');
          AppLogger.error('❌ [RevenueCat Debug] For iOS, API keys should start with "appl_"', tag: 'RevenueCatService');
          AppLogger.error('❌ [RevenueCat Debug] Get your API key from: https://app.revenuecat.com/projects/YOUR_PROJECT_ID/settings', tag: 'RevenueCatService');
        }
        // Don't fail initialization if customer info fails - app can still work
      }
      
      final totalTime = DateTime.now().difference(startTime).inMilliseconds;
      AppLogger.success('🎉 [RevenueCat Debug] Full initialization completed in ${totalTime}ms', tag: 'RevenueCatService');
      
    } catch (e, stackTrace) {
      final totalTime = DateTime.now().difference(startTime).inMilliseconds;
      AppLogger.error('❌ [RevenueCat Debug] Failed to initialize RevenueCat after ${totalTime}ms', error: e, stackTrace: stackTrace, tag: 'RevenueCatService');
      AppLogger.error('❌ [RevenueCat Debug] Error type: ${e.runtimeType}', tag: 'RevenueCatService');
      AppLogger.error('❌ [RevenueCat Debug] Error toString: ${e.toString()}', tag: 'RevenueCatService');
      
      if (e is PlatformException || e.toString().contains('MissingPluginException') || e.toString().contains('setupPurchases')) {
        AppLogger.error('❌ [RevenueCat Debug] MissingPluginException detected!', tag: 'RevenueCatService');
        AppLogger.error('❌ [RevenueCat Debug] This usually means:', tag: 'RevenueCatService');
        AppLogger.error('  1. The app needs a full rebuild (not hot reload)', tag: 'RevenueCatService');
        AppLogger.error('  2. Pod install needs to be run for iOS', tag: 'RevenueCatService');
        AppLogger.error('  3. The native plugin code is not linked', tag: 'RevenueCatService');
        AppLogger.error('❌ [RevenueCat Debug] Platform: ${Platform.operatingSystem}', tag: 'RevenueCatService');
        AppLogger.error('❌ [RevenueCat Debug] Error message: ${e.toString()}', tag: 'RevenueCatService');
      }
      
      AppLogger.info('📋 [RevenueCat Debug] Failed initialization steps:', tag: 'RevenueCatService');
      for (var step in _initSteps) {
        AppLogger.info('  - $step', tag: 'RevenueCatService');
      }
      
      _initialized = false;
      rethrow;
    }
  }
  
  void _addInitStep(String step) {
    _initSteps.add('${DateTime.now().millisecondsSinceEpoch}: $step');
  }

  /// Set user ID for RevenueCat (call after user logs in)
  /// This will link any anonymous purchases to the user ID
  Future<void> setUserId(String userId) async {
    try {
      AppLogger.info('Setting RevenueCat user ID: $userId', tag: 'RevenueCatService');
      AppLogger.debug('Logging in to RevenueCat with user ID...', tag: 'RevenueCatService');
      
      // LogIn will link any anonymous purchases to this user ID
      final loginResult = await Purchases.logIn(userId);
      _customerInfo = loginResult.customerInfo;
      
      AppLogger.success('RevenueCat user ID set successfully', tag: 'RevenueCatService');
      AppLogger.debug('Active entitlements after login: ${loginResult.customerInfo.entitlements.active.keys.toList()}', tag: 'RevenueCatService');
      AppLogger.debug('Original app user ID: ${loginResult.customerInfo.originalAppUserId}', tag: 'RevenueCatService');
      AppLogger.debug('Created: ${loginResult.created}', tag: 'RevenueCatService');
      
      // Refresh to get latest info
      await refreshCustomerInfo();
    } catch (e) {
      AppLogger.error('Failed to set RevenueCat user ID', error: e, tag: 'RevenueCatService');
      rethrow;
    }
  }

  /// Log out current user (call when user logs out)
  Future<void> logOut() async {
    try {
      AppLogger.info('Logging out RevenueCat user', tag: 'RevenueCatService');
      final customerInfo = await Purchases.logOut();
      _customerInfo = customerInfo;
      AppLogger.success('RevenueCat user logged out', tag: 'RevenueCatService');
    } catch (e) {
      AppLogger.error('Failed to log out RevenueCat user', error: e, tag: 'RevenueCatService');
      rethrow;
    }
  }

  /// Refresh customer info from RevenueCat servers
  Future<CustomerInfo> refreshCustomerInfo() async {
    try {
      AppLogger.debug('Refreshing customer info...', tag: 'RevenueCatService');
      final customerInfo = await Purchases.getCustomerInfo();
      _customerInfo = customerInfo;
      
      AppLogger.info('Customer info refreshed', tag: 'RevenueCatService');
      AppLogger.debug('Active entitlements: ${customerInfo.entitlements.active.keys.toList()}', tag: 'RevenueCatService');
      
      return customerInfo;
    } catch (e) {
      AppLogger.error('Failed to refresh customer info', error: e, tag: 'RevenueCatService');
      rethrow;
    }
  }

  /// Get available offerings (packages/products)
  Future<Offerings> getOfferings() async {
    try {
      AppLogger.debug('Fetching offerings...', tag: 'RevenueCatService');
      final offerings = await Purchases.getOfferings();
      
      if (offerings.current != null) {
        AppLogger.info('Current offering: ${offerings.current!.identifier}', tag: 'RevenueCatService');
        AppLogger.debug('Available packages: ${offerings.current!.availablePackages.map((p) => p.identifier).toList()}', tag: 'RevenueCatService');
      } else {
        AppLogger.warning('No current offering found', tag: 'RevenueCatService');
      }
      
      return offerings;
    } catch (e) {
      AppLogger.error('Failed to get offerings', error: e, tag: 'RevenueCatService');
      rethrow;
    }
  }

  /// Purchase a package
  Future<CustomerInfo> purchasePackage(Package package) async {
    try {
      AppLogger.info('Purchasing package: ${package.identifier}', tag: 'RevenueCatService');
      
      final customerInfo = await Purchases.purchasePackage(package);
      _customerInfo = customerInfo;
      
      AppLogger.success('Purchase successful', tag: 'RevenueCatService');
      AppLogger.debug('Active entitlements after purchase: ${customerInfo.entitlements.active.keys.toList()}', tag: 'RevenueCatService');
      
      return customerInfo;
    } on PurchasesError catch (e) {
      AppLogger.error('Purchase failed', error: e, tag: 'RevenueCatService');
      
      // Handle specific error cases
      if (e.code == PurchasesErrorCode.purchaseCancelledError) {
        AppLogger.info('Purchase was cancelled by user', tag: 'RevenueCatService');
      } else if (e.code == PurchasesErrorCode.productNotAvailableForPurchaseError) {
        AppLogger.warning('Product not available in store', tag: 'RevenueCatService');
      } else if (e.code == PurchasesErrorCode.purchaseNotAllowedError) {
        AppLogger.warning('Purchase not allowed', tag: 'RevenueCatService');
      } else if (e.code == PurchasesErrorCode.purchaseInvalidError) {
        AppLogger.warning('Purchase invalid', tag: 'RevenueCatService');
      }
      
      rethrow;
    } catch (e) {
      AppLogger.error('Unexpected error during purchase', error: e, tag: 'RevenueCatService');
      rethrow;
    }
  }

  /// Restore purchases (for users who already purchased)
  /// This will sync purchases from the App Store/Play Store
  Future<CustomerInfo> restorePurchases() async {
    try {
      AppLogger.info('Restoring purchases...', tag: 'RevenueCatService');
      AppLogger.debug('This will sync purchases from App Store/Play Store', tag: 'RevenueCatService');
      
      final customerInfo = await Purchases.restorePurchases();
      _customerInfo = customerInfo;
      
      AppLogger.success('Purchases restored', tag: 'RevenueCatService');
      AppLogger.debug('Active entitlements: ${customerInfo.entitlements.active.keys.toList()}', tag: 'RevenueCatService');
      AppLogger.debug('Original app user ID: ${customerInfo.originalAppUserId}', tag: 'RevenueCatService');
      AppLogger.debug('First seen: ${customerInfo.firstSeen}', tag: 'RevenueCatService');
      
      // Log all entitlements for debugging
      if (customerInfo.entitlements.all.isNotEmpty) {
        AppLogger.debug('All entitlements:', tag: 'RevenueCatService');
        customerInfo.entitlements.all.forEach((key, entitlement) {
          AppLogger.debug('  - $key: active=${entitlement.isActive}, productId=${entitlement.productIdentifier}', tag: 'RevenueCatService');
        });
      } else {
        AppLogger.warning('No entitlements found after restore', tag: 'RevenueCatService');
      }
      
      return customerInfo;
    } catch (e) {
      AppLogger.error('Failed to restore purchases', error: e, tag: 'RevenueCatService');
      rethrow;
    }
  }

  /// Check if user has specific entitlement
  bool hasEntitlement(String entitlementId) {
    return _customerInfo?.entitlements.active.containsKey(entitlementId) ?? false;
  }

  /// Get entitlement info
  EntitlementInfo? getEntitlement(String entitlementId) {
    return _customerInfo?.entitlements.active[entitlementId];
  }

  /// Listen to customer info updates
  void listenToCustomerInfoUpdates(Function(CustomerInfo) onUpdate) {
    Purchases.addCustomerInfoUpdateListener((customerInfo) {
      _customerInfo = customerInfo;
      onUpdate(customerInfo);
    });
  }
}

