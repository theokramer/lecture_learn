import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../services/revenuecat_service.dart';
import '../utils/logger.dart';

/// State class for RevenueCat subscription status
class RevenueCatState {
  final bool isLoading;
  final bool hasActiveSubscription;
  final CustomerInfo? customerInfo;
  final Offerings? offerings;
  final String? error;
  final Map<String, EntitlementInfo> activeEntitlements;

  RevenueCatState({
    this.isLoading = false,
    this.hasActiveSubscription = false,
    this.customerInfo,
    this.offerings,
    this.error,
    Map<String, EntitlementInfo>? activeEntitlements,
  }) : activeEntitlements = activeEntitlements ?? {};

  RevenueCatState copyWith({
    bool? isLoading,
    bool? hasActiveSubscription,
    CustomerInfo? customerInfo,
    Offerings? offerings,
    String? error,
    Map<String, EntitlementInfo>? activeEntitlements,
  }) {
    return RevenueCatState(
      isLoading: isLoading ?? this.isLoading,
      hasActiveSubscription: hasActiveSubscription ?? this.hasActiveSubscription,
      customerInfo: customerInfo ?? this.customerInfo,
      offerings: offerings ?? this.offerings,
      error: error ?? this.error,
      activeEntitlements: activeEntitlements ?? this.activeEntitlements,
    );
  }
}

/// Provider for RevenueCat state management
class RevenueCatNotifier extends Notifier<RevenueCatState> {
  final _revenueCat = RevenueCatService();

  @override
  RevenueCatState build() {
    // Set up listener for customer info updates
    _revenueCat.listenToCustomerInfoUpdates((customerInfo) {
      _updateStateFromCustomerInfo(customerInfo);
    });

    // Load initial state
    _loadInitialState();

    return RevenueCatState();
  }

  Future<void> _loadInitialState() async {
    try {
      state = state.copyWith(isLoading: true);
      
      // Refresh customer info
      final customerInfo = await _revenueCat.refreshCustomerInfo();
      _updateStateFromCustomerInfo(customerInfo);
      
      // Load offerings
      final offerings = await _revenueCat.getOfferings();
      state = state.copyWith(offerings: offerings, isLoading: false);
    } catch (e) {
      AppLogger.error('Failed to load RevenueCat state', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
    }
  }

  void _updateStateFromCustomerInfo(CustomerInfo customerInfo) {
    final hasActive = customerInfo.entitlements.active.isNotEmpty;
    state = state.copyWith(
      customerInfo: customerInfo,
      hasActiveSubscription: hasActive,
      activeEntitlements: customerInfo.entitlements.active,
    );
  }

  /// Refresh customer info
  Future<void> refreshCustomerInfo() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final customerInfo = await _revenueCat.refreshCustomerInfo();
      _updateStateFromCustomerInfo(customerInfo);
      state = state.copyWith(isLoading: false);
    } catch (e) {
      AppLogger.error('Failed to refresh customer info', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
    }
  }

  /// Refresh offerings
  Future<void> refreshOfferings() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final offerings = await _revenueCat.getOfferings();
      state = state.copyWith(offerings: offerings, isLoading: false);
    } catch (e) {
      AppLogger.error('Failed to refresh offerings', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
    }
  }

  /// Purchase a package
  Future<CustomerInfo> purchasePackage(Package package) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      
      final customerInfo = await _revenueCat.purchasePackage(package);
      _updateStateFromCustomerInfo(customerInfo);
      
      state = state.copyWith(isLoading: false);
      return customerInfo;
    } on PurchasesError catch (e) {
      final errorMessage = _getPurchaseErrorMessage(e);
      AppLogger.error('Purchase failed', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: errorMessage,
        isLoading: false,
      );
      rethrow;
    } catch (e) {
      AppLogger.error('Unexpected error during purchase', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
      rethrow;
    }
  }

  /// Restore purchases
  Future<void> restorePurchases() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      
      final customerInfo = await _revenueCat.restorePurchases();
      _updateStateFromCustomerInfo(customerInfo);
      
      state = state.copyWith(isLoading: false);
    } catch (e) {
      AppLogger.error('Failed to restore purchases', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
      rethrow;
    }
  }

  /// Set user ID (call after login)
  Future<void> setUserId(String userId) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      await _revenueCat.setUserId(userId);
      await refreshCustomerInfo();
    } catch (e) {
      AppLogger.error('Failed to set user ID', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
    }
  }

  /// Log out (call when user logs out)
  Future<void> logOut() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      await _revenueCat.logOut();
      state = state.copyWith(
        isLoading: false,
        hasActiveSubscription: false,
        customerInfo: null,
        activeEntitlements: {},
      );
    } catch (e) {
      AppLogger.error('Failed to log out', error: e, tag: 'RevenueCatProvider');
      state = state.copyWith(
        error: e.toString(),
        isLoading: false,
      );
    }
  }

  String _getPurchaseErrorMessage(PurchasesError error) {
    switch (error.code) {
      case PurchasesErrorCode.purchaseCancelledError:
        return 'Purchase was cancelled';
      case PurchasesErrorCode.productNotAvailableForPurchaseError:
        return 'Product not available';
      case PurchasesErrorCode.purchaseNotAllowedError:
        return 'Purchase not allowed';
      case PurchasesErrorCode.purchaseInvalidError:
        return 'Purchase invalid';
      case PurchasesErrorCode.networkError:
        return 'Network error. Please check your connection.';
      case PurchasesErrorCode.receiptAlreadyInUseError:
        return 'Receipt already in use';
      default:
        return error.message;
    }
  }
}

/// Provider instance
final revenueCatProvider = NotifierProvider<RevenueCatNotifier, RevenueCatState>(() {
  return RevenueCatNotifier();
});

