import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../providers/revenuecat_provider.dart';
import '../utils/logger.dart';

/// Widget that displays RevenueCat paywall using the official UI package
class RevenueCatPaywallWidget extends ConsumerStatefulWidget {
  final VoidCallback? onPurchaseComplete;
  final VoidCallback? onDismiss;
  final String? offeringId; // Optional: specific offering to show

  const RevenueCatPaywallWidget({
    super.key,
    this.onPurchaseComplete,
    this.onDismiss,
    this.offeringId,
  });

  @override
  ConsumerState<RevenueCatPaywallWidget> createState() => _RevenueCatPaywallWidgetState();
}

class _RevenueCatPaywallWidgetState extends ConsumerState<RevenueCatPaywallWidget> {
  bool _isLoading = true;
  Offerings? _offerings;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadOfferings();
  }

  Future<void> _loadOfferings() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final revenueCatState = ref.read(revenueCatProvider);
      
      // Refresh offerings if not available
      if (revenueCatState.offerings == null) {
        await ref.read(revenueCatProvider.notifier).refreshOfferings();
      }

      final updatedState = ref.read(revenueCatProvider);
      _offerings = updatedState.offerings;

      if (_offerings == null || _offerings!.current == null) {
        setState(() {
          _error = 'No subscription packages available';
          _isLoading = false;
        });
        return;
      }

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      AppLogger.error('Failed to load offerings', error: e, tag: 'RevenueCatPaywallWidget');
      setState(() {
        _error = 'Failed to load subscription options';
        _isLoading = false;
      });
    }
  }

  Future<void> _handlePurchase(Package package) async {
    try {
      AppLogger.info('Purchasing package: ${package.identifier}', tag: 'RevenueCatPaywallWidget');
      
      await ref.read(revenueCatProvider.notifier).purchasePackage(package);
      
      // Check if purchase was successful
      final state = ref.read(revenueCatProvider);
      if (state.hasActiveSubscription) {
        AppLogger.success('Purchase successful', tag: 'RevenueCatPaywallWidget');
        if (widget.onPurchaseComplete != null) {
          widget.onPurchaseComplete!();
        }
        if (mounted) {
          Navigator.of(context).pop();
        }
      }
    } catch (e) {
      AppLogger.error('Purchase failed', error: e, tag: 'RevenueCatPaywallWidget');
      
      if (mounted) {
        // Only show error if it wasn't a cancellation
        if (e is PurchasesError && e.code != PurchasesErrorCode.purchaseCancelledError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Purchase failed: ${e.message}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Widget _buildPackageCard(Package package) {
    final storeProduct = package.storeProduct;
    final price = storeProduct.priceString;
    final title = storeProduct.title;
    final description = storeProduct.description;
    
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      child: InkWell(
        onTap: () => _handlePurchase(package),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            description,
                            style: const TextStyle(
                              fontSize: 14,
                              color: Colors.grey,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  Text(
                    price,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _handlePurchase(package),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Subscribe'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final revenueCatState = ref.watch(revenueCatProvider);

    if (_isLoading || revenueCatState.isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Subscription'),
        ),
        body: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Subscription'),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadOfferings,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final currentOffering = _offerings?.current;
    if (currentOffering == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Subscription'),
        ),
        body: const Center(
          child: Text('No subscription packages available'),
        ),
      );
    }

    // Build custom paywall UI using packages from offering
    return Scaffold(
      appBar: AppBar(
        title: const Text('Subscription'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            if (widget.onDismiss != null) {
              widget.onDismiss!();
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 20),
          const Text(
            'Unlock Premium Features',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          const Text(
            'Get access to all premium features and unlock the full potential of RocketLearn',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 40),
          // Display available packages
          ...currentOffering.availablePackages.map((package) {
            return _buildPackageCard(package);
          }),
          const SizedBox(height: 20),
          TextButton(
            onPressed: () async {
              try {
                await ref.read(revenueCatProvider.notifier).restorePurchases();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Purchases restored'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to restore: ${e.toString()}'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Restore Purchases'),
          ),
        ],
      ),
    );
  }
}

/// Helper function to show RevenueCat paywall as a modal
Future<void> showRevenueCatPaywall(
  BuildContext context, {
  VoidCallback? onPurchaseComplete,
  VoidCallback? onDismiss,
  String? offeringId,
}) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => RevenueCatPaywallWidget(
        onPurchaseComplete: onPurchaseComplete,
        onDismiss: onDismiss,
        offeringId: offeringId,
      ),
    ),
  );
}

